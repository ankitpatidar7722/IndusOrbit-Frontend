/**
 * Web Push helper — subscribe/unsubscribe the current device for OS-level notifications
 * (delivered even when the app is closed). The VAPID public key is fetched from the backend
 * (/api/push/vapid-public-key), the browser subscription is POSTed to /api/push/subscribe, and
 * a per-user localStorage flag remembers the user's choice so we can silently re-subscribe on
 * later loads (push subscriptions can expire / rotate). Server send side: Services/WebPushSender.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

const flagKey = (userId: number | string) => `indus.push.enabled.${userId}`;

/** VAPID base64url → the Uint8Array applicationServerKey the PushManager wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** 'default' | 'granted' | 'denied' | 'unsupported' */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

/** Whether the user previously turned push ON (used to auto-restore the subscription on load). */
export function pushPreferred(userId: number | string): boolean {
  try { return localStorage.getItem(flagKey(userId)) === "1"; } catch { return false; }
}

async function fetchVapidKey(): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/api/push/vapid-public-key`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { enabled?: boolean; key?: string };
    return j.enabled && j.key ? j.key : null;
  } catch { return null; }
}

/** Is this device currently subscribed (has a live PushSubscription)? */
export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/**
 * Turn push ON for this device: ask permission, subscribe via the SW, send the subscription to
 * the backend. Throws an Error (with a readable message) on any blocker so the caller can toast it.
 */
export async function subscribeToPush(userId: number | string, companyId: number | string = 1): Promise<void> {
  if (!pushSupported()) throw new Error("Push notifications aren't supported in this browser.");
  if (!(await navigator.serviceWorker.getRegistration()) && !navigator.serviceWorker.controller) {
    // Ensure a registration exists (dev/localhost or first run).
    try { await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }); } catch { /* ignore */ }
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification permission denied — allow it in your browser settings.");

  const reg = await navigator.serviceWorker.ready;
  const key = await fetchVapidKey();
  if (!key) throw new Error("Push isn't configured on the server yet.");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
  const r = await fetch(`${BASE}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", UserID: String(userId), CompanyID: String(companyId) },
    body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
  });
  if (!r.ok) throw new Error("Couldn't save the subscription on the server.");
  try { localStorage.setItem(flagKey(userId), "1"); } catch { /* ignore */ }
}

/** Turn push OFF for this device: drop the browser subscription + tell the backend to forget it. */
export async function unsubscribeFromPush(userId: number | string, companyId: number | string = 1): Promise<void> {
  try { localStorage.removeItem(flagKey(userId)); } catch { /* ignore */ }
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await fetch(`${BASE}/api/push/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", UserID: String(userId), CompanyID: String(companyId) },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

/**
 * Silently make sure the device is subscribed IF the user opted in earlier and permission is still
 * granted. Safe to call on every app load (idempotent). Never throws.
 */
export async function ensurePushIfPreferred(userId: number | string, companyId: number | string = 1): Promise<void> {
  try {
    if (!pushSupported() || !pushPreferred(userId) || Notification.permission !== "granted") return;
    await subscribeToPush(userId, companyId);
  } catch { /* best-effort */ }
}
