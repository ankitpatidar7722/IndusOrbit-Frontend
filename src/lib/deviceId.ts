// A stable per-browser device identity for audit / forensics. Browsers forbid reading a real hardware
// serial / MAC / machine name, so instead we use (a) a persistent random Device ID kept in localStorage
// and (b) a Fingerprint hash of stable device traits. Together they answer "which machine+browser did
// this action come from" — e.g. to catch someone signing in as another user from their own device.
const KEY = "indus_device_id";

function uuid(): string {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch { /* ignore */ }
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Persistent, per-browser-profile device id (survives reloads; changes only if storage is cleared). */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = "D-" + uuid().replace(/-/g, ""); localStorage.setItem(KEY, id); }
    return id;
  } catch { return ""; }
}

/** Short hash of stable device/browser traits — survives a localStorage wipe (a semi-stable backup id). */
export function getFingerprint(): string {
  if (typeof window === "undefined") return "";
  try {
    const n = navigator as unknown as Record<string, unknown>;
    const s = screen;
    const parts = [
      n.userAgent, n.platform, n.language, Array.isArray(n.languages) ? n.languages.join(",") : "",
      n.hardwareConcurrency, n.deviceMemory, n.maxTouchPoints,
      `${s.width}x${s.height}x${s.colorDepth}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join("|");
    let h = 5381;                                   // djb2
    for (let i = 0; i < parts.length; i++) h = ((h << 5) + h + parts.charCodeAt(i)) >>> 0;
    return "FP-" + h.toString(36);
  } catch { return ""; }
}

/** Spread into fetch headers so the backend can record the originating device on every audited action. */
export function deviceHeaders(): Record<string, string> {
  const id = getDeviceId(), fp = getFingerprint();
  const h: Record<string, string> = {};
  if (id) h["X-Device-Id"] = id;
  if (fp) h["X-Device-Fp"] = fp;
  return h;
}
