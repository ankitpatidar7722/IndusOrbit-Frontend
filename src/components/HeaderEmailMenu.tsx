"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Mail, RefreshCw, Maximize2, Send, Paperclip, Star } from "lucide-react";
import { useEmailComposer } from "@/components/email/EmailComposerProvider";
import { mailApi, type MailMessage } from "@/lib/mail";
import MailReaderModal from "@/components/MailReaderModal";

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
};

const AVATARS = ["rgb(var(--color-primary))", "#0f6a72", "#553c9a", "#b45309", "#276749", "#9b2c5a", "#0369a1"];
function avatarBg(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVATARS[h % AVATARS.length]; }

function ago(iso: string): string {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Header email dropdown — quick inbox peek + Compose + expand to the full /email client. */
export default function HeaderEmailMenu({ iconBtn }: { iconBtn: React.CSSProperties }) {
  const router = useRouter();
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const { openComposer } = useEmailComposer();

  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<MailMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [viewMsg, setViewMsg] = useState<MailMessage | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true); setErr(null);
    const r = await mailApi.list(email, "inbox", 1, 15);
    setLoading(false);
    if (r.success && r.data) { setEmails(r.data.emails); setUnread(r.data.unreadCount); }
    else setErr(r.error || "Could not load inbox.");
  }, [email]);

  // Prime the badge once on mount (header persists across navigation), refresh on open.
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!viewMsg && ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, viewMsg]);

  const goFull = () => { setOpen(false); router.push("/email"); };
  const compose = () => { setOpen(false); openComposer({ onSent: () => load() }); };

  // Open an email in the in-place reader popup (no navigation to /email).
  const openMail = async (i: number) => {
    const m = emails[i];
    if (!m) return;
    setViewIdx(i); setViewMsg(m); setViewLoading(true);
    const r = await mailApi.get(email, "inbox", m.id);
    setViewLoading(false);
    if (r.success && r.data) setViewMsg(r.data);
    if (!m.isRead) {
      mailApi.update(m.id, { email, folder: "inbox", isRead: true });
      setEmails((prev) => prev.map((e, idx) => (idx === i ? { ...e, isRead: true } : e)));
      setUnread((u) => Math.max(0, u - 1));
    }
  };
  const navigate = (dir: "prev" | "next") => {
    if (viewIdx == null) return;
    const ni = dir === "prev" ? viewIdx - 1 : viewIdx + 1;
    if (ni >= 0 && ni < emails.length) openMail(ni);
  };
  const onStarView = (starred: boolean) => {
    setViewMsg((v) => (v ? { ...v, isStarred: starred } : v));
    if (viewIdx != null) setEmails((prev) => prev.map((e, idx) => (idx === viewIdx ? { ...e, isStarred: starred } : e)));
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button style={iconBtn} title="Email" onClick={() => setOpen((o) => !o)}>
        <Mail size={18} />
        {unread > 0 && (
          <span style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 9, background: "rgb(var(--color-error))", color: "#fff", fontSize: 9.5, fontWeight: 800, display: "grid", placeItems: "center", lineHeight: 1 }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="header-popover" style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: 384, maxWidth: "92vw", background: T.surface, border: `1px solid ${T.bd}`, borderRadius: 14, boxShadow: "0 18px 50px -12px rgba(16,24,40,.35), 0 4px 12px rgba(16,24,40,.12)", overflow: "hidden", zIndex: 1000 }}>
          {/* Header */}
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.bd}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 800, color: T.fg }}>
                <Mail size={16} style={{ color: T.primary }} /> Inbox
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={load} title="Refresh" style={ghostBtn}>
                  <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : undefined }} />
                </button>
                <button onClick={goFull} title="Open full view" style={ghostBtn}><Maximize2 size={15} /></button>
                <button onClick={compose} title="Compose" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  <Send size={13} /> Compose
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>
              {unread > 0 ? `${unread} unread message${unread !== 1 ? "s" : ""}` : "You're all caught up"}
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {loading && emails.length === 0 ? (
              <div style={{ padding: 34, textAlign: "center", color: T.muted, fontSize: 13 }}>Loading emails…</div>
            ) : err ? (
              <div style={{ padding: 28, textAlign: "center" }}>
                <Mail size={30} style={{ color: T.faint, marginBottom: 8 }} />
                <div style={{ fontSize: 12.5, color: T.muted }}>{err}</div>
                <div style={{ fontSize: 11.5, color: T.faint, marginTop: 4 }}>Set your SMTP (App Password) in User Management → Emails.</div>
              </div>
            ) : emails.length === 0 ? (
              <div style={{ padding: 34, textAlign: "center", color: T.muted }}>
                <Mail size={34} style={{ color: T.faint, marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>Your inbox is empty</div>
              </div>
            ) : (
              emails.map((m, i) => (
                <div key={m.id} onClick={() => openMail(i)}
                  style={{ display: "flex", gap: 11, padding: "11px 14px", borderBottom: `1px solid ${T.bd}`, cursor: "pointer", background: m.isRead ? "transparent" : "color-mix(in srgb, rgb(var(--color-primary)) 5%, transparent)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = m.isRead ? "transparent" : "color-mix(in srgb, rgb(var(--color-primary)) 5%, transparent)")}
                >
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: avatarBg(m.from.email), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>
                    {(m.from.name?.[0] || m.from.email?.[0] || "?").toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: m.isRead ? 500 : 700, color: m.isRead ? T.muted : T.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }}>{m.from.name || m.from.email}</span>
                        {m.hasAttachments && <Paperclip size={12} style={{ color: T.muted, flexShrink: 0 }} />}
                      </span>
                      <span style={{ fontSize: 11, color: T.muted, flexShrink: 0, whiteSpace: "nowrap" }}>{ago(m.receivedAt)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: m.isRead ? 500 : 700, color: m.isRead ? T.muted : T.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.subject}</div>
                    <div style={{ fontSize: 11.5, color: T.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 5 }}>
                      {m.isStarred && <Star size={11} style={{ color: T.warning, fill: T.warning, flexShrink: 0 }} />}
                      {m.snippet}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <button onClick={goFull} style={{ width: "100%", padding: "11px", background: T.subtle, border: "none", borderTop: `1px solid ${T.bd}`, color: T.primary, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            View All Emails
          </button>
        </div>
      )}
      {viewMsg && (
        <MailReaderModal email={viewMsg} userEmail={email} folder="inbox"
          hasPrev={viewIdx != null && viewIdx > 0} hasNext={viewIdx != null && viewIdx < emails.length - 1}
          loading={viewLoading} onClose={() => { setViewMsg(null); setViewIdx(null); }} onNavigate={navigate}
          onChanged={load} onStar={onStarView} />
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const ghostBtn: React.CSSProperties = { display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.bd}`, background: T.surface, color: T.muted, cursor: "pointer" };
