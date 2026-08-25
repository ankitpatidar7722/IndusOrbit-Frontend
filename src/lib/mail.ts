// Mail (Gmail-like) API client — talks to the Indus360 .NET backend, which reads the
// acting user's own mailbox over IMAP (per-user SMTP creds from app.Users) and sends
// over SMTP. Cloned from the Parkson /activity/email client, adapted to our backend.

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface MailAddress {
  email: string;
  name?: string | null;
}

export interface MailAttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface MailMessage {
  id: string;                 // IMAP UID (per folder)
  folder: string;
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  snippet: string;
  bodyHtml?: string | null;   // only on detail fetch
  bodyText?: string | null;   // only on detail fetch
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments: MailAttachmentMeta[];
}

export interface MailListResult {
  emails: MailMessage[];
  totalCount: number;
  unreadCount: number;
  hasMore: boolean;
}

export type MailFolder = "inbox" | "starred" | "sent" | "archive" | "trash";

export interface MailApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const enc = encodeURIComponent;

async function get<T>(path: string): Promise<MailApiResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
    return (await res.json()) as MailApiResult<T>;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

async function send<T>(method: string, path: string, body?: unknown): Promise<MailApiResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    return (await res.json().catch(() => ({ success: res.ok }))) as MailApiResult<T>;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export interface MailStatusUpdate {
  email: string;              // acting user (whose mailbox)
  folder: string;
  isRead?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
}

export const mailApi = {
  /** A page of messages from the user's mailbox folder (newest first). */
  list: (email: string, folder: MailFolder | string, page = 1, limit = 50) =>
    get<MailListResult>(`/api/email/messages?email=${enc(email)}&folder=${enc(folder)}&page=${page}&limit=${limit}`),

  /** Full message (body + attachments) by IMAP UID. */
  get: (email: string, folder: string, uid: string) =>
    get<MailMessage>(`/api/email/messages/${enc(uid)}?email=${enc(email)}&folder=${enc(folder)}`),

  /** Update flags (read/star) or archive. */
  update: (uid: string, body: MailStatusUpdate) =>
    send<null>("PATCH", `/api/email/messages/${enc(uid)}`, body),

  /** Delete (move to Trash). */
  remove: (email: string, folder: string, uid: string) =>
    send<null>("DELETE", `/api/email/messages/${enc(uid)}?email=${enc(email)}&folder=${enc(folder)}`),
};

/** Direct download URL for an attachment — the browser downloads it (Content-Disposition). */
export function attachmentUrl(email: string, folder: string, uid: string, index: number): string {
  return `${BASE}/api/email/messages/${enc(uid)}/attachments/${index}?email=${enc(email)}&folder=${enc(folder)}`;
}

/** Relative time for the mail list (Today → time, this week → weekday, older → date). */
export function mailTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days <= 0 && now.getDate() === d.getDate()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
