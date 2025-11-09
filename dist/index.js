// src/index.js
import express from "express";
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
const BASE_URL = process.env.BASE_URL || "https://telextaskkeeper-production.up.railway.app";

// ---------- Types ----------
/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} channelId
 * @property {string} creatorId
 * @property {string} title
 * @property {string|undefined} [due]
 * @property {string|undefined} [assignee]
 * @property {string} createdAt
 * @property {boolean|undefined} [done]
 */

// ---------- Simple file storage ----------
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create data dir", err);
  }
}

/**
 * @returns {Promise<Object.<string, Task>>}
 */
async function readTasks() {
  try {
    await ensureDataDir();
    const raw = await fs.readFile(TASKS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    console.error("Error reading tasks file:", err);
    return {};
  }
}

/**
 * @param {Object.<string, Task>} tasks
 */
async function writeTasks(tasks) {
  try {
    await ensureDataDir();
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing tasks file:", err);
  }
}

// ---------- Helpers ----------
function verifySignature(req) {
  if (!TELEX_SECRET) return true;
  const sig = (req.headers["x-telex-signature"] || "");
  if (!sig) return false;
  const body = JSON.stringify(req.body);
  const hmac = crypto.createHmac("sha256", TELEX_SECRET).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig));
  } catch {
    return false;
  }
}

function extractTaskInfo(text) {
  const trimmed = (text || "").trim();
  const remindRegex = /remind (?:me|<@[\w-]+>) to (.+)/i;
  const addRegex = /(?:add|create|new) (?:task|reminder)[:\s-]+(.+)/i;

  const r = trimmed.match(remindRegex);
  if (r) return { title: r[1].trim() };

  const a = trimmed.match(addRegex);
  if (a) return { title: a[1].trim() };

  return { title: trimmed.replace(/^remind me to\s+/i, "").trim() || trimmed };
}

function parseDueWithChrono(text) {
  if (!text) return undefined;
  const date = chrono.parseDate(text, new Date(), { forwardDate: true });
  if (!date) return undefined;
  return dayjs(date).utc().toISOString();
}

function formatTaskShort(t) {
  const id = t.id.substring(0, 8);
  const due = t.due ? ` • Due: ${dayjs(t.due).utc().format("YYYY-MM-DD HH:mm [UTC]")}` : "";
  const assn = t.assignee ? ` • Assigned: <@${t.assignee}>` : "";
  const done = t.done ? " ✅" : "";
  return `• [${id}] ${t.title}${due}${assn}${done}`;
}

function buildProfessionalReply(header, body) {
  return `${header}\n\n${body}`.trim();
}

function buildSummaryText(list, maxToShow = 8) {
  if (list.length === 0) return "There are no active tasks in this channel.";
  const tasksToShow = list.slice(0, maxToShow);
  const lines = tasksToShow.map(formatTaskShort).join("\n");
  const more = list.length > maxToShow ? `\n...and ${list.length - maxToShow} more tasks.` : "";
  return `You currently have ${list.length} active task(s):\n\n${lines}${more}`;
}

// ---------- Endpoints ----------
app.post("/api/a2a/taskAgent", async (req, res) => {
  try {
    if (!verifySignature(req)) return res.status(401).json({ error: "invalid signature" });

    const event = req.body || {};
    const { type, channelId, userId, text } = event;

    if (!type || type !== "message") return res.json({ ok: true });

    if (!channelId || !text) {
      return res.status(400).json({ error: "missing channelId/text" });
    }

    const lower = String(text).toLowerCase().trim();

    // === Summary ===
    if (lower === "/summary" || (lower.startsWith("/tasks") && (lower.includes("summary") || lower.includes("list")))) {
      const tasksMap = await readTasks();
      const list = Object.values(tasksMap).filter((t) => t.channelId === channelId && !t.done);

      const summaryText = buildSummaryText(list, 8);
      const message = buildProfessionalReply("Task Summary", summaryText);

      return res.json({
        action: "send_message",
        payload: { channel_id: channelId, text: message },
        results: {
          status: "ok",
          count: list.length,
          tasks: list.map((t) => ({
            id: t.id,
            title: t.title,
            due: t.due || null,
            assignee: t.assignee || null,
            done: !!t.done,
            createdAt: t.createdAt
          }))
        }
      });
    }

    // === Create ===
    const info = extractTaskInfo(String(text));
    const due = parseDueWithChrono(String(text));
    const id = uuidv4();

    /** @type {Task} */
    const newTask = {
      id,
      channelId,
      creatorId: userId || "unknown",
      title: info.title || String(text),
      due: due || undefined,
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
      results: {
        status: "ok",
        task: {
          id: newTask.id,
          title: newTask.title,
          due: newTask.due || null,
          assignee: newTask.assignee || null,
          done: !!newTask.done,
          createdAt: newTask.createdAt
        }
      }
    });
  } catch (err) {
    console.error("taskAgent error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

app.post("/api/a2a/taskAgent/action", async (req, res) => {
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

// health & debug
app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/tasks", async (_req, res) => {
  const tasksMap = await readTasks();
  return res.json(Object.values(tasksMap));
});

// telex discovery
app.get("/.well-known/telex.json", (_req, res) => {
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

// start
app.listen(PORT, () => {
  console.log(`TaskKeeper agent listening on ${PORT}`);
  console.log(`BASE_URL=${BASE_URL}`);
});
