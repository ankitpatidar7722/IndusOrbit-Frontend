/**
 * Normalise a notification's stored navigate URL into an Indus 360 route.
 *
 * The old TMS wrote tilde-rooted ASP.NET links (e.g. "~/DashboardDeveloper.aspx?pointId=6336").
 * Those rows still live in dbo.Notifications, and pushing them verbatim resolves relative to the
 * current page → "/activity/~/DashboardDeveloper.aspx?..." → 404. Map the four legacy pages to
 * their Point Management board and carry the pointId through so the board can auto-open the point.
 * New notifications already store "/point-management/..." routes and pass straight through.
 */
const ASPX_ROUTE: Record<string, string> = {
  dashboarddeveloper: "/point-management/developer",
  dashboardtester: "/point-management/tester",
  supportactioncenter: "/point-management/support",
  mergecode: "/point-management/merge",
};

export function normalizeNotifLink(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s || s === "#") return null;

  // Legacy ASP.NET ".aspx" link from the old TMS.
  if (/\.aspx/i.test(s)) {
    const m = s.match(/([A-Za-z0-9_]+)\.aspx(?:[^?]*\?[^]*?pointId=(\d+))?/i);
    const page = m?.[1]?.toLowerCase() ?? "";
    const pointId = m?.[2];
    const route = ASPX_ROUTE[page] ?? "/point-management/manage-points";
    return pointId ? `${route}?pointId=${pointId}` : route;
  }

  // Any other tilde-rooted path → app-absolute path.
  if (s.startsWith("~/")) return s.slice(1);
  return s;
}
