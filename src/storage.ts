import fs from "fs";
import path from "path";

const FILE_PATH = path.resolve(__dirname, "reminders.json");

export type Reminder = {
  text: string;
  time: string;
};

export const loadReminders = (): Reminder[] => {
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
  } catch {
    return [];
  }
};

export const saveReminders = (reminders: Reminder[]) => {
  fs.writeFileSync(FILE_PATH, JSON.stringify(reminders, null, 2));
};
