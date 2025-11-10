"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveReminders = exports.loadReminders = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const FILE_PATH = path_1.default.resolve(__dirname, "reminders.json");
// ---- Local Fallback for telex.kv ----
const memoryKv = {};
const globalAny = globalThis;
if (!globalAny.telex) {
    globalAny.telex = {
        kv: {
            async get(key) {
                return memoryKv[key] ?? null;
            },
            async set(key, value) {
                memoryKv[key] = value;
            }
        }
    };
}
// ---- End Fallback ----
// Use KV if available, else file storage
const loadReminders = async () => {
    try {
        const kv = globalThis.telex?.kv;
        if (kv) {
            const data = await kv.get("reminders");
            return data ? JSON.parse(data) : [];
        }
    }
    catch (err) {
        console.error("KV load failed:", err);
    }
    // fallback to local file
    if (!fs_1.default.existsSync(FILE_PATH))
        return [];
    try {
        return JSON.parse(fs_1.default.readFileSync(FILE_PATH, "utf-8"));
    }
    catch {
        return [];
    }
};
exports.loadReminders = loadReminders;
const saveReminders = async (reminders) => {
    try {
        const kv = globalThis.telex?.kv;
        if (kv) {
            await kv.set("reminders", JSON.stringify(reminders));
            return;
        }
    }
    catch (err) {
        console.error("KV save failed:", err);
    }
    // fallback to local file
    fs_1.default.writeFileSync(FILE_PATH, JSON.stringify(reminders, null, 2));
};
exports.saveReminders = saveReminders;
