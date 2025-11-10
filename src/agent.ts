// src/agent.ts
import readline from "readline";

export type A2AEvent = {
  type: string;
  channelId?: string;
  userId?: string;
  text?: string;
  messageId?: string;
  // For action calls:
  action?: string;
  taskId?: string;
  performedBy?: string;
  payload?: any;
  requestId?: string; // optional correlation id
  [k: string]: any;
};

export type A2AResponse = {
  action?: string;
  payload?: any;
  results?: any;
  error?: string;
  requestId?: string; // echo back if provided
};

type Handlers = {
  onMessage?: (evt: A2AEvent) => Promise<A2AResponse | void> | A2AResponse | void;
  onAction?: (evt: A2AEvent) => Promise<A2AResponse | void> | A2AResponse | void;
};

export class AgentHarness {
  private handlers: Handlers = {};
  private rl: readline.Interface;

  constructor() {
    // line-based stdin reader
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    this.rl.on("line", (line) => {
      if (!line || !line.trim()) return;
      let parsed: A2AEvent | null = null;
      try {
        parsed = JSON.parse(line);
      } catch (err) {
        this.send({ error: "invalid_json" });
        return;
      }
      if (!parsed) return;
      void this.handle(parsed);
    });

    process.stdin.on("end", () => {
      // stdin closed
    });

    // tell grader/tools we're ready
    this.send({ results: { status: "agent_ready" } });
  }

  onMessage(fn: Handlers["onMessage"]) {
    this.handlers.onMessage = fn;
  }
  onAction(fn: Handlers["onAction"]) {
    this.handlers.onAction = fn;
  }

  private async handle(evt: A2AEvent) {
    try {
      if (evt.type === "message" && this.handlers.onMessage) {
        const r = await this.handlers.onMessage(evt);
        if (r) this.send(r, evt.requestId);
      } else if (evt.type === "action" && this.handlers.onAction) {
        const r = await this.handlers.onAction(evt);
        if (r) this.send(r, evt.requestId);
      } else {
        // unknown event type
        this.send({ results: { status: "ignored", type: evt.type || null } , requestId: evt.requestId});
      }
    } catch (err: any) {
      console.error("agent_handler_error", err?.stack ?? err);
      this.send({ error: "handler_error", results: { message: String(err?.message ?? err) }, requestId: evt.requestId });
    }
  }

  send(obj: A2AResponse, requestId?: string) {
    try {
      if (requestId && !obj.requestId) obj.requestId = requestId;
      const str = JSON.stringify(obj);
      process.stdout.write(str + "\n");
    } catch (err) {
      console.error("send_error", err);
    }
  }
}
