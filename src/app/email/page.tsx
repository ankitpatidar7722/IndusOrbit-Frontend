"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge, Button, StandardModal } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import {
  Mail, Inbox, Star, Send, Archive, Trash2, RefreshCw, Search, Paperclip,
  Reply, Forward, Pencil, ChevronLeft, ChevronRight, Printer, X, Download, FileText, Menu,
} from "lucide-react";
import { mailApi, mailTime, attachmentUrl, type MailMessage, type MailListResult, type MailFolder } from "@/lib/mail";
import { useEmailComposer } from "@/components/email/EmailComposerProvider";
import TemplatesManager from "./TemplatesManager";

// Theme tokens (indas-ui) — never hardcode colors (frontend-design skill).
const T = {
  surface: "rgb(var(--bg-surface))",
  subtle: "rgb(var(--bg-subtle))",
  hover: "rgb(var(--bg-hover))",
  fg: "rgb(var(--fg-default))",
  muted: "rgb(var(--fg-muted))",
  faint: "rgb(var(--fg-muted) / 0.6)",
  bd: "rgb(var(--bd-default))",
  primary: "rgb(var(--color-primary))",
  warning: "rgb(var(--color-warning))",
  onPrimary: "#fff",
};

const FOLDERS: { id: MailFolder; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const AVATARS = ["rgb(var(--color-primary))", "#0f6a72", "#553c9a", "#b45309", "#276749", "#9b2c5a", "#0369a1"];
function avatarBg(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVATARS[h % AVATARS.length]; }
const initial = (a: { name?: string | null; email: string }) => (a.name?.[0] || a.email?.[0] || "?").toUpperCase();
const quote = (m: MailMessage) => `\n\n\n---------- Original message ----------\nFrom: ${m.from.name || ""} <${m.from.email}>\nDate: ${new Date(m.receivedAt).toLocaleString()}\nSubject: ${m.subject}\n\n${m.bodyText || m.snippet || ""}`;

const PER_PAGE = 50;

export default function EmailPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? "";
  const { openComposer } = useEmailComposer();

  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [foldersOpen, setFoldersOpen] = useState(false);   // mobile folder drawer
  const [showTemplates, setShowTemplates] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<MailListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<MailMessage | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  const reload = useCallback(async (f: MailFolder = folder, p = page) => {
    if (!userEmail) return;
    setLoading(true); setErr(null);
    const r = await mailApi.list(userEmail, f, p, PER_PAGE);
    setLoading(false);
    if (r.success && r.data) setResult(r.data);
    else { setResult({ emails: [], totalCount: 0, unreadCount: 0, hasMore: false }); setErr(r.error || "Could not load emails."); }
  }, [userEmail, folder, page]);

  useEffect(() => { reload(folder, page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userEmail, folder, page]);

  const selectFolder = (f: MailFolder) => { setFolder(f); setPage(1); };

  const openEmail = async (m: MailMessage) => {
    setViewing(m); setViewerLoading(true);
    const r = await mailApi.get(userEmail, folder, m.id);
    setViewerLoading(false);
    if (r.success && r.data) setViewing(r.data);
    if (!m.isRead) {
      mailApi.update(m.id, { email: userEmail, folder, isRead: true });
      setResult((prev) => prev ? { ...prev, emails: prev.emails.map((e) => e.id === m.id ? { ...e, isRead: true } : e), unreadCount: Math.max(0, prev.unreadCount - 1) } : prev);
    }
  };

  const toggleStar = async (e: React.MouseEvent, m: MailMessage) => {
    e.stopPropagation();
    const next = !m.isStarred;
    setResult((prev) => prev ? { ...prev, emails: prev.emails.map((x) => x.id === m.id ? { ...x, isStarred: next } : x) } : prev);
    await mailApi.update(m.id, { email: userEmail, folder, isStarred: next });
    if (folder === "starred") reload();
  };
  const archive = async (e: React.MouseEvent, m: MailMessage) => {
    e.stopPropagation();
    await mailApi.update(m.id, { email: userEmail, folder, isArchived: true });
    reload();
  };
  const del = async (e: React.MouseEvent, m: MailMessage) => {
    e.stopPropagation();
    await mailApi.remove(userEmail, folder, m.id);
    reload();
  };

  const reply = (m: MailMessage) => { setViewing(null); openComposer({ to: [{ email: m.from.email, name: m.from.name ?? undefined }], subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`, body: quote(m), onSent: () => reload() }); };
  const forward = (m: MailMessage) => { setViewing(null); openComposer({ subject: /^fwd:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`, body: quote(m), onSent: () => reload() }); };

  const emails = useMemo(() => {
    const list = result?.emails ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((e) => e.subject.toLowerCase().includes(q) || e.from.email.toLowerCase().includes(q) || (e.from.name || "").toLowerCase().includes(q) || (e.snippet || "").toLowerCase().includes(q));
  }, [result, search]);

  const unread = (id: string) => result?.emails.find((e) => e.id === id)?.isRead === false;
  const folderLabel = FOLDERS.find((f) => f.id === folder)?.label ?? "Email";

  if (!userEmail) return <BrandedLoader size="lg" text="Loading your mailbox…" />;

  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 150px)", minHeight: 520, border: `1px solid ${T.bd}`, borderRadius: 14, overflow: "hidden", background: T.surface, position: "relative" }}>
      {/* Backdrop behind the folder drawer (mobile only, shown via CSS when open) */}
      {foldersOpen && <div className="email-backdrop" onClick={() => setFoldersOpen(false)} />}
      {/* ── Folder rail (becomes a slide-in drawer on mobile) ── */}
      <div className={`email-rail${foldersOpen ? " email-rail-open" : ""}`} style={{ width: 210, flexShrink: 0, borderRight: `1px solid ${T.bd}`, background: T.subtle, display: "flex", flexDirection: "column", padding: "14px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 6px 12px", color: T.fg }}>
          <Mail size={18} style={{ color: T.primary }} />
          <span style={{ fontSize: 15, fontWeight: 800 }}>Email</span>
        </div>
        <Button variant="primary" size="sm" icon={Pencil} onClick={() => openComposer({ onSent: () => reload() })}>Compose</Button>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 2 }}>
          {FOLDERS.map((f) => {
            const active = !showTemplates && folder === f.id;
            const Icon = f.icon;
            const badge = f.id === "inbox" ? (result?.unreadCount ?? 0) : 0;
            return (
              <button key={f.id} onClick={() => { setShowTemplates(false); selectFolder(f.id); setFoldersOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: active ? 700 : 600, textAlign: "left", background: active ? T.surface : "transparent", color: active ? T.primary : T.muted, boxShadow: active ? `inset 0 0 0 1px ${T.bd}` : "none" }}>
                <Icon size={16} /> <span style={{ flex: 1 }}>{f.label}</span>
                {badge > 0 && <Badge variant="info">{badge}</Badge>}
              </button>
            );
          })}
          <div style={{ height: 1, background: T.bd, margin: "8px 4px" }} />
          <button onClick={() => { setShowTemplates(true); setFoldersOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: showTemplates ? 700 : 600, textAlign: "left", background: showTemplates ? T.surface : "transparent", color: showTemplates ? T.primary : T.muted, boxShadow: showTemplates ? `inset 0 0 0 1px ${T.bd}` : "none" }}>
            <FileText size={16} /> <span style={{ flex: 1 }}>Templates</span>
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {showTemplates ? <TemplatesManager /> : (<>
        {/* header */}
        <div style={{ height: 56, flexShrink: 0, borderBottom: `1px solid ${T.bd}`, display: "flex", alignItems: "center", gap: 14, padding: "0 16px" }}>
          {/* Hamburger — opens the folder drawer (mobile only) */}
          <button className="email-menu-btn" onClick={() => setFoldersOpen(true)} title="Folders" aria-label="Folders"
            style={{ display: "none", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.bd}`, background: T.surface, color: T.fg, cursor: "pointer", flexShrink: 0 }}>
            <Menu size={18} />
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: T.fg, margin: 0 }}>{folderLabel}</h1>
          <div style={{ flex: 1 }} />
          <div className="email-search" style={{ position: "relative", width: 260 }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: 10, color: T.muted }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search emails…"
              style={{ width: "100%", height: 36, padding: "0 12px 0 34px", fontSize: 13, border: `1px solid ${T.bd}`, borderRadius: 9, background: T.surface, color: T.fg, outline: "none", boxSizing: "border-box" }} />
          </div>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => reload()} disabled={loading}>Refresh</Button>
        </div>

        {/* list */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {loading && !result ? (
            <div style={{ padding: 60, textAlign: "center", color: T.muted, fontSize: 14 }}>Loading emails…</div>
          ) : err ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <Mail size={44} style={{ color: T.faint, marginBottom: 12 }} />
              <div style={{ color: T.fg, fontWeight: 600, marginBottom: 4 }}>{err}</div>
              <div style={{ color: T.muted, fontSize: 13 }}>Make sure your email (with a Gmail App Password) is set in User Management → Emails, and IMAP is enabled.</div>
            </div>
          ) : emails.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: T.muted }}>
              <Mail size={44} style={{ color: T.faint, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, color: T.fg }}>No emails{search ? " match your search" : ""}.</div>
            </div>
          ) : (
            emails.map((m) => (
              <div key={m.id} onClick={() => openEmail(m)}
                style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 16px", borderBottom: `1px solid ${T.bd}`, cursor: "pointer", background: m.isRead ? "transparent" : "color-mix(in srgb, rgb(var(--color-primary)) 5%, transparent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = m.isRead ? "transparent" : "color-mix(in srgb, rgb(var(--color-primary)) 5%, transparent)")}
              >
                <button onClick={(e) => toggleStar(e, m)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} title="Star">
                  <Star size={16} style={{ color: m.isStarred ? T.warning : T.faint, fill: m.isStarred ? T.warning : "none" }} />
                </button>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarBg(m.from.email), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initial(m.from)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: m.isRead ? 500 : 700, color: m.isRead ? T.muted : T.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{m.from.name || m.from.email}</span>
                    {m.hasAttachments && <Paperclip size={13} style={{ color: T.muted, flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: m.isRead ? 500 : 700, color: m.isRead ? T.muted : T.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.subject}</div>
                  <div style={{ fontSize: 12, color: T.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.snippet}</div>
                </div>
                <div style={{ fontSize: 11.5, color: T.muted, flexShrink: 0, whiteSpace: "nowrap" }}>{mailTime(m.receivedAt)}</div>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  {folder !== "archive" && <button onClick={(e) => archive(e, m)} title="Archive" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: T.muted }}><Archive size={15} /></button>}
                  {folder !== "trash" && <button onClick={(e) => del(e, m)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: T.muted }}><Trash2 size={15} /></button>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* pagination */}
        {folder !== "starred" && (result?.totalCount ?? 0) > 0 && (
          <div style={{ height: 46, flexShrink: 0, borderTop: `1px solid ${T.bd}`, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, padding: "0 16px" }}>
            <span style={{ fontSize: 12, color: T.muted }}>
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, result!.totalCount)} of {result!.totalCount}
            </span>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} style={{ background: "none", border: "none", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.3 : 1, color: T.muted, padding: 4 }}><ChevronLeft size={18} /></button>
            <button onClick={() => setPage((p) => p + 1)} disabled={!result?.hasMore || loading} style={{ background: "none", border: "none", cursor: !result?.hasMore ? "default" : "pointer", opacity: !result?.hasMore ? 0.3 : 1, color: T.muted, padding: 4 }}><ChevronRight size={18} /></button>
          </div>
        )}
        </>)}
      </div>

      {/* ── Reader ── */}
      {viewing && (
        <EmailViewer m={viewing} loading={viewerLoading} email={userEmail} folder={folder} onClose={() => setViewing(null)}
          onReply={() => reply(viewing)} onForward={() => forward(viewing)}
          onArchive={async () => { await mailApi.update(viewing.id, { email: userEmail, folder, isArchived: true }); setViewing(null); reload(); }}
          onDelete={async () => { await mailApi.remove(userEmail, folder, viewing.id); setViewing(null); reload(); }} />
      )}

      {/* Compose floating action button — mobile only (shown via CSS) */}
      {!showTemplates && (
        <button className="email-fab" onClick={() => openComposer({ onSent: () => reload() })} title="Compose" aria-label="Compose">
          <Pencil size={22} />
        </button>
      )}
    </div>
  );
}

function EmailViewer({ m, loading, email, folder, onClose, onReply, onForward, onArchive, onDelete }: {
  m: MailMessage; loading: boolean; email: string; folder: string; onClose: () => void;
  onReply: () => void; onForward: () => void; onArchive: () => void; onDelete: () => void;
}) {
  return (
    <StandardModal isOpen onClose={onClose} title={m.subject || "(No Subject)"} size="xl" showFooter={false}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 12, borderBottom: `1px solid ${T.bd}` }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: avatarBg(m.from.email), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>{initial(m.from)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.fg }}>{m.from.name || m.from.email}</div>
          <div style={{ fontSize: 12, color: T.muted }}>&lt;{m.from.email}&gt; · to {m.to.map((t) => t.name || t.email).join(", ") || "me"}</div>
        </div>
        <div style={{ fontSize: 12, color: T.muted, flexShrink: 0 }}>{new Date(m.receivedAt).toLocaleString()}</div>
      </div>

      <div style={{ padding: "16px 2px", minHeight: 180 }}>
        {loading ? (
          <div style={{ color: T.muted, textAlign: "center", padding: 40 }}>Loading message…</div>
        ) : m.bodyHtml ? (
          <iframe title="email-body" sandbox="allow-same-origin" srcDoc={m.bodyHtml}
            style={{ width: "100%", minHeight: 340, border: "none", background: "rgb(var(--bg-surface))", borderRadius: 8 }} />
        ) : (
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 13.5, color: T.fg, margin: 0, lineHeight: 1.55 }}>{m.bodyText || m.snippet}</pre>
        )}
      </div>

      {m.attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 0", borderTop: `1px solid ${T.bd}` }}>
          {m.attachments.map((a, i) => (
            <a key={a.id} href={attachmentUrl(email, folder, m.id, i)} target="_blank" rel="noreferrer" title={`Download ${a.filename}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", border: `1px solid ${T.bd}`, borderRadius: 8, fontSize: 12.5, color: T.fg, background: T.subtle, textDecoration: "none", cursor: "pointer" }}>
              <Paperclip size={13} style={{ color: T.muted }} /> <span>{a.filename}</span> <Download size={13} style={{ color: T.primary }} />
            </a>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, paddingTop: 14, borderTop: `1px solid ${T.bd}`, marginTop: 8 }}>
        <Button variant="primary" size="sm" icon={Reply} onClick={onReply}>Reply</Button>
        <Button variant="outline" size="sm" icon={Forward} onClick={onForward}>Forward</Button>
        <Button variant="outline" size="sm" icon={Printer} onClick={() => window.print()}>Print</Button>
        <div style={{ flex: 1 }} />
        <Button variant="outline" size="sm" icon={Archive} onClick={onArchive}>Archive</Button>
        <Button variant="action-delete" size="sm" icon={Trash2} onClick={onDelete}>Delete</Button>
        <Button variant="ghost" size="sm" iconOnly icon={X} tooltip="Close" onClick={onClose} />
      </div>
    </StandardModal>
  );
}
