import { userIdHeader } from "@/lib/currentUser";
// Audit Logs API — the central activity trail (app.AuditLog).
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface AuditRow {
  id: number;
  createdAt: string;            // UTC ISO — display in IST
  userId?: number | null;
  userName?: string | null;
  action: string;              // Create | Update | Delete | Login | Logout | Export | Seed | Other
  module?: string | null;
  subModule?: string | null;   // tab / sub-area (e.g. "Tracker · Milestones")
  client?: string | null;      // "IA00274 · AnkitTesting"
  entityType?: string | null;  // Milestone / Change Request / …
  entityId?: string | null;
  summary?: string | null;
  changes?: string | null;     // JSON before/after
  httpMethod?: string | null;
  path?: string | null;
  statusCode?: number | null;
  success?: boolean | null;
  durationMs?: number | null;
  ipAddress?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  deviceId?: string | null;     // persistent per-browser device id (forensics)
  fingerprint?: string | null;  // device-traits hash
  userAgent?: string | null;
  payload?: string | null;
}

export interface AuditFacets { modules: string[]; actions: string[]; users: { id: number; name: string }[]; }

export interface AuditFilters {
  search?: string; module?: string; client?: string; action?: string; userId?: number | null;
  from?: string | null; to?: string | null; page?: number; pageSize?: number;
}

async function jget<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { ...userIdHeader() }, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const auditApi = {
  list: (f: AuditFilters) => {
    const q = new URLSearchParams();
    if (f.search) q.set("search", f.search);
    if (f.module) q.set("module", f.module);
    if (f.client) q.set("client", f.client);
    if (f.action) q.set("action", f.action);
    if (f.userId) q.set("userId", String(f.userId));
    if (f.from) q.set("from", f.from);
    if (f.to) q.set("to", f.to);
    q.set("page", String(f.page ?? 1));
    q.set("pageSize", String(f.pageSize ?? 50));
    return jget<{ success: boolean; rows: AuditRow[]; total: number; page: number; pageSize: number }>(`/api/audit-logs?${q.toString()}`);
  },
  facets: () => jget<{ success: boolean } & AuditFacets>("/api/audit-logs/facets"),
};

/** One login session — who signed in, when, for how long. */
export interface SessionRow {
  id: number;
  userId?: number | null;
  userName?: string | null;
  loginAt: string;              // UTC
  lastSeen: string;             // UTC
  logoutAt?: string | null;     // UTC
  durationMin?: number | null;  // minutes used
  endReason?: string | null;    // Logout | Timed out | Superseded | null (active)
  active: boolean;
  ipAddress?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  deviceId?: string | null;
}

export const sessionsApi = {
  list: (f: { userId?: number | null; activeOnly?: boolean; from?: string | null; to?: string | null; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (f.userId) q.set("userId", String(f.userId));
    if (f.activeOnly) q.set("activeOnly", "true");
    if (f.from) q.set("from", f.from);
    if (f.to) q.set("to", f.to);
    q.set("page", String(f.page ?? 1));
    q.set("pageSize", String(f.pageSize ?? 50));
    return jget<{ success: boolean; rows: SessionRow[]; total: number; page: number; pageSize: number }>(`/api/sessions?${q.toString()}`);
  },
};

/** minutes → "45 min" / "1h 23m". */
export function fmtDuration(min?: number | null): string {
  const m = Math.max(0, Math.round(min ?? 0));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Backend UTC datetime (no 'Z', 7-digit fractional seconds) → "08 Oct 2026, 02:08 PM" in IST. */
export function fmtIST(iso?: string | null): string {
  if (!iso) return "—";
  try {
    let s = iso.replace(/(\.\d{3})\d+/, "$1");                 // trim fractional seconds to ms (JS limit)
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += "Z";           // no timezone marker → it's UTC
    const d = new Date(s);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-GB", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).replace(/\b([ap])\.?m\.?\b/i, (m) => m.replace(/\./g, "").toUpperCase());  // "pm" → "PM"
  } catch { return iso; }
}
