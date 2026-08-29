import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { UPLOADS_DIR } from "./paths";

// Photos arrive already resized client-side (max 1600px, ~85% JPEG). Here we
// persist the bytes under the data volume and hand back a URL served by
// src/app/media/[...path]/route.ts. Swap for Supabase Storage (signed URLs,
// private bucket) if the pilot outgrows a single instance — see spec section 9.
export function saveDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/s);
  if (!m) throw new Error("bad image data");
  const ext = m[2] === "jpeg" ? "jpg" : m[2] === "svg+xml" ? "svg" : m[2];
  const buf = Buffer.from(m[3], "base64");
  if (buf.length > 6_000_000) throw new Error("image too large");
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
  return `/media/${name}`;
}

/** Write raw bytes (used by the seed script for placeholder images). */
export function saveBytes(bytes: Buffer, ext: string): string {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), bytes);
  return `/media/${name}`;
}
