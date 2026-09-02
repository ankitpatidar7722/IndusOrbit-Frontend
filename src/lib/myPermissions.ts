// The acting user's effective per-module permissions, read from the SAME endpoint the sidebar uses
// (`createdynamicmenuwithsubmenu`) — which returns only the modules the user can view (CanView=1),
// each carrying all seven permission flags. Lets pages gate actions (e.g. the "Create Client
// Project" button → the "Clients" module's CanSave) against User Management → Module Authority.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface ModulePerm {
  canView: boolean; canSave: boolean; canEdit: boolean; canDelete: boolean;
  canExport: boolean; canPrint: boolean; canCancel: boolean;
}

/** Map of ModuleName → permissions for the given user. Empty on error (callers fail open). */
export async function fetchMyModulePerms(userId?: number): Promise<Record<string, ModulePerm>> {
  if (!userId) return {};
  try {
    const res = await fetch(`${BASE}/api/othermaster/createdynamicmenuwithsubmenu`, {
      headers: { UserID: String(userId) }, cache: "no-store",
    });
    const arr = await res.json();
    const map: Record<string, ModulePerm> = {};
    if (Array.isArray(arr)) {
      for (const m of arr) {
        map[String(m.ModuleName)] = {
          canView: !!m.CanView, canSave: !!m.CanSave, canEdit: !!m.CanEdit, canDelete: !!m.CanDelete,
          canExport: !!m.CanExport, canPrint: !!m.CanPrint, canCancel: !!m.CanCancel,
        };
      }
    }
    return map;
  } catch { return {}; }
}
