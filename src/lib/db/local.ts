// Zero-setup JSON store. Not for scale — for a 40-person pilot it is plenty and
// removes every "set up a database" step for a non-technical founder.
//
// Everything is synchronous on purpose: single Node process, tiny data, and
// sync fs gives us a crude but correct write lock (no interleaved writes).

import fs from "node:fs";
import { DBShape, emptyDB } from "./schema";
import { DATA_DIR, DB_FILE } from "../paths";

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readDB(): DBShape {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    const fresh = emptyDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const parsed = JSON.parse(raw) as Partial<DBShape>;
  // merge so new collections added later don't break an old file
  return { ...emptyDB(), ...parsed };
}

export function writeDB(data: DBShape): void {
  ensureDir();
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/** Read, mutate in a callback, write back. The callback may return a value. */
export function mutate<T>(fn: (db: DBShape) => T): T {
  const db = readDB();
  const result = fn(db);
  writeDB(db);
  return result;
}
