"use client";

import { useEffect } from "react";
import { markAllNotificationsRead } from "@/lib/actions/misc";

export function MarkReadOnView() {
  useEffect(() => {
    markAllNotificationsRead();
  }, []);
  return null;
}
