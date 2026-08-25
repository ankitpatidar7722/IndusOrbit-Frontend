"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { HubConnection, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { notificationsApi, type AppNotification, type NotifSettings } from "@/lib/notifications";
import { armNotificationSounds, playNotificationSound } from "@/lib/notificationSounds";
import { pmApi } from "@/lib/tms";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface ToastItem { id: number; notification: AppNotification }

interface NotificationsCtx {
  notifications: AppNotification[];
  unread: number;
  settings: NotifSettings;
  toasts: ToastItem[];
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  clearRead: () => Promise<void>;
  saveSettings: (s: NotifSettings) => Promise<void>;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<NotificationsCtx>({
  notifications: [], unread: 0, settings: { NotifyMessages: true, NotifyEmails: true }, toasts: [],
  refresh: async () => {}, markRead: async () => {}, markAllRead: async () => {}, deleteNotification: async () => {}, clearRead: async () => {}, saveSettings: async () => {}, dismissToast: () => {},
});
export const useNotifications = () => useContext(Ctx);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const u = session?.user as any;
  const userId = u?.UserID ?? u?.userID ?? 0;
  const companyId = u?.CompanyID ?? u?.companyID ?? 1;
  const email = session?.user?.email ?? "";

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [settings, setSettings] = useState<NotifSettings>({ NotifyMessages: true, NotifyEmails: true });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const connRef = useRef<HubConnection | null>(null);
  const toastSeq = useRef(0);

  const dismissToast = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  const showToast = useCallback((n: AppNotification) => {
    const id = ++toastSeq.current;
    setToasts(t => [...t.slice(-3), { id, notification: n }]); // keep at most 4 stacked
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5500);

    // Professional per-type chime (Message / Email / Point-System).
    playNotificationSound(n.Type);

    // OS notification when the tab isn't focused (WhatsApp-style push). silent:true so the OS
    // doesn't add its own beep on top of our chime.
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        const os = new Notification(n.Title || "New notification", { body: n.Body || "", tag: `n-${n.NotificationID}`, icon: "/app/company-logo.png", silent: true });
        os.onclick = () => { window.focus(); if (n.Link) window.location.href = n.Link; os.close(); };
      }
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const r = await notificationsApi.list(userId, companyId, 30);
    if (r) { setNotifications(r.data); setUnread(r.unread); }
  }, [userId, companyId]);

  const markRead = useCallback(async (id: number) => {
    setNotifications(ns => ns.map(n => n.NotificationID === id ? { ...n, IsRead: true } : n));
    setUnread(c => Math.max(0, c - 1));
    if (userId) { const r = await notificationsApi.markRead(id, userId, companyId); if (r) setUnread(r.unread); }
  }, [userId, companyId]);

  const markAllRead = useCallback(async () => {
    setNotifications(ns => ns.map(n => ({ ...n, IsRead: true }))); setUnread(0);
    if (userId) await notificationsApi.markAllRead(userId, companyId);
  }, [userId, companyId]);

  const deleteNotification = useCallback(async (id: number) => {
    setNotifications(ns => {
      const gone = ns.find(n => n.NotificationID === id);
      if (gone && !gone.IsRead) setUnread(c => Math.max(0, c - 1));
      return ns.filter(n => n.NotificationID !== id);
    });
    if (userId) await notificationsApi.remove(id, userId, companyId);
  }, [userId, companyId]);

  const clearRead = useCallback(async () => {
    setNotifications(ns => ns.filter(n => !n.IsRead));
    if (userId) await notificationsApi.clearRead(userId, companyId);
  }, [userId, companyId]);

  const saveSettings = useCallback(async (s: NotifSettings) => {
    setSettings(s);
    if (userId) await notificationsApi.saveSettings(s, userId, companyId);
  }, [userId, companyId]);

  // Initial fetch + settings + browser-permission request + arm the sound engine.
  useEffect(() => {
    if (!userId) return;
    refresh();
    notificationsApi.getSettings(userId, companyId).then(s => { if (s) setSettings(s); });
    armNotificationSounds();
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
    } catch { /* ignore */ }
  }, [userId, companyId, refresh]);

  // Dedicated SignalR connection to receive real-time "Notification" pushes (own the user group).
  useEffect(() => {
    if (!userId) return;
    const conn = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/messagingHub?companyId=${companyId}&userId=${userId}`)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.None)
      .build();
    conn.on("Notification", (data: any) => {
      if (!data?.notification) return;
      const n: AppNotification = data.notification;
      setNotifications(ns => [n, ...ns].slice(0, 40));
      if (typeof data.unread === "number") setUnread(data.unread); else setUnread(c => c + 1);
      showToast(n);
    });
    conn.start().catch(() => {});
    connRef.current = conn;
    return () => { conn.stop().catch(() => {}); connRef.current = null; };
  }, [userId, companyId, showToast]);

  // Ring the "Point" chime when the Point-Management (TMS) unread count rises.
  const prevTms = useRef<number | null>(null);
  useEffect(() => {
    if (!email) return;
    let alive = true;
    const poll = () => pmApi.notificationsUnread(email).then((r) => {
      if (!alive) return;
      const p = prevTms.current;
      if (p !== null && r.count > p) playNotificationSound("Point");
      prevTms.current = r.count;
    }).catch(() => {});
    poll();
    const t = setInterval(poll, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [email]);

  // Poll the mailbox for new email every ~90s (server raises Email notifications → arrive via SignalR).
  useEffect(() => {
    if (!userId || !email || !settings.NotifyEmails) return;
    const tick = () => notificationsApi.checkEmail(email, userId, companyId).catch(() => {});
    const t = setInterval(tick, 90_000);
    const first = setTimeout(tick, 8_000); // one shortly after load
    return () => { clearInterval(t); clearTimeout(first); };
  }, [userId, companyId, email, settings.NotifyEmails]);

  return (
    <Ctx.Provider value={{ notifications, unread, settings, toasts, refresh, markRead, markAllRead, deleteNotification, clearRead, saveSettings, dismissToast }}>
      {children}
    </Ctx.Provider>
  );
}
