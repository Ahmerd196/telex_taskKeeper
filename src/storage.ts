import fs from "fs";
import path from "path";

const FILE_PATH = path.resolve(__dirname, "reminders.json");

// Define type
export type Reminder = {
  text: string;
  time: string;
};

// ---- Local Fallback for telex.kv ----
const memoryKv: Record<string, string> = {};
const globalAny = globalThis as any;

if (!globalAny.telex) {
  globalAny.telex = {
    kv: {
      async get(key: string) {
        return memoryKv[key] ?? null;
      },
      async set(key: string, value: string) {
        memoryKv[key] = value;
      }
    }
  };
}
// ---- End Fallback ----

// Use KV if available, else file storage
export const loadReminders = async (): Promise<Reminder[]> => {
  try {
    const kv = (globalThis as any).telex?.kv;
    if (kv) {
      const data = await kv.get("reminders");
      return data ? JSON.parse(data) : [];
    }
  } catch (err) {
    console.error("KV load failed:", err);
  }

  // fallback to local file
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
  } catch {
    return [];
  }
};

export const saveReminders = async (reminders: Reminder[]) => {
  try {
    const kv = (globalThis as any).telex?.kv;
    if (kv) {
      await kv.set("reminders", JSON.stringify(reminders));
      return;
    }
  } catch (err) {
    console.error("KV save failed:", err);
  }

  // fallback to local file
  fs.writeFileSync(FILE_PATH, JSON.stringify(reminders, null, 2));
};
