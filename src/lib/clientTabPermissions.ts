// The acting user's effective view/edit permission for each client-detail tab.
// Backend logic: admin role → all view+edit; no config → view all / edit none;
// once configured in User Management → Module Authentication → explicit per tab.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface ClientTabPermission { key: string; canView: boolean; canEdit: boolean }
export type TabPermMap = Record<string, { canView: boolean; canEdit: boolean }>;

/** Fetch the map { tabKey → {canView,canEdit} } for a user. Empty on error (caller defaults to view-all). */
export async function fetchClientTabPermissions(userId?: number): Promise<TabPermMap> {
  if (!userId) return {};
  try {
    const res = await fetch(`${BASE}/api/client-tab-permissions?userId=${userId}`, { cache: "no-store" });
    const j = await res.json();
    if (j?.success && Array.isArray(j.data)) {
      const map: TabPermMap = {};
      for (const p of j.data as ClientTabPermission[]) map[p.key] = { canView: p.canView, canEdit: p.canEdit };
      return map;
    }
  } catch { /* backend down — caller falls back to view-all */ }
  return {};
}
