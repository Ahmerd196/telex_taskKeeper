import { AgentHarness } from "./agent";
import { loadReminders, saveReminders } from "./storage";

// single-run agent
const agent = new AgentHarness();

async function main() {
  // Telex sends event JSON to stdin
  const input = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });

  const evt = JSON.parse(input);

  try {
    const text = (evt.text ?? "").trim();
    let reminders = await loadReminders();

    if (text === "/summary") {
      if (reminders.length === 0) {
        console.log(JSON.stringify({ results: { reply: "📄 You have no reminders yet." } }));
        return;
      }

      const list = reminders
        .map((r, i) => `${i + 1}. ${r.text} (at ${new Date(r.time).toLocaleString()})`)
        .join("\n");

      console.log(JSON.stringify({ results: { reply: `📄 Your reminders:\n${list}` } }));
      return;
    }

    if (text.toLowerCase().startsWith("remind me")) {
      const reminderText = text.replace(/^remind me/i, "").trim();
      const timeIso = new Date().toISOString();

      reminders.push({ text: reminderText, time: timeIso });
      await saveReminders(reminders);

      console.log(JSON.stringify({
        results: { reply: `✅ Got it! Reminder saved: "${reminderText}"` },
      }));
      return;
    }

    console.log(JSON.stringify({
      results: { reply: `✅ TaskKeeper Agent received: ${text}` },
    }));
  } catch (err: any) {
    console.error("AGENT ERROR", err);
    console.log(JSON.stringify({ error: "handler_error", results: { message: String(err) } }));
  }
}

main();
