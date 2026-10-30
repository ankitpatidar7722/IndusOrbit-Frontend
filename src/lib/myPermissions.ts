// The acting user's effective per-module permissions, read from the SAME menu the sidebar uses
// (`createdynamicmenuwithsubmenu`, shared via lib/menuCache) — which returns only the modules the user
// can view (CanView=1), each carrying all seven permission flags. Lets pages gate actions (e.g. the
// "Create Client Project" button → the "Clients" module's CanSave) against User Management → Module Authority.
import { fetchMenuRows } from "@/lib/menuCache";

export interface ModulePerm {
  canView: boolean; canSave: boolean; canEdit: boolean; canDelete: boolean;
  canExport: boolean; canPrint: boolean; canCancel: boolean;
}

/** Map of ModuleName → permissions for the given user. Empty on error (callers fail open). */
export async function fetchMyModulePerms(userId?: number): Promise<Record<string, ModulePerm>> {
  if (!userId) return {};
  try {
    const arr = await fetchMenuRows(userId);
    const map: Record<string, ModulePerm> = {};
    for (const m of arr) {
      map[String(m.ModuleName)] = {
        canView: !!m.CanView, canSave: !!m.CanSave, canEdit: !!m.CanEdit, canDelete: !!m.CanDelete,
        canExport: !!m.CanExport, canPrint: !!m.CanPrint, canCancel: !!m.CanCancel,
      };
    }
    return map;
  } catch { return {}; }
}
