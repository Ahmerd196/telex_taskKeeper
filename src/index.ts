import { AgentHarness } from "./agent";
import * as chrono from "chrono-node";

const agent = new AgentHarness();

type Reminder = { text: string; time: Date };
let reminders: Reminder[] = [];

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
