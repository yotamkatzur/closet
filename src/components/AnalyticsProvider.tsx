"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { flush, getSessionId, track } from "@/lib/analytics/client";

// Session bootstrap + route-change flush (analytics-spec §5).
export function AnalyticsProvider({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    getSessionId(); // ensure an id exists from day one
    let daysSince: number | null = null;
    try {
      const last = localStorage.getItem("closet_last_seen");
      if (last) {
        daysSince = Math.floor(
          (Date.now() - Number(last)) / 86_400_000,
        );
      }
      localStorage.setItem("closet_last_seen", String(Date.now()));
    } catch {
      /* ignore */
    }
    track("session_start", { days_since_last_session: daysSince });
    if (!signedIn) track("landing_view", { referrer: document.referrer || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    flush(); // flush buffered events on every route change
  }, [pathname]);

  return null;
}
