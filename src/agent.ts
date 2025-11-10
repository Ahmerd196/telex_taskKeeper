import readline from "readline";

export type A2AEvent = {
  type: string;
  channelId?: string;
  userId?: string;
  text?: string;
  messageId?: string;
  action?: string;
  taskId?: string;
  performedBy?: string;
  payload?: any;
  [k: string]: any;
};

export type A2AResponse = {
  action?: string;
  payload?: any;
  results?: any;
  error?: string;
};

type Handlers = {
  onMessage?: (evt: A2AEvent) => Promise<A2AResponse | void> | A2AResponse | void;
  onAction?: (evt: A2AEvent) => Promise<A2AResponse | void> | A2AResponse | void;
};

export class AgentHarness {
  private handlers: Handlers = {};
  private rl: readline.Interface;

  constructor() {
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
      this.handle(parsed);
    });

    process.stdin.on("end", () => {});

    // indicate agent is ready
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
        if (r) this.send(r);
      } else if (evt.type === "action" && this.handlers.onAction) {
        const r = await this.handlers.onAction(evt);
        if (r) this.send(r);
      } else {
        this.send({ results: { status: "ignored", type: evt.type || null } });
      }
    } catch (err: any) {
      console.error("agent_handler_error", err?.stack ?? err);
      this.send({ error: "handler_error", results: { message: String(err?.message ?? err) } });
    }
  }

  send(obj: A2AResponse) {
    try {
      process.stdout.write(JSON.stringify(obj) + "\n");
    } catch (err) {
      console.error("send_error", err);
    }
  }
}
