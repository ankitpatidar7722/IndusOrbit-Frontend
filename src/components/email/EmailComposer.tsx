"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { StandardModal, Dropdown, useModalAlert } from "indas-ui";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Paperclip, X, Mail, FileText, Image as ImageIcon } from "lucide-react";
import { insertImageFile } from "@/lib/imageEmbed";
import {
  emailApi, fileToBase64,
  type EmailAddress, type EmailAttachmentBase64, type EmailContext, type EmailSendRequest, type EmailConfig, type EmailTemplate,
} from "@/lib/email";
import { SYSTEM_EMAIL_TEMPLATES, renderTemplate, withDefaults, templatesApi } from "@/lib/emailTemplates";

export interface ComposerInit {
  to?: EmailAddress[];
  cc?: EmailAddress[];
  subject?: string;
  body?: string;
  context?: EmailContext;
  attachments?: EmailAttachmentBase64[];
  onSent?: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #d6dbe3", borderRadius: 8, fontSize: 13.5, outline: "none", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" };
const chip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, background: "rgb(var(--bg-subtle))", color: "rgb(var(--color-primary))", borderRadius: 999, padding: "3px 6px 3px 10px", fontSize: 12, fontWeight: 600, maxWidth: "100%", minWidth: 0 };
const tbtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 28, border: "1px solid #e2e7ef", background: "rgb(var(--bg-surface))", borderRadius: 7, cursor: "pointer", color: "#334" };
const rowLabel: React.CSSProperties = { width: 44, fontSize: 12, fontWeight: 700, color: "rgb(var(--fg-muted))", flexShrink: 0, paddingTop: 8 };

/** A To/Cc/Bcc field: validated email chips + free text, with Gmail-style autocomplete of
 *  previously-emailed addresses (passed in via `suggestions`). */
function ChipField({ value, onChange, suggestions = [] }: { value: EmailAddress[]; onChange: (v: EmailAddress[]) => void; suggestions?: EmailAddress[] }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const commit = (rawEmail: string, name?: string) => {
    const email = rawEmail.trim().replace(/[,;]+$/, "").trim();
    if (!email) return;
    if (!EMAIL_RE.test(email)) return; // ignore invalid; user sees it not chip-ify
    if (value.some((v) => v.email.toLowerCase() === email.toLowerCase())) { setText(""); setOpen(false); return; }
    onChange([...value, name ? { email, name } : { email }]);
    setText(""); setOpen(false); setActive(0);
  };

  // Gmail-style matches: previously-emailed addresses containing what's typed, minus already-added ones.
  const q = text.trim().toLowerCase();
  const added = new Set(value.map((v) => v.email.toLowerCase()));
  const matches = q
    ? suggestions
        .filter((s) => !added.has(s.email.toLowerCase()))
        .filter((s) => s.email.toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q))
        .slice(0, 8)
    : [];
  const showDrop = open && matches.length > 0;

  // close the dropdown on an outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(ev.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={boxRef} style={{ position: "relative", minWidth: 0 }}>
      <div style={{ ...input, display: "flex", flexWrap: "wrap", gap: 6, padding: 6, minHeight: 38, minWidth: 0 }}>
        {value.map((a) => (
          <span key={a.email} style={chip}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{a.name ? `${a.name} <${a.email}>` : a.email}</span>
            <button onClick={() => onChange(value.filter((x) => x.email !== a.email))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "rgb(var(--color-primary))", display: "grid", placeItems: "center", flexShrink: 0 }}><X size={12} /></button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",") || v.endsWith(";")) commit(v);
            else { setText(v); setOpen(true); setActive(0); }
          }}
          onKeyDown={(e) => {
            if (showDrop && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setActive((i) => e.key === "ArrowDown" ? (i + 1) % matches.length : (i - 1 + matches.length) % matches.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (showDrop && matches[active]) commit(matches[active].email, matches[active].name);
              else commit(text);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onFocus={() => { if (text) setOpen(true); }}
          onBlur={() => commit(text)}
          placeholder={value.length ? "" : "name@example.com"}
          style={{ flex: 1, minWidth: 120, border: "none", outline: "none", fontSize: 13.5, background: "transparent" }}
        />
      </div>

      {showDrop && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 40, marginTop: 4, background: "rgb(var(--bg-surface))", border: "1px solid #d6dbe3", borderRadius: 8, boxShadow: "0 10px 28px -8px rgba(0,0,0,.28)", overflow: "hidden", maxHeight: 264, overflowY: "auto" }}>
          {matches.map((s, i) => (
            <button
              key={s.email}
              type="button"
              // onMouseDown (not onClick) + preventDefault so the input doesn't blur before we commit.
              onMouseDown={(e) => { e.preventDefault(); commit(s.email, s.name); }}
              onMouseEnter={() => setActive(i)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "none", cursor: "pointer", textAlign: "left", background: i === active ? "rgb(var(--bg-subtle))" : "transparent" }}
            >
              <span style={{ width: 26, height: 26, borderRadius: 999, background: "rgb(var(--color-primary))", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {(s.name || s.email).trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span style={{ minWidth: 0 }}>
                {s.name && <div style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-default))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>}
                <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmailComposer({ open, init, onClose }: { open: boolean; init: ComposerInit | null; onClose: () => void }) {
  const { data: session } = useSession();
  const sender = (session?.user ?? {}) as { name?: string; email?: string };
  const { showSuccess, showError, AlertComponent } = useModalAlert();

  const [to, setTo] = useState<EmailAddress[]>([]);
  const [cc, setCc] = useState<EmailAddress[]>([]);
  const [bcc, setBcc] = useState<EmailAddress[]>([]);
  const [suggestions, setSuggestions] = useState<EmailAddress[]>([]); // Gmail-style recipient autocomplete source
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState<EmailAttachmentBase64[]>([]);
  const [sending, setSending] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [tvars, setTvars] = useState<Record<string, string>>({});
  const [cfg, setCfg] = useState<EmailConfig | null>(null);
  const [includeSig, setIncludeSig] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>(SYSTEM_EMAIL_TEMPLATES);
  const editorRef = useRef<HTMLDivElement>(null);
  // latest cfg/toggle for the async body-init (setTimeout) closure
  const cfgRef = useRef<EmailConfig | null>(null);
  const includeSigRef = useRef(true);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  useEffect(() => { includeSigRef.current = includeSig; }, [includeSig]);
  const ctx = init?.context;

  // load the sending mailbox resolved for the logged-in user (their per-user SMTP if set)
  useEffect(() => { emailApi.config(sender.email).then(setCfg).catch(() => {}); }, [sender.email]);

  // (re)initialise every time the composer opens
  useEffect(() => {
    if (!open) return;
    setTo(init?.to ?? []);
    setCc(init?.cc ?? []);
    setBcc([]);
    setShowCc(!!init?.cc?.length);
    setShowBcc(false);
    setSubject(init?.subject ?? "");
    setAttachments(init?.attachments ?? []);
    setTemplateId("");
    setTvars({});
    setIncludeSig(true);
    templatesApi.list().then((list) => setTemplates(list.length ? list : SYSTEM_EMAIL_TEMPLATES)).catch(() => {});
    emailApi.recipients().then(setSuggestions).catch(() => {}); // company-wide past recipients (all senders) for autocomplete
    // set body after the editor mounts, then append the saved signature (if any)
    setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.innerHTML = (init?.body ?? "").replace(/\n/g, "<br/>");
      if (includeSigRef.current && cfgRef.current?.signature) appendSigNode(editor, cfgRef.current.signature);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep the signature block in sync when it loads late or the user toggles it
  useEffect(() => {
    if (!open) return;
    const editor = editorRef.current;
    if (!editor) return;
    if (includeSig && cfg?.signature) appendSigNode(editor, cfg.signature);
    else removeSigNode(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, includeSig, cfg?.signature]);

  const template = useMemo(() => templates.find((t) => t.id === templateId) || null, [templateId, templates]);

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) { setTvars({}); return; }
    // prefill variables from context + sender + declared defaults
    const seed: Record<string, string> = {};
    for (const v of t.variables) {
      if (v.name === "clientName" && ctx?.clientName) seed[v.name] = ctx.clientName;
      else if (v.name === "clientCode" && ctx?.clientCode) seed[v.name] = ctx.clientCode;
      else if (v.name === "senderName" && sender.name) seed[v.name] = sender.name;
      else if (v.defaultValue != null) seed[v.name] = v.defaultValue;
    }
    setTvars(seed);
  };

  const applyTemplate = async () => {
    if (!template) return;
    const vars = withDefaults(template, tvars);
    setSubject(renderTemplate(template.subject, vars));
    const bodyText = renderTemplate(template.body, vars);
    if (editorRef.current) {
      editorRef.current.innerHTML = bodyText.replace(/\n/g, "<br/>");
      if (includeSig && cfg?.signature) appendSigNode(editorRef.current, cfg.signature);
    }
    // Auto-attach the files saved with this template (skip any already attached by name+size).
    if (template.attachments && template.attachments.length) {
      const files = await templatesApi.attachments(template.id);
      if (files.length) {
        setAttachments((prev) => {
          const seen = new Set(prev.map((a) => `${a.filename}|${a.size ?? 0}`));
          return [...prev, ...files.filter((a) => !seen.has(`${a.filename}|${a.size ?? 0}`))];
        });
      }
    }
  };

  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); editorRef.current?.focus(); };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const added = await Promise.all(Array.from(files).map(fileToBase64));
    setAttachments((prev) => [...prev, ...added]);
  };

  const send = async () => {
    if (!to.length) { showError("Recipient required", "Add at least one valid recipient in the To field."); return; }
    if (!subject.trim()) { showError("Subject required", "Please enter a subject."); return; }
    const htmlBody = editorRef.current?.innerHTML ?? "";
    const textBody = editorRef.current?.innerText ?? "";
    setSending(true);
    try {
      const req: EmailSendRequest = {
        to, cc: cc.length ? cc : undefined, bcc: bcc.length ? bcc : undefined,
        subject: subject.trim(), htmlBody, textBody,
        replyTo: sender.email || undefined,
        attachments: attachments.length ? attachments : undefined,
        clientCode: ctx?.clientCode, clientName: ctx?.clientName, pointId: ctx?.pointId, ticketId: ctx?.ticketId, module: ctx?.module,
        sentByEmail: sender.email, sentByName: sender.name,
      };
      const res = await emailApi.send(req);
      if (res.success) {
        showSuccess("Email sent", `Delivered via ${res.provider ?? "SMTP"}.`, 2500);
        init?.onSent?.();
        onClose();
      } else {
        showError("Send failed", res.error || res.message || "Unknown error.");
      }
    } catch (e) {
      showError("Send failed", String(e instanceof Error ? e.message : e));
    } finally {
      setSending(false);
    }
  };

  const totalAttachBytes = attachments.reduce((s, a) => s + (a.size ?? 0), 0);

  return (
    <>
      <StandardModal
        isOpen={open}
        onClose={() => { if (!sending) onClose(); }}
        title="Compose Email"
        subtitle={ctx?.clientName ? `To ${ctx.clientName}${ctx.clientCode ? ` · ${ctx.clientCode}` : ""}` : undefined}
        size="xl"
        showFooter
        onSave={send}
        onCancel={onClose}
        saveLabel={sending ? "Sending…" : "Send Email"}
        saveIcon={Mail}
        saving={sending}
      >
        <div className="email-compose-body" style={{ display: "grid", gap: 10, minWidth: 0 }}>
          {/* From — the actual sending mailbox (read-only, from server config) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{ width: 44, fontSize: 12, fontWeight: 700, color: "rgb(var(--fg-muted))", flexShrink: 0 }}>From</div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9, background: "rgb(var(--bg-subtle))", border: "1px solid #e6eaf0", borderRadius: 8, padding: "8px 12px" }}>
              <Mail size={14} style={{ opacity: 0.55, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-default))", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {sender.email
                  ? (sender.name ? `${sender.name} <${sender.email}>` : sender.email)
                  : (cfg ? (cfg.configured ? cfg.mailbox : "No mailbox configured") : "Loading…")}
              </span>
              {cfg?.configured && cfg.mailbox && sender.email && sender.email.toLowerCase() !== cfg.mailbox.toLowerCase() && (
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: "rgb(var(--fg-muted))", whiteSpace: "nowrap" }} title="Actual delivery mailbox (SMTP account)">via&nbsp;{cfg.mailbox}</span>
              )}
            </div>
          </div>

          {(ctx?.clientName || ctx?.pointId || ctx?.module) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgb(var(--bg-subtle))", border: "1px solid #d6e0ee", borderRadius: 9, padding: "7px 12px", fontSize: 12.5, color: "rgb(var(--color-primary))" }}>
              <Mail size={14} />
              <span><b>Context:</b> {ctx?.clientName ?? "—"}{ctx?.clientCode ? ` (${ctx.clientCode})` : ""}{ctx?.pointId ? ` · Issue #${ctx.pointId}` : ""}{ctx?.module ? ` · ${ctx.module}` : ""}</span>
            </div>
          )}

          {/* To + Cc/Bcc toggles */}
          <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
            <div style={rowLabel}>To</div>
            <div style={{ flex: 1, minWidth: 0 }}><ChipField value={to} onChange={setTo} suggestions={suggestions} /></div>
            <div style={{ display: "flex", gap: 6, paddingTop: 8, flexShrink: 0 }}>
              {!showCc && <button onClick={() => setShowCc(true)} style={{ ...tbtn, width: "auto", padding: "0 8px", fontSize: 12, fontWeight: 700 }}>Cc</button>}
              {!showBcc && <button onClick={() => setShowBcc(true)} style={{ ...tbtn, width: "auto", padding: "0 8px", fontSize: 12, fontWeight: 700 }}>Bcc</button>}
            </div>
          </div>
          {showCc && <div style={{ display: "flex", gap: 8, minWidth: 0 }}><div style={rowLabel}>Cc</div><div style={{ flex: 1, minWidth: 0 }}><ChipField value={cc} onChange={setCc} suggestions={suggestions} /></div></div>}
          {showBcc && <div style={{ display: "flex", gap: 8, minWidth: 0 }}><div style={rowLabel}>Bcc</div><div style={{ flex: 1, minWidth: 0 }}><ChipField value={bcc} onChange={setBcc} suggestions={suggestions} /></div></div>}

          {/* Template picker */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0 }}>
            <div style={{ ...rowLabel, paddingTop: 8 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FileText size={13} /></span></div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 180px", minWidth: 0, maxWidth: 280 }}>
                <Dropdown
                  value={templateId}
                  onValueChange={(v) => pickTemplate(String(v))}
                  options={[{ value: "", label: "— Use a template —" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
                  placeholder="— Use a template —"
                  searchable
                  size="md"
                />
              </div>
              {template && <button onClick={applyTemplate} style={{ ...tbtn, width: "auto", padding: "0 14px", fontWeight: 700, background: "rgb(var(--color-primary))", color: "#fff", border: "none", whiteSpace: "nowrap", flexShrink: 0 }}>Apply template</button>}
            </div>
          </div>
          {template && template.variables.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 12px", background: "rgb(var(--bg-subtle))", border: "1px solid #e6eaf0", borderRadius: 9, padding: 12 }}>
              {template.variables.map((v) => (
                <div key={v.name}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "rgb(var(--fg-muted))", letterSpacing: 0.1 }}>{v.label}{v.required ? " *" : ""}</label>
                  {v.type === "select" ? (
                    <select value={tvars[v.name] ?? ""} onChange={(e) => setTvars((p) => ({ ...p, [v.name]: e.target.value }))} style={{ ...input, marginTop: 3 }}>
                      <option value="">—</option>
                      {(v.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={v.type === "date" ? "date" : v.type === "number" ? "number" : "text"} value={tvars[v.name] ?? ""} onChange={(e) => setTvars((p) => ({ ...p, [v.name]: e.target.value }))} style={{ ...input, marginTop: 3 }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Subject */}
          <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
            <div style={{ ...rowLabel, paddingTop: 9 }}>Subject</div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={{ ...input, flex: 1, minWidth: 0 }} />
          </div>

          {/* Toolbar + body */}
          <div style={{ border: "1px solid #d6dbe3", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 6, padding: 8, borderBottom: "1px solid #eef1f5", background: "rgb(var(--bg-subtle))" }}>
              <button style={tbtn} title="Bold" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}><Bold size={14} /></button>
              <button style={tbtn} title="Italic" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}><Italic size={14} /></button>
              <button style={tbtn} title="Underline" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}><Underline size={14} /></button>
              <button style={tbtn} title="Bullet list" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}><List size={14} /></button>
              <button style={tbtn} title="Numbered list" onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}><ListOrdered size={14} /></button>
              <button style={tbtn} title="Insert link" onMouseDown={(e) => { e.preventDefault(); const url = window.prompt("Link URL"); if (url) exec("createLink", url); }}><Link2 size={14} /></button>
              <label style={tbtn} title="Insert image / logo">
                <ImageIcon size={14} />
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const file = e.target.files?.[0]; e.currentTarget.value = "";
                  if (!file) return;
                  try { await insertImageFile(editorRef.current, file, 480, false); } catch (err) { showError("Image error", err instanceof Error ? err.message : String(err)); }
                }} />
              </label>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                {cfg?.signature ? (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))", cursor: "pointer", userSelect: "none" }} title="Append your saved email signature">
                    <input type="checkbox" checked={includeSig} onChange={(e) => setIncludeSig(e.target.checked)} style={{ cursor: "pointer" }} /> Signature
                  </label>
                ) : null}
                <label style={{ ...tbtn, width: "auto", padding: "0 10px", gap: 6, fontSize: 12, fontWeight: 600 }} title="Attach files">
                  <Paperclip size={14} /> Attach
                  <input type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
                </label>
              </div>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              style={{ minHeight: 200, maxHeight: 340, overflowY: "auto", padding: "12px 14px", fontSize: 13.5, lineHeight: 1.5, outline: "none", color: "rgb(var(--fg-default))" }}
            />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {attachments.map((a, i) => (
                <span key={i} style={{ ...chip, background: "#eef7f0", color: "#1c6b3c", paddingRight: 6 }}>
                  <Paperclip size={12} /> {a.filename} <span style={{ opacity: 0.6, fontWeight: 500 }}>({fmtBytes(a.size ?? 0)})</span>
                  <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#1c6b3c", display: "grid", placeItems: "center" }}><X size={12} /></button>
                </span>
              ))}
              <span style={{ alignSelf: "center", fontSize: 11.5, opacity: 0.6 }}>Total {fmtBytes(totalAttachBytes)}</span>
            </div>
          )}
        </div>
      </StandardModal>
      <AlertComponent />
    </>
  );
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── Signature block: appended to the editor as a marked DOM node so it survives
//    body edits, is easy to strip/re-add on toggle, and is captured by innerHTML on send.
const SIG_ATTR = "data-indus-sig";
function removeSigNode(editor: HTMLElement | null) {
  editor?.querySelectorAll(`[${SIG_ATTR}]`).forEach((n) => n.remove());
}
function appendSigNode(editor: HTMLElement | null, sigHtml: string) {
  if (!editor || !sigHtml) return;
  removeSigNode(editor); // idempotent — never stack two signatures
  const wrap = document.createElement("div");
  wrap.setAttribute(SIG_ATTR, "1");
  wrap.style.marginTop = "16px";
  wrap.style.color = "#6b7686";
  wrap.style.fontSize = "13px";
  wrap.innerHTML = `<div style="color:#aeb6c2;margin-bottom:2px">--</div>${sigHtml}`;
  editor.appendChild(wrap);
}
