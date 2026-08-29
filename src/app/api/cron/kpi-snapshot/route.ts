import { NextResponse } from "next/server";
import { computeKpis } from "@/lib/kpi";
import { saveKpiSnapshot } from "@/lib/db/repo";

// Weekly frozen KPI numbers (analytics-spec §9). Schedule Monday 08:00 Israel.
// If CRON_SECRET is set it is required.
function weekStart(): string {
  const x = new Date();
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.headers.get("x-cron-secret") ??
      new URL(req.url).searchParams.get("secret");
    if (provided !== secret)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const k = computeKpis();
  saveKpiSnapshot({
    week_start: weekStart(),
    notes: null,
    metrics: {
      completed: k.transactions.completed,
      offplatform_reported: k.transactions.offplatform_reported,
      repeat_rate_pct: k.repeat_listing.repeat_rate_pct,
      active_members: k.active_members,
      buyer_rate_pct: k.buyer_rate.buyer_rate_pct,
      onboarding_completion_pct: k.onboarding_funnel.completion_pct,
      tier_a_ctr: k.tier_ctr.find((t) => t.tier === "A")?.ctr_pct ?? null,
      tier_c_ctr: k.tier_ctr.find((t) => t.tier === "C")?.ctr_pct ?? null,
    },
  });

  // Founder summary (analytics-spec §9) — WhatsApp/SMS in prod; console in pilot.
  console.info(
    `\n[KPI weekly] שבוע ${weekStart()} · Closet\n` +
      `עסקאות: ${k.transactions.completed} (+${k.transactions.offplatform_reported} מדווח עצמית)\n` +
      `פרסום חוזר: ${k.repeat_listing.repeat_rate_pct ?? "—"}%\n` +
      `CTR מותאם/לא: ${k.tier_ctr.find((t) => t.tier === "A")?.ctr_pct ?? "—"}% מול ${k.tier_ctr.find((t) => t.tier === "C")?.ctr_pct ?? "—"}%\n` +
      `חברות פעילות: ${k.active_members}\n` +
      k.size_coverage
        .filter((s) => s.live_listings < 3)
        .map((s) => `⚠️ מידה ${s.size}: ${s.live_listings} פריטים חיים — צריך לגייס`)
        .join("\n"),
  );

  return NextResponse.json({ ok: true, week_start: weekStart() });
}
