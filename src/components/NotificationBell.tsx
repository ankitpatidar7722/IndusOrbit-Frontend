"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, Settings, CheckCheck, Trash2, MessageSquare, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationFeed, type NotifTab, type FeedItem } from "@/hooks/useNotificationFeed";

function timeAgo(ms: number): string {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(ms).toLocaleDateString("en-GB");
}
function TypeIcon({ type, className }: { type: FeedItem["type"]; className?: string }) {
  const I = type === "Email" ? Mail : type === "Message" ? MessageSquare : Bell;
  return <I className={className} />;
}
function iconBox(type: FeedItem["type"]) {
  return type === "Email" ? "bg-violet-50 text-violet-600" : type === "Message" ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-600";
}

const TABS: { key: NotifTab; label: string; active: string }[] = [
  { key: "all", label: "All", active: "bg-[rgb(var(--fg-default))] text-white" },
  { key: "email", label: "Email", active: "bg-violet-500 text-white" },
  { key: "messages", label: "Messages", active: "bg-blue-500 text-white" },
  { key: "point", label: "Point Tool", active: "bg-amber-500 text-white" },
];

/** Header notifications bell + Parkson-style dropdown (tabs All / Email / Messages). */
export default function NotificationBell() {
  const router = useRouter();
  const { counts, forTab, unread, loading, markRead, remove, markAllRead, refresh } = useNotificationFeed();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotifTab>("all");
  const [q, setQ] = useState("");

  const items = forTab(tab, q);

  const openItem = (it: FeedItem) => {
    if (!it.isRead) markRead(it);
    if (it.link) { setOpen(false); setQ(""); router.push(it.link); }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        style={iconBtn}
        title="Notifications"
        onClick={() => { const n = !open; setOpen(n); if (n) refresh(); }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span style={{ position: "absolute", top: 2, right: 2, minWidth: 15, height: 15, borderRadius: 8, background: "#e53e3e", color: "#fff", fontSize: 9.5, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 3px" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setQ(""); }} />
          <div className="header-popover absolute right-0 top-11 z-50 w-[28rem] max-w-[calc(100vw-1rem)] bg-[rgb(var(--bg-surface))] rounded-2xl shadow-2xl border border-[rgb(var(--bd-default))] overflow-hidden">
            {/* Header: title + search + settings */}
            <div className="px-5 pt-5 pb-0 bg-[rgb(var(--bg-surface))]">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-bold text-[rgb(var(--fg-default))] flex-shrink-0">Notifications</h3>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgb(var(--fg-muted))]" />
                  <input
                    type="text" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] focus:outline-none focus:border-[rgb(var(--color-primary))] focus:bg-[rgb(var(--bg-surface))] transition-colors"
                  />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpen(false); router.push("/settings?tab=notifications"); }}
                  className="p-2 rounded-lg text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))] transition-colors flex-shrink-0"
                  title="Notification Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                {TABS.map((tk) => {
                  const isActive = tab === tk.key;
                  return (
                    <button
                      key={tk.key}
                      onClick={() => setTab(tk.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap border",
                        isActive ? `${tk.active} border-transparent shadow-sm` : "bg-transparent text-[rgb(var(--fg-muted))] border-[rgb(var(--bd-default))] hover:bg-[rgb(var(--bg-hover))]"
                      )}
                    >
                      {tk.label}
                      <span className={cn(
                        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] leading-none rounded-full font-bold",
                        isActive ? "bg-white/20 text-inherit" : "bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-muted))]"
                      )}>
                        {counts[tk.key]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto bg-[rgb(var(--bg-subtle))]">
              {loading && items.length === 0 ? (
                <div className="p-8 text-center bg-[rgb(var(--bg-surface))]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(var(--color-primary))] mx-auto" />
                  <p className="text-sm text-[rgb(var(--fg-muted))] mt-3">Loading...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="p-10 text-center bg-[rgb(var(--bg-surface))]">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-[rgb(var(--fg-muted))] opacity-30" />
                  <p className="text-sm text-[rgb(var(--fg-muted))]">{q ? "No matching notifications" : "All caught up! No notifications here."}</p>
                </div>
              ) : (
                items.map((it) => (
                  <div
                    key={it.key}
                    onClick={() => openItem(it)}
                    className={cn(
                      "group px-5 py-4 flex gap-3 border-b border-[rgb(var(--bd-subtle))] transition-colors cursor-pointer relative hover:bg-[rgb(var(--bg-hover))]",
                      !it.isRead ? "bg-[rgb(var(--bg-surface))]" : "bg-[rgb(var(--bg-subtle))]/60"
                    )}
                  >
                    {/* Unread accent bar (left edge) */}
                    {!it.isRead && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[rgb(var(--color-primary))] rounded-r" />}

                    <div className={cn("flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", iconBox(it.type))}>
                      <TypeIcon type={it.type} className="h-5 w-5" />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm leading-snug text-[rgb(var(--fg-default))]", it.isRead ? "font-medium" : "font-bold")}>{it.title}</p>
                      {it.body && <p className="text-xs text-[rgb(var(--fg-muted))] mt-1 line-clamp-2 leading-relaxed">{it.body}</p>}
                    </div>

                    {/* Right column: time on top, always-visible actions below */}
                    <div className="flex flex-col items-end justify-between flex-shrink-0 gap-2 pl-1">
                      <span className="text-[11px] text-[rgb(var(--fg-muted))] whitespace-nowrap">{timeAgo(it.timeMs)}</span>
                      <div className="flex items-center gap-1">
                        {!it.isRead && (
                          <button onClick={(e) => { e.stopPropagation(); markRead(it); }} title="Mark as read"
                            className="w-7 h-7 rounded-md border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] flex items-center justify-center text-[rgb(var(--fg-muted))] hover:text-white hover:bg-emerald-500 hover:border-emerald-500 transition-colors">
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); remove(it); }} title="Delete"
                          className="w-7 h-7 rounded-md border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] flex items-center justify-center text-[rgb(var(--fg-muted))] hover:text-white hover:bg-red-500 hover:border-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] flex items-center justify-between">
              {unread > 0 ? (
                <button className="text-sm text-[rgb(var(--color-primary))] hover:underline font-semibold" onClick={(e) => { e.stopPropagation(); markAllRead(); }}>
                  Mark all as read
                </button>
              ) : <span />}
              <button
                className="text-sm text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] font-medium"
                onClick={() => { setOpen(false); setQ(""); router.push("/activity/notifications"); }}
              >
                View History
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  position: "relative", width: 34, height: 34, borderRadius: 9, border: "none", background: "rgba(255,255,255,.12)",
  color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0,
};
