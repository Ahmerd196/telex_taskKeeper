"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadReminders = loadReminders;
exports.saveReminders = saveReminders;
const KEY = "reminders";
async function loadReminders() {
    try {
        const raw = await telex.kv.get(KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
async function saveReminders(reminders) {
    await telex.kv.set(KEY, JSON.stringify(reminders));
}
