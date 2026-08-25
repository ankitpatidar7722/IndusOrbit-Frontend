"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Dropdown, StandardModal } from "indas-ui";
import { Plus, Pencil, Trash2, FileText, Save, Paperclip, X } from "lucide-react";
import { templatesApi, deriveVariables, SYSTEM_EMAIL_TEMPLATES, type TemplateAttachmentSave } from "@/lib/emailTemplates";
import { fileToBase64, type EmailTemplate } from "@/lib/email";

function fmtBytes(n?: number | null) {
  const b = n ?? 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const T = {
  surface: "rgb(var(--bg-surface))",
  subtle: "rgb(var(--bg-subtle))",
  hover: "rgb(var(--bg-hover))",
  fg: "rgb(var(--fg-default))",
  muted: "rgb(var(--fg-muted))",
  faint: "rgb(var(--fg-muted) / 0.6)",
  bd: "rgb(var(--bd-default))",
  primary: "rgb(var(--color-primary))",
};
const CATEGORIES = ["General", "Onboarding", "Billing", "Support", "Business", "Marketing", "Reminder"];

const fldLabel: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 5 };
const fldInput: React.CSSProperties = { width: "100%", height: 40, padding: "0 12px", fontSize: 13.5, border: `1px solid ${T.bd}`, borderRadius: 9, background: T.surface, color: T.fg, outline: "none", boxSizing: "border-box" };
const fldArea: React.CSSProperties = { ...fldInput, height: "auto", padding: "10px 12px", minHeight: 200, resize: "vertical", fontFamily: "inherit", lineHeight: 1.55 };

export default function TemplatesManager() {
  const [list, setList] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", category: "General", subject: "", body: "" });
  const [atts, setAtts] = useState<TemplateAttachmentSave[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => { setLoading(true); templatesApi.list().then(setList).catch(() => setList([])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setF({ name: "", category: "General", subject: "", body: "" }); setAtts([]); setErr(null); setOpen(true); };
  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setF({ name: t.name, category: t.category || "General", subject: t.subject, body: t.body });
    // Existing attachments come back as metadata (id, no content) — keep them as-is; new uploads add content.
    setAtts((t.attachments ?? []).map((a) => ({ id: a.id, filename: a.filename, contentType: a.contentType, size: a.size })));
    setErr(null); setOpen(true);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const added = await Promise.all(Array.from(files).map(fileToBase64));
    setAtts((prev) => [...prev, ...added.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType, size: a.size }))]);
    if (fileRef.current) fileRef.current.value = "";
  };
  const removeAtt = (i: number) => setAtts((prev) => prev.filter((_, j) => j !== i));

  const save = async () => {
    if (!f.name.trim()) { setErr("Template name is required."); return; }
    if (!f.subject.trim() && !f.body.trim()) { setErr("Add a subject and/or body."); return; }
    setSaving(true); setErr(null);
    try {
      const body = { name: f.name.trim(), subject: f.subject, body: f.body, category: f.category, attachments: atts };
      const r = editing ? await templatesApi.update(editing.id, body) : await templatesApi.create(body);
      if (r?.success === false) { setErr(r.error || "Save failed."); return; }
      setOpen(false); load();
    } catch (e) { setErr(String(e)); } finally { setSaving(false); }
  };

  const del = async (t: EmailTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"? This cannot be undone.`)) return;
    await templatesApi.remove(t.id);
    load();
  };

  const loadDefaults = async () => {
    setSeeding(true);
    try { for (const t of SYSTEM_EMAIL_TEMPLATES) await templatesApi.create({ name: t.name, subject: t.subject, body: t.body, category: t.category }); }
    finally { setSeeding(false); load(); }
  };

  const detected = deriveVariables(f.subject, f.body);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* header */}
      <div style={{ height: 56, flexShrink: 0, borderBottom: `1px solid ${T.bd}`, display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: T.fg, margin: 0 }}>Templates</h1>
        <span style={{ fontSize: 12, color: T.muted }}>{list.length} template{list.length !== 1 ? "s" : ""}</span>
        <div style={{ flex: 1 }} />
        <Button variant="action-create" size="sm" icon={Plus} onClick={openCreate}>Create</Button>
      </div>

      {/* list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 50, textAlign: "center", color: T.muted }}>Loading templates…</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 50, textAlign: "center" }}>
            <FileText size={40} style={{ color: T.faint, marginBottom: 12 }} />
            <div style={{ fontWeight: 600, color: T.fg, marginBottom: 4 }}>No templates yet</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>Create your own, or load the 6 built-in defaults to start.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Button variant="primary" size="sm" icon={Plus} onClick={openCreate}>Create template</Button>
              <Button variant="outline" size="sm" onClick={loadDefaults} disabled={seeding}>{seeding ? "Loading…" : "Load default templates"}</Button>
            </div>
          </div>
        ) : (
          list.map((t) => (
            <div key={t.id} onClick={() => openEdit(t)}
              style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 16px", borderBottom: `1px solid ${T.bd}`, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "color-mix(in srgb, rgb(var(--color-primary)) 12%, transparent)", color: T.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <FileText size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.subject || "(no subject)"}</div>
                <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>{t.category}</div>
              </div>
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(t)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: T.muted }}><Pencil size={15} /></button>
                <button onClick={() => del(t)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "rgb(var(--color-error))" }}><Trash2 size={15} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* editor modal */}
      <StandardModal isOpen={open} onClose={() => setOpen(false)} title={editing ? `Edit Template — ${editing.name}` : "New Template"} size="lg" showFooter={false}>
        {err && <div style={{ color: "rgb(var(--color-error))", fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px 16px" }}>
          <div>
            <label style={fldLabel}>Template Name *</label>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={fldInput} placeholder="e.g. Payment Reminder" />
          </div>
          <div>
            <label style={fldLabel}>Category</label>
            <Dropdown value={f.category} onValueChange={(v) => setF({ ...f, category: String(v) })} options={CATEGORIES.map((c) => ({ value: c, label: c }))} size="md" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={fldLabel}>Subject</label>
            <input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} style={fldInput} placeholder="e.g. Payment Reminder — {{clientName}}" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={fldLabel}>Body</label>
            <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} style={fldArea} placeholder={"Dear {{clientName}},\n\n…\n\nRegards,\n{{senderName}}"} />
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>
              Use <code>{"{{variableName}}"}</code> placeholders — the sender fills them when composing. Common: <code>{"{{clientName}}"}</code>, <code>{"{{clientCode}}"}</code>, <code>{"{{senderName}}"}</code>.
              {detected.length > 0 && (
                <span> Detected: {detected.map((v) => <span key={v.name} style={{ display: "inline-block", background: T.subtle, border: `1px solid ${T.bd}`, borderRadius: 6, padding: "1px 6px", margin: "0 3px", fontFamily: "monospace", fontSize: 11 }}>{v.name}</span>)}</span>
              )}
            </div>
          </div>
          {/* Attachments — files saved with the template auto-attach when it's applied in the composer. */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={fldLabel}>Attachments</label>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 13px", fontSize: 12.5, fontWeight: 600, color: T.primary, background: "color-mix(in srgb, rgb(var(--color-primary)) 8%, transparent)", border: `1px solid ${T.bd}`, borderRadius: 9, cursor: "pointer" }}>
                <Paperclip size={14} /> Attach files
              </button>
              {atts.map((a, i) => (
                <span key={a.id ?? `new-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 6px 0 11px", fontSize: 12, fontWeight: 600, color: "rgb(var(--color-success))", background: "rgb(var(--color-success-subtle))", borderRadius: 999 }}>
                  <Paperclip size={12} /> {a.filename} <span style={{ opacity: 0.65, fontWeight: 500 }}>({fmtBytes(a.size)})</span>
                  <button type="button" onClick={() => removeAtt(i)} title="Remove" style={{ border: "none", background: "transparent", cursor: "pointer", color: "rgb(var(--color-success))", display: "grid", placeItems: "center" }}><X size={12} /></button>
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>These files are attached automatically whenever this template is used in an email.</div>
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6, paddingTop: 12, borderTop: `1px solid ${T.bd}` }}>
            <Button variant="action-cancel" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="action-save" size="sm" icon={Save} loading={saving} onClick={save}>{editing ? "Save Changes" : "Create Template"}</Button>
          </div>
        </div>
      </StandardModal>
    </div>
  );
}
