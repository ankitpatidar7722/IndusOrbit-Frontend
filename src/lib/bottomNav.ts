import {
  Home, Building2, MessageSquare, Bell, ClipboardList, PlusCircle, Code2, Mail, Users, FolderKanban,
  ShieldCheck, FlaskConical, GitMerge, LifeBuoy, UserPlus, LayoutGrid, ClipboardCheck, TrendingUp, Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Mobile bottom-nav shortcuts — each user picks up to 4 (a 5th "Menu" is always added by BottomNav).
 * Candidates = a few SPECIAL items (Home/Clients/Chat/Alerts) + EVERY module the user can view
 * (fetched from the same menu endpoint the sidebar uses). Chosen items are stored (as objects, so
 * BottomNav needs no fetch) in localStorage keyed by UserID. Configure in Settings → Bottom Navbar.
 */
export type BottomNavStored = { key: string; label: string; route?: string; action?: "chat" };

/** Non-route specials + a couple of common destinations, always offered first. */
export const SPECIAL_ITEMS: BottomNavStored[] = [
  { key: "home",    label: "Home",    route: "/" },
  { key: "clients", label: "Clients", route: "/clients" },
  { key: "chat",    label: "Chat",    action: "chat" },
  { key: "alerts",  label: "Alerts",  route: "/activity/notifications" },
];

export const DEFAULT_ITEMS: BottomNavStored[] = SPECIAL_ITEMS.slice(0, 4);
export const MAX_BOTTOM_NAV = 4;
export const BOTTOM_NAV_EVENT = "indus-bottomnav-changed";

const keyFor = (userId?: number) => `indus.bottomNav.${userId ?? "anon"}`;

/** Pick a sensible icon for a shortcut (specials by key, modules by route keyword, else generic). */
export function iconForItem(it: { key: string; route?: string; action?: string }): LucideIcon {
  if (it.action === "chat") return MessageSquare;
  const r = (it.route || it.key || "").toLowerCase();
  if (it.key === "home" || r === "/") return Home;
  if (it.key === "clients" || r.includes("/clients")) return Building2;
  if (it.key === "alerts" || r.includes("notification")) return Bell;
  if (r.includes("add-point")) return PlusCircle;
  if (r.includes("assign")) return UserPlus;
  if (r.includes("developer")) return Code2;
  if (r.includes("verify")) return ShieldCheck;
  if (r.includes("tester")) return FlaskConical;
  if (r.includes("merge")) return GitMerge;
  if (r.includes("support")) return LifeBuoy;
  if (r.includes("manage-points") || r.includes("point")) return ClipboardList;
  if (r.includes("time-report") || r.includes("customer-progress")) return TrendingUp;
  if (r.includes("worklog") || r.includes("time")) return Clock;
  if (r.includes("email")) return Mail;
  if (r.includes("customer")) return Users;
  if (r.includes("implementation") || r.includes("tracker")) return FolderKanban;
  if (r.includes("sign") || r.includes("kickoff")) return ClipboardCheck;
  return LayoutGrid;
}

/** All modules the user can view, as bottom-nav candidates (same endpoint the sidebar uses). */
export async function fetchNavModules(userId?: number): Promise<BottomNavStored[]> {
  if (!userId) return [];
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";
    const res = await fetch(`${base}/api/othermaster/createdynamicmenuwithsubmenu`, {
      headers: { UserID: String(userId) }, cache: "no-store",
    });
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((m: Record<string, unknown>) => typeof m.ModuleName === "string" && (m.ModuleName as string).startsWith("/") && m.CanView)
      .map((m: Record<string, unknown>) => ({ key: m.ModuleName as string, label: (m.ModuleDisplayName as string) || (m.ModuleName as string), route: m.ModuleName as string }));
  } catch { return []; }
}

/** SPECIAL_ITEMS + every viewable module (deduped by key/route), for the Settings picker. */
export async function bottomNavCandidates(userId?: number): Promise<BottomNavStored[]> {
  const mods = await fetchNavModules(userId);
  const seen = new Set(SPECIAL_ITEMS.map((s) => s.key));
  const extra = mods.filter((m) => !seen.has(m.key));
  return [...SPECIAL_ITEMS, ...extra];
}

/** The user's chosen shortcut items (falls back to the default set). */
export function loadBottomNav(userId?: number): BottomNavStored[] {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(userId)) || "null");
    if (Array.isArray(v)) {
      const objs = v.filter((x) => x && typeof x === "object" && typeof x.key === "string" && (x.route || x.action));
      if (objs.length) return objs.slice(0, MAX_BOTTOM_NAV);
    }
  } catch { /* ignore */ }
  return DEFAULT_ITEMS;
}

/** Save the chosen items and notify any mounted BottomNav to refresh live. */
export function saveBottomNav(userId: number | undefined, items: BottomNavStored[]) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(items.slice(0, MAX_BOTTOM_NAV)));
    window.dispatchEvent(new Event(BOTTOM_NAV_EVENT));
  } catch { /* ignore */ }
}
