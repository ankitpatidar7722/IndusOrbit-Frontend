// Notifications API client (chat + email) for Indus 360 — talks to /api/notifications.
// Real-time delivery arrives over the messaging SignalR hub ("Notification" event);
// this client is for the initial fetch, mark-read, settings, and the email poll.

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface AppNotification {
  NotificationID: number;
  UserID: number;
  Type: "Message" | "Email" | "System";
  Title: string | null;
  Body: string | null;
  Link: string | null;
  RefId: string | null;
  IconKey: string | null;
  IsRead: boolean;
  CreatedAt: string;
}

export interface NotifSettings { NotifyMessages: boolean; NotifyEmails: boolean }

function headers(userId: number | string, companyId: number | string = 1): Record<string, string> {
  return { "Content-Type": "application/json", UserID: String(userId), CompanyID: String(companyId) };
}

async function j<T>(method: string, path: string, userId: number | string, companyId: number | string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: headers(userId, companyId),
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
    });
    if (!res.ok) return null;
    return res.status === 204 ? (null as T) : await res.json();
  } catch { return null; }
}

export const notificationsApi = {
  list: (userId: number | string, companyId: number | string, limit = 30) =>
    j<{ data: AppNotification[]; unread: number }>("GET", `/api/notifications?limit=${limit}`, userId, companyId),
  markRead: (id: number, userId: number | string, companyId: number | string) =>
    j<{ unread: number }>("POST", `/api/notifications/${id}/read`, userId, companyId, {}),
  markAllRead: (userId: number | string, companyId: number | string) =>
    j<{ unread: number }>("POST", `/api/notifications/read-all`, userId, companyId, {}),
  remove: (id: number, userId: number | string, companyId: number | string) =>
    j<{ unread: number }>("DELETE", `/api/notifications/${id}`, userId, companyId),
  clearRead: (userId: number | string, companyId: number | string) =>
    j<{ cleared: number }>("POST", `/api/notifications/clear-read`, userId, companyId, {}),
  getSettings: (userId: number | string, companyId: number | string) =>
    j<NotifSettings>("GET", `/api/notifications/settings`, userId, companyId),
  saveSettings: (s: NotifSettings, userId: number | string, companyId: number | string) =>
    j<{ Message: string }>("PUT", `/api/notifications/settings`, userId, companyId, s),
  // Poll the mailbox for new email → raises Email notifications server-side.
  checkEmail: (email: string, userId: number | string, companyId: number | string) =>
    j<{ created: number }>("GET", `/api/email/check-notifications?email=${encodeURIComponent(email)}`, userId, companyId),
};
