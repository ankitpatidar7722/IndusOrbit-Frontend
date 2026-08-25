import { userIdHeader } from "@/lib/currentUser";
// Client-side email template library — ported from the legacy Indas Estimo
// templates.ts (SYSTEM_EMAIL_TEMPLATES + renderTemplate). Templates use {{var}}
// placeholders plus {{#if}} / {{#unless}} / {{#each}} blocks. Adapted to the
// Indus 360 client / subscription / support context.
import type { EmailTemplate, EmailTemplateAttachment, EmailAttachmentBase64 } from "./email";

export const SYSTEM_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "general-inquiry",
    name: "General Message",
    category: "General",
    subject: "{{subject}}",
    body: "Dear {{clientName}},\n\n{{message}}\n\nBest regards,\n{{senderName}}\nIndus Analytics",
    variables: [
      { name: "clientName", label: "Client Name", type: "text", required: true },
      { name: "subject", label: "Subject", type: "text", required: true },
      { name: "message", label: "Message", type: "text", required: true },
      { name: "senderName", label: "Your Name", type: "text", required: true },
    ],
  },
  {
    id: "welcome-email",
    name: "Welcome / Onboarding",
    category: "Onboarding",
    subject: "Welcome to {{applicationName}}, {{clientName}}!",
    body:
      "Dear {{clientName}},\n\nWelcome aboard! Your {{applicationName}} account has been set up and is ready to use.\n\n" +
      "Login URL: {{loginUrl}}\nCompany Login: {{companyLogin}}\n\n" +
      "Our team will reach out shortly to schedule your kick-off and training. If you have any questions, just reply to this email.\n\n" +
      "Best regards,\n{{senderName}}\nIndus Analytics",
    variables: [
      { name: "clientName", label: "Client Name", type: "text", required: true },
      { name: "applicationName", label: "Application", type: "text", required: true, defaultValue: "EstimoPrime" },
      { name: "loginUrl", label: "Login URL", type: "text", required: false },
      { name: "companyLogin", label: "Company Login", type: "text", required: false },
      { name: "senderName", label: "Your Name", type: "text", required: true },
    ],
  },
  {
    id: "payment-reminder",
    name: "Payment Reminder",
    category: "Billing",
    subject: "Payment Reminder - {{clientName}} ({{clientCode}})",
    body:
      "Dear {{clientName}},\n\nThis is a gentle reminder that your subscription payment is due on {{dueDate}}.\n\n" +
      "{{#if amount}}Amount due: {{amount}}\n\n{{/if}}" +
      "Please clear the pending payment to ensure uninterrupted service. Kindly ignore this message if payment has already been made.\n\n" +
      "Best regards,\n{{senderName}}\nIndus Analytics",
    variables: [
      { name: "clientName", label: "Client Name", type: "text", required: true },
      { name: "clientCode", label: "Client Code", type: "text", required: false },
      { name: "dueDate", label: "Due Date", type: "date", required: true },
      { name: "amount", label: "Amount", type: "text", required: false },
      { name: "senderName", label: "Your Name", type: "text", required: true },
    ],
  },
  {
    id: "subscription-renewal",
    name: "Subscription Renewal",
    category: "Billing",
    subject: "Your subscription is expiring soon - {{clientName}}",
    body:
      "Dear {{clientName}},\n\nYour {{applicationName}} subscription is scheduled to expire on {{expiryDate}}.\n\n" +
      "To continue enjoying uninterrupted access, please renew before the expiry date. Our team is happy to help with the renewal process.\n\n" +
      "Best regards,\n{{senderName}}\nIndus Analytics",
    variables: [
      { name: "clientName", label: "Client Name", type: "text", required: true },
      { name: "applicationName", label: "Application", type: "text", required: true, defaultValue: "EstimoPrime" },
      { name: "expiryDate", label: "Expiry Date", type: "date", required: true },
      { name: "senderName", label: "Your Name", type: "text", required: true },
    ],
  },
  {
    id: "support-followup",
    name: "Support / Issue Follow-up",
    category: "Support",
    subject: "Follow-up on your request - {{ticketRef}}",
    body:
      "Dear {{clientName}},\n\nWe are following up on your recent request ({{ticketRef}}).\n\n{{message}}\n\n" +
      "Please let us know if there is anything else we can help with.\n\nBest regards,\n{{senderName}}\nIndus Analytics",
    variables: [
      { name: "clientName", label: "Client Name", type: "text", required: true },
      { name: "ticketRef", label: "Ticket / Ref", type: "text", required: false },
      { name: "message", label: "Message", type: "text", required: true },
      { name: "senderName", label: "Your Name", type: "text", required: true },
    ],
  },
  {
    id: "quotation-followup",
    name: "Quotation Follow-up",
    category: "Business",
    subject: "Following up on Quotation #{{quotationNumber}}",
    body:
      "Dear {{clientName}},\n\nI hope this message finds you well. I wanted to follow up on Quotation #{{quotationNumber}} shared with you on {{sentDate}}.\n\n" +
      "Please let me know if you have any questions or need any adjustments. We would be glad to move forward at your convenience.\n\n" +
      "Best regards,\n{{senderName}}\nIndus Analytics",
    variables: [
      { name: "clientName", label: "Client Name", type: "text", required: true },
      { name: "quotationNumber", label: "Quotation No.", type: "text", required: true },
      { name: "sentDate", label: "Sent Date", type: "date", required: false },
      { name: "senderName", label: "Your Name", type: "text", required: true },
    ],
  },
];

export const TEMPLATE_CATEGORIES = Array.from(new Set(SYSTEM_EMAIL_TEMPLATES.map((t) => t.category)));

/** Merge a template's declared defaultValues under the supplied variables. */
export function withDefaults(template: EmailTemplate, vars: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const v of template.variables) if (v.defaultValue != null) out[v.name] = v.defaultValue;
  return { ...out, ...vars };
}

/**
 * Render a template string with variables — regex-based, applied in order:
 * 1) {{key}}  2) {{#if cond}}…{{/if}}  3) {{#unless cond}}…{{/unless}}  4) {{#each arr}}…{{/each}}.
 * Ported verbatim in behaviour from the legacy renderTemplate().
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  let out = template;

  // 1) simple {{key}} — do #each/#if first so their inner {{this.x}} survive
  // (order matches legacy: simple replace first, then blocks)
  for (const [key, value] of Object.entries(variables)) {
    if (Array.isArray(value) || (value && typeof value === "object")) continue;
    out = out.replace(new RegExp(`{{\\s*${escapeRe(key)}\\s*}}`, "g"), String(value ?? ""));
  }

  // 2) {{#if cond}}...{{/if}}
  out = out.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (_m, cond, content) =>
    variables[cond] ? content : "");

  // 3) {{#unless cond}}...{{/unless}}
  out = out.replace(/{{#unless\s+(\w+)}}([\s\S]*?){{\/unless}}/g, (_m, cond, content) =>
    !variables[cond] ? content : "");

  // 4) {{#each arr}}...{{/each}}
  out = out.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (_m, name, content) => {
    const arr = variables[name];
    if (!Array.isArray(arr)) return "";
    return arr
      .map((item) => {
        if (item && typeof item === "object") {
          let block = content;
          for (const [k, v] of Object.entries(item as Record<string, unknown>))
            block = block.replace(new RegExp(`{{\\s*this\\.${escapeRe(k)}\\s*}}`, "g"), String(v ?? ""));
          return block;
        }
        return content.replace(/{{\s*this\s*}}/g, String(item ?? ""));
      })
      .join("\n");
  });

  return out;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─────────────────────────── DB-backed templates ───────────────────────────
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface DbEmailTemplate { id: number; name: string; subject: string; body: string; category?: string | null; isActive?: boolean; attachments?: EmailTemplateAttachment[]; }
/** One attachment in a template save — kept existing ones carry `id` (no content); new uploads carry `content` (no id). */
export interface TemplateAttachmentSave { id?: number; filename: string; content?: string; contentType?: string | null; size?: number | null; }
export interface TemplateSave { name: string; subject: string; body: string; category?: string | null; attachments?: TemplateAttachmentSave[]; }

/** Turn "clientName" / "due_date" → "Client Name" / "Due Date". */
function humanize(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/** Auto-derive the variable list from {{placeholders}} in subject+body (skips block helpers + `this`). */
export function deriveVariables(subject: string, body: string): EmailTemplate["variables"] {
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  const names = new Set<string>();
  for (const s of [subject || "", body || ""]) { let m: RegExpExecArray | null; while ((m = re.exec(s))) { if (m[1] !== "this") names.add(m[1]); } }
  return [...names].map((name) => ({ name, label: humanize(name), type: "text" as const, required: false }));
}

/** Map a DB row → the EmailTemplate shape the composer uses (variables derived from tokens). */
export function toEmailTemplate(r: DbEmailTemplate): EmailTemplate {
  return { id: String(r.id), name: r.name, category: r.category ?? "General", subject: r.subject, body: r.body, variables: deriveVariables(r.subject, r.body), attachments: r.attachments ?? [] };
}

export const templatesApi = {
  /** Live templates from the DB (empty array on error — caller falls back to SYSTEM_EMAIL_TEMPLATES). */
  list: async (): Promise<EmailTemplate[]> => {
    try {
      const res = await fetch(`${BASE}/api/email/templates`, { cache: "no-store" });
      const j = await res.json();
      if (j?.success && Array.isArray(j.data)) return (j.data as DbEmailTemplate[]).map(toEmailTemplate);
    } catch { /* offline / DB down */ }
    return [];
  },
  /** Full attachments (with base64 content) for a template — used to auto-attach when applying it in the composer. */
  attachments: async (id: string | number): Promise<EmailAttachmentBase64[]> => {
    try {
      const res = await fetch(`${BASE}/api/email/templates/${id}/attachments`, { cache: "no-store" });
      const j = await res.json();
      if (j?.success && Array.isArray(j.data)) {
        return (j.data as { filename: string; content: string; contentType?: string; size?: number }[])
          .map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType || "application/octet-stream", size: a.size }));
      }
    } catch { /* offline / DB down */ }
    return [];
  },
  create: (b: TemplateSave) => fetch(`${BASE}/api/email/templates`, { method: "POST", headers: { "Content-Type": "application/json", ...userIdHeader() }, body: JSON.stringify(b), cache: "no-store" }).then((r) => r.json()),
  update: (id: string | number, b: TemplateSave) => fetch(`${BASE}/api/email/templates/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", ...userIdHeader() }, body: JSON.stringify(b), cache: "no-store" }).then((r) => r.json()),
  remove: (id: string | number) => fetch(`${BASE}/api/email/templates/${id}`, { method: "DELETE", cache: "no-store" }).then((r) => r.json()),
};
