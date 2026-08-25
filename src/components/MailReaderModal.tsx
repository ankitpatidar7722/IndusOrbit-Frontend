"use client";
import { Dialog, DialogContent, DialogTitle, Button } from "indas-ui";
import { ChevronLeft, ChevronRight, Star, Archive, Trash2, X, Reply, ReplyAll, Forward, Paperclip, Download } from "lucide-react";
import { mailApi, attachmentUrl, type MailMessage } from "@/lib/mail";
import { useEmailComposer } from "@/components/email/EmailComposerProvider";

const T = {
  surface: "rgb(var(--bg-surface))",
  subtle: "rgb(var(--bg-subtle))",
  fg: "rgb(var(--fg-default))",
  muted: "rgb(var(--fg-muted))",
  bd: "rgb(var(--bd-default))",
  primary: "rgb(var(--color-primary))",
  warning: "rgb(var(--color-warning))",
};
const AVATARS = ["rgb(var(--color-primary))", "#0f6a72", "#553c9a", "#b45309", "#276749", "#9b2c5a", "#0369a1"];
function avatarBg(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVATARS[h % AVATARS.length]; }
const quote = (m: MailMessage) => `\n\n\n---------- Original message ----------\nFrom: ${m.from.name || ""} <${m.from.email}>\nDate: ${new Date(m.receivedAt).toLocaleString()}\nSubject: ${m.subject}\n\n${m.bodyText || m.snippet || ""}`;

const toolBtn: React.CSSProperties = { display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: "rgb(var(--fg-muted))", cursor: "pointer" };

/**
 * Full email reader popup (Parkson EmailDetailModal style) — read a message in place
 * without leaving the current page. Prev/Next through the given list, star/archive/delete,
 * and Reply / Reply All / Forward (reuses the shared composer).
 */
export default function MailReaderModal({
  email, userEmail, folder, hasPrev, hasNext, loading, onClose, onNavigate, onChanged, onStar,
}: {
  email: MailMessage;
  userEmail: string;
  folder: string;
  hasPrev: boolean;
  hasNext: boolean;
  loading: boolean;
  onClose: () => void;
  onNavigate: (dir: "prev" | "next") => void;
  onChanged: () => void;
  onStar: (starred: boolean) => void;
}) {
  const { openComposer } = useEmailComposer();

  const reply = (all: boolean) => {
    const extra = all ? email.to.filter((a) => a.email.toLowerCase() !== userEmail.toLowerCase()).map((a) => ({ email: a.email, name: a.name ?? undefined })) : [];
    openComposer({
      to: [{ email: email.from.email, name: email.from.name ?? undefined }, ...extra],
      subject: /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`,
      body: quote(email),
      onSent: onChanged,
    });
    onClose();
  };
  const forward = () => {
    openComposer({ subject: /^fwd:/i.test(email.subject) ? email.subject : `Fwd: ${email.subject}`, body: quote(email), onSent: onChanged });
    onClose();
  };
  const star = async () => { const n = !email.isStarred; onStar(n); await mailApi.update(email.id, { email: userEmail, folder, isStarred: n }); onChanged(); };
  const archive = async () => { await mailApi.update(email.id, { email: userEmail, folder, isArchived: true }); onClose(); onChanged(); };
  const del = async () => { await mailApi.remove(userEmail, folder, email.id); onClose(); onChanged(); };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="xl" hideCloseButton className="p-0 flex flex-col overflow-hidden max-h-[88vh]" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{email.subject || "Email"}</DialogTitle>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${T.bd}`, background: T.subtle, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={() => onNavigate("prev")} disabled={!hasPrev} title="Newer" style={{ ...toolBtn, opacity: hasPrev ? 1 : 0.3, cursor: hasPrev ? "pointer" : "default" }}><ChevronLeft size={19} /></button>
            <button onClick={() => onNavigate("next")} disabled={!hasNext} title="Older" style={{ ...toolBtn, opacity: hasNext ? 1 : 0.3, cursor: hasNext ? "pointer" : "default" }}><ChevronRight size={19} /></button>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={star} title={email.isStarred ? "Unstar" : "Star"} style={toolBtn}><Star size={18} style={{ color: email.isStarred ? T.warning : "rgb(var(--fg-muted))", fill: email.isStarred ? T.warning : "none" }} /></button>
            <button onClick={archive} title="Archive" style={toolBtn}><Archive size={18} /></button>
            <button onClick={del} title="Delete" style={{ ...toolBtn, color: "rgb(var(--color-error))" }}><Trash2 size={18} /></button>
            <button onClick={onClose} title="Close" style={toolBtn}><X size={19} /></button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 24px", background: T.surface }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: T.fg, margin: "0 0 16px" }}>{email.subject || "(No Subject)"}</h1>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 13, paddingBottom: 14, marginBottom: 16, borderBottom: `1px solid ${T.bd}` }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: avatarBg(email.from.email), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 17, flexShrink: 0 }}>
              {(email.from.name?.[0] || email.from.email?.[0] || "?").toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: T.fg }}>{email.from.name || email.from.email}</span>
                <span style={{ fontSize: 12.5, color: T.muted }}>&lt;{email.from.email}&gt;</span>
              </div>
              <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>To: {email.to.map((t) => t.name || t.email).join(", ") || "me"}</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>{new Date(email.receivedAt).toLocaleString()}</div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: T.muted, textAlign: "center", padding: 40 }}>Loading message…</div>
          ) : email.bodyHtml ? (
            <iframe title="email-body" sandbox="allow-same-origin" srcDoc={email.bodyHtml}
              style={{ width: "100%", minHeight: 320, border: "none", background: "rgb(var(--bg-surface))", borderRadius: 8 }} />
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 13.5, color: T.fg, margin: 0, lineHeight: 1.6 }}>{email.bodyText || email.snippet}</pre>
          )}

          {email.attachments.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.bd}` }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: T.fg, marginBottom: 9 }}>
                <Paperclip size={14} /> {email.attachments.length} Attachment{email.attachments.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {email.attachments.map((a, i) => (
                  <a key={a.id} href={attachmentUrl(userEmail, folder, email.id, i)} target="_blank" rel="noreferrer" title={`Download ${a.filename}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", border: `1px solid ${T.bd}`, borderRadius: 8, fontSize: 12.5, color: T.fg, background: T.subtle, textDecoration: "none" }}>
                    <Paperclip size={13} style={{ color: T.muted }} /> <span>{a.filename}</span> <Download size={13} style={{ color: T.primary }} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, padding: "12px 18px", borderTop: `1px solid ${T.bd}`, background: T.subtle, flexShrink: 0 }}>
          <Button variant="outline" size="sm" icon={Reply} onClick={() => reply(false)}>Reply</Button>
          <Button variant="outline" size="sm" icon={ReplyAll} onClick={() => reply(true)}>Reply All</Button>
          <Button variant="outline" size="sm" icon={Forward} onClick={forward}>Forward</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
