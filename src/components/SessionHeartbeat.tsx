"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { heartbeat } from "@/lib/sessionTracking";

/** Mounts once (app-wide); while signed in, pings the server every 90s so the login session's duration
 *  stays accurate. No unload handler — a stopped heartbeat is swept server-side (so a refresh never
 *  ends the session, and a browser-close ends it within a few minutes). */
export default function SessionHeartbeat() {
  const { status } = useSession();
  useEffect(() => {
    if (status !== "authenticated") return;
    heartbeat();                                   // immediately on load
    const t = setInterval(heartbeat, 90_000);      // then every 90s
    const onVisible = () => { if (document.visibilityState === "visible") heartbeat(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [status]);
  return null;
}
