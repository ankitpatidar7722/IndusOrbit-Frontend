"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ThemeContext } from "indas-ui";
import { Bell, BookOpen, Home, LogOut, Moon, Search, Settings as SettingsIcon, Sun, User as UserIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationsContext";
import { signOutTracked } from "@/lib/sessionTracking";
import { photoUrl } from "@/lib/users";
import UserManual from "@/components/UserManual";
import { fetchPhoneGroups, type PhoneGroup } from "@/lib/phoneModules";

/** Fired by the top bar's Search; BottomNav opens the Modules sheet with its search focused. */
export const OPEN_MODULE_SEARCH_EVENT = "indus:open-module-search";

/**
 * Phone / tablet top bar (IndusFlexoERP style) — replaces the navy desktop header below lg:
 *
 *   [⌂] Home                              🔍   🔔⁹   (avatar)
 *
 * Left: the current screen's icon + name (from the same DB menu as the sidebar). Right, only three
 * things: Search (modules & screens), Notifications (opens the notifications page) and the profile
 * menu — which also carries what the desktop header had: Settings, light/dark, User Manual, Sign out.
 */
export default function PhoneTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const u = (session?.user ?? {}) as { name?: string; email?: string; UserID?: number };
  const { unread } = useNotifications();
  const themeCtx = useContext(ThemeContext);
  const isDark = !!themeCtx?.isDark;
  const [groups, setGroups] = useState<PhoneGroup[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [avatarOk, setAvatarOk] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (u.UserID) fetchPhoneGroups(u.UserID).then(setGroups); }, [u.UserID]);

  // Close the profile menu on an outside tap.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  // The screen's name + icon: the most specific menu route that owns the path.
  const screen: { label: string; icon: LucideIcon } = (() => {
    if (pathname === "/") return { label: "Home", icon: Home };
    let best: { label: string; icon: LucideIcon; len: number } | null = null;
    for (const g of groups ?? []) for (const l of g.leaves) {
      if (l.route === "/" || !(pathname === l.route || pathname.startsWith(l.route + "/"))) continue;
      if (!best || l.route.length > best.len) best = { label: l.label, icon: l.icon, len: l.route.length };
    }
    if (pathname.startsWith("/settings")) return { label: "Settings", icon: SettingsIcon };
    return best ?? { label: "Indas Orbit", icon: Home };
  })();
  const ScreenIcon = screen.icon;

  const go = (href: string) => { setMenuOpen(false); router.push(href); };

  return (
    <>
      <header className="phone-topbar">
        <ScreenIcon size={22} strokeWidth={2} aria-hidden style={{ flexShrink: 0 }} />
        <h1 className="phone-topbar-title">{screen.label}</h1>

        <button type="button" className="phone-topbar-btn" aria-label="Search modules and screens"
          onClick={() => window.dispatchEvent(new Event(OPEN_MODULE_SEARCH_EVENT))}>
          <Search size={23} strokeWidth={2} />
        </button>

        <button type="button" className="phone-topbar-btn" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          onClick={() => router.push("/activity/notifications")}>
          <Bell size={23} strokeWidth={2} />
          {unread > 0 && <span className="phone-topbar-badge">{unread > 99 ? "99+" : unread}</span>}
        </button>

        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button type="button" className="phone-topbar-avatar" aria-label="Profile" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}>
            {u.UserID && avatarOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl(u.UserID)} alt="" onError={() => setAvatarOk(false)} />
            ) : <UserIcon size={19} />}
          </button>
          {menuOpen && (
            <div className="phone-topbar-menu" role="menu">
              <div className="phone-topbar-menu-head">
                <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name || "User"}</div>
                {u.email && <div style={{ fontSize: 12.5, opacity: 0.62, overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>}
              </div>
              <button type="button" role="menuitem" onClick={() => go("/settings")}><SettingsIcon size={18} /> Settings</button>
              <button type="button" role="menuitem" onClick={() => { themeCtx?.toggleMode(); setMenuOpen(false); }}>
                {isDark ? <Sun size={18} /> : <Moon size={18} />} {isDark ? "Light mode" : "Dark mode"}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setManualOpen(true); }}><BookOpen size={18} /> User Manual</button>
              <button type="button" role="menuitem" className="danger" onClick={() => signOutTracked()}><LogOut size={18} /> Sign out</button>
            </div>
          )}
        </div>
      </header>
      {manualOpen && <UserManual onClose={() => setManualOpen(false)} />}
    </>
  );
}
