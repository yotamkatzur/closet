"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { he } from "@/data/he";
import { Avatar } from "./Avatar";

const tabs = (userId: string | null) => [
  { href: "/", label: he.nav.feed, icon: "◇" },
  { href: "/search", label: he.nav.search, icon: "⌕" },
  { href: "/sell", label: he.nav.sell, icon: "＋" },
  { href: "/deals", label: he.nav.deals, icon: "⇄" },
  { href: userId ? `/u/${userId}` : "/profile", label: he.nav.profile, icon: "◍" },
];

export function BottomNav({
  signedIn,
  isAdmin,
  unread,
  hasBodyCard,
  userId,
  avatarUrl,
  displayName,
}: {
  signedIn: boolean;
  isAdmin: boolean;
  unread: number;
  hasBodyCard: boolean;
  userId: string | null;
  avatarUrl?: string | null;
  displayName?: string;
}) {
  const pathname = usePathname();
  const items = tabs(userId);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-blush-100 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((t) => {
          const active =
            t.href === "/"
              ? pathname === "/"
              : pathname.startsWith(t.href.replace(/\/u\/.*/, "/u/"));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                active ? "text-blush-600" : "text-stone-400"
              }`}
            >
              {t.label === he.nav.profile && signedIn && avatarUrl ? (
                <Avatar
                  name={displayName ?? ""}
                  url={avatarUrl}
                  size={22}
                  className={active ? "ring-2 ring-blush-500" : ""}
                />
              ) : (
                <span className="text-xl leading-none">{t.icon}</span>
              )}
              {t.label}
            </Link>
          );
        })}
      </div>
      {(signedIn && (unread > 0 || !hasBodyCard || isAdmin)) && (
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-3 border-t border-blush-100 bg-blush-50 px-3 py-1 text-[11px] text-blush-600">
          {!hasBodyCard && (
            <Link href="/profile" className="underline">
              {he.match.needBodyCard}
            </Link>
          )}
          {unread > 0 && (
            <Link href="/notifications" className="underline">
              {he.notifications.title} ({unread})
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className="underline">
              {he.nav.admin}
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
