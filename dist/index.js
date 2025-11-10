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
Object.defineProperty(exports, "__esModule", { value: true });
const agent_1 = require("./agent");
const chrono = __importStar(require("chrono-node"));
const agent = new agent_1.AgentHarness();
let reminders = [];
agent.onMessage(async (evt) => {
    const text = evt.text ?? "";
    // Set a reminder
    if (text.toLowerCase().startsWith("remind me")) {
        const reminderText = text.replace(/^remind me /i, "").trim();
        const parsedDate = chrono.parseDate(reminderText);
        const reminderTime = parsedDate ?? new Date(); // fallback to now if parse fails
        reminders.push({ text: reminderText, time: reminderTime });
        return {
            results: {
                reply: `✅ Got it! I'll remind you: "${reminderText}" at ${reminderTime.toLocaleString()}.`,
            },
        };
    }
    // List all reminders
    if (text === "/summary") {
        if (reminders.length === 0) {
            return { results: { reply: "📄 You have no reminders yet." } };
        }
        const list = reminders
            .map((r, i) => `${i + 1}. ${r.text} (at ${r.time.toLocaleString()})`)
            .join("\n");
        return { results: { reply: `📄 Your reminders:\n${list}` } };
    }
    return { results: { reply: `✅ TaskKeeper Agent received: ${text}` } };
});
