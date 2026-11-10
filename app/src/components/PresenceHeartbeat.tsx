"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === "/login" || pathname.startsWith("/warden")) return;

    let interval: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    const heartbeat = async () => {
      try {
        const response = await fetch("/api/auth/presence", { method: "POST", cache: "no-store" });
        if (response.ok && !stopped && !interval) {
          interval = setInterval(() => {
            if (document.visibilityState === "visible") void heartbeat();
          }, 60_000);
        }
      } catch {
        // The dashboard will naturally show an expired heartbeat if the device is offline.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };

    void heartbeat();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname]);

  return null;
}
