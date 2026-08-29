import { NextResponse } from "next/server";
import { readDB } from "@/lib/db/repo";

export function GET() {
  try {
    const db = readDB();
    return NextResponse.json({
      ok: true,
      users: db.users.length,
      items: db.items.length,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
