import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { UPLOADS_DIR } from "@/lib/paths";

// Serves uploaded photos from the data volume. Kept out of /public so it works
// with a mounted volume and Next standalone output.
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  const name = parts.join("/");
  // no traversal
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return new NextResponse("bad request", { status: 400 });
  }
  const file = path.join(UPLOADS_DIR, name);
  if (!file.startsWith(UPLOADS_DIR) || !fs.existsSync(file)) {
    return new NextResponse("not found", { status: 404 });
  }
  const ext = path.extname(name).toLowerCase();
  const data = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
