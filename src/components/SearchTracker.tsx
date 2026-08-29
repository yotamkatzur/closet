"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

export function SearchTracker({
  query,
  filters,
  resultsCount,
}: {
  query: string;
  filters: Record<string, string>;
  resultsCount: number;
}) {
  useEffect(() => {
    if (!query && Object.keys(filters).length === 0) return;
    track("search_performed", {
      query_text: query,
      filters,
      results_count: resultsCount,
    });
    if (resultsCount === 0) {
      track("search_zero_results", { query_text: query, filters });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
