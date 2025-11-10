"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentHarness = void 0;
// src/agent.ts
const readline_1 = __importDefault(require("readline"));
class AgentHarness {
    constructor() {
        this.handlers = {};
        // line-based stdin reader
        this.rl = readline_1.default.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
        this.rl.on("line", (line) => {
            if (!line || !line.trim())
                return;
            let parsed = null;
            try {
                parsed = JSON.parse(line);
            }
            catch (err) {
                this.send({ error: "invalid_json" });
                return;
            }
            if (!parsed)
                return;
            void this.handle(parsed);
        });
        process.stdin.on("end", () => {
            // stdin closed
        });
        // tell grader/tools we're ready
        this.send({ results: { status: "agent_ready" } });
    }
    onMessage(fn) {
        this.handlers.onMessage = fn;
    }
    onAction(fn) {
        this.handlers.onAction = fn;
    }
    async handle(evt) {
        try {
            if (evt.type === "message" && this.handlers.onMessage) {
                const r = await this.handlers.onMessage(evt);
                if (r)
                    this.send(r, evt.requestId);
            }
            else if (evt.type === "action" && this.handlers.onAction) {
                const r = await this.handlers.onAction(evt);
                if (r)
                    this.send(r, evt.requestId);
            }
            else {
                // unknown event type
                this.send({ results: { status: "ignored", type: evt.type || null }, requestId: evt.requestId });
            }
        }
        catch (err) {
            console.error("agent_handler_error", err?.stack ?? err);
            this.send({ error: "handler_error", results: { message: String(err?.message ?? err) }, requestId: evt.requestId });
        }
    }
    send(obj, requestId) {
        try {
            if (requestId && !obj.requestId)
                obj.requestId = requestId;
            const str = JSON.stringify(obj);
            process.stdout.write(str + "\n");
        }
        catch (err) {
            console.error("send_error", err);
        }
    }
}
exports.AgentHarness = AgentHarness;
