// Login-session tracking — a periodic heartbeat keeps the server-side session alive (so "how long the
// user used the app" is accurate), and an explicit logout closes it with the final duration. Browser
// close needs no call: once the heartbeat stops, the server sweeps the idle session after a few minutes.
import { signOut } from "next-auth/react";
import { getCurrentUserId } from "@/lib/currentUser";
import { deviceHeaders } from "@/lib/deviceId";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

/** Keep this user's session alive (+ stamp the originating device). Fire-and-forget. */
export function heartbeat(): void {
  const uid = getCurrentUserId();
  if (!uid) return;
  try { fetch(`${BASE}/api/sessions/heartbeat`, { method: "POST", headers: { UserID: String(uid), ...deviceHeaders() }, keepalive: true }); } catch { /* ignore */ }
}

/** Close this user's active session (records the session duration server-side). Awaitable. */
export async function recordLogout(): Promise<void> {
  const uid = getCurrentUserId();
  if (!uid) return;
  try { await fetch(`${BASE}/api/sessions/logout`, { method: "POST", headers: { UserID: String(uid), ...deviceHeaders() }, keepalive: true }); } catch { /* ignore */ }
}

/** Sign out — closes the audited session first, then runs next-auth sign-out. Drop-in for signOut(). */
export async function signOutTracked(opts?: { callbackUrl?: string }): Promise<void> {
  await recordLogout();
  signOut(opts ?? { callbackUrl: "/login" });
}
