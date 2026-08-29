import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getItem,
  getUser,
  listAllEvents,
  listAllItems,
  listAllRequests,
  listAllTx,
  listReports,
  listUsers,
} from "@/lib/db/repo";
import {
  ItemModControls,
  ResolveReportButton,
  RunSweepButton,
  TxAdminControls,
  UserModControls,
} from "@/components/AdminClient";
import { Header } from "@/components/ui";
import { REQUEST_STATE_HE, TX_STATE_HE, he, shekels } from "@/data/he";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/profile?next=/admin");
  if (!user.is_admin) redirect("/");

  const txs = listAllTx();
  const flagged = txs.filter(
    (t) => t.state === "DISPUTED" || t.mismatch_flagged_at,
  );
  const items = listAllItems();
  const users = listUsers();
  const reports = listReports();
  const requests = listAllRequests();
  const events = listAllEvents().slice(0, 100);

  return (
    <div className="pb-10">
      <Header
        title={he.admin.title}
        back="/"
        right={
          <Link
            href="/admin/kpi"
            className="rounded-full bg-blush-500 px-3 py-1 text-xs font-semibold text-white"
          >
            {he.admin.kpi}
          </Link>
        }
      />
      <div className="p-4">
        <RunSweepButton />
      </div>

      <Section title={`${he.admin.flagged} (${flagged.length})`}>
        {flagged.length === 0 && <Empty />}
        {flagged.map((t) => (
          <Line key={t.id}>
            <span className="text-[11px]">
              <Link href={`/item/${t.item_id}`} className="underline">
                {getItem(t.item_id)?.title ?? "—"}
              </Link>{" "}
              · {TX_STATE_HE[t.state]}
              {t.mismatch_flagged_at && " · אי-התאמת תשלום"} ·{" "}
              {getUser(t.buyer_id)?.display_name} ← {getUser(t.seller_id)?.display_name}
            </span>
            <TxAdminControls txId={t.id} state={t.state} />
          </Line>
        ))}
      </Section>

      <Section title={`${he.admin.requests} (${requests.length})`}>
        {requests.slice(0, 40).map((r) => (
          <Line key={r.id}>
            <span className="text-[11px]">
              <Link href={`/item/${r.item_id}`} className="underline">
                {getItem(r.item_id)?.title ?? "—"}
              </Link>{" "}
              · {REQUEST_STATE_HE[r.state]} · {getUser(r.buyer_id)?.display_name} →{" "}
              {getUser(r.seller_id)?.display_name}
            </span>
          </Line>
        ))}
        {requests.length === 0 && <Empty />}
      </Section>

      <Section title={`${he.admin.transactions} (${txs.length})`}>
        {txs.map((t) => (
          <Line key={t.id}>
            <span className="text-[11px]">
              <Link href={`/item/${t.item_id}`} className="underline">
                {getItem(t.item_id)?.title ?? "—"}
              </Link>{" "}
              · {TX_STATE_HE[t.state]} · {shekels(t.price_agorot)} · קוד{" "}
              {t.payment_ref}
              <br />
              {getUser(t.buyer_id)?.display_name} ← {getUser(t.seller_id)?.display_name}
            </span>
            <TxAdminControls txId={t.id} state={t.state} />
          </Line>
        ))}
        {txs.length === 0 && <Empty />}
      </Section>

      <Section title={`${he.admin.items} (${items.length})`}>
        {items.map((i) => (
          <Line key={i.id}>
            <span className="text-[11px]">
              <Link href={`/item/${i.id}`} className="underline">
                {i.title}
              </Link>{" "}
              · {i.status} · {shekels(i.price_agorot)} ·{" "}
              {getUser(i.owner_id)?.display_name}
            </span>
            <ItemModControls itemId={i.id} hidden={i.status === "hidden"} />
          </Line>
        ))}
      </Section>

      <Section title={`${he.admin.users} (${users.length})`}>
        {users.map((u) => (
          <Line key={u.id}>
            <span className="text-[11px]">
              <Link href={`/u/${u.id}`} className="underline">
                {u.display_name}
              </Link>{" "}
              · {u.phone}
              {u.is_admin && " · ADMIN"}
              {u.is_suspended && " · מושעה"}
              {u.blocked_user_ids.length > 0 &&
                ` · חסמה ${u.blocked_user_ids.length}`}
            </span>
            <UserModControls userId={u.id} suspended={u.is_suspended} />
          </Line>
        ))}
      </Section>

      <Section
        title={`${he.admin.reports} (${reports.filter((r) => !r.resolved).length})`}
      >
        {reports.length === 0 && <Empty text={he.admin.noReports} />}
        {reports.map((r) => (
          <Line key={r.id}>
            <span className={`text-[11px] ${r.resolved ? "opacity-40" : ""}`}>
              {r.target_type === "item" ? "פריט" : "משתמשת"}:{" "}
              <Link
                href={
                  r.target_type === "item"
                    ? `/item/${r.target_id}`
                    : `/u/${r.target_id}`
                }
                className="underline"
              >
                {r.target_id.slice(0, 8)}
              </Link>{" "}
              · {r.reason} · {getUser(r.reporter_id)?.display_name}
            </span>
            {!r.resolved && <ResolveReportButton reportId={r.id} />}
          </Line>
        ))}
      </Section>

      <Section title={he.admin.events}>
        <ul className="space-y-1 px-3 text-[10px] text-stone-500">
          {events.map((e) => (
            <li key={e.id}>
              {new Date(e.created_at).toLocaleString("he-IL")} ·{" "}
              {e.from_state ?? "∅"}→{e.to_state} · {e.note}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-2">
      <h2 className="sticky top-[57px] z-10 bg-stone-100 px-4 py-1.5 text-xs font-bold text-stone-600">
        {title}
      </h2>
      <div className="divide-y divide-stone-100">{children}</div>
    </section>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
      {children}
    </div>
  );
}

function Empty({ text = "—" }: { text?: string }) {
  return <p className="px-4 py-3 text-xs text-stone-400">{text}</p>;
}
