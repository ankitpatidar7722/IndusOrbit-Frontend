// The acting user's effective view/edit permission for each client-detail tab.
// Backend logic: admin role → all view+edit; no config → view all / edit none;
// once configured in User Management → Module Authentication → explicit per tab.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface ClientTabPermission { key: string; canView: boolean; canEdit: boolean }
export type TabPermMap = Record<string, { canView: boolean; canEdit: boolean }>;

// Shared for a minute per user — the client detail body re-asked on every mount / session refresh.
const tabCache = new Map<number, { at: number; p: Promise<TabPermMap> }>();
const TAB_TTL_MS = 60_000;

/** Fetch the map { tabKey → {canView,canEdit} } for a user. Empty on error (caller defaults to view-all). */
export function fetchClientTabPermissions(userId?: number): Promise<TabPermMap> {
  if (!userId) return Promise.resolve({});
  const hit = tabCache.get(userId);
  if (hit && Date.now() - hit.at < TAB_TTL_MS) return hit.p;
  const p = loadClientTabPermissions(userId);
  tabCache.set(userId, { at: Date.now(), p });
  return p;
}

async function loadClientTabPermissions(userId: number): Promise<TabPermMap> {
  try {
    const res = await fetch(`${BASE}/api/client-tab-permissions?userId=${userId}`, { cache: "no-store" });
    const j = await res.json();
    if (j?.success && Array.isArray(j.data)) {
      const map: TabPermMap = {};
      for (const p of j.data as ClientTabPermission[]) map[p.key] = { canView: p.canView, canEdit: p.canEdit };
      return map;
    }
  } catch { /* backend down — caller falls back to view-all */ }
  tabCache.delete(userId);   // don't keep a failed/empty read for the whole minute
  return {};
}
