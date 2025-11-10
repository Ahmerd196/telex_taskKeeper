import { AgentHarness } from "./agent";
import { loadReminders, saveReminders } from "./storage";

let reminders: any[] = [];

const agent = new AgentHarness();

agent.onMessage(async (evt) => {
  try {
    const text = evt.text ?? "";

    if (text.toLowerCase().startsWith("remind me")) {
      const reminderText = text.replace(/^remind me /i, "").trim();
      const timeIso = new Date().toISOString();

      reminders = await loadReminders();
      reminders.push({ text: reminderText, time: timeIso });
      await saveReminders(reminders);

      return {
        results: {
          reply: `✅ Got it! I'll remind you: "${reminderText}" at ${new Date(timeIso).toLocaleString()}`
        }
      };
    }

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

    return { results: { reply: `✅ TaskKeeper Agent received: ${text}` } };

  } catch (err: any) {
    console.error("AGENT ERROR", err);

    return {
      error: "handler_error",
      results: {
        message: String(err)
      }
    };
  }
});
