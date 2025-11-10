// src/adapter.ts
import express from "express";
import bodyParser from "body-parser";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { Readable } from "stream";
import readline from "readline";
import path from "path";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const AGENT_PATH = process.env.AGENT_PATH || path.resolve(__dirname, "core.js"); // built JS

// spawn agent as child process
function startAgent(): ChildProcessWithoutNullStreams {
  const proc = spawn(process.execPath, [AGENT_PATH], { stdio: ["pipe", "pipe", "inherit"] });
  proc.on("exit", (code) => {
    console.warn("agent process exited with", code);
  });
  return proc;
}

const app = express();
app.use(bodyParser.json({ limit: "100kb" }));

// manage child and line reader
const agentProc = startAgent();
const rl = readline.createInterface({ input: agentProc.stdout });

const pending = new Map<string, (res: any) => void>();

rl.on("line", (line) => {
  let parsed: any = null;
  try {
    parsed = JSON.parse(line);
  } catch (err) {
    console.error("adapter: invalid JSON from agent:", line);
    return;
  }
  // try to resolve by requestId if present
  const rid = parsed?.requestId;
  if (rid && pending.has(rid)) {
    const cb = pending.get(rid)!;
    pending.delete(rid);
    cb(parsed);
  } else {
    // no pending resolver — just log
    console.log("adapter: agent emitted:", parsed);
  }
});

function sendToAgent(evt: any, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = evt.requestId || `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    evt.requestId = requestId;
    const json = JSON.stringify(evt) + "\n";
    pending.set(requestId, (resp) => resolve(resp));
    // write
    agentProc.stdin.write(json, (err) => {
      if (err) {
        pending.delete(requestId);
        return reject(err);
      }
      // set timeout
      setTimeout(() => {
        if (pending.has(requestId)) {
          pending.delete(requestId);
          reject(new Error("agent timeout"));
        }
      }, timeout);
    });
  });
}

// A2A endpoints
app.post("/api/a2a/taskAgent", async (req, res) => {
  const evt = req.body || {};
  // ensure message type exists
  if (!evt.type) evt.type = "message";
  try {
    const r = await sendToAgent(evt, 8000);
    return res.json(r);
  } catch (err: any) {
    console.error("adapter error", err);
    return res.status(500).json({ error: "adapter_error", message: String(err?.message ?? err) });
  }
});

app.post("/api/a2a/taskAgent/action", async (req, res) => {
  const evt = req.body || {};
  if (!evt.type) evt.type = "action";
  try {
    const r = await sendToAgent(evt, 8000);
    return res.json(r);
  } catch (err: any) {
    console.error("adapter error", err);
    return res.status(500).json({ error: "adapter_error", message: String(err?.message ?? err) });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Adapter listening on ${PORT}, proxying to agent:${AGENT_PATH}`);
});
