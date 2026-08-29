"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { computeKpis } from "@/lib/kpi";
import { saveKpiSnapshot } from "@/lib/db/repo";

function weekStart(d = new Date()): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export async function takeKpiSnapshot(note: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const k = computeKpis();
  saveKpiSnapshot({
    week_start: weekStart(),
    notes: note.trim() || null,
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
  revalidatePath("/admin/kpi");
  return { ok: true };
}
