"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, CheckCheck, Trash2, RefreshCw, MessageSquare, Mail, MailOpen } from "lucide-react";
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
  { key: "all", label: "All", active: "bg-[rgb(var(--color-primary))] text-white" },
  { key: "email", label: "Email", active: "bg-violet-500 text-white" },
  { key: "messages", label: "Messages", active: "bg-blue-500 text-white" },
  { key: "point", label: "Point Tool", active: "bg-amber-500 text-white" },
];

export default function NotificationsHistoryPage() {
  const router = useRouter();
  const { feed, counts, forTab, unread, readCount, loading, markRead, remove, markAllRead, clearRead, refresh } = useNotificationFeed();
  const [tab, setTab] = useState<NotifTab>("all");
  const [q, setQ] = useState("");
  const items = forTab(tab, q);

  const openItem = (it: FeedItem) => { if (!it.isRead) markRead(it); if (it.link) router.push(it.link); };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[rgb(var(--bg-surface))]">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-[rgb(var(--bd-default))] px-4 md:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[rgb(var(--color-primary)/0.12)] text-[rgb(var(--color-primary))] flex items-center justify-center"><Bell className="h-5 w-5" /></div>
              <h1 className="text-lg font-bold text-[rgb(var(--fg-default))]">Notifications</h1>
            </div>
            <div className="relative w-full sm:w-[20rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgb(var(--fg-muted))]" />
              <input
                type="text" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] focus:outline-none focus:border-[rgb(var(--color-primary))] focus:bg-[rgb(var(--bg-surface))] transition-colors"
              />
            </div>
            {unread > 0 && <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500 text-white">{unread} unread</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => markAllRead()} disabled={unread === 0} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg border border-[rgb(var(--bd-default))] text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))] disabled:opacity-40 disabled:cursor-not-allowed">
              <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
            </button>
            <button onClick={() => clearRead()} disabled={readCount === 0} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg border border-[rgb(var(--bd-default))] text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))] disabled:opacity-40 disabled:cursor-not-allowed">
              <Trash2 className="h-3.5 w-3.5" /> Clear Read
            </button>
            <button onClick={() => refresh()} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg border border-[rgb(var(--bd-default))] text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))] disabled:opacity-40">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-3">
          {TABS.map((tk) => {
            const isActive = tab === tk.key;
            return (
              <button
                key={tk.key} onClick={() => setTab(tk.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap border",
                  isActive ? `${tk.active} border-transparent shadow-sm` : "bg-transparent text-[rgb(var(--fg-muted))] border-[rgb(var(--bd-default))] hover:bg-[rgb(var(--bg-hover))]"
                )}
              >
                {tk.label}
                <span className={cn("inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full font-bold", isActive ? "bg-white/20 text-inherit" : "bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-muted))]")}>{counts[tk.key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-[rgb(var(--bg-subtle))]">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(var(--color-primary))] mb-3" />
            <p className="text-sm text-[rgb(var(--fg-muted))]">Loading...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <MailOpen className="h-14 w-14 text-[rgb(var(--fg-muted))] opacity-20 mb-4" />
            <p className="text-sm font-medium text-[rgb(var(--fg-default))] mb-1">{q ? "No matching notifications" : "No notifications in this category"}</p>
            <p className="text-xs text-[rgb(var(--fg-muted))]">{q ? "Try a different search term" : "All caught up"}</p>
          </div>
        ) : (
          <div>
            {items.map((it) => (
              <div
                key={it.key} onClick={() => openItem(it)}
                className={cn(
                  "group px-4 md:px-6 py-4 flex gap-4 border-b border-[rgb(var(--bd-subtle))] transition-colors cursor-pointer relative hover:bg-[rgb(var(--bg-hover))]",
                  !it.isRead ? "bg-[rgb(var(--bg-surface))]" : "bg-[rgb(var(--bg-subtle))]/60"
                )}
              >
                {!it.isRead && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[rgb(var(--color-primary))] rounded-r" />}
                <div className={cn("flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", iconBox(it.type))}>
                  <TypeIcon type={it.type} className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm leading-snug text-[rgb(var(--fg-default))]", it.isRead ? "font-medium opacity-80" : "font-semibold")}>{it.title}</p>
                  {it.body && <p className="text-xs text-[rgb(var(--fg-muted))] mt-1 line-clamp-2 leading-relaxed">{it.body}</p>}
                </div>
                {/* Right column: badge + time on top, always-visible actions below */}
                <div className="flex flex-col items-end justify-between flex-shrink-0 gap-2 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      it.type === "Email" ? "bg-violet-100 text-violet-700" : it.type === "Message" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>{it.type}</span>
                    <span className="w-px h-3.5 bg-[rgb(var(--bd-default))]" />
                    <span className="text-[11px] text-[rgb(var(--fg-muted))] whitespace-nowrap">{timeAgo(it.timeMs)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!it.isRead && (
                      <button onClick={(e) => { e.stopPropagation(); markRead(it); }} title="Mark as read"
                        className="w-8 h-8 rounded-lg border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] flex items-center justify-center text-[rgb(var(--fg-muted))] hover:text-white hover:bg-emerald-500 hover:border-emerald-500 transition-colors">
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); remove(it); }} title="Delete"
                      className="w-8 h-8 rounded-lg border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] flex items-center justify-center text-[rgb(var(--fg-muted))] hover:text-white hover:bg-red-500 hover:border-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="px-4 md:px-6 py-3 text-center bg-[rgb(var(--bg-surface))] border-t border-[rgb(var(--bd-default))]">
              <p className="text-xs text-[rgb(var(--fg-muted))]">Showing {items.length} of {feed.length} notifications</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
