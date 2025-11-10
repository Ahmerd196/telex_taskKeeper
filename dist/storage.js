"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveReminders = exports.loadReminders = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const FILE_PATH = path_1.default.resolve(__dirname, "reminders.json");
const loadReminders = () => {
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
const saveReminders = (reminders) => {
    fs_1.default.writeFileSync(FILE_PATH, JSON.stringify(reminders, null, 2));
};
exports.saveReminders = saveReminders;
