import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getItem, getUser, listRequestsForSeller } from "@/lib/db/repo";
import { RequestRow } from "@/components/RequestRow";
import { EmptyState, Header } from "@/components/ui";
import { REQUEST_STATE_HE, he, shekels } from "@/data/he";

export default async function RequestsInboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/profile?next=/requests");

  const reqs = listRequestsForSeller(user.id);
  const pending = reqs.filter((r) => r.state === "pending");
  const past = reqs.filter((r) => r.state !== "pending");

  return (
    <div>
      <Header title={he.request.inboxTitle} back="/deals" />
      {pending.length === 0 && past.length === 0 ? (
        <EmptyState>{he.request.none}</EmptyState>
      ) : (
        <div className="space-y-3 p-3">
          {pending.map((r) => {
            const item = getItem(r.item_id);
            const buyer = getUser(r.buyer_id);
            return (
              <RequestRow
                key={r.id}
                requestId={r.id}
                asSeller
                itemTitle={item?.title ?? "שמלה"}
                counterpartyName={buyer?.display_name ?? "—"}
                priceAgorot={item?.price_agorot ?? 0}
                expiresAt={r.expires_at}
                message={r.message}
              />
            );
          })}
          {past.length > 0 && (
            <ul className="space-y-1 pt-2 text-xs text-stone-400">
              {past.map((r) => {
                const item = getItem(r.item_id);
                return (
                  <li key={r.id}>
                    <Link href={`/item/${r.item_id}`} className="underline">
                      {item?.title}
                    </Link>{" "}
                    · {shekels(item?.price_agorot ?? 0)} ·{" "}
                    {REQUEST_STATE_HE[r.state]}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
