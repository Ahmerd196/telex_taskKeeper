// src/core.ts
import { AgentHarness, A2AEvent, A2AResponse } from "./agent";
import { loadReminders, saveReminders, Reminder } from "./storage";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";

const agent = new AgentHarness();

// in-memory + persisted
let reminders: Reminder[] = loadReminders();

// helper format
function formatReminder(r: Reminder) {
  const time = r.time ? new Date(r.time).toLocaleString() : "unspecified";
  return `• [${r.id.substring(0,8)}] ${r.text} — ${time}${r.done ? " ✅" : ""}`;
}

agent.onMessage(async (evt: A2AEvent) => {
  const text = (evt.text || "").trim();
  const lower = text.toLowerCase();

  // /summary or /tasks summary
  if (lower === "/summary" || (lower.startsWith("/tasks") && (lower.includes("summary") || lower.includes("list")))) {
    const list = reminders.filter(r => (evt.channelId ? r.channelId === evt.channelId : true) && !r.done);
    const body = list.length === 0 ? "There are no active reminders." : `You have ${list.length} active reminder(s):\n\n${list.slice(0, 25).map(formatReminder).join("\n")}`;
    const res: A2AResponse = { results: { reply: `📄 Task Summary\n\n${body}` } };
    return res;
  }

  // create reminders using "remind me"
  if (/^remind me/i.test(text)) {
    // naive split: handle multiple items separated by " and " or commas
    // We'll split by " and " or " , " but keep simple: split on " and " (better parsing can be added)
    const body = text.replace(/^remind me( to)?\s*/i, "").trim();
    // try to split multiple tasks if present "A and B and C"
    const parts = body.split(/\s+and\s+/i).map(p => p.trim()).filter(Boolean);

    const created: Reminder[] = [];
    for (const p of parts) {
      // try to parse a date/time in the text using simple heuristics: look for "by <time>" or "on <day>"
      // For now we set time to now OR if "by <...>" exists extract that substring (improvable)
      let timeIso = new Date().toISOString();
      const byMatch = p.match(/\bby\s+(.+)$/i);
      if (byMatch) {
        // set to now but keep text inclusive — you can later integrate chrono-node
        timeIso = new Date().toISOString();
      }
      const rem: Reminder = {
        id: uuidv4(),
        text: p,
        time: timeIso,
        channelId: evt.channelId,
        creatorId: evt.userId,
        done: false
      };
      reminders.push(rem);
      created.push(rem);
    }

    saveReminders(reminders);

    const reply = created.map(r => formatReminder(r)).join("\n");
    return { results: { reply: `✅ Created ${created.length} reminder(s):\n${reply}` } };
  }

  // fallback
  return { results: { reply: `✅ TaskKeeper Agent received: ${text}` } };
});

// actions
agent.onAction(async (evt) => {
  if (!evt.action) return { error: "missing_action" };
  if (evt.action === "mark_done") {
    const taskId = evt.taskId;
    if (!taskId) return { error: "missing_taskId" };
    const idx = reminders.findIndex(r => r.id === taskId);
    if (idx === -1) return { error: "not_found" };
    reminders[idx].done = true;
    saveReminders(reminders);
    return { results: { reply: `✅ Marked done: ${reminders[idx].text}` } };
  }
  if (evt.action === "list") {
    const list = reminders.filter(r => !r.done);
    return { results: { reply: `Active reminders:\n${list.map(formatReminder).join("\n")}` } };
  }

  return { error: "unknown_action" };
});
