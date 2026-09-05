// Indus 360 — minimal service worker (PWA install enabler).
//
// This deliberately does NOT cache pages, API responses, or data: the app's data is
// live from the database and must always be fresh, so there is zero risk of showing
// stale content. The only reason this file exists is that browsers require a service
// worker with a fetch handler before they'll offer "Install / Add to Home Screen".
//
// - install:  activate the new version immediately (no "waiting" step).
// - activate: take control of open tabs right away.
// - fetch:    pass-through — we don't call respondWith(), so the browser fetches
//             normally over the network exactly as if no SW existed.
const SW_VERSION = "v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network pass-through — intentionally no caching. Keeps all data live/fresh.
});
