"use client";
import { useState, useContext } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ThemeContext } from "indas-ui";
import { Mail, LogOut, User as UserIcon, PanelLeft, Settings as SettingsIcon, MessageSquare, Sun, Moon } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useMessagingPanel } from "@/components/messaging/MessagingPanelProvider";
import { useMessaging } from "@/contexts/MessagingContext";
import HeaderEmailMenu from "@/components/HeaderEmailMenu";
import { toggleMobileNav } from "@/components/MobileNav";
import { photoUrl } from "@/lib/users";

/**
 * Toggle the sidebar. Below the AppShell `lg` breakpoint (1024px) the sidebar is an off-canvas
 * drawer that indas-ui can't open on its own — so there we flip our own `mobi-nav-open` body
 * class (see MobileNav + globals.css). On desktop we click AppShell's Expand/Collapse button.
 */
function toggleSidebar() {
  if (typeof window !== "undefined" && window.innerWidth < 1024) {
    toggleMobileNav();
    return;
  }
  const btn = document.querySelector(
    'button[title="Expand sidebar"], button[title="Collapse sidebar"]'
  ) as HTMLButtonElement | null;
  btn?.click();
}

/** Top navigation header (navy) — logo, company/year, search, notifications, profile. */
export default function TopHeader() {
  const { data: session } = useSession();
  const u = (session?.user ?? {}) as { name?: string; FYear?: string; UserID?: number };
  const name = u.name ?? "User";
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOk, setAvatarOk] = useState(true);
  const router = useRouter();
  const { openMessaging } = useMessagingPanel();
  const { state: msgState } = useMessaging();
  const chatUnread = msgState.totalUnreadCount;
  const themeCtx = useContext(ThemeContext);
  const isDark = !!themeCtx?.isDark;

  return (
    <header
      className="app-topbar"
      style={{
        position: "relative",
        zIndex: 30,
        height: 58,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 18px",
        // The DynamicSidebar paints itself with --color-primary-hover (via .bg-primary-hover),
        // so use the SAME var here → header and sidebar are always the exact same shade + theme together.
        background: "rgb(var(--color-primary-hover))",
        color: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,.18)",
      }}
    >
      {/* Sidebar toggle */}
      <button style={{ ...iconBtn, background: "rgba(255,255,255,.14)" }} onClick={toggleSidebar} title="Toggle sidebar" aria-label="Toggle sidebar">
        <PanelLeft size={18} />
      </button>

      {/* Logo (single) — full text on desktop, short "Indus 360" on mobile (see globals .app-topbar) */}
      <div className="topbar-title" style={{ fontWeight: 800, fontSize: 17, letterSpacing: 0.2, whiteSpace: "nowrap", flexShrink: 0 }}>Indus Command Center</div>
      <div className="topbar-title-short" style={{ fontWeight: 800, fontSize: 16, whiteSpace: "nowrap", flexShrink: 0 }}>Indus 360</div>

      {/* Greeting — hidden on small screens to save header width */}
      <div className="topbar-greeting" style={{ fontSize: 13.5, opacity: 0.92, whiteSpace: "nowrap" }}>Hello <b>{name}</b></div>

      {/* Theme toggle (light / dark) — flips the whole app */}
      <button style={{ ...iconBtn, marginLeft: "auto" }} onClick={() => themeCtx?.toggleMode()}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle light/dark mode">
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Icons — Chat lives in the mobile bottom-nav, so hide it here on phones. */}
      <button className="hide-on-mobile" style={{ ...iconBtn, position: "relative" }} title="Chat" onClick={openMessaging}>
        <MessageSquare size={18} />
        {chatUnread > 0 && (
          <span style={{ position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, background: "#22c55e", color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 4px", border: "2px solid rgb(var(--color-primary-hover))", boxSizing: "content-box" }}>
            {chatUnread > 99 ? "99+" : chatUnread}
          </span>
        )}
      </button>
      <HeaderEmailMenu iconBtn={iconBtn} />
      <NotificationBell />

      {/* Profile */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button style={{ ...iconBtn, width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,.18)", padding: 0, overflow: "hidden" }} onClick={() => setMenuOpen((o) => !o)} title={name}>
          {u.UserID && avatarOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(u.UserID)} alt="" onError={() => setAvatarOk(false)} style={{ width: 34, height: 34, objectFit: "cover" }} />
          ) : <UserIcon size={17} />}
        </button>
        {menuOpen && (
          <div style={{ position: "absolute", right: 0, top: 42, background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", borderRadius: 10, minWidth: 180, boxShadow: "0 12px 34px rgba(0,0,0,.25)", overflow: "hidden", zIndex: 40 }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #eef1f6" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{name}</div>
              <div style={{ fontSize: 11.5, opacity: 0.6 }}>Signed in</div>
            </div>
            <button
              onClick={() => { setMenuOpen(false); router.push("/settings"); }}
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: "1px solid #eef1f6", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgb(var(--fg-default))" }}
            >
              <SettingsIcon size={15} /> Settings
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#c0392b" }}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: "none", background: "rgba(255,255,255,.12)",
  color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0,
};
