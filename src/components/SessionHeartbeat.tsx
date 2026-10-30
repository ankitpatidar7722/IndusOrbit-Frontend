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
    // At most one ping per 30s: switching tabs back and forth used to send one on every return.
    let last = 0;
    const beat = () => { const now = Date.now(); if (now - last < 30_000) return; last = now; heartbeat(); };
    beat();                                        // immediately on load
    const t = setInterval(beat, 90_000);           // then every 90s
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [status]);
  return null;
}
