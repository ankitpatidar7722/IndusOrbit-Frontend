import {
  LayoutDashboard, Building2, Rocket, Activity, FileSpreadsheet, FileCheck2, HardHat, Layers, Code, Gauge,
  ClipboardCheck, Plus, ListChecks, Send, ClipboardList, BadgeCheck, GitMerge, LifeBuoy, Clock, TrendingUp,
  PackagePlus, Images, PenTool, Trash2, Mail, Bell, MessageSquare, ShieldCheck, Settings, FolderKanban,
  ScrollText, Upload, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppIconTone } from "@/components/phone/AppIcon";
import { fetchMenuRows } from "@/lib/menuCache";

/**
 * Phone navigation model (Modules sheet + phone Home), built from the SAME DB-driven menu the desktop sidebar
 * uses (`/api/othermaster/createdynamicmenuwithsubmenu`, per UserID) — so module visibility/permissions stay
 * exactly as configured in Module Authentication. Ported from IndusFlexoERP's module-icons / useModuleGroups.
 */
/** `href` = where a tap goes: same as `route`, except the company Dashboard ("/") — on a phone "/" is the Home,
 *  so the Dashboard opens as "/?tab=overview" (app/page.tsx). */
export type PhoneLeaf = { route: string; href: string; label: string; group: string; icon: LucideIcon; tone: AppIconTone };

/** The page that shows the company Dashboard tabs on a phone. */
export const dashboardHref = (tab: string) => `/?tab=${tab}`;
export type PhoneGroup = { name: string; icon: LucideIcon; tone: AppIconTone; leaves: PhoneLeaf[] };

/** ModuleMaster.ModuleIcon (a lucide name string) → component. Only names used by the menu are imported. */
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Building2, Rocket, Activity, FileSpreadsheet, FileCheck2, HardHat, Layers, Code, Gauge,
  ClipboardCheck, Plus, ListChecks, Send, ClipboardList, BadgeCheck, GitMerge, LifeBuoy, Clock, TrendingUp,
  PackagePlus, Images, PenTool, Trash2, Mail, Bell, MessageSquare, ShieldCheck, Settings, FolderKanban, ScrollText,
};

/** One colour per business area, the same on the Home and in the Modules sheet. */
export function toneFor(groupName: string): AppIconTone {
  const n = groupName.toLowerCase();
  const has = (...w: string[]) => w.some((x) => n.includes(x));
  if (has("overview", "dashboard", "report", "kpi")) return "amber";
  if (has("client", "customer", "crm")) return "blue";
  if (has("implementation", "tracker", "onsite")) return "teal";
  if (has("point", "ticket", "task")) return "orange";
  if (has("bulk", "import", "upload")) return "green";
  if (has("activity", "email", "notification", "message")) return "red";
  if (has("module", "authority")) return "violet";
  if (has("admin", "user", "setting", "audit")) return "indigo";
  return "grey";
}

/** Screens inside a group get DIFFERENT colours (a whole grid in the group's one colour read as a
 *  single blob): the palette in turn, starting after the group's own colour so neighbours never match.
 *  A destructive screen ("… Delete") is always red. */
const LEAF_PALETTE: AppIconTone[] = ["blue", "teal", "orange", "violet", "green", "amber", "indigo", "red"];
function leafTone(label: string, groupTone: AppIconTone, index: number): AppIconTone {
  if (/delete|remove/i.test(label)) return "red";
  const start = Math.max(0, LEAF_PALETTE.indexOf(groupTone));
  return LEAF_PALETTE[(start + index) % LEAF_PALETTE.length];
}

/** Group (header module) icon — by name, so a new group still gets a sensible glyph. */
export function groupIconFor(groupName: string): LucideIcon {
  const n = groupName.toLowerCase();
  if (n.includes("overview") || n.includes("dashboard")) return LayoutDashboard;
  if (n.includes("client")) return Building2;
  if (n.includes("customer")) return Users;
  if (n.includes("implementation")) return Rocket;
  if (n.includes("point")) return ListChecks;
  if (n.includes("bulk") || n.includes("import")) return Upload;
  if (n.includes("activity")) return Bell;
  if (n.includes("module") || n.includes("authority")) return Layers;
  if (n.includes("admin")) return ShieldCheck;
  return LayoutDashboard;
}

// One fetch per user per page-load, shared by the sheet and the Home (both mount together on a phone).
const cache = new Map<number, Promise<PhoneGroup[]>>();

export function fetchPhoneGroups(userId?: number): Promise<PhoneGroup[]> {
  if (!userId) return Promise.resolve([]);
  const hit = cache.get(userId);
  if (hit) return hit;
  const p = load(userId).catch(() => {
    cache.delete(userId); // a failed read must not stick for the session
    return [] as PhoneGroup[];
  });
  cache.set(userId, p);
  return p;
}

async function load(userId: number): Promise<PhoneGroup[]> {
  const arr = await fetchMenuRows(userId);   // shared with the other menu readers (lib/menuCache)
  const rows = arr
    .filter((m) => typeof m.ModuleName === "string" && (m.ModuleName as string).startsWith("/") && m.CanView)
    .sort((a, b) => Number(a.SetGroupIndex ?? 0) - Number(b.SetGroupIndex ?? 0) || Number(a.ModuleDisplayOrder ?? 0) - Number(b.ModuleDisplayOrder ?? 0));

  const groups: PhoneGroup[] = [];
  const seen = new Set<string>();
  for (const m of rows) {
    const route = m.ModuleName as string;
    if (seen.has(route)) continue;
    seen.add(route);
    const groupName = (m.ModuleHeadName as string) || "Menu";
    let g = groups.find((x) => x.name === groupName);
    if (!g) {
      g = { name: groupName, icon: groupIconFor(groupName), tone: toneFor(groupName), leaves: [] };
      groups.push(g);
    }
    g.leaves.push({
      route,
      href: route === "/" ? dashboardHref("overview") : route,
      label: (m.ModuleDisplayName as string) || route,
      group: groupName,
      icon: ICONS[(m.ModuleIcon as string) || ""] ?? g.icon,
      tone: leafTone((m.ModuleDisplayName as string) || route, g.tone, g.leaves.length),
    });
  }
  return groups;
}

const isDashboard = (l: PhoneLeaf) => /dashboard|kpi|progress|time-report/i.test(`${l.route} ${l.label}`);

/** Home "Quick actions": the everyday screens first (in this order), then fill from the menu. Max 8. */
const QUICK_PREFERRED = [
  "/clients", "/point-management/add-point", "/point-management/manage-points", "/implementation/tracker",
  "/email", "/point-management/developer", "/point-management/support", "/implementation/kickoff",
];

export const MAX_QUICK_ACTIONS = 8;
const quickKey = (userId?: number) => `indus360.quickActions.${userId ?? "anon"}`;

/** The user's own Quick actions (routes, in their order) — null when they never customised them. */
export function loadQuickActions(userId?: number): string[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(quickKey(userId)) || "null");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX_QUICK_ACTIONS) : null;
  } catch { return null; }
}
/** Save (or, with null, reset to the automatic default) the user's Quick actions on this device. */
export function saveQuickActions(userId: number | undefined, routes: string[] | null) {
  try {
    if (routes) localStorage.setItem(quickKey(userId), JSON.stringify(routes.slice(0, MAX_QUICK_ACTIONS)));
    else localStorage.removeItem(quickKey(userId));
  } catch { /* storage blocked — the choice lasts this visit */ }
}

/** Everything the Quick actions can hold: the user's screens, minus the Dashboard and dashboard-like ones. */
export const quickActionCandidates = (groups: PhoneGroup[]) =>
  groups.flatMap((g) => g.leaves).filter((l) => l.route !== "/" && !isDashboard(l));

export function pickQuickActions(groups: PhoneGroup[], max = MAX_QUICK_ACTIONS, saved?: string[] | null): PhoneLeaf[] {
  const all = quickActionCandidates(groups);
  // The user's own choice wins (a screen they lost access to simply drops out).
  if (saved) {
    const byRoute = new Map(all.map((l) => [l.route, l]));
    return saved.map((r) => byRoute.get(r)).filter((l): l is PhoneLeaf => !!l).slice(0, max);
  }
  const byRoute = new Map(all.map((l) => [l.route, l]));
  const out: PhoneLeaf[] = [];
  for (const r of QUICK_PREFERRED) {
    const l = byRoute.get(r);
    if (l) out.push(l);
  }
  for (const l of all) {
    if (out.length >= max) break;
    if (!out.includes(l)) out.push(l);
  }
  return out.slice(0, max);
}

/** Home "Dashboards": every dashboard-like screen the user can open (KPI, progress, time report…). */
export function pickDashboards(groups: PhoneGroup[]): PhoneLeaf[] {
  return groups.flatMap((g) => g.leaves).filter((l) => l.route !== "/" && isDashboard(l));
}

/** Can the user open the company Dashboard ("/")? */
export const hasMainDashboard = (groups: PhoneGroup[]) => groups.some((g) => g.leaves.some((l) => l.route === "/"));
