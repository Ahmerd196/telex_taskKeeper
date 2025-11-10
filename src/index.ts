import { AgentHarness } from "./agent";
import { loadReminders, saveReminders, Reminder } from "./storage";
import crypto from "crypto";

const agent = new AgentHarness();

agent.onMessage(async (evt) => {
  const text = (evt.text ?? evt.message?.text ?? "").trim();
  let reminders: Reminder[] = await loadReminders();

  // ---- CREATE REMINDER ----
  if (text.toLowerCase().startsWith("remind me")) {
    const reminderText = text.replace(/^remind me /i, "").trim();
    const timeIso = new Date().toISOString();

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      text: reminderText,
      time: timeIso,
      channelId: evt.channelId ?? "unknown",
      done: false
    };

    reminders.push(reminder);
    await saveReminders(reminders);

    return {
      results: {
        reply: `✅ Got it! I'll remind you: "${reminderText}" at ${new Date(timeIso).toLocaleString()}`
      }
    };
  }

  // ---- SUMMARY ----
  if (text === "/summary") {
    reminders = await loadReminders();

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
