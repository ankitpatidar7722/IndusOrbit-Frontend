"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import { useMessagingPanel } from "@/components/messaging/MessagingPanelProvider";
import { useMessaging } from "@/contexts/MessagingContext";
import { toggleMobileNav } from "@/components/MobileNav";
import { loadBottomNav, iconForItem, BOTTOM_NAV_EVENT, type BottomNavStored } from "@/lib/bottomNav";

/**
 * Native-app bottom navigation bar — mobile only (hidden ≥ lg via .bottom-nav CSS).
 * Shows the user's chosen shortcuts (Settings → Bottom Navbar) + a fixed "Menu" (opens the full
 * module drawer). Per-user config in localStorage; refreshes live when Settings saves.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { openMessaging } = useMessagingPanel();
  const { state } = useMessaging();
  const unread = state.totalUnreadCount;
  const userId = (useSession().data?.user as { UserID?: number } | undefined)?.UserID;

  const [items, setItems] = useState<BottomNavStored[]>([]);
  useEffect(() => {
    const refresh = () => setItems(loadBottomNav(userId));
    refresh();
    window.addEventListener(BOTTOM_NAV_EVENT, refresh);
    return () => window.removeEventListener(BOTTOM_NAV_EVENT, refresh);
  }, [userId]);

  const active = (route?: string) => (!route ? false : route === "/" ? pathname === "/" : pathname.startsWith(route));
  const onItem = (it: BottomNavStored) => {
    if (it.action === "chat") openMessaging();
    else if (it.route) router.push(it.route);
  };

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((it) => {
        const Icon = iconForItem(it);
        const showBadge = it.action === "chat" && unread > 0;
        return (
          <button key={it.key} className="bottom-nav-item" data-active={active(it.route)} onClick={() => onItem(it)}>
            <span className="bottom-nav-icon">
              <Icon size={20} />
              {showBadge && <span className="bottom-nav-badge">{unread > 99 ? "99+" : unread}</span>}
            </span>
            <span>{it.label}</span>
          </button>
        );
      })}
      <button className="bottom-nav-item" onClick={toggleMobileNav}>
        <Menu size={20} /> <span>Menu</span>
      </button>
    </nav>
  );
}
