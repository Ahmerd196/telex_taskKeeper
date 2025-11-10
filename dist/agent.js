"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentHarness = void 0;
const readline_1 = __importDefault(require("readline"));
class AgentHarness {
    constructor() {
        this.handlers = {};
        this.rl = readline_1.default.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
        this.rl.on("line", (line) => {
            if (!line || !line.trim())
                return;
            let parsed = null;
            try {
                parsed = JSON.parse(line);
            }
            catch (err) {
                this.send({ error: "invalid_json" });
                return;
            }
            if (!parsed)
                return;
            this.handle(parsed);
        });
        process.stdin.on("end", () => { });
        // indicate agent is ready
        this.send({ results: { status: "agent_ready" } });
    }
    onMessage(fn) {
        this.handlers.onMessage = fn;
    }
    onAction(fn) {
        this.handlers.onAction = fn;
    }
    async handle(evt) {
        try {
            if (evt.type === "message" && this.handlers.onMessage) {
                const r = await this.handlers.onMessage(evt);
                if (r)
                    this.send(r);
            }
            else if (evt.type === "action" && this.handlers.onAction) {
                const r = await this.handlers.onAction(evt);
                if (r)
                    this.send(r);
            }
            else {
                this.send({ results: { status: "ignored", type: evt.type || null } });
            }
        }
        catch (err) {
            console.error("agent_handler_error", err?.stack ?? err);
            this.send({ error: "handler_error", results: { message: String(err?.message ?? err) } });
        }
    }
    send(obj) {
        try {
            process.stdout.write(JSON.stringify(obj) + "\n");
        }
        catch (err) {
            console.error("send_error", err);
        }
    }
}
exports.AgentHarness = AgentHarness;
