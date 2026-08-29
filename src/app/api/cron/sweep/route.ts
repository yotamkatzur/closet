import { NextResponse } from "next/server";
import { sweepTimeouts } from "@/lib/tx/engine";

// Timeout sweep: completes transactions whose 48h return window elapsed, and
// auto-refunds buyers when a seller goes silent 5 days after a return is
// delivered (spec section 6). Also fires the T-12h return reminder.
//
// Wire this to a scheduler:
//   Vercel Cron  -> add to vercel.json:  { "crons": [{ "path": "/api/cron/sweep", "schedule": "*/15 * * * *" }] }
//   Local dev    -> `while true; do curl -s localhost:3000/api/cron/sweep -H "x-cron-secret: $CRON_SECRET"; sleep 300; done`
//
// If CRON_SECRET is set it is required; otherwise the endpoint is open (fine
// for local pilot use).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.headers.get("x-cron-secret") ??
      new URL(req.url).searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }
  const result = await sweepTimeouts();
  return NextResponse.json({ ok: true, ...result });
}
