// declare global Telex runtime KV api
declare const telex: {
  kv: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
};

export type Reminder = {
  id: string;
  text: string;
  time: string;
  channelId: string;
  done: boolean;
};

const KEY = "reminders";

export async function loadReminders(): Promise<Reminder[]> {
  try {
    const raw = await telex.kv.get(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveReminders(reminders: Reminder[]) {
  await telex.kv.set(KEY, JSON.stringify(reminders));
}
