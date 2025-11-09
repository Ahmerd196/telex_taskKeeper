// src/index.ts
import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import * as chrono from "chrono-node";
import fs from "fs/promises";
import path from "path";
import os from "os";

dayjs.extend(utc);

const app = express();
app.use(bodyParser.json());

// ---------- Configuration ----------
const DATA_DIR = path.resolve(process.cwd(), "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const TELEX_SECRET = process.env.TELEX_SECRET || "";
const PORT = Number(process.env.PORT || 4000);
const BASE_URL =
  process.env.BASE_URL || "https://telextaskkeeper-production.up.railway.app";

// ---------- Types ----------
type Task = {
  id: string;
  channelId: string;
  creatorId: string;
  title: string;
  due?: string;
  assignee?: string;
  createdAt: string;
  done?: boolean;
};

// ---------- File Storage ----------
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create data dir", err);
  }
}

async function readTasks(): Promise<Record<string, Task>> {
  try {
    await ensureDataDir();
    const raw = await fs.readFile(TASKS_FILE, "utf8");
    return JSON.parse(raw) as Record<string, Task>;
  } catch (err: any) {
    if (err.code === "ENOENT") return {};
    console.error("Error reading tasks file:", err);
    return {};
  }
}

async function writeTasks(tasks: Record<string, Task>) {
  try {
    await ensureDataDir();
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing tasks file:", err);
  }
}

// ---------- Helpers ----------
function verifySignature(req: Request): boolean {
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
  const trimmed = text.trim();
  const remindRegex = /remind (?:me|<@[\w-]+>) to (.+)/i;
  const addRegex = /(?:add|create|new) (?:task|reminder)[:\s-]+(.+)/i;

  const r = trimmed.match(remindRegex);
  if (r) return { title: r[1].trim() };

  const a = trimmed.match(addRegex);
  if (a) return { title: a[1].trim() };

  return { title: trimmed.replace(/^remind me to\s+/i, "").trim() || trimmed };
}

function parseDueWithChrono(text: string): string | undefined {
  const date = chrono.parseDate(text, new Date(), { forwardDate: true });
  return date ? dayjs(date).utc().toISOString() : undefined;
}

function formatTaskShort(t: Task) {
  const id = t.id.substring(0, 8);
  const due = t.due ? ` • Due: ${dayjs(t.due).utc().format("YYYY-MM-DD HH:mm [UTC]")}` : "";
  const assn = t.assignee ? ` • Assigned: <@${t.assignee}>` : "";
  const done = t.done ? " ✅" : "";
  return `• [${id}] ${t.title}${due}${assn}${done}`;
}

function buildProfessionalReply(header: string, body: string) {
  return `${header}\n\n${body}`.trim();
}

function buildSummaryText(list: Task[], maxToShow = 8) {
  if (list.length === 0) return "There are no active tasks in this channel.";
  const tasksToShow = list.slice(0, maxToShow);
  const lines = tasksToShow.map(formatTaskShort).join("\n");
  const more = list.length > maxToShow ? `\n...and ${list.length - maxToShow} more tasks.` : "";
  return `You currently have ${list.length} active task(s):\n\n${lines}${more}`;
}

// ---------- Endpoints ----------
app.post("/api/a2a/taskAgent", async (req: Request, res: Response) => {
  try {
    if (!verifySignature(req)) return res.status(401).json({ error: "invalid signature" });

    const event = req.body;
    const { type, channelId, userId, text } = event;

    if (!type || type !== "message") return res.json({ ok: true });
    if (!channelId || !text) return res.status(400).json({ error: "missing channelId/text" });

    const lower = String(text).toLowerCase().trim();

    if (lower === "/summary" || (lower.startsWith("/tasks") && (lower.includes("summary") || lower.includes("list")))) {
      const tasksMap = await readTasks();
      const list = Object.values(tasksMap).filter((t) => t.channelId === channelId && !t.done);

      const summaryText = buildSummaryText(list);
      const message = buildProfessionalReply("Task Summary", summaryText);

      return res.json({
        action: "send_message",
        payload: { channel_id: channelId, text: message },
        results: {
          status: "ok",
          count: list.length,
          tasks: list
        }
      });
    }

    const info = extractTaskInfo(String(text));
    const due = parseDueWithChrono(String(text));
    const id = uuidv4();

    const newTask: Task = {
      id,
      channelId,
      creatorId: userId || "unknown",
      title: info.title,
      due,
      createdAt: dayjs().utc().toISOString(),
      done: false
    };

    const tasksMap = await readTasks();
    tasksMap[id] = newTask;
    await writeTasks(tasksMap);

    const shortMsg = formatTaskShort(newTask);
    const message = buildProfessionalReply("Task Created", `${shortMsg}\n\nI will remind you as requested.`);

    return res.json({
      action: "send_message",
      payload: { channel_id: channelId, text: message },
      results: { status: "ok", task: newTask }
    });
  } catch (err) {
    console.error("taskAgent error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

app.post("/api/a2a/taskAgent/action", async (req: Request, res: Response) => {
  try {
    if (!verifySignature(req)) return res.status(401).json({ error: "invalid signature" });

    const { action, taskId, performedBy, channelId, payload } = req.body || {};
    if (!taskId) return res.status(400).json({ error: "missing taskId" });

    const tasksMap = await readTasks();
    const t = tasksMap[taskId];
    if (!t) return res.status(404).json({ error: "task not found" });

    if (action === "mark_done") {
      t.done = true;
      await writeTasks(tasksMap);
      const message = `✅ Task [${t.id.substring(0, 8)}] marked done by <@${performedBy || t.creatorId}>.`;
      return res.json({
        action: "send_message",
        payload: { channel_id: channelId, text: message },
        results: { status: "ok", taskId: t.id, done: true }
      });
    }

    if (action === "assign") {
      const assignee = payload?.assignee || performedBy;
      t.assignee = assignee;
      await writeTasks(tasksMap);
      const message = `👥 Task [${t.id.substring(0, 8)}] assigned to <@${assignee}>.`;
      return res.json({
        action: "send_message",
        payload: { channel_id: channelId, text: message },
        results: { status: "ok", taskId: t.id, assignee }
      });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (err) {
    console.error("action handler error:", err);
    return res.status(500).json({ error: "internal" });
  }
});

// Health
app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));
app.get("/tasks", async (_req: Request, res: Response) => {
  const tasksMap = await readTasks();
  res.json(Object.values(tasksMap));
});

// Telex discovery
app.get("/.well-known/telex.json", (_req: Request, res: Response) => {
  res.json({
    name: "taskkeeper",
    version: "0.1.0",
    type: "a2a",
    description: "TaskKeeper A2A agent for Telex - persistent JSON storage",
    host: BASE_URL,
    endpoints: {
      a2a: `${BASE_URL}/api/a2a/taskAgent`,
      action: `${BASE_URL}/api/a2a/taskAgent/action`,
      health: `${BASE_URL}/health`
    },
    platform: { os: os.platform(), node: process.version }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`TaskKeeper agent listening on ${PORT}`);
  console.log(`BASE_URL=${BASE_URL}`);
});
