// Route-level access control. The sidebar only SHOWS modules the user can view, but a user could
// still reach a page by typing its URL (e.g. /users). This reads the user's full module authority
// (app.ModuleMaster × app.UserModuleAuthentication, via GET /api/users/{id}/modules) and decides
// whether the current route is a module the user is NOT allowed to view.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

/** normalized route (lowercase, no trailing slash) → CanView. Only real "/…" module routes. */
export type ModuleAccessMap = Record<string, boolean>;

let accessCache: { userId: number; map: ModuleAccessMap } | null = null;

const norm = (p: string) => (p || "").trim().toLowerCase().replace(/\/+$/, "") || "/";

/** Synchronous read of the cached map for a user (null if not fetched yet) — lets the guard avoid a
 *  loading flash on client-side navigations after the first load. */
export function getCachedModuleAccess(userId?: number): ModuleAccessMap | null {
  return userId && accessCache?.userId === userId ? accessCache.map : null;
}

/** Fetch (and cache) the user's CanView for EVERY module route. Empty map on error → fail open. */
export async function fetchMyModuleAccess(userId?: number): Promise<ModuleAccessMap> {
  if (!userId) return {};
  const cached = getCachedModuleAccess(userId);
  if (cached) return cached;
  try {
    const res = await fetch(`${BASE}/api/users/${userId}/modules`, { headers: { UserID: String(userId) }, cache: "no-store" });
    const j = await res.json();
    const map: ModuleAccessMap = {};
    if (j?.success && Array.isArray(j.data)) {
      for (const m of j.data) {
        const name = norm(String(m.moduleName ?? ""));
        // Only real page routes are gated; never gate the landing/home route ("/").
        if (name.startsWith("/") && name !== "/") map[name] = !!m.canView;
      }
    }
    accessCache = { userId, map };
    return map;
  } catch {
    return {};   // network/permission blip → don't lock the user out
  }
}

/** Drop the cache (e.g. after an admin changes this user's authority). */
export function clearModuleAccessCache() { accessCache = null; }

/** True when `pathname` maps to a module the user may NOT view. A route with no matching module
 *  (dashboard, settings, self-service pages, …) is never gated. Matches the MOST specific module
 *  route that is a prefix of the path, so /implementation/signoff is checked before /implementation. */
export function isRouteDenied(pathname: string, map: ModuleAccessMap): boolean {
  const path = norm(pathname);
  let best: string | null = null;
  for (const route of Object.keys(map)) {
    if (path === route || path.startsWith(route + "/")) {
      if (best === null || route.length > best.length) best = route;
    }
  }
  return best !== null && map[best] === false;
}
