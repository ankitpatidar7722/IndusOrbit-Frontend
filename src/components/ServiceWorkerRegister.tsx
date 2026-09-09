"use client";
import { useEffect } from "react";

/**
 * Registers the PWA service worker (/sw.js) so the app becomes installable AND can receive
 * Web Push notifications. Registered in PRODUCTION, and also on LOCALHOST so push can be
 * tested during development (localhost is a secure context; the SW is a network pass-through
 * with NO caching — see public/sw.js — so it doesn't interfere with HMR). On other non-prod
 * hosts it stays off. `updateViaCache:"none"` + the update check pick up a new SW immediately.
 * Renders nothing.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    if (process.env.NODE_ENV !== "production" && !isLocalhost) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => { reg.update().catch(() => {}); })
      .catch(() => { /* SW registration is best-effort; app works fine without it */ });
  }, []);

  return null;
}
