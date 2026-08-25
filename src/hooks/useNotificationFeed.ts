"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/contexts/NotificationsContext";
import { normalizeNotifLink } from "@/lib/notifLink";
import { pmApi, type NotificationRow } from "@/lib/tms";

export type NotifTab = "all" | "email" | "messages" | "point";

export interface FeedItem {
  key: string;
  source: "app" | "tms";
  id: number;
  type: "Message" | "Email" | "System";
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  timeMs: number;
  createdAt: string;
}

function parseTime(s: string): number {
  const norm = s.endsWith("Z") || s.includes("+") ? s : (s.includes("T") ? s + "Z" : s.replace(" ", "T") + "Z");
  const t = new Date(norm).getTime();
  return isNaN(t) ? new Date(s).getTime() : t;
}

/**
 * One merged notification feed = app chat/email/system notifications (real-time, from
 * NotificationsContext) + Point-Management (TMS) ones. Shared by the header dropdown and
 * the /activity/notifications page. Tabs: All / Email / Messages / Point Tool (TMS-only).
 */
export function useNotificationFeed() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const ctx = useNotifications();
  const [tms, setTms] = useState<NotificationRow[]>([]);
  const [loadingTms, setLoadingTms] = useState(false);

  const refreshTms = useCallback(async () => {
    if (!email) return;
    setLoadingTms(true);
    try { setTms(await pmApi.notifications(email)); } catch { /* ignore */ } finally { setLoadingTms(false); }
  }, [email]);

  useEffect(() => { refreshTms(); }, [refreshTms]);

  const feed: FeedItem[] = useMemo(() => {
    const app: FeedItem[] = ctx.notifications.map((n) => ({
      key: "a" + n.NotificationID, source: "app", id: n.NotificationID,
      type: n.Type === "Email" ? "Email" : n.Type === "Message" ? "Message" : "System",
      title: n.Title || (n.Type === "Email" ? "New email" : "New message"),
      body: n.Body || "", link: normalizeNotifLink(n.Link), isRead: n.IsRead, timeMs: parseTime(n.CreatedAt), createdAt: n.CreatedAt,
    }));
    const t: FeedItem[] = tms.map((it) => ({
      key: "t" + it.notificationID, source: "tms", id: it.notificationID,
      type: "System", title: it.messageText || "Point update", body: "", link: normalizeNotifLink(it.navigateURL),
      isRead: it.isRead, timeMs: parseTime(it.dateCreated), createdAt: it.dateCreated,
    }));
    return [...app, ...t].sort((a, b) => b.timeMs - a.timeMs);
  }, [ctx.notifications, tms]);

  const counts = useMemo(() => ({
    all: feed.length,
    email: feed.filter((f) => f.type === "Email").length,
    messages: feed.filter((f) => f.type === "Message").length,
    point: feed.filter((f) => f.source === "tms").length,
  }), [feed]);

  const forTab = useCallback((tab: NotifTab, q = "") => {
    let list = tab === "email" ? feed.filter((f) => f.type === "Email")
      : tab === "messages" ? feed.filter((f) => f.type === "Message")
      : tab === "point" ? feed.filter((f) => f.source === "tms")
      : feed;
    const term = q.trim().toLowerCase();
    if (term) list = list.filter((f) => f.title.toLowerCase().includes(term) || f.body.toLowerCase().includes(term));
    return list;
  }, [feed]);

  const markRead = useCallback(async (item: FeedItem) => {
    if (item.isRead) return;
    if (item.source === "app") await ctx.markRead(item.id);
    else { setTms((xs) => xs.map((x) => x.notificationID === item.id ? { ...x, isRead: true } : x)); pmApi.markNotificationRead(item.id).catch(() => {}); }
  }, [ctx]);

  const remove = useCallback(async (item: FeedItem) => {
    if (item.source === "app") await ctx.deleteNotification(item.id);
    else { setTms((xs) => xs.filter((x) => x.notificationID !== item.id)); pmApi.deleteNotification(item.id).catch(() => {}); }
  }, [ctx]);

  const markAllRead = useCallback(async () => {
    await ctx.markAllRead();
    setTms((xs) => xs.map((x) => ({ ...x, isRead: true })));
    if (email) pmApi.markAllNotificationsRead(email).catch(() => {});
  }, [ctx, email]);

  const clearRead = useCallback(async () => {
    await ctx.clearRead();
    tms.filter((x) => x.isRead).forEach((x) => pmApi.deleteNotification(x.notificationID).catch(() => {}));
    setTms((xs) => xs.filter((x) => !x.isRead));
  }, [ctx, tms]);

  const refresh = useCallback(async () => { await ctx.refresh(); await refreshTms(); }, [ctx, refreshTms]);

  const unread = ctx.unread + tms.filter((x) => !x.isRead).length;
  const readCount = feed.filter((f) => f.isRead).length;

  return { feed, counts, forTab, unread, readCount, loading: loadingTms, markRead, remove, markAllRead, clearRead, refresh };
}
