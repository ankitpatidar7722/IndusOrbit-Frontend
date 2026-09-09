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
// - push / notificationclick: Web Push — show an OS notification even when the app
//             is closed, and focus/open the right page when the user taps it.
const SW_VERSION = "v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network pass-through — intentionally no caching. Keeps all data live/fresh.
});

// A push arrived from the server (works with the tab/app closed).
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : "" }; }

  const title = data.title || "Indus Orbit";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// User tapped the notification → focus an existing tab (navigating it) or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if ("focus" in client) {
          try {
            await client.focus();
            if ("navigate" in client && url) { try { await client.navigate(url); } catch { /* cross-scope */ } }
            return;
          } catch { /* try next */ }
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});
