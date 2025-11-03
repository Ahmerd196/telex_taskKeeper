// src/index.ts
import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import * as chrono from "chrono-node";
import os from "os";

dayjs.extend(utc);

const app = express();
app.use(bodyParser.json());

type Task = {
  id: string;
  channelId: string;
  creatorId: string;
  assignee?: string;
  title: string;
  due?: string;
  createdAt: string;
  done?: boolean;
};
const tasks: Record<string, Task> = {};

const TELEX_SECRET = process.env.TELEX_SECRET || "";

function verifySignature(req: express.Request): boolean {
  if (!TELEX_SECRET) return true;
  const sig = (req.headers["x-telex-signature"] || "") as string;
  if (!sig) return false;
  const body = JSON.stringify(req.body);
  const hmac = crypto.createHmac("sha256", TELEX_SECRET).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig));
  } catch {
    return false;
  }
}

function extractTaskInfo(text: string) {
  const lower = text.trim();
  const remindRegex = /remind (?:me|<@[\w-]+>) to (.+)/i;
  const addRegex = /(?:add|create|new) (?:task|reminder)[:\s-]+(.+)/i;

  const remind = lower.match(remindRegex);
  if (remind) return { title: remind[1] };

  const add = lower.match(addRegex);
  if (add) return { title: add[1] };

  return { title: text };
}

function parseDueWithChrono(text: string, refDate?: Date): string | undefined {
  if (!text) return undefined;
  const date = chrono.parseDate(text, refDate || new Date(), { forwardDate: true });
  if (!date) return undefined;
  return dayjs(date).utc().toISOString();
}

app.post("/api/a2a/taskAgent", async (req, res) => {
  try {
    if (!verifySignature(req)) return res.status(401).json({ error: "invalid signature" });

    const event = req.body;
    const { type, channelId, userId, text } = event;

    if (!type || type !== "message") return res.json({ ok: true });
    if (!channelId || !text) return res.status(400).json({ error: "missing channelId/text" });

    const lower = text.toLowerCase().trim();

    if (lower.startsWith("/tasks")) {
      if (lower.includes("summary") || lower.includes("list")) {
        const list = Object.values(tasks).filter(t => t.channelId === channelId && !t.done);
        const body =
          list.length === 0
            ? "No active tasks in this channel."
            : `Active tasks (${list.length}):\n` +
              list
                .map(
                  t =>
                    `• [${t.id.substring(0, 8)}] ${t.title}${
                      t.due ? ` — due ${dayjs(t.due).utc().format("YYYY-MM-DD HH:mm [UTC]")}` : ""
                    }${t.assignee ? ` — assignee: ${t.assignee}` : ""}`
                )
                .join("\n");

        return res.json({
          action: "send_message",
          payload: { channel_id: channelId, text: body },
          results: { status: "ok", count: list.length }
        });
      }
    }

    const info = extractTaskInfo(text);
    const due = parseDueWithChrono(text);
    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      channelId,
      creatorId: userId,
      title: info.title || text,
      due,
      createdAt: dayjs().utc().toISOString()
    };
    tasks[taskId] = task;

    const dueText = due ? ` — due ${dayjs(due).utc().format("YYYY-MM-DD HH:mm [UTC]")}` : "";

    return res.json({
      action: "send_message",
      payload: {
        channel_id: channelId,
        text: `✅ Task created: "${task.title}"${dueText}`
      },
      results: { status: "ok", taskId }
    });
  } catch (err) {
    console.error("agent error", err);
    return res.status(500).json({ error: "internal error" });
  }
});

app.post("/api/a2a/taskAgent/action", (req, res) => {
  try {
    if (!verifySignature(req)) return res.status(401).json({ error: "invalid signature" });
    const { action, taskId, performedBy, channelId, payload } = req.body;
    const t = tasks[taskId];
    if (!t) return res.status(404).json({ error: "task not found" });

    if (action === "mark_done") {
      t.done = true;
      return res.json({
        action: "send_message",
        payload: { channel_id: channelId, text: `✅ Task [${t.id.substring(0, 8)}] marked as done by <@${performedBy}>.` }
      });
    }

    if (action === "assign") {
      const assignee = payload?.assignee || performedBy;
      t.assignee = assignee;
      return res.json({
        action: "send_message",
        payload: { channel_id: channelId, text: `👥 Task [${t.id.substring(0, 8)}] assigned to <@${assignee}>.` }
      });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/tasks", (_req, res) => res.json(Object.values(tasks)));

const port = Number(process.env.PORT || 4000);
app.get("/.well-known/telex.json", (_req, res) => {
  const base = process.env.BASE_URL || "https://syble-contradictive-rhonda.ngrok-free.dev";
  const payload = {
    name: "taskkeeper",
    version: "0.1.0",
    type: "a2a",
    description: "TaskKeeper A2A agent for Telex",
    host: base,
    endpoints: {
      a2a: `${base}/api/a2a/taskAgent`,
      action: `${base}/api/a2a/taskAgent/action`,
      health: `${base}/health`
    },
    platform: { os: os.platform(), node: process.version }
  };
  res.json(payload);
});

app.listen(port, () => console.log(`TaskKeeper agent listening on ${port}`));



// // src/index.ts
// import express from "express";
// import bodyParser from "body-parser";
// import crypto from "crypto";
// import { v4 as uuidv4 } from "uuid";
// import dayjs from "dayjs";
// import utc from "dayjs/plugin/utc";
// import * as chrono from "chrono-node";
// import os from "os";

// dayjs.extend(utc);

// const app = express();
// app.use(bodyParser.json());

// type Task = {
//   id: string;
//   channelId: string;
//   creatorId: string;
//   assignee?: string;
//   title: string;
//   due?: string;
//   createdAt: string;
//   done?: boolean;
// };
// const tasks: Record<string, Task> = {};

// const TELEX_SECRET = process.env.TELEX_SECRET || "";

// function verifySignature(req: express.Request): boolean {
//   if (!TELEX_SECRET) return true;
//   const sig = (req.headers["x-telex-signature"] || "") as string;
//   if (!sig) return false;
//   const body = JSON.stringify(req.body);
//   const hmac = crypto.createHmac("sha256", TELEX_SECRET).update(body).digest("hex");
//   try {
//     return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig));
//   } catch {
//     return false;
//   }
// }

// function extractTaskInfo(text: string) {
//   const lower = text.trim();
//   const remindRegex = /remind (?:me|<@[\w-]+>) to (.+)/i;
//   const addRegex = /(?:add|create|new) (?:task|reminder)[:\s-]+(.+)/i;

//   const remind = lower.match(remindRegex);
//   if (remind) return { title: remind[1] };

//   const add = lower.match(addRegex);
//   if (add) return { title: add[1] };

//   return { title: text };
// }

// function parseDueWithChrono(text: string, refDate?: Date): string | undefined {
//   if (!text) return undefined;
//   const date = chrono.parseDate(text, refDate || new Date(), { forwardDate: true });
//   if (!date) return undefined;
//   return dayjs(date).utc().toISOString();
// }

// // -------------------- Task Message Endpoint --------------------
// app.post("/api/a2a/taskAgent", async (req, res) => {
//   try {
//     if (!verifySignature(req)) return res.status(401).json({ error: "invalid signature" });

//     const event = req.body;
//     const { type, channelId, userId, text } = event;

//     if (!type || type !== "message") return res.json({ ok: true });
//     if (!channelId || !text) return res.status(400).json({ error: "missing channelId/text" });

//     const lower = text.toLowerCase().trim();

//     // Summary / list
//     if (lower.startsWith("/tasks")) {
//       if (lower.includes("summary") || lower.includes("list")) {
//         const list = Object.values(tasks).filter(t => t.channelId === channelId && !t.done);

//         if (list.length === 0) {
//           return res.json({
//             action: "send_message",
//             payload: { channelId, text: "No active tasks in this channel." },
//             results: { status: "ok", count: 0 }
//           });
//         }

//         const maxPerMessage = 10; // number of tasks per message to avoid truncation
//         const messages: string[] = [];

//         for (let i = 0; i < list.length; i += maxPerMessage) {
//           const chunk = list.slice(i, i + maxPerMessage);
//           const body =
//             `Active tasks ${i + 1}–${i + chunk.length} of ${list.length}:\n` +
//             chunk
//               .map(
//                 t =>
//                   `• [${t.id.substring(0, 8)}] ${t.title}` +
//                   (t.due ? ` — due ${dayjs(t.due).utc().format("YYYY-MM-DD HH:mm [UTC]")}` : "") +
//                   (t.assignee ? ` — assignee: ${t.assignee}` : "")
//               )
//               .join("\n");
//           messages.push(body);
//         }

//     // Send messages sequentially
//     return res.json({
//       action: "send_messages", // note plural if your platform supports multiple
//       payload: messages.map(text => ({ channelId, text })),
//       results: { status: "ok", count: list.length }
//     });
//   }
// }

//     // Create new task
//     const info = extractTaskInfo(text);
//     const due = parseDueWithChrono(text);
//     const taskId = uuidv4();
//     const task: Task = {
//       id: taskId,
//       channelId,
//       creatorId: userId,
//       title: info.title || text,
//       due,
//       createdAt: dayjs().utc().toISOString()
//     };
//     tasks[taskId] = task;

//     const dueText = due ? ` — due ${dayjs(due).utc().format("YYYY-MM-DD HH:mm [UTC]")}` : "";

//     return res.json({
//       action: "send_message",
//       payload: { channelId, text: `✅ Task created: "${task.title}"${dueText}` },
//       results: {
//         status: "ok",
//         task: {
//           id: task.id,
//           title: task.title,
//           due: task.due || null,
//           assignee: task.assignee || null,
//           done: task.done || false
//         }
//       }
//     });
//   } catch (err) {
//     console.error("agent error", err);
//     return res.status(500).json({ error: "internal error" });
//   }
// });

// // -------------------- Task Action Endpoint --------------------
// app.post("/api/a2a/taskAgent/action", (req, res) => {
//   try {
//     if (!verifySignature(req)) return res.status(401).json({ error: "invalid signature" });

//     const { action, taskId, performedBy, channelId, payload } = req.body;
//     const t = tasks[taskId];
//     if (!t) return res.status(404).json({ error: "task not found" });

//     if (action === "mark_done") {
//       t.done = true;
//       return res.json({
//         action: "send_message",
//         payload: { channelId, text: `✅ Task [${t.id.substring(0, 8)}] marked as done by <@${performedBy}>.` },
//         results: { status: "ok", taskId: t.id, done: true }
//       });
//     }

//     if (action === "assign") {
//       const assignee = payload?.assignee || performedBy;
//       t.assignee = assignee;
//       return res.json({
//         action: "send_message",
//         payload: { channelId, text: `👥 Task [${t.id.substring(0, 8)}] assigned to <@${assignee}>.` },
//         results: { status: "ok", taskId: t.id, assignee }
//       });
//     }

//     return res.status(400).json({ error: "unknown action" });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: "internal" });
//   }
// });

// // -------------------- Health & Tasks --------------------
// app.get("/health", (_req, res) => res.json({ ok: true }));
// app.get("/tasks", (_req, res) => res.json(Object.values(tasks)));

// // -------------------- Telex Discovery --------------------
// const port = Number(process.env.PORT || 4000);
// app.get("/.well-known/telex.json", (_req, res) => {
//   const base = process.env.BASE_URL || `http://localhost:${port}`;
//   const payload = {
//     name: "taskkeeper",
//     version: "0.1.0",
//     type: "a2a",
//     description: "TaskKeeper A2A agent for Telex",
//     host: base,
//     endpoints: {
//       a2a: `${base}/api/a2a/taskAgent`,
//       action: `${base}/api/a2a/taskAgent/action`,
//       health: `${base}/health`
//     },
//     platform: {
//       os: os.platform(),
//       node: process.version
//     }
//   };
//   res.json(payload);
// });

// // -------------------- Start Server --------------------
// app.listen(port, () => console.log(`TaskKeeper agent listening on ${port}`));




// src/index.ts
// import express from "express";
// import bodyParser from "body-parser";
// import crypto from "crypto";
// import { v4 as uuidv4 } from "uuid";
// import dayjs from "dayjs";
// import utc from "dayjs/plugin/utc";
// import * as chrono from "chrono-node";
// import os from "os";

// dayjs.extend(utc);

// const app = express();
// app.use(bodyParser.json());

// type Task = {
//   id: string;
//   channelId: string;
//   creatorId: string;
//   assignee?: string;
//   title: string;
//   due?: string; // ISO string (UTC)
//   createdAt: string;
//   done?: boolean;
// };

// const tasks: Record<string, Task> = {};

// const TELEX_SECRET = process.env.TELEX_SECRET || "";

// // --------- Utility Functions ---------
// function verifySignature(req: express.Request): boolean {
//   if (!TELEX_SECRET) return true;
//   const sig = (req.headers["x-telex-signature"] || "") as string;
//   if (!sig) return false;
//   const body = JSON.stringify(req.body);
//   const hmac = crypto.createHmac("sha256", TELEX_SECRET).update(body).digest("hex");
//   try {
//     return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig));
//   } catch {
//     return false;
//   }
// }

// function extractTaskInfo(text: string) {
//   const lower = text.trim();
//   const remindRegex = /remind (?:me|<@[\w-]+>) to (.+)/i;
//   const addRegex = /(?:add|create|new) (?:task|reminder)[:\s-]+(.+)/i;

//   const remind = lower.match(remindRegex);
//   if (remind) return { title: remind[1] };

//   const add = lower.match(addRegex);
//   if (add) return { title: add[1] };

//   return { title: text };
// }

// function parseDueWithChrono(text: string, refDate?: Date): string | undefined {
//   if (!text) return undefined;
//   const date = chrono.parseDate(text, refDate || new Date(), { forwardDate: true });
//   if (!date) return undefined;
//   return dayjs(date).utc().toISOString();
// }

// function formatTaskMessage(task: Task) {
//   const dueText = task.due ? `\n📅 Due: ${dayjs(task.due).utc().format("YYYY-MM-DD HH:mm [UTC]")}` : "";
//   const assigneeText = task.assignee ? `\n👤 Assigned to: <@${task.assignee}>` : "";
//   return `✅ Task: "${task.title}"${dueText}${assigneeText}\n• ID: ${task.id.substring(0, 8)}`;
// }

// // --------- Endpoints ---------
// app.post("/api/a2a/taskAgent", async (req, res) => {
//   try {
//     if (!verifySignature(req)) return res.status(401).json({ error: "invalid signature" });

//     const { type, channelId, userId, text } = req.body;

//     if (type !== "message") return res.json({ ok: true });
//     if (!channelId || !text) return res.status(400).json({ error: "missing channelId/text" });

//     const lower = text.toLowerCase().trim();

//     // Handle /tasks summary
//     if (lower.startsWith("/tasks") && (lower.includes("summary") || lower.includes("list"))) {
//       const list = Object.values(tasks).filter(t => t.channelId === channelId && !t.done);
//       const body =
//         list.length === 0
//           ? "No active tasks in this channel."
//           : `Active tasks (${list.length}):\n` + list.map(formatTaskMessage).join("\n\n");

//       return res.json({
//         action: "send_message",
//         payload: { channelId, text: body },
//         results: { status: "ok", count: list.length }
//       });
//     }

//     // Create new task
//     const info = extractTaskInfo(text);
//     const due = parseDueWithChrono(text);
//     const taskId = uuidv4();
//     const task: Task = {
//       id: taskId,
//       channelId,
//       creatorId: userId,
//       title: info.title || text,
//       due,
//       createdAt: dayjs().utc().toISOString()
//     };
//     tasks[taskId] = task;

//     return res.json({
//       action: "send_message_with_actions",
//       payload: {
//         channelId,
//         text: formatTaskMessage(task),
//         actions: [
//           { type: "button", text: "Mark Done", action: "mark_done", taskId },
//           { type: "button", text: "Assign", action: "assign", taskId }
//         ]
//       },
//       results: { status: "ok", taskId }
//     });

//   } catch (err) {
//     console.error("agent error", err);
//     return res.status(500).json({ error: "internal error" });
//   }
// });

// app.post("/api/a2a/taskAgent/action", (req, res) => {
//   try {
//     if (!verifySignature(req)) return res.status(401).json({ error: "invalid signature" });

//     const { action, taskId, performedBy, channelId, payload } = req.body;
//     const t = tasks[taskId];
//     if (!t) return res.status(404).json({ error: "task not found" });

//     if (action === "mark_done") {
//       t.done = true;
//       return res.json({
//         action: "send_message",
//         payload: { channelId, text: `✅ Task [${t.id.substring(0, 8)}] marked as done by <@${performedBy}>.` }
//       });
//     }

//     if (action === "assign") {
//       const assignee = payload?.assignee || performedBy;
//       t.assignee = assignee;
//       return res.json({
//         action: "send_message",
//         payload: { channelId, text: `👥 Task [${t.id.substring(0, 8)}] assigned to <@${assignee}>.` }
//       });
//     }

//     return res.status(400).json({ error: "unknown action" });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: "internal" });
//   }
// });

// app.get("/tasks", (_req, res) => res.json(Object.values(tasks)));
// app.get("/health", (_req, res) => res.json({ ok: true }));

// // Telex discovery endpoint
// app.get("/.well-known/telex.json", (_req, res) => {
//   const base = process.env.BASE_URL || "https://your-ngrok-or-production-url";
//   res.json({
//     name: "taskkeeper",
//     version: "0.1.0",
//     type: "a2a",
//     description: "TaskKeeper A2A agent for Telex",
//     host: base,
//     endpoints: {
//       a2a: `${base}/api/a2a/taskAgent`,
//       action: `${base}/api/a2a/taskAgent/action`,
//       health: `${base}/health`
//     },
//     platform: { os: os.platform(), node: process.version }
//   });
// });

// // Start server
// const port = Number(process.env.PORT || 4000);
// app.listen(port, () => console.log(`TaskKeeper agent listening on ${port}`));
