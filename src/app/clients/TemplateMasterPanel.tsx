"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button, StandardModal, useModalAlert } from "indas-ui";
import { FileSpreadsheet, Download, Send, Trash2, Upload, RefreshCw, Inbox, Layers, CheckCircle2 } from "lucide-react";
import { masterTemplatesApi, type MasterTemplate, type TemplateSentStatus } from "@/lib/masterTemplates";
import { useEmailComposer } from "@/components/email/EmailComposerProvider";
import type { CustomerDetail } from "@/lib/customers";

const T = {
  surface: "rgb(var(--bg-surface))",
  subtle: "rgb(var(--bg-subtle))",
  fg: "rgb(var(--fg-default))",
  muted: "rgb(var(--fg-muted))",
  faint: "rgb(var(--fg-muted) / 0.6)",
  bd: "rgb(var(--bd-default))",
  primary: "rgb(var(--color-primary))",
};
const XLSX_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
};
const keyOf = (t: MasterTemplate) => `${t.group}/${t.name}`;

const iconBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 30,
  borderRadius: 8, border: `1px solid ${T.bd}`, background: T.surface, color: "#334", cursor: "pointer", textDecoration: "none",
};

/** Checkbox that supports the indeterminate (partial) state. */
function TriCheck({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked; }, [indeterminate, checked]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      style={{ width: 16, height: 16, cursor: "pointer", accentColor: "rgb(var(--color-primary))", flexShrink: 0 }} />
  );
}

/**
 * "Template Master Excel" tab — a GLOBAL, group-organised library of master-data Excel
 * templates (same set shows for every client). Multi-select templates and email them to the
 * client to fill in for master upload; or download / upload / soft-delete.
 */
export default function TemplateMasterPanel({ client, canEdit = true }: { client: CustomerDetail; canEdit?: boolean }) {
  const { showSuccess, showError, showWarning, hideAlert, AlertComponent } = useModalAlert();
  const { openComposer } = useEmailComposer();
  const { data: session } = useSession();
  const sentBy = (session?.user as { UserID?: number } | undefined)?.UserID;
  const clientCode = client.companyUniqueCode ?? "";
  const [rows, setRows] = useState<MasterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Per-client "Sent to Client" status, keyed by `${group}/${name}`.
  const [sentStatus, setSentStatus] = useState<Map<string, TemplateSentStatus>>(new Map());
  const loadStatus = useCallback(() => {
    if (!clientCode) return;
    masterTemplatesApi.listStatus(clientCode).then((r) => {
      const m = new Map<string, TemplateSentStatus>();
      (r?.data || []).forEach((s) => m.set(`${s.group}/${s.name}`, s));
      setSentStatus(m);
    }).catch(() => {});
  }, [clientCode]);
  useEffect(loadStatus, [loadStatus]);

  // upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadGroup, setUploadGroup] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    masterTemplatesApi.list()
      .then((r) => setRows(r?.success ? (r.data || []) : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // group the rows for display
  const groups = useMemo(() => {
    const m = new Map<string, MasterTemplate[]>();
    for (const t of rows) { const g = t.group || "Ungrouped"; if (!m.has(g)) m.set(g, []); m.get(g)!.push(t); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);
  const groupNames = useMemo(() => [...new Set(rows.map((r) => r.group).filter(Boolean))].sort(), [rows]);

  const selectedRows = useMemo(() => rows.filter((t) => selected.has(keyOf(t))), [rows, selected]);

  const toggle = (t: MasterTemplate) => setSelected((prev) => {
    const n = new Set(prev); const k = keyOf(t); n.has(k) ? n.delete(k) : n.add(k); return n;
  });
  const toggleMany = (items: MasterTemplate[]) => setSelected((prev) => {
    const n = new Set(prev);
    const allSel = items.every((t) => n.has(keyOf(t)));
    items.forEach((t) => (allSel ? n.delete(keyOf(t)) : n.add(keyOf(t))));
    return n;
  });

  const emailSelected = async () => {
    if (!selectedRows.length) return;
    // Always open the composer with the templates attached. Prefill "To" with the client's
    // email if we have it; otherwise leave it blank for the user to fill in.
    setSending(true);
    try {
      const attachments = [];
      for (const t of selectedRows) {
        const content = await masterTemplatesApi.fetchBase64(t.group, t.name);
        attachments.push({ filename: t.name, content, contentType: XLSX_CT, size: t.size });
      }
      const listHtml = selectedRows.map((t) => `&bull; ${t.group ? t.group + " / " : ""}${t.name}`).join("<br/>");
      // Capture which templates go out BEFORE clearing the selection — recorded as "Sent to Client"
      // only once the email is actually sent (composer onSent).
      const items = selectedRows.map((t) => ({ group: t.group, name: t.name }));
      openComposer({
        to: client.email ? [{ email: client.email, name: client.companyName ?? undefined }] : [],
        subject: `Master Data Templates — ${client.companyName || "your project"}`,
        body: `Dear ${client.companyName || "Sir/Madam"},<br/><br/>Please find attached the master-data template(s):<br/>${listHtml}<br/><br/>Kindly fill in your data in these Excel sheets and send them back to us for master upload.<br/><br/>Regards,<br/>Indus Analytics`,
        context: { clientCode: client.companyUniqueCode ?? undefined, clientName: client.companyName ?? undefined, module: "Master Template" },
        attachments,
        onSent: async () => { if (clientCode) { await masterTemplatesApi.markSent(clientCode, sentBy, items); loadStatus(); } },
      });
      setSelected(new Set());
    } catch (e) { showError("Failed to attach templates", String(e)); }
    finally { setSending(false); }
  };

  const remove = (t: MasterTemplate) => {
    showWarning("Remove template", `Remove "${t.name}"${t.group ? ` from ${t.group}` : ""}? It is moved to a recoverable folder, not permanently deleted.`, [
      { label: "Cancel", variant: "secondary", onClick: () => hideAlert() },
      {
        label: "Remove", variant: "primary", onClick: async () => {
          hideAlert(); setBusy(keyOf(t));
          try {
            const r = await masterTemplatesApi.remove(t.group, t.name);
            if (r.success) { showSuccess("Removed", "Template removed from the library.", 1800); load(); }
            else showError("Failed", r.message);
          } catch (e) { showError("Failed", String(e)); }
          finally { setBusy(null); }
        },
      },
    ]);
  };

  const doUpload = async () => {
    if (!uploadFiles.length) { showWarning("No file", "Choose at least one Excel file to upload."); return; }
    setUploading(true);
    let ok = 0;
    try {
      for (const f of uploadFiles) {
        const res = await masterTemplatesApi.upload(f, uploadGroup.trim());
        if (res.success) ok++; else showError("Upload failed", `${f.name}: ${res.message || "error"}`);
      }
      if (ok) showSuccess("Uploaded", `${ok} template${ok > 1 ? "s" : ""} added${uploadGroup.trim() ? ` to ${uploadGroup.trim()}` : ""}.`, 2200);
      setUploadOpen(false); setUploadFiles([]); setUploadGroup("");
      load();
    } catch (e) { showError("Upload failed", String(e)); }
    finally { setUploading(false); }
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.fg }}>Template Master Excel</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>
            Shared master-data templates (same for every client). Tick the ones you need and email them to the client to fill in for master upload.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="action-create" size="sm" icon={Send} loading={sending} disabled={!selected.size || sending} onClick={emailSelected}>
            Email Selected{selected.size ? ` (${selected.size})` : ""}
          </Button>
          {canEdit && <Button variant="outline" size="sm" icon={Upload} onClick={() => setUploadOpen(true)}>Upload Template</Button>}
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
        </div>
      </div>

      {/* Groups */}
      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: T.muted, fontSize: 13 }}>Loading templates…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center", color: T.faint, border: `1px solid ${T.bd}`, borderRadius: 12, background: T.surface }}>
          <Inbox size={34} style={{ opacity: 0.5 }} />
          <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600, color: T.muted }}>No templates yet</div>
          <div style={{ fontSize: 12.5, marginTop: 3 }}>Click <b>Upload Template</b> to add master Excel files (.xlsx / .xls / .csv).</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map(([g, items]) => {
            const allSel = items.every((t) => selected.has(keyOf(t)));
            const someSel = items.some((t) => selected.has(keyOf(t)));
            return (
              <div key={g} style={{ border: `1px solid ${T.bd}`, borderRadius: 12, background: T.surface, overflow: "hidden" }}>
                {/* Group header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: T.subtle, borderBottom: `1px solid ${T.bd}` }}>
                  <TriCheck checked={allSel} indeterminate={someSel} onChange={() => toggleMany(items)} />
                  <Layers size={15} style={{ color: T.primary }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.fg, letterSpacing: 0.3, textTransform: "uppercase" }}>{g}</span>
                  <span style={{ fontSize: 11.5, color: T.faint, fontWeight: 600 }}>{items.length}</span>
                </div>
                {/* Rows */}
                {items.map((t, i) => (
                  <div key={keyOf(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: i ? `1px solid ${T.bd}` : "none", background: selected.has(keyOf(t)) ? "rgb(var(--color-primary) / 0.045)" : "transparent" }}>
                    <TriCheck checked={selected.has(keyOf(t))} onChange={() => toggle(t)} />
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgb(16 122 60 / 0.10)", color: "#0a7d3c", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <FileSpreadsheet size={17} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.fg, wordBreak: "break-word" }}>{t.name}</div>
                      <div style={{ fontSize: 11.5, color: T.faint, marginTop: 1 }}>{fmtBytes(t.size)} · {fmtDate(t.modifiedAt)}</div>
                      {(() => {
                        const st = sentStatus.get(keyOf(t));
                        return st ? (
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#0a7d3c", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3 }}
                            title={st.sentBy ? `Sent by ${st.sentBy}` : undefined}>
                            <CheckCircle2 size={12} /> Sent to Client · {fmtDate(st.sentAt)}
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <a href={masterTemplatesApi.downloadUrl(t.group, t.name)} download style={iconBtn} title="Download"><Download size={15} /></a>
                      {canEdit && <button style={{ ...iconBtn, color: "#b03030", borderColor: "#eec4c4" }} disabled={busy === keyOf(t)} title="Remove" onClick={() => remove(t)}><Trash2 size={15} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload modal */}
      <StandardModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Template" size="md"
        showFooter onSave={doUpload} onCancel={() => setUploadOpen(false)} saveLabel="Upload" saving={uploading}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", display: "block", marginBottom: 5 }}>Group</label>
            <input list="tmpl-groups" value={uploadGroup} onChange={(e) => setUploadGroup(e.target.value)}
              placeholder="e.g. Item Master (pick existing or type a new group)"
              style={{ width: "100%", height: 38, padding: "0 11px", fontSize: 13.5, border: `1px solid ${T.bd}`, borderRadius: 8, background: T.surface, color: T.fg, outline: "none", boxSizing: "border-box" }} />
            <datalist id="tmpl-groups">{groupNames.map((g) => <option key={g} value={g} />)}</datalist>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", display: "block", marginBottom: 5 }}>Excel File(s)</label>
            <input type="file" accept=".xlsx,.xls,.csv" multiple onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
              style={{ fontSize: 13, color: T.fg }} />
            {uploadFiles.length > 0 && <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{uploadFiles.length} file(s) selected</div>}
          </div>
        </div>
      </StandardModal>

      <AlertComponent />
    </div>
  );
}
