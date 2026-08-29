import path from "node:path";

// Where mutable state lives. In production point DATA_DIR at a persistent
// volume (Railway: mount a volume and set DATA_DIR=/data). Everything the app
// writes — the JSON database and uploaded photos — goes under here, so one
// volume is all that needs to persist.
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), ".data");

export const DB_FILE = path.join(DATA_DIR, "db.json");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
