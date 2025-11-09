// src/index.ts
import { AgentHarness } from "./agent";
import fs from "fs";
import chrono from "chrono-node";

const DB_FILE = "./reminders.json";

type Reminder = {
  text: string;
  time: Date;
};

function loadReminders(): Reminder[] {
  if (fs.existsSync(DB_FILE)) {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8")).map((r: any) => ({
      text: r.text,
      time: new Date(r.time),
    }));
  }
  return [];
}

function saveReminders(reminders: Reminder[]) {
  fs.writeFileSync(DB_FILE, JSON.stringify(reminders, null, 2));
}

const agent = new AgentHarness();
let reminders: Reminder[] = loadReminders();

// Handle messages from user
agent.onMessage(async (evt) => {
  const text = evt.text?.trim();
  if (!text) {
    return { results: { reply: "⚠️ I didn't get any text." } };
  }

  // Handle summary command
  if (text.toLowerCase() === "/summary") {
    if (reminders.length === 0) {
      return { results: { reply: "📄 You have no reminders yet." } };
    }
    const summary = reminders
      .map((r, i) => `${i + 1}. ${r.text} at ${r.time.toLocaleString()}`)
      .join("\n");
    return { results: { reply: `📄 Your reminders:\n${summary}` } };
  }

  // Handle setting new reminders
  if (text.toLowerCase().startsWith("remind me") || text.toLowerCase().startsWith("set me a reminder") || text.toLowerCase().includes("remind")) {
    // Split by 'and' or ',' for multiple reminders
    const parts = text.split(/,|and/i);
    let newReminders: Reminder[] = [];

    for (const part of parts) {
      const date = chrono.parseDate(part, new Date(), { forwardDate: true });
      if (date) {
        newReminders.push({ text: part.trim(), time: date });
      }
    }

    if (newReminders.length === 0) {
      return { results: { reply: "⚠️ I couldn't detect any valid time in your message." } };
    }

    reminders = reminders.concat(newReminders);
    saveReminders(reminders);

    return {
      results: {
        reply: `✅ I have saved ${newReminders.length} reminder(s).`,
      },
    };
  }

  // Default echo message
  return {
    results: { reply: `✅ TaskKeeper Agent received: ${text}` },
  };
});

// Handle action calls
agent.onAction(async (evt) => {
  if (evt.action === "ping") {
    return { results: { pong: true } };
  }
  return { error: "unknown_action" };
});
