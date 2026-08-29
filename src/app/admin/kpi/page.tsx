import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { computeKpis } from "@/lib/kpi";
import { listKpiSnapshots } from "@/lib/db/repo";
import { SnapshotButton } from "@/components/KpiClient";
import { Header } from "@/components/ui";

// Founder-readable KPI dashboard (analytics-spec §8). Hebrew. Raw counts always
// shown next to rates. Targets are the GTM pilot criteria.
export default async function KpiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/profile?next=/admin/kpi");
  if (!user.is_admin) redirect("/");

  const k = computeKpis();
  const snapshots = listKpiSnapshots();

  const tierA = k.tier_ctr.find((t) => t.tier === "A");
  const tierC = k.tier_ctr.find((t) => t.tier === "C");
  const ctrRatio =
    tierA?.ctr_pct && tierC?.ctr_pct ? tierA.ctr_pct / tierC.ctr_pct : null;

  return (
    <div className="space-y-5 pb-12">
      <Header title="מדדי הפיילוט" back="/admin" right={<SnapshotButton />} />

      {/* Top row */}
      <div className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-2">
        <Tile
          label="עסקאות שהושלמו"
          value={`${k.transactions.completed} / 12`}
          sub={`+ ${k.transactions.offplatform_reported} מדווח עצמית (מספר מינימום)`}
          pctOfTarget={k.transactions.completed / 12}
        />
        <Tile
          label="פרסום חוזר"
          value={
            k.repeat_listing.repeat_rate_pct === null
              ? "—"
              : `${k.repeat_listing.repeat_rate_pct}% (${k.repeat_listing.repeat_sellers}/${k.repeat_listing.sellers})`
          }
          sub="יעד 40%"
          pctOfTarget={(k.repeat_listing.repeat_rate_pct ?? 0) / 40}
        />
        <Tile
          label="CTR מותאם מול לא"
          value={
            tierA?.ctr_pct != null && tierC?.ctr_pct != null
              ? `${tierA.ctr_pct}% / ${tierC.ctr_pct}%`
              : "אין מספיק נתונים"
          }
          sub={
            ctrRatio
              ? ctrRatio >= 2
                ? `✓ פי ${ctrRatio.toFixed(1)}`
                : `פי ${ctrRatio.toFixed(1)} — לא מובהק`
              : "צריך יותר חשיפות"
          }
        />
        <Tile
          label="חברות פעילות (14 יום)"
          value={`${k.active_members} / 40`}
          pctOfTarget={k.active_members / 40}
        />
      </div>

      {/* Onboarding funnel */}
      <Panel title="משפך אונבורדינג">
        <FunnelBar rows={[
          ["נחתו", k.onboarding_funnel.landed],
          ["ראו את הבקשה", k.onboarding_funnel.prompted],
          ["התחילו למלא", k.onboarding_funnel.started],
          ["שלחו מידות", k.onboarding_funnel.submitted],
          ["התחברו", k.onboarding_funnel.authed],
        ]} />
        <p className="mt-2 text-xs text-stone-500">
          השלמה: {k.onboarding_funnel.completion_pct ?? "—"}% (יעד 40%). הפער בין
          &quot;התחילו&quot; ל&quot;שלחו&quot; = האם נשים מוכנות לשתף מידות.
        </p>
      </Panel>

      {/* Size coverage */}
      <Panel title="כיסוי מידות — יעד ≥3 פריטים חיים בכל תא">
        <table className="w-full text-xs">
          <tbody>
            {k.size_coverage.map((s) => (
              <tr
                key={s.size}
                className={s.live_listings < 3 ? "bg-red-50 text-red-700" : ""}
              >
                <td className="py-1 font-semibold">{s.size}</td>
                <td>{s.members} חברות</td>
                <td>{s.live_listings} פריטים חיים</td>
                <td>{s.live_listings < 3 ? "צריך לגייס" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-stone-400">
          גובה:{" "}
          {k.height_coverage.map((h) => `${h.band}: ${h.members}`).join(" · ")}
        </p>
      </Panel>

      {/* Tier CTR by position band — the confound check */}
      <Panel title="CTR לפי טיר וטווח מיקום (בדיקת הטיה)">
        {k.tier_ctr_by_position.length === 0 ? (
          <p className="text-xs text-stone-400">אין עדיין מספיק חשיפות.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-stone-400">
                <th className="text-right">מיקום</th>
                <th>טיר</th>
                <th>חשיפות</th>
                <th>CTR</th>
              </tr>
            </thead>
            <tbody>
              {k.tier_ctr_by_position.map((r, i) => (
                <tr key={i}>
                  <td>{r.band}</td>
                  <td>{r.tier}</td>
                  <td>{r.impressions}</td>
                  <td>{r.ctr_pct ?? "—"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-stone-400">
          אם טיר A מנצח את C בתוך כל טווח מיקום — ההשפעה אמיתית.
        </p>
      </Panel>

      <Panel title="שיעור החזרות לפי טיר — האות החזק ביותר">
        <table className="w-full text-xs">
          <tbody>
            {k.return_by_tier.map((r) => (
              <tr key={r.tier}>
                <td className="font-semibold">טיר {r.tier}</td>
                <td>נשמרו {r.kept}</td>
                <td>הוחזרו {r.returned}</td>
                <td>{r.return_rate_pct ?? "—"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {k.return_reasons.length > 0 && (
          <p className="mt-2 text-xs text-stone-400">
            סיבות:{" "}
            {k.return_reasons.map((r) => `${r.reason} (${r.n})`).join(" · ")}
          </p>
        )}
      </Panel>

      <Panel title="תשלום — שלוש המספרים שמעריכים את המודל">
        <ul className="space-y-1 text-xs">
          <li>
            שיעור אישור בקשות: {k.payment.approval_rate_pct ?? "—"}% (
            {k.payment.approved}/{k.payment.sent})
          </li>
          <li>
            חשיפה → תשלום מאושר: {k.payment.reveal_to_paid_pct ?? "—"}%
          </li>
          <li>אי-התאמות תשלום: {k.payment.mismatch_count}</li>
        </ul>
      </Panel>

      <Panel title="מכירות מחוץ לאתר — מדווח עצמית, מספר מינימום">
        {k.offplatform_channels.length === 0 ? (
          <p className="text-xs text-stone-400">אין עדיין דיווחים.</p>
        ) : (
          <p className="text-xs">
            {k.offplatform_channels
              .map((c) => `${c.channel}: ${c.n}`)
              .join(" · ")}
          </p>
        )}
      </Panel>

      <Panel title="חיפושים ללא תוצאות — דוח פערי קטלוג (20 אחרונים)">
        {k.zero_result_searches.length === 0 ? (
          <p className="text-xs text-stone-400">אין.</p>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {k.zero_result_searches.map((s, i) => (
              <li key={i}>
                &quot;{s.query || "(סינון בלבד)"}&quot; ·{" "}
                {new Date(s.at).toLocaleDateString("he-IL")}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {k.ai_field_correction.length > 0 && (
        <Panel title="תיקוני AI — מעל 50% = לא למלא אוטומטית ב-v2">
          <ul className="text-xs">
            {k.ai_field_correction.map((f) => (
              <li key={f.field}>
                {f.field}: {f.corrections}/{f.fills} תוקנו
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="פריטים תקועים — חיים 21+ ימים ללא כניסה">
        {k.stale_listings.length === 0 ? (
          <p className="text-xs text-stone-400">אין.</p>
        ) : (
          <ul className="text-xs">
            {k.stale_listings.map((s) => (
              <li key={s.item_id}>
                <Link href={`/item/${s.item_id}`} className="underline">
                  {s.title}
                </Link>{" "}
                · {s.days_live} ימים
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {snapshots.length > 0 && (
        <Panel title="מגמה שבועית">
          <table className="w-full text-xs">
            <tbody>
              {snapshots.map((s) => {
                const m = s.metrics as Record<string, number>;
                return (
                  <tr key={s.week_start}>
                    <td>{s.week_start}</td>
                    <td>עסקאות {m.completed}</td>
                    <td>פרסום חוזר {m.repeat_rate_pct ?? "—"}%</td>
                    <td>פעילות {m.active_members}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}

      <p className="px-4 text-[11px] text-stone-400">
        בגודל מדגם כזה רוב ההפרשים הם רעש. הפרש מתחת לפי 2–3 = כיווני בלבד. משקלי
        את ההערות האיכותניות השבועיות לפחות כמו הלוח.
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  pctOfTarget,
}: {
  label: string;
  value: string;
  sub?: string;
  pctOfTarget?: number;
}) {
  const p = pctOfTarget != null ? Math.min(1, Math.max(0, pctOfTarget)) : null;
  return (
    <div className="rounded-2xl border border-blush-100 bg-white p-3">
      <p className="text-xs text-stone-400">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {p != null && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full ${p >= 1 ? "bg-green-500" : "bg-blush-400"}`}
            style={{ width: `${p * 100}%` }}
          />
        </div>
      )}
      {sub && <p className="mt-1 text-[11px] text-stone-400">{sub}</p>}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-4 rounded-2xl border border-blush-100 bg-white p-3">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

function FunnelBar({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="space-y-1">
      {rows.map(([label, n]) => (
        <div key={label} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 text-stone-500">{label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-stone-100">
            <div
              className="h-full bg-blush-400"
              style={{ width: `${(n / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-left font-semibold">{n}</span>
        </div>
      ))}
    </div>
  );
}
