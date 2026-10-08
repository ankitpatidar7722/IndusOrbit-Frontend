// Route-level access control. The sidebar only SHOWS modules the user can view, but a user could
// still reach a page by typing its URL (e.g. /users). This reads the user's full module authority
// (app.ModuleMaster × app.UserModuleAuthentication, via GET /api/users/{id}/modules) and decides
// whether the current route is a module the user is NOT allowed to view.
//
// The SAME fetch also yields the full per-module permission flags (view/save/edit/delete/export/
// print/cancel), which power `usePageAccess()` (see contexts/ModuleAuthContext.tsx) so every page's
// action controls (grid edit/delete, custom buttons) are gated against User Management → Module
// Authentication — not just hidden from the sidebar.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

/** normalized route (lowercase, no trailing slash) → CanView. Only real "/…" module routes. */
export type ModuleAccessMap = Record<string, boolean>;

/** The seven per-module permission flags. */
export interface ModulePerm {
  canView: boolean; canSave: boolean; canEdit: boolean; canDelete: boolean;
  canExport: boolean; canPrint: boolean; canCancel: boolean;
}
/** normalized module key (route "/…" OR a non-sidebar key like "clienttab-templates") → flags. */
export type ModulePermMap = Record<string, ModulePerm>;

let accessCache: { userId: number; map: ModuleAccessMap; perms: ModulePermMap } | null = null;

const norm = (p: string) => (p || "").trim().toLowerCase().replace(/\/+$/, "") || "/";

/** Synchronous read of the cached CanView map for a user (null if not fetched yet) — lets the guard
 *  avoid a loading flash on client-side navigations after the first load. */
export function getCachedModuleAccess(userId?: number): ModuleAccessMap | null {
  return userId && accessCache?.userId === userId ? accessCache.map : null;
}

/** Synchronous read of the cached full per-module permission map (null if not fetched yet). */
export function getCachedModulePerms(userId?: number): ModulePermMap | null {
  return userId && accessCache?.userId === userId ? accessCache.perms : null;
}

/** Fetch (and cache) the user's authority for EVERY module: both the CanView map (route gating) and
 *  the full per-module permission flags. Empty maps on error → fail open. */
export async function fetchMyModuleAccess(userId?: number): Promise<ModuleAccessMap> {
  if (!userId) return {};
  const cached = getCachedModuleAccess(userId);
  if (cached) return cached;
  try {
    const res = await fetch(`${BASE}/api/users/${userId}/modules`, { headers: { UserID: String(userId) }, cache: "no-store" });
    const j = await res.json();
    const map: ModuleAccessMap = {};
    const perms: ModulePermMap = {};
    if (j?.success && Array.isArray(j.data)) {
      for (const m of j.data) {
        const name = norm(String(m.moduleName ?? ""));
        if (!name) continue;
        perms[name] = {
          canView: !!m.canView, canSave: !!m.canSave, canEdit: !!m.canEdit, canDelete: !!m.canDelete,
          canExport: !!m.canExport, canPrint: !!m.canPrint, canCancel: !!m.canCancel,
        };
        // Only real page routes are gated for *view*; never gate the landing/home route ("/").
        if (name.startsWith("/") && name !== "/") map[name] = !!m.canView;
      }
    }
    accessCache = { userId, map, perms };
    return map;
  } catch {
    return {};   // network/permission blip → don't lock the user out
  }
}

/** Ensure the per-module permission map is loaded, returning it (fetches once, then cached). */
export async function fetchMyModulePerms(userId?: number): Promise<ModulePermMap> {
  if (!userId) return {};
  const cached = getCachedModulePerms(userId);
  if (cached) return cached;
  await fetchMyModuleAccess(userId);              // populates accessCache.perms as a side effect
  return getCachedModulePerms(userId) ?? {};
}

/** Drop the cache (e.g. after an admin changes this user's authority). */
export function clearModuleAccessCache() { accessCache = null; }

/** The module route that most specifically owns `pathname` (longest "/…" prefix), or null when the
 *  path maps to no module (dashboard, settings, self-service, …). */
function bestRouteFor(pathname: string, keys: string[]): string | null {
  const path = norm(pathname);
  let best: string | null = null;
  for (const route of keys) {
    if (!route.startsWith("/") || route === "/") continue;   // only real page routes own a path
    if (path === route || path.startsWith(route + "/")) {
      if (best === null || route.length > best.length) best = route;
    }
  }
  return best;
}

/** True when `pathname` maps to a module the user may NOT view. A route with no matching module
 *  (dashboard, settings, self-service pages, …) is never gated. Matches the MOST specific module
 *  route that is a prefix of the path, so /implementation/signoff is checked before /implementation. */
export function isRouteDenied(pathname: string, map: ModuleAccessMap): boolean {
  const best = bestRouteFor(pathname, Object.keys(map));
  return best !== null && map[best] === false;
}

/** The per-module permissions that own `pathname` (longest matching route prefix), or null when the
 *  path maps to no module. Used by `usePageAccess()` to gate a page's action controls. */
export function resolveRoutePerm(pathname: string, perms: ModulePermMap): ModulePerm | null {
  const best = bestRouteFor(pathname, Object.keys(perms));
  return best ? perms[best] : null;
}

/** Look up a specific module's permissions by key (e.g. a client-tab key like "clienttab-templates"
 *  that is not the page's own route). Case-insensitive. Null when not present. */
export function getModulePerm(moduleKey: string, perms: ModulePermMap): ModulePerm | null {
  return perms[norm(moduleKey)] ?? null;
}
