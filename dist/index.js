"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const agent_1 = require("./agent");
const storage_1 = require("./storage");
const crypto_1 = __importDefault(require("crypto"));
const agent = new agent_1.AgentHarness();
agent.onMessage(async (evt) => {
    const text = evt.text ?? "";
    let reminders = await (0, storage_1.loadReminders)();
    // ---- CREATE REMINDER ----
    if (text.toLowerCase().startsWith("remind me")) {
        const reminderText = text.replace(/^remind me /i, "").trim();
        const timeIso = new Date().toISOString();
        const reminder = {
            id: crypto_1.default.randomUUID(),
            text: reminderText,
            time: timeIso,
            channelId: evt.channelId ?? "unknown",
            done: false
        };
        reminders.push(reminder);
        await (0, storage_1.saveReminders)(reminders);
        return {
            results: {
                reply: `✅ Got it! I'll remind you: "${reminderText}" at ${new Date(timeIso).toLocaleString()}`
            }
        };
    }
    // ---- SUMMARY ----
    if (text === "/summary") {
        reminders = await (0, storage_1.loadReminders)();
        if (reminders.length === 0) {
            return { results: { reply: "📄 You have no reminders yet." } };
        }
        const list = reminders
            .map((r, i) => `${i + 1}. ${r.text} (at ${new Date(r.time).toLocaleString()})`)
            .join("\n");
        return { results: { reply: `📄 Your reminders:\n${list}` } };
    }
    // fallback
    return { results: { reply: `✅ TaskKeeper Agent received: ${text}` } };
});
