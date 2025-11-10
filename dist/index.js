"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const agent_1 = require("./agent");
const storage_1 = require("./storage");
let reminders = (0, storage_1.loadReminders)();
const agent = new agent_1.AgentHarness();
agent.onMessage(async (evt) => {
    const text = evt.text ?? "";
    if (text.toLowerCase().startsWith("remind me")) {
        const reminderText = text.replace(/^remind me /i, "").trim();
        const timeIso = new Date().toISOString();
        reminders.push({ text: reminderText, time: timeIso });
        (0, storage_1.saveReminders)(reminders);
        return {
            results: {
                reply: `✅ Got it! I'll remind you: "${reminderText}" at ${new Date(timeIso).toLocaleString()}`
            }
        };
    }
    if (text === "/summary") {
        reminders = (0, storage_1.loadReminders)();
        if (reminders.length === 0) {
            return { results: { reply: "📄 You have no reminders yet." } };
        }
        const list = reminders
            .map((r, i) => `${i + 1}. ${r.text} (at ${new Date(r.time).toLocaleString()})`)
            .join("\n");
        return { results: { reply: `📄 Your reminders:\n${list}` } };
    }
    return { results: { reply: `✅ TaskKeeper Agent received: ${text}` } };
});
