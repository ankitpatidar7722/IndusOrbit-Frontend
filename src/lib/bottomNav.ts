import { Home, Building2, MessageSquare, Bell, ClipboardList, PlusCircle, Code2, Mail, Users, FolderKanban } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Mobile bottom-nav shortcuts — each user picks up to 4 (a 5th "Menu" is always added by BottomNav).
 * Per-user, stored in localStorage keyed by UserID (no backend). A "chat" item opens the messaging
 * panel; everything else navigates to a route. Configure in Settings → Bottom Navbar.
 */
export type BottomNavItem = { key: string; label: string; icon: LucideIcon; route?: string; action?: "chat" };

export const BOTTOM_NAV_CATALOG: BottomNavItem[] = [
  { key: "home",      label: "Home",      icon: Home,          route: "/" },
  { key: "clients",   label: "Clients",   icon: Building2,     route: "/clients" },
  { key: "chat",      label: "Chat",      icon: MessageSquare, action: "chat" },
  { key: "alerts",    label: "Alerts",    icon: Bell,          route: "/activity/notifications" },
  { key: "points",    label: "Points",    icon: ClipboardList, route: "/point-management/manage-points" },
  { key: "addpoint",  label: "Add Point", icon: PlusCircle,    route: "/point-management/add-point" },
  { key: "devtask",   label: "Dev Task",  icon: Code2,         route: "/point-management/developer" },
  { key: "email",     label: "Email",     icon: Mail,          route: "/email" },
  { key: "customers", label: "Customers", icon: Users,         route: "/customers" },
  { key: "implementation", label: "Impl.", icon: FolderKanban, route: "/implementation/tracker" },
];

export const DEFAULT_BOTTOM_NAV = ["home", "clients", "chat", "alerts"];
export const MAX_BOTTOM_NAV = 4;
export const BOTTOM_NAV_EVENT = "indus-bottomnav-changed";

const keyFor = (userId?: number) => `indus.bottomNav.${userId ?? "anon"}`;

export function itemFor(key: string): BottomNavItem | undefined {
  return BOTTOM_NAV_CATALOG.find((i) => i.key === key);
}

/** The user's chosen shortcut keys (falls back to the default set). */
export function loadBottomNav(userId?: number): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(userId)) || "null");
    const valid = Array.isArray(v) ? v.filter((k) => typeof k === "string" && itemFor(k)) : [];
    return valid.length ? valid.slice(0, MAX_BOTTOM_NAV) : DEFAULT_BOTTOM_NAV;
  } catch { return DEFAULT_BOTTOM_NAV; }
}

/** Save the user's chosen keys and notify any mounted BottomNav to refresh live. */
export function saveBottomNav(userId: number | undefined, keys: string[]) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(keys.slice(0, MAX_BOTTOM_NAV)));
    window.dispatchEvent(new Event(BOTTOM_NAV_EVENT));
  } catch { /* ignore */ }
}
