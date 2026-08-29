import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { getCurrentUser } from "@/lib/auth";
import { countUnreadNotifications, getBodyCard } from "@/lib/db/repo";
import { he } from "@/data/he";

export const metadata: Metadata = {
  title: he.appName + " — " + he.tagline,
  description: he.tagline,
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#fdfcfb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const unread = user ? countUnreadNotifications(user.id) : 0;
  const hasBodyCard = user ? !!getBodyCard(user.id) : false;

  return (
    <html lang="he" dir="rtl">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&family=Assistant:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <AnalyticsProvider signedIn={!!user} />
        <div className="mx-auto min-h-screen max-w-2xl bg-paper shadow-sm safe-bottom">
          {children}
        </div>
        <BottomNav
          signedIn={!!user}
          isAdmin={!!user?.is_admin}
          unread={unread}
          hasBodyCard={hasBodyCard}
          userId={user?.id ?? null}
          avatarUrl={user?.avatar_url ?? null}
          displayName={user?.display_name}
        />
      </body>
    </html>
  );
}
