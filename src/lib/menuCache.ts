// ONE shared fetch of the user's DB-driven menu (`/api/othermaster/createdynamicmenuwithsubmenu`):
// the rows of app.ModuleMaster × app.UserModuleAuthentication the user can view, each with all seven
// permission flags. Several features read it (phone Modules sheet + Home, page permission gates,
// Settings → Bottom Navbar); before this each fetched its own copy on every page. One in-flight
// promise per user is shared, kept for 5 minutes (so an authority change shows up without a re-login),
// and dropped on failure so a network blip is not cached.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";
const TTL_MS = 5 * 60 * 1000;

export type MenuRow = Record<string, unknown>;

const cache = new Map<number, { at: number; rows: Promise<MenuRow[]> }>();

export function fetchMenuRows(userId?: number): Promise<MenuRow[]> {
  if (!userId) return Promise.resolve([]);
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  const rows = fetch(`${BASE}/api/othermaster/createdynamicmenuwithsubmenu`, {
    headers: { UserID: String(userId) }, cache: "no-store",
  })
    .then((res) => res.json())
    .then((arr) => (Array.isArray(arr) ? (arr as MenuRow[]) : []))
    .catch((e) => {
      cache.delete(userId);
      throw e;
    });
  cache.set(userId, { at: Date.now(), rows });
  return rows;
}

/** Forget the cached menu (e.g. after Module Authority is saved). */
export function clearMenuCache() { cache.clear(); }
