"use strict";
// // src/index.ts
// import { AgentHarness, A2AEvent, A2AResponse } from "./agent";
// import fs from "fs/promises";
// import path from "path";
// import { v4 as uuidv4 } from "uuid";
// import dayjs from "dayjs";
// import utc from "dayjs/plugin/utc";
// const chrono = require("chrono-node");
Object.defineProperty(exports, "__esModule", { value: true });
// dayjs.extend(utc);
// // config
// const DATA_DIR = path.resolve(process.cwd(), "data");
// const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
// // Types
// type Task = {
//   id: string;
//   channelId: string;
//   creatorId: string;
//   title: string;
//   due?: string;
//   assignee?: string;
//   createdAt: string;
//   done?: boolean;
// };
// async function ensureDataDir() {
//   try {
//     await fs.mkdir(DATA_DIR, { recursive: true });
//   } catch (e) {
//     console.error("failed to create data dir", e);
//   }
// }
// async function readTasks(): Promise<Record<string, Task>> {
//   try {
//     await ensureDataDir();
//     const raw = await fs.readFile(TASKS_FILE, "utf8");
//     return JSON.parse(raw) as Record<string, Task>;
//   } catch (err: any) {
//     if (err && (err.code === "ENOENT" || err.code === "ENOTFOUND")) return {};
//     console.error("readTasks error", err);
//     return {};
//   }
// }
// async function writeTasks(tasks: Record<string, Task>) {
//   try {
//     await ensureDataDir();
//     await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf8");
//   } catch (err) {
//     console.error("writeTasks error", err);
//   }
// }
// function extractTaskInfo(text: string) {
//   const trimmed = (text || "").trim();
//   const remindRegex = /remind (?:me|<@[\w-]+>) to (.+)/i;
//   const addRegex = /(?:add|create|new) (?:task|reminder)[:\s-]+(.+)/i;
//   const r = trimmed.match(remindRegex);
//   if (r) return { title: r[1].trim() };
//   const a = trimmed.match(addRegex);
//   if (a) return { title: a[1].trim() };
//   return { title: trimmed.replace(/^remind me to\s+/i, "").trim() || trimmed };
// }
// function parseDueWithChrono(text: string): string | undefined {
//   if (!text) return undefined;
//   const date = chrono.parseDate(text, new Date(), { forwardDate: true });
//   if (!date) return undefined;
//   return dayjs(date).utc().toISOString();
// }
// function formatTaskShort(t: Task) {
//   const id = t.id.substring(0, 8);
//   const due = t.due ? ` • Due: ${dayjs(t.due).utc().format("YYYY-MM-DD HH:mm [UTC]")}` : "";
//   const assn = t.assignee ? ` • Assigned: <@${t.assignee}>` : "";
//   const done = t.done ? " ✅" : "";
//   return `• [${id}] ${t.title}${due}${assn}${done}`;
// }
// function buildProfessionalReply(header: string, body: string) {
//   return `${header}\n\n${body}`.trim();
// }
// function buildSummaryText(list: Task[], maxToShow = 8) {
//   if (list.length === 0) return "There are no active tasks in this channel.";
//   const tasksToShow = list.slice(0, maxToShow);
//   const lines = tasksToShow.map(formatTaskShort).join("\n");
//   const more = list.length > maxToShow ? `\n...and ${list.length - maxToShow} more tasks.` : "";
//   return `You currently have ${list.length} active task(s):\n\n${lines}${more}`;
// }
// const harness = new AgentHarness();
// harness.onMessage(async (evt: A2AEvent) => {
//   const { channelId, userId, text } = evt;
//   if (!channelId || !text) {
//     return { error: "missing channelId/text" } as A2AResponse;
//   }
//   const lower = String(text).toLowerCase().trim();
//   // summary
//   if (lower === "/summary" || (lower.startsWith("/tasks") && (lower.includes("summary") || lower.includes("list")))) {
//     const tasksMap = await readTasks();
//     const list = Object.values(tasksMap).filter((t) => t.channelId === channelId && !t.done);
//     const summaryText = buildSummaryText(list, 8);
//     const message = buildProfessionalReply("Task Summary", summaryText);
//     return {
//       action: "send_message",
//       payload: { channel_id: channelId, text: message },
//       results: { status: "ok", count: list.length, tasks: list.map(t => ({ id: t.id, title: t.title, due: t.due || null, assignee: t.assignee || null, done: !!t.done })) }
//     } as A2AResponse;
//   }
//   // create task
//   const info = extractTaskInfo(String(text));
//   const due = parseDueWithChrono(String(text));
//   const id = uuidv4();
//   const newTask: Task = {
//     id,
//     channelId,
//     creatorId: userId || "unknown",
//     title: info.title || String(text),
//     due: due || undefined,
//     createdAt: dayjs().utc().toISOString(),
//     done: false
//   };
//   const tasksMap = await readTasks();
//   tasksMap[id] = newTask;
//   await writeTasks(tasksMap);
//   const shortMsg = formatTaskShort(newTask);
//   const message = buildProfessionalReply("Task Created", `${shortMsg}\n\nI will remind you as requested.`);
//   return {
//     action: "send_message",
//     payload: { channel_id: channelId, text: message },
//     results: { status: "ok", task: { id: newTask.id, title: newTask.title, due: newTask.due || null, assignee: newTask.assignee || null, done: !!newTask.done } }
//   } as A2AResponse;
// });
// harness.onAction(async (evt: A2AEvent) => {
//   const { action, taskId, performedBy, channelId, payload } = evt;
//   if (!taskId) return { error: "missing taskId" };
//   const tasksMap = await readTasks();
//   const t = tasksMap[taskId];
//   if (!t) return { error: "task_not_found" };
//   if (action === "mark_done") {
//     t.done = true;
//     await writeTasks(tasksMap);
//     const message = `✅ Task [${t.id.substring(0, 8)}] marked done by <@${performedBy || t.creatorId}>.`;
//     return { action: "send_message", payload: { channel_id: channelId, text: message }, results: { status: "ok", taskId: t.id, done: true } };
//   }
//   if (action === "assign") {
//     const assignee = payload?.assignee || performedBy;
//     t.assignee = assignee;
//     await writeTasks(tasksMap);
//     const message = `👥 Task [${t.id.substring(0, 8)}] assigned to <@${assignee}>.`;
//     return { action: "send_message", payload: { channel_id: channelId, text: message }, results: { status: "ok", taskId: t.id, assignee } };
//   }
//   return { error: "unknown_action" };
// });
// Agent is live and harness emits readiness on startup
// The harness already sent an agent_ready handshake at construction.
// src/index.ts
const agent_1 = require("./agent");
const agent = new agent_1.AgentHarness();
// when user sends chat to agent
agent.onMessage(async (evt) => {
    return {
        results: {
            reply: `✅ TaskKeeper Agent received: ${evt.text}`
        }
    };
});
// when Telex performs an action call to the agent
agent.onAction(async (evt) => {
    if (evt.action === "ping") {
        return { results: { pong: true } };
    }
    return { error: "unknown_action" };
});
