import { AgentHarness } from "./agent";
import { loadReminders, saveReminders } from "./storage";
import { randomUUID } from "crypto";

let reminders = loadReminders();

const agent = new AgentHarness();

agent.onMessage(async (evt) => {
  const text = evt.text ?? "";

  if (text.toLowerCase().startsWith("remind me")) {
    const reminderText = text.replace(/^remind me /i, "").trim();
    const timeIso = new Date().toISOString();

    const reminder = {
      id: randomUUID(),
      text: reminderText,
      time: timeIso,
      channelId: evt.channelId ?? "default",
      done: false,
    };

    reminders.push(reminder);
    saveReminders(reminders);

    return {
      results: {
        reply: `✅ Got it! I'll remind you: "${reminderText}" at ${new Date(timeIso).toLocaleString()}`
      }
    };
  }

  if (text === "/summary") {
    reminders = loadReminders();

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
