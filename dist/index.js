"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const chrono = __importStar(require("chrono-node")); // <-- fixed import
// add near top with other imports
const os_1 = __importDefault(require("os"));
dayjs_1.default.extend(utc_1.default);
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
const tasks = {};
const TELEX_SECRET = process.env.TELEX_SECRET || "";
function verifySignature(req) {
    if (!TELEX_SECRET)
        return true;
    const sig = (req.headers["x-telex-signature"] || "");
    if (!sig)
        return false;
    const body = JSON.stringify(req.body);
    const hmac = crypto_1.default.createHmac("sha256", TELEX_SECRET).update(body).digest("hex");
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig));
    }
    catch {
        return false;
    }
}
function extractTaskInfo(text) {
    const lower = text.trim();
    const remindRegex = /remind (?:me|<@[\w-]+>) to (.+)/i;
    const addRegex = /(?:add|create|new) (?:task|reminder)[:\s-]+(.+)/i;
    const remind = lower.match(remindRegex);
    if (remind)
        return { title: remind[1] };
    const add = lower.match(addRegex);
    if (add)
        return { title: add[1] };
    return { title: text };
}
function parseDueWithChrono(text, refDate) {
    if (!text)
        return undefined;
    // chrono.parseDate is available when imported as namespace
    const date = chrono.parseDate(text, refDate || new Date(), { forwardDate: true });
    if (!date)
        return undefined;
    return (0, dayjs_1.default)(date).utc().toISOString();
}
app.post("/api/a2a/taskAgent", async (req, res) => {
    try {
        if (!verifySignature(req))
            return res.status(401).json({ error: "invalid signature" });
        const event = req.body;
        const { type, channelId, userId, text } = event;
        if (!type || type !== "message")
            return res.json({ ok: true });
        if (!channelId || !text)
            return res.status(400).json({ error: "missing channelId/text" });
        const lower = text.toLowerCase().trim();
        if (lower.startsWith("/tasks")) {
            if (lower.includes("summary") || lower.includes("list")) {
                const list = Object.values(tasks).filter(t => t.channelId === channelId && !t.done);
                const body = list.length === 0
                    ? "No active tasks in this channel."
                    : `Active tasks (${list.length}):\n` +
                        list
                            .map(t => `• [${t.id.substring(0, 8)}] ${t.title}${t.due ? ` — due ${(0, dayjs_1.default)(t.due).utc().format("YYYY-MM-DD HH:mm [UTC]")}` : ""}${t.assignee ? ` — assignee: ${t.assignee}` : ""}`)
                            .join("\n");
                return res.json({
                    action: "send_message",
                    payload: { channelId, text: body }
                });
            }
        }
        const info = extractTaskInfo(text);
        const due = parseDueWithChrono(text);
        const taskId = (0, uuid_1.v4)();
        const task = {
            id: taskId,
            channelId,
            creatorId: userId,
            title: info.title || text,
            due,
            createdAt: (0, dayjs_1.default)().utc().toISOString()
        };
        tasks[taskId] = task;
        const dueText = due ? ` — due ${(0, dayjs_1.default)(due).utc().format("YYYY-MM-DD HH:mm [UTC]")}` : "";
        return res.json({
            action: "send_message_with_actions",
            payload: {
                channelId,
                text: `✅ Task created: "${task.title}"${dueText}`,
                actions: [
                    { type: "button", text: "Mark Done", action: "mark_done", taskId },
                    { type: "button", text: "Assign", action: "assign", taskId }
                ]
            }
        });
    }
    catch (err) {
        console.error("agent error", err);
        return res.status(500).json({ error: "internal error" });
    }
});
app.post("/api/a2a/taskAgent/action", (req, res) => {
    try {
        if (!verifySignature(req))
            return res.status(401).json({ error: "invalid signature" });
        const { action, taskId, performedBy, channelId, payload } = req.body;
        const t = tasks[taskId];
        if (!t)
            return res.status(404).json({ error: "task not found" });
        if (action === "mark_done") {
            t.done = true;
            return res.json({
                action: "send_message",
                payload: { channelId, text: `✅ Task [${t.id.substring(0, 8)}] marked as done by <@${performedBy}>.` }
            });
        }
        if (action === "assign") {
            const assignee = payload?.assignee || performedBy;
            t.assignee = assignee;
            return res.json({
                action: "send_message",
                payload: { channelId, text: `👥 Task [${t.id.substring(0, 8)}] assigned to <@${assignee}>.` }
            });
        }
        return res.status(400).json({ error: "unknown action" });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: "internal" });
    }
});
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/tasks", (_req, res) => res.json(Object.values(tasks)));
const port = Number(process.env.PORT || 4000);
// then add this route (paste before app.listen)
app.get("/.well-known/telex.json", (_req, res) => {
    const base = process.env.BASE_URL || "https://syble-contradictive-rhonda.ngrok-free.dev";
    // Minimal discovery object Telex can use. Adjust fields if you want.
    const payload = {
        name: "taskkeeper",
        version: "0.1.0",
        type: "a2a",
        description: "TaskKeeper A2A agent for Telex",
        host: base,
        endpoints: {
            a2a: `${base}/api/a2a/taskAgent`,
            action: `${base}/api/a2a/taskAgent/action`,
            health: `${base}/health`
        },
        platform: {
            os: os_1.default.platform(),
            node: process.version
        }
    };
    res.json(payload);
});
app.listen(port, () => console.log(`TaskKeeper agent listening on ${port}`));
