import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listNotifications } from "@/lib/db/repo";
import { EmptyState, Header } from "@/components/ui";
import { MarkReadOnView } from "@/components/MarkReadOnView";
import { he } from "@/data/he";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/profile?next=/notifications");
  const notes = listNotifications(user.id);

  return (
    <div>
      <Header title={he.notifications.title} back="/" />
      <MarkReadOnView />
      {notes.length === 0 ? (
        <EmptyState>{he.notifications.none}</EmptyState>
      ) : (
        <ul className="divide-y divide-blush-50">
          {notes.map((n) => (
            <li key={n.id} className={n.read ? "opacity-60" : ""}>
              <Link
                href={n.href ?? "#"}
                className="block px-4 py-3 text-sm"
              >
                {!n.read && (
                  <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blush-500" />
                )}
                {n.body}
                <span className="mt-0.5 block text-[11px] text-stone-400">
                  {new Date(n.created_at).toLocaleString("he-IL")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
