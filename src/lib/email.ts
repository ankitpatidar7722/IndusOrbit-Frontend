import { userIdHeader } from "@/lib/currentUser";
// Email API client for Indus 360 — talks to the .NET backend EmailController
// (migrated from the legacy Indas Estimo email feature). SMTP transport; the
// backend sources credentials from IntegrationConfig, never the client.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface EmailAddress { email: string; name?: string }

export interface EmailAttachmentBase64 {
  filename: string;
  content: string;        // base64, no data: prefix
  contentType: string;
  size?: number;
}

/** Optional Client / Project / Issue context carried into history. */
export interface EmailContext {
  clientCode?: string;
  clientName?: string;
  pointId?: number;
  ticketId?: number;
  module?: string;
}

export interface EmailSendRequest extends EmailContext {
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
  attachments?: EmailAttachmentBase64[];
  sentByEmail?: string;
  sentByName?: string;
}

export interface EmailSendResult {
  success: boolean;
  provider?: string;
  message?: string;
  error?: string;
  historyId?: number;
}

export interface EmailConfig {
  configured: boolean;
  provider: string;
  mailbox: string;
  fromName?: string;
  senderDisplay?: string;   // e.g. "Indus Analytics <noreply.indus99@gmail.com>"
  smtpConfigured: boolean;
  graphConfigured: boolean;
  signature?: string | null;   // per-user HTML signature, appended when composing
}

export interface EmailHistoryItem {
  id: number;
  recipients?: string;
  subject?: string;
  clientCode?: string;
  clientName?: string;
  pointId?: number;
  ticketId?: number;
  module?: string;
  provider?: string;
  status?: string;             // 'Sent' | 'Failed'
  errorMessage?: string;
  attachmentsJson?: string;
  sentByName?: string;
  sentAt: string;
}

// ---- templates (client-side library, ported from the legacy templates.ts) ----
export interface EmailTemplateVariable {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "boolean" | "select";
  defaultValue?: string;
  options?: string[];
  required: boolean;
}
/** Attachment saved with a template — metadata only (base64 content fetched on apply). */
export interface EmailTemplateAttachment {
  id: number;
  filename: string;
  contentType?: string | null;
  size?: number | null;
}
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: EmailTemplateVariable[];
  category: string;
  attachments?: EmailTemplateAttachment[];
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...userIdHeader(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const b = await res.json(); msg = b.error || b.message || JSON.stringify(b); } catch { msg = await res.text(); }
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : await res.json();
}

export const emailApi = {
  config: (email?: string) => j<EmailConfig>(`/api/email/config${email ? `?email=${encodeURIComponent(email)}` : ""}`),
  send: (body: EmailSendRequest) => j<EmailSendResult>("/api/email/send", { method: "POST", body: JSON.stringify(body) }),
  history: (ctx?: { clientCode?: string; pointId?: number }) => {
    const p = new URLSearchParams();
    if (ctx?.clientCode) p.set("clientCode", ctx.clientCode);
    if (ctx?.pointId != null) p.set("pointId", String(ctx.pointId));
    const qs = p.toString();
    return j<EmailHistoryItem[]>(`/api/email/history${qs ? `?${qs}` : ""}`);
  },
};

/** Read a File as base64 (strips the data: prefix) for attachment upload. */
export function fileToBase64(file: File): Promise<EmailAttachmentBase64> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes("base64,") ? result.split("base64,")[1] : result;
      resolve({ filename: file.name, content: base64, contentType: file.type || "application/octet-stream", size: file.size });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
