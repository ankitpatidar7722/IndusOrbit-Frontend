"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Mail, MessagesSquare, Moon, Sun, Sunrise, Sunset, LayoutDashboard, UserPlus, CreditCard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useMessaging } from "@/contexts/MessagingContext";
import { AppIcon, type AppIconTone } from "@/components/phone/AppIcon";
import TodayCard from "@/components/phone/TodayCard";
import {
  fetchPhoneGroups, pickQuickActions, pickDashboards, hasMainDashboard, dashboardHref, type PhoneGroup,
} from "@/lib/phoneModules";

/**
 * Phone Home (ported from IndusFlexoERP's HomePhone) — an app home screen in the iOS / Android dashboard style,
 * shown on "/" below 768px (app/page.tsx). Desktop never mounts it.
 *   hero        time-of-day greeting + the user's name, Today widget beside it
 *   status      Notifications / Emails / Messages unread counts as three compact glass tiles
 *   quick       4-up tonal app icons for the everyday screens the user can open
 *   dashboards  a sideways row of dashboard cards (company Dashboard tabs + KPI / report screens)
 * Lists come from the same DB menu as the sidebar (lib/phoneModules), so permissions are respected.
 */
type DashCard = { href: string; label: string; icon: LucideIcon; tone: AppIconTone };

const MAIN_DASH: DashCard[] = [
  { href: dashboardHref("overview"), label: "Overview", icon: LayoutDashboard, tone: "amber" },
  { href: dashboardHref("onboarding"), label: "Onboarding", icon: UserPlus, tone: "blue" },
  { href: dashboardHref("subscriptions"), label: "Subscriptions", icon: CreditCard, tone: "violet" },
];

export default function HomePhone() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = (session?.user ?? {}) as { name?: string; UserID?: number };
  const { unread, notifications } = useNotifications();
  const { state: msg } = useMessaging();
  const [groups, setGroups] = useState<PhoneGroup[] | null>(null);

  useEffect(() => { if (user.UserID) fetchPhoneGroups(user.UserID).then(setGroups); }, [user.UserID]);

  // Client-only screen (app/page.tsx mounts it after measuring the viewport), so reading the clock here is safe.
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  const DayGlyph: LucideIcon = h < 12 ? Sunrise : h < 17 ? Sun : h < 20 ? Sunset : Moon;
  const dayTone = h < 17 ? "rgb(var(--color-warning))" : h < 20 ? "rgb(var(--color-orange))" : "rgb(var(--color-info))";

  const emailUnread = notifications.filter((n) => n.Type === "Email" && !n.IsRead).length;
  const quick = groups ? pickQuickActions(groups) : [];
  const dashboards: DashCard[] = groups
    ? [...(hasMainDashboard(groups) ? MAIN_DASH : []), ...pickDashboards(groups).map((l) => ({ href: l.href, label: l.label, icon: l.icon, tone: l.tone }))]
    : [];

  return (
    <div className="phone-home">
      {/* Neutral grey backdrop with soft light/shade patches — gives the frosted cards depth. */}
      <div aria-hidden className="phone-home-backdrop" />

      <div className="phone-home-inner">
        {/* Hero — greeting left, the compact Today widget right. */}
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 4px" }}>
          <h1 style={{ minWidth: 0, flex: 1, margin: 0 }}>
            <span className="phone-greet-eyebrow">
              <DayGlyph style={{ width: 17, height: 17, flexShrink: 0, color: dayTone }} strokeWidth={2.2} aria-hidden />
              <span className="today-trunc">{greeting}</span>
            </span>
            <span className="phone-greet-name">{user.name || "User"}</span>
          </h1>
          <TodayCard />
        </header>

        {/* Status tiles */}
        <div className="phone-status-row">
          <StatusTile icon={Bell} tone="red" count={unread} label="Notifications" onClick={() => router.push("/activity/notifications")} />
          <StatusTile icon={Mail} tone="indigo" count={emailUnread} label="Emails" onClick={() => router.push("/email")} />
          <StatusTile icon={MessagesSquare} tone="green" count={msg.totalUnreadCount ?? 0} label="Messages" onClick={() => router.push("/activity/messages")} />
        </div>

        {/* Quick actions */}
        <section>
          <SectionTitle>Quick actions</SectionTitle>
          <div className="m-glass-card phone-quick-grid">
            {groups === null
              ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="phone-quick-item" aria-hidden>
                  <div className="m-skel" style={{ width: 52, height: 52, borderRadius: 16 }} />
                  <div className="m-skel" style={{ width: "68%", height: 10, borderRadius: 5, marginTop: 2 }} />
                </div>
              ))
              : quick.map((a) => (
                <Link key={a.route} href={a.href} className="phone-quick-item">
                  <AppIcon icon={a.icon} tone={a.tone} />
                  <span className="phone-quick-label">{a.label}</span>
                </Link>
              ))}
          </div>
          {groups !== null && quick.length === 0 && <p className="phone-sheet-empty">No modules assigned to you yet.</p>}
        </section>

        {/* Dashboards — sideways cards */}
        {dashboards.length > 0 && (
          <section>
            <SectionTitle>Dashboards</SectionTitle>
            <div className="phone-dash-row">
              {dashboards.map((d) => (
                <Link key={d.href} href={d.href} className="m-glass-card phone-dash-card">
                  <AppIcon icon={d.icon} tone={d.tone} size={38} />
                  <span>
                    <span className="phone-dash-title">{d.label}</span>
                    <span className="phone-dash-sub">Dashboard</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="phone-section-title">{children}</h2>;
}

function StatusTile({ icon, tone, count, label, onClick }: { icon: LucideIcon; tone: AppIconTone; count: number; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="m-glass-card phone-status-tile">
      <span style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <AppIcon icon={icon} tone={tone} size={34} />
        <span className="today-ink" style={{ fontSize: 20, lineHeight: "24px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {count > 99 ? "99+" : count}
        </span>
      </span>
      <span className="phone-status-label">{label}</span>
    </button>
  );
}
