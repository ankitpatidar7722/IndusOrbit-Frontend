"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import { useMessagingPanel } from "@/components/messaging/MessagingPanelProvider";
import { useMessaging } from "@/contexts/MessagingContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { loadBottomNav, iconForItem, BOTTOM_NAV_EVENT, type BottomNavStored } from "@/lib/bottomNav";
import { NavIcon, type NavIconName } from "@/components/phone/NavIcons";
import ModulesSheet from "@/components/phone/ModulesSheet";

/**
 * Native-app bottom navigation — mobile/tablet only (hidden ≥ lg via .bottom-nav CSS).
 * Floating glass capsule (ported from IndusFlexoERP): the user's chosen shortcuts (Settings → Bottom Navbar)
 * + a fixed "Modules" button that opens the Modules bottom sheet. The selected tab gets a theme-colour pill
 * (shared layoutId → it slides between tabs) and a FILLED glyph; idle tabs show the outline glyph.
 * Per-user config in localStorage; refreshes live when Settings saves.
 */
const NATIVE_GLYPH: Record<string, NavIconName> = { home: "home", chat: "messages", alerts: "bell" };

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = !!useReducedMotion();
  const { openMessaging } = useMessagingPanel();
  const { state } = useMessaging();
  const { unread: alertUnread } = useNotifications();
  const chatUnread = state.totalUnreadCount;
  const userId = (useSession().data?.user as { UserID?: number } | undefined)?.UserID;
  const [modulesOpen, setModulesOpen] = useState(false);

  const [items, setItems] = useState<BottomNavStored[]>([]);
  useEffect(() => {
    const refresh = () => setItems(loadBottomNav(userId));
    refresh();
    window.addEventListener(BOTTOM_NAV_EVENT, refresh);
    return () => window.removeEventListener(BOTTOM_NAV_EVENT, refresh);
  }, [userId]);

  const active = (route?: string) => (!route ? false : route === "/" ? pathname === "/" : pathname.startsWith(route));
  const onItem = (it: BottomNavStored) => {
    setModulesOpen(false); // a bar tab always wins over the open sheet (the sheet closes itself on a tile tap)
    if (it.action === "chat") openMessaging();
    else if (it.route) router.push(it.route);
  };

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        <div className="bottom-nav-capsule m-glass-bar">
          {items.map((it) => {
            const on = !modulesOpen && active(it.route);
            const glyph = NATIVE_GLYPH[it.key];
            const Icon = glyph ? null : iconForItem(it);
            const badge = it.action === "chat" ? chatUnread : it.key === "alerts" ? alertUnread : 0;
            return (
              <motion.button key={it.key} type="button" className="bottom-nav-item" data-active={on}
                aria-current={on ? "page" : undefined} onClick={() => onItem(it)} whileTap={{ scale: 0.92 }}>
                <span className="bottom-nav-icon">
                  {on && <ActivePill reduceMotion={reduceMotion} />}
                  <TabGlyph active={on} reduceMotion={reduceMotion}>
                    {glyph
                      ? <NavIcon name={glyph} filled={on} width={24} height={24} />
                      : Icon && <Icon size={22} strokeWidth={on ? 2.25 : 1.8} />}
                  </TabGlyph>
                  {badge > 0 && <span className="bottom-nav-badge">{badge > 99 ? "99+" : badge}</span>}
                </span>
                <span className="bottom-nav-label">{it.label}</span>
              </motion.button>
            );
          })}

          {/* Modules — opens the Modules sheet (the full DB menu as an app drawer). */}
          <motion.button type="button" className="bottom-nav-item" data-active={modulesOpen}
            aria-expanded={modulesOpen} aria-label="Open modules" onClick={() => setModulesOpen((o) => !o)} whileTap={{ scale: 0.92 }}>
            <span className="bottom-nav-icon">
              {modulesOpen && <ActivePill reduceMotion={reduceMotion} />}
              <TabGlyph active={modulesOpen} reduceMotion={reduceMotion}>
                <NavIcon name="modules" filled={modulesOpen} width={24} height={24} />
              </TabGlyph>
            </span>
            <span className="bottom-nav-label">Modules</span>
          </motion.button>
        </div>
      </nav>
      <ModulesSheet open={modulesOpen} onClose={() => setModulesOpen(false)} />
    </>
  );
}

/** The selected tab's pill behind the icon — ONE element shared via layoutId, so it slides tab-to-tab. */
function ActivePill({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.span
      layoutId={reduceMotion ? undefined : "bottom-nav-active"}
      aria-hidden
      className="m-nav-pill"
      initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
    />
  );
}

/** The tab glyph: white on the pill with a short spring "pop" when it becomes selected. */
function TabGlyph({ active, reduceMotion, children }: { active: boolean; reduceMotion: boolean; children: React.ReactNode }) {
  return (
    <motion.span
      key={active ? "on" : "off"}
      initial={active && !reduceMotion ? { scale: 0.7 } : false}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 18 }}
      className="bottom-nav-glyph"
      data-active={active}
    >
      {children}
    </motion.span>
  );
}
