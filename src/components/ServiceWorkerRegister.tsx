"use client";
import { useEffect } from "react";

/**
 * Registers the PWA service worker (/sw.js) so the app becomes installable on mobile.
 * Registered only in PRODUCTION so it never interferes with the local dev server (HMR).
 * The SW is a network pass-through (no caching) — see public/sw.js. `updateViaCache:"none"`
 * + the update check make sure a new deploy's SW is picked up immediately, no stale version.
 * Renders nothing.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => { reg.update().catch(() => {}); })
      .catch(() => { /* SW registration is best-effort; app works fine without it */ });
  }, []);

  return null;
}
