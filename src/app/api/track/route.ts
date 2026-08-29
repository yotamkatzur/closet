import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { track } from "@/lib/analytics";
import {
  backfillSessionUser,
  getBodyCard,
  insertFeedImpressions,
  markImpressionClicked,
} from "@/lib/db/repo";

interface Payload {
  session_id: string;
  events?: {
    event: string;
    props?: Record<string, unknown>;
    item_id?: string | null;
    tx_id?: string | null;
  }[];
  impressions?: {
    item_id: string;
    tier: "A" | "B" | "C";
    match_score: number | null;
    position: number;
    feed_mode: "chronological" | "ranked";
  }[];
}

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const sessionId = String(body.session_id || "anon").slice(0, 128);
  const userId = await getSessionUserId();

  // Anonymous session → user backfill (§5 rule 5)
  if (userId) backfillSessionUser(sessionId, userId);

  for (const e of body.events ?? []) {
    if (!e?.event) continue;
    track(e.event, {
      props: e.props,
      userId,
      sessionId,
      itemId: e.item_id ?? null,
      txId: e.tx_id ?? null,
    });
    // item_tap also flips the matching impression's `clicked` flag
    if (e.event === "item_tap" && userId && e.item_id) {
      markImpressionClicked(userId, sessionId, e.item_id);
    }
  }

  if (userId && (body.impressions?.length ?? 0) > 0) {
    // dedupe per (session, item) is handled client-side; guard body data here
    void getBodyCard; // body attrs never touch the impressions table
    insertFeedImpressions(
      body.impressions!.map((i) => ({
        user_id: userId,
        session_id: sessionId,
        item_id: i.item_id,
        tier: i.tier,
        match_score: i.match_score,
        position: i.position,
        feed_mode: i.feed_mode,
        clicked: false,
      })),
    );
  }

  return NextResponse.json({ ok: true });
}
