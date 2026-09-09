"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Tabs, Badge, Button, Card, CardHeader, CardTitle, CardContent, StandardModal, Dropdown, useModalAlert, TooltipProvider } from "indas-ui";
// Same full-featured grid as /users (owned source — colored header tint, white filter row, etc.)
import { DataGrid, createActionsColumn } from "@/components/datagrid";
import DateField from "@/components/DateField";
import type { ColumnDef } from "@tanstack/react-table";
import { PartyPopper, ClipboardCheck, Plus, Mail, ListTodo, Check, Download, Upload, Target, Eye, PlayCircle, Sparkles } from "lucide-react";
import { trackerAiApi } from "@/lib/trackerAi";
import { useSession } from "next-auth/react";
import { api, type Milestone, type TrainingUpdate, type ChangeRequest, type SupportLog, type OnsiteVisit, type KeylineModule } from "@/lib/api";
import { usersApi } from "@/lib/users";
import { fetchUserPermissions } from "@/lib/featurePermissions";
import { statusVariant } from "@/lib/ui";
import { useEmailComposer } from "@/components/email/EmailComposerProvider";

type Tracker = {
  milestones: Milestone[]; training: TrainingUpdate[]; changeRequests: ChangeRequest[];
  support: SupportLog[]; onsite: OnsiteVisit[];
};

/* ------------------------------------------------------------------ form model */
type FieldType = "text" | "url" | "date" | "time" | "textarea" | "select" | "module" | "submodule" | "user" | "aiSummary";
// dependsOn: for "submodule" — the key of the "module" field it cascades from.
// compute: derives this field's value from the other form values (read-only, auto-filled) — e.g. Days = To − From.
// span: grid-column width on a 12-col layout — lets a form pack rows of 3 (span 4) or 4 (span 3) fields; omit for the default 3-up grid.
// autoGrow: textarea that grows its height to fit the text inside it (no scrollbar, no manual drag handle).
type FieldDef = { key: string; label: string; type?: FieldType; options?: string[]; full?: boolean; span?: number; autoGrow?: boolean; dependsOn?: string; compute?: (v: Record<string, unknown>) => string; locked?: boolean };

/** Inclusive day-count between two yyyy-mm-dd dates (same day = 1); blank if either is missing/invalid. */
function daysBetween(from?: unknown, to?: unknown): string {
  const a = String(from ?? "").slice(0, 10), b = String(to ?? "").slice(0, 10);
  if (!a || !b) return "";
  const d1 = new Date(a).getTime(), d2 = new Date(b).getTime();
  if (isNaN(d1) || isNaN(d2)) return "";
  const n = Math.round((d2 - d1) / 86400000) + 1;
  return n > 0 ? String(n) : "";
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8,
  fontSize: 13, background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", fontWeight: 600, marginBottom: 5, display: "block",
};

/** Textarea that auto-sizes its height to fit its content — grows as you type, no scrollbar, no drag handle. */
function AutoGrowTextarea({ value, onChange, minHeight = 44 }: { value: string; onChange: (v: string) => void; minHeight?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";                               // reset so shrinking works too
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [value, minHeight]);
  return (
    <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, minHeight, resize: "none", overflow: "hidden", lineHeight: 1.5 }} />
  );
}

/* fast 3-dropdown time picker (Hour / Minute / AM-PM) — replaces the slow native scroll wheel */
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")); // 00,05,…,55
function parseTime(v: string) {
  if (!v || !v.includes(":")) return { h: "", m: "", ap: "" };
  const [H, M] = v.split(":");
  let hh = parseInt(H, 10);
  if (isNaN(hh)) return { h: "", m: "", ap: "" };
  const ap = hh >= 12 ? "PM" : "AM";
  let h12 = hh % 12; if (h12 === 0) h12 = 12;
  return { h: String(h12).padStart(2, "0"), m: (M ?? "00").padStart(2, "0"), ap };
}
function composeTime(h: string, m: string, ap: string) {
  if (!h || !m || !ap) return "";
  let H = parseInt(h, 10) % 12;
  if (ap === "PM") H += 12;
  return `${String(H).padStart(2, "0")}:${m}`;
}
function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { h, m, ap } = parseTime(value);
  const set = (nh: string, nm: string, nap: string) => onChange(composeTime(nh, nm, nap || "AM"));
  const sel: React.CSSProperties = { ...inputStyle, padding: "7px 6px", flex: 1 };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select style={sel} value={h} onChange={(e) => set(e.target.value, m || "00", ap)}>
        <option value="">HH</option>
        {HOURS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <select style={sel} value={m} onChange={(e) => set(h, e.target.value, ap)}>
        <option value="">MM</option>
        {MINUTES.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <select style={sel} value={ap} onChange={(e) => set(h || "12", m || "00", e.target.value)}>
        <option value="">--</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

// Keyline (Module Name / Sub Module Name) catalog — fetched once, cached for every form.
let _keylineCache: KeylineModule[] | null = null;
async function loadKeylineModules(): Promise<KeylineModule[]> {
  if (_keylineCache) return _keylineCache;
  try { const r = await api.keylineModules(); _keylineCache = r.success ? r.data : []; }
  catch { _keylineCache = []; }
  return _keylineCache;
}

// Active-user names (for "user"-type fields like Reported By) — fetched once, cached.
let _usersCache: string[] | null = null;
async function loadUserNames(): Promise<string[]> {
  if (_usersCache) return _usersCache;
  try {
    const r = await usersApi.list();
    _usersCache = r.success ? r.data.filter((u) => u.isActive && u.fullName?.trim()).map((u) => u.fullName) : [];
  } catch { _usersCache = []; }
  return _usersCache;
}

/** Textarea + "Summarize with AI" button. Sends the row's filled fields to Gemini (backend) and
 *  drops the returned summary into the field. The text stays fully editable. */
function AiSummaryField({ value, onChange, entity, fields, values, disabled }: {
  value: string; onChange: (v: string) => void; entity: string; fields: FieldDef[]; values: Record<string, unknown>; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const generate = async () => {
    setBusy(true); setErr(null);
    const payload: Record<string, string> = {};
    for (const fd of fields) {
      if (fd.type === "aiSummary") continue;                     // don't feed the summary back in
      const v = String(values[fd.key] ?? "").trim();
      if (v) payload[fd.label] = v;
    }
    if (Object.keys(payload).length === 0) { setErr("Fill in some details first, then Summarize."); setBusy(false); return; }
    const res = await trackerAiApi.summarize(entity, payload);
    if (res.success && res.summary) onChange(res.summary.replace(/\*\*/g, "").trim());
    else setErr(res.message || "Could not generate the summary.");
    setBusy(false);
  };
  return (
    <div>
      <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder="Click “Summarize with AI” to auto-generate — or write your own." />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={generate} disabled={busy || disabled}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid rgb(var(--color-primary))",
            background: busy ? "rgba(148,163,184,.15)" : "rgb(var(--color-primary))", color: busy ? "rgb(var(--fg-muted))" : "#fff",
            borderRadius: 8, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: busy || disabled ? "default" : "pointer" }}>
          <Sparkles size={14} /> {busy ? "Summarizing…" : "Summarize with AI"}
        </button>
        {value && !busy && (
          <span style={{ fontSize: 11.5, color: "rgb(var(--fg-muted))" }}>Auto-generated · editable</span>
        )}
        {err && <span style={{ fontSize: 12, color: "#c0392b" }}>{err}</span>}
      </div>
    </div>
  );
}

function EntityFormModal({
  open, title, fields, initial, saving, onClose, onSave, readOnly = false,
}: {
  open: boolean; title: string; fields: FieldDef[]; initial: Record<string, unknown>;
  saving: boolean; onClose: () => void; onSave: (values: Record<string, unknown>) => void; readOnly?: boolean;
}) {
  const { data: session } = useSession();
  const currentUserName = ((session?.user as { name?: string } | undefined)?.name) || "";

  const [f, setF] = useState<Record<string, unknown>>(initial);
  // Last auto-filled value per compute-field — lets us auto-fill on input change WITHOUT clobbering a manual edit.
  const computedRef = useRef<Record<string, string>>({});
  // On open: seed from `initial`, and default any empty "user" field to the logged-in user's name (still editable).
  useEffect(() => {
    if (!open) return;
    const base: Record<string, unknown> = { ...initial };
    for (const fd of fields) if (fd.type === "user" && !base[fd.key] && currentUserName) base[fd.key] = currentUserName;
    // Seed the compute-tracker from the initial data so a stored/manual value isn't overwritten until an input changes.
    computedRef.current = {};
    for (const fd of fields) if (fd.compute) computedRef.current[fd.key] = fd.compute(base);
    setF(base);
  }, [open, initial, currentUserName, fields]);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  // Load the keyline Module/Sub-Module catalog when this form uses those field types.
  const needsKeyline = useMemo(() => fields.some((fd) => fd.type === "module" || fd.type === "submodule"), [fields]);
  const [keyline, setKeyline] = useState<KeylineModule[]>(_keylineCache ?? []);
  useEffect(() => { if (open && needsKeyline) loadKeylineModules().then(setKeyline); }, [open, needsKeyline]);

  // Load the active-user list when this form uses a "user" field (e.g. Reported By).
  const needsUsers = useMemo(() => fields.some((fd) => fd.type === "user"), [fields]);
  const [userNames, setUserNames] = useState<string[]>(_usersCache ?? []);
  useEffect(() => { if (open && needsUsers) loadUserNames().then(setUserNames); }, [open, needsUsers]);

  // Auto-fill derived (compute) fields when their INPUTS change — but keep them editable:
  // only overwrite when the freshly computed value differs from the last one we filled, so a
  // manual edit survives (editing the field itself doesn't change the computed inputs).
  useEffect(() => {
    setF((prev) => {
      let next = prev; let changed = false;
      for (const fd of fields) {
        if (!fd.compute) continue;
        const v = fd.compute(prev);
        // Inputs unchanged → keep a MANUAL value, but still auto-fill an EMPTY computed field
        // (e.g. Timeline Var Status when the row already has an Actual Start but no status yet).
        if (v === computedRef.current[fd.key] && String(prev[fd.key] ?? "").trim() !== "") continue;
        computedRef.current[fd.key] = v;
        if (v !== "" && String(prev[fd.key] ?? "") !== v) { if (!changed) { next = { ...prev }; changed = true; } next[fd.key] = v; }
      }
      return changed ? next : prev;
    });
  }, [f, fields]);

  const heads = useMemo(() => Array.from(new Set(keyline.map((k) => k.head))), [keyline]);
  const subsFor = (head?: string) => (head ? Array.from(new Set(keyline.filter((k) => k.head === head).map((k) => k.name))) : []);
  // Set a Module Name + clear any Sub Module field that cascades from it.
  const setModule = (moduleKey: string, v: string) => setF((p) => {
    const next = { ...p, [moduleKey]: v };
    for (const fd of fields) if (fd.type === "submodule" && fd.dependsOn === moduleKey) next[fd.key] = "";
    return next;
  });

  // When any field declares an explicit `span`, lay the form on a 12-column grid (12 = lcm of 3 and 4,
  // so rows of 4 fields (span 3) or 3 fields (span 4) both fill a row exactly). Otherwise keep the simple 3-up grid.
  const gridCols = useMemo(() => (fields.some((fd) => fd.span) ? 12 : 3), [fields]);

  return (
    <StandardModal isOpen={open} onClose={onClose} title={readOnly ? `${title} · View only` : title} size="lg" showFooter={!readOnly}
      onSave={() => onSave(f)} onCancel={onClose} saveLabel="Save" saving={saving}>
      <div className="form-grid-3" style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: "12px 16px", ...(readOnly ? { pointerEvents: "none", opacity: 0.92 } : {}) }}>
        {fields.map((fd) => {
          const val = (f[fd.key] as string) ?? "";
          // A textarea / summary spans the whole row UNLESS it carries an explicit `span`; an explicit span always wins.
          const isFull = fd.full || ((fd.type === "textarea" || fd.type === "aiSummary") && !fd.span);
          const span = isFull ? { gridColumn: "1 / -1" } : (fd.span ? { gridColumn: `span ${fd.span}` } : undefined);
          // Per-field lock: this field is view-only for users without the authority, while the
          // rest of the form stays editable. (Whole-form readOnly already disables everything.)
          const fieldLocked = !!fd.locked && !readOnly;
          return (
            <div key={fd.key} style={{ ...span, ...(fieldLocked ? { pointerEvents: "none", opacity: 0.55 } : {}) }}>
              <label style={labelStyle}>{fd.label}{fieldLocked && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "rgb(var(--fg-muted))" }}>🔒 view only</span>}</label>
              {fd.compute ? (
                <input type="text" value={val} onChange={(e) => set(fd.key, e.target.value)}
                  title="Auto-calculated from the dates — you can override it" style={inputStyle} />
              ) : fd.type === "aiSummary" ? (
                <AiSummaryField value={val} onChange={(v) => set(fd.key, v)} entity={title} fields={fields} values={f} disabled={readOnly || fieldLocked} />
              ) : fd.type === "textarea" ? (
                fd.autoGrow ? (
                  <AutoGrowTextarea value={val} onChange={(v) => set(fd.key, v)} minHeight={isFull ? 76 : 44} />
                ) : (
                  <textarea style={{ ...inputStyle, minHeight: 62, resize: "vertical" }} value={val} onChange={(e) => set(fd.key, e.target.value)} />
                )
              ) : fd.type === "time" ? (
                <TimeSelect value={val} onChange={(v) => set(fd.key, v)} />
              ) : fd.type === "select" ? (
                <Dropdown value={val} onValueChange={(v) => set(fd.key, String(v))}
                  options={(fd.options ?? []).map((o) => ({ value: o, label: o }))} placeholder="— select —" size="md" />
              ) : fd.type === "module" ? (
                <Dropdown value={val} onValueChange={(v) => setModule(fd.key, String(v))}
                  options={heads.map((h) => ({ value: h, label: h }))} placeholder="— select —" searchable size="md" />
              ) : fd.type === "submodule" ? (
                (() => {
                  const head = (f[fd.dependsOn ?? ""] as string) || "";
                  return (
                    <Dropdown value={val} onValueChange={(v) => set(fd.key, String(v))}
                      options={subsFor(head).map((n) => ({ value: n, label: n }))}
                      placeholder={head ? "— select —" : "Select a module first"} searchable size="md" disabled={!head} />
                  );
                })()
              ) : fd.type === "user" ? (
                <Dropdown value={val} onValueChange={(v) => set(fd.key, String(v))}
                  options={(val && !userNames.includes(val) ? [val, ...userNames] : userNames).map((n) => ({ value: n, label: n }))}
                  placeholder="— select user —" searchable size="md" />
              ) : fd.type === "date" ? (
                <DateField value={val} onChange={(v) => set(fd.key, v)} />
              ) : fd.type === "url" ? (
                <input type="url" inputMode="url" style={inputStyle} value={val} onChange={(e) => set(fd.key, e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…" />
              ) : (
                <input type="text" style={inputStyle} value={val} onChange={(e) => set(fd.key, e.target.value)} />
              )}
            </div>
          );
        })}
      </div>
    </StandardModal>
  );
}

/* ------------------------------------------------------------------ "sent" indicator style (borderless, clean green check) */
const sentIcon: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 28,
  color: "#1c6b3c",
};

/* ------------------------------------------------------------------ Excel import preview */
const toDateInput = (v: string) => (v && v.includes("-") ? String(v).slice(0, 10) : "");
const isValidDate = (v: string) => !v || !isNaN(new Date(v).getTime());

/** One editable cell in the import preview (text / date / select). Red when invalid. */
function CellEditor({ fd, value, error, onChange }: { fd: FieldDef; value: string; error: boolean; onChange: (v: string) => void }) {
  const base: React.CSSProperties = {
    width: fd.type === "textarea" ? 200 : fd.type === "date" ? 140 : 130,
    padding: "5px 7px", fontSize: 12.5, borderRadius: 6, outline: "none", boxSizing: "border-box",
    border: `1px solid ${error ? "#e05252" : "#d6dbe3"}`, background: error ? "#fff5f5" : "#fff", color: "rgb(var(--fg-default))",
  };
  if (fd.type === "select") {
    const opts = fd.options ?? [];
    const unknown = value && !opts.some((o) => o.toLowerCase() === value.toLowerCase());
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} style={base}>
        <option value="">—</option>
        {unknown && <option value={value}>⚠ {value}</option>}
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (fd.type === "date")
    return <input type="date" value={toDateInput(value)} onChange={(e) => onChange(e.target.value)} style={base} />;
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={base} />;
}

/**
 * Preview + edit the parsed Excel before importing. Every cell is editable; invalid cells go
 * red (required-missing, dropdown value not in the allowed list, bad date). Import commits
 * only the valid rows.
 */
function ImportPreviewModal({ open, title, fields, initialRows, onClose, onImport }: {
  open: boolean; title: string; fields: FieldDef[];
  initialRows: Record<string, string>[];
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  useEffect(() => { if (open) setRows(initialRows.map((r) => ({ ...r }))); }, [open, initialRows]);

  const requiredKey = fields[0]?.key ?? "";
  const cellError = (fd: FieldDef, val: string): boolean => {
    const v = (val ?? "").trim();
    if (fd.key === requiredKey && !v) return true;
    if (fd.type === "select" && v && fd.options && !fd.options.some((o) => o.toLowerCase() === v.toLowerCase())) return true;
    if (fd.type === "date" && v && !isValidDate(v)) return true;
    return false;
  };
  const rowHasData = (r: Record<string, string>) => fields.some((fd) => String(r[fd.key] ?? "").trim());
  const rowErrs = (r: Record<string, string>) => fields.reduce((n, fd) => n + (cellError(fd, r[fd.key] ?? "") ? 1 : 0), 0);
  const validRows = rows.filter((r) => rowHasData(r) && rowErrs(r) === 0);
  const errorRows = rows.filter((r) => rowHasData(r) && rowErrs(r) > 0).length;

  const setCell = (ri: number, key: string, val: string) => setRows((prev) => prev.map((r, i) => (i === ri ? { ...r, [key]: val } : r)));
  const removeRow = (ri: number) => setRows((prev) => prev.filter((_, i) => i !== ri));
  const doImport = async () => { setImporting(true); try { await onImport(validRows); } finally { setImporting(false); } };

  const th: React.CSSProperties = { position: "sticky", top: 0, background: "rgb(var(--bg-subtle))", color: "rgb(var(--fg-default))", fontWeight: 700, fontSize: 11.5, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap", borderBottom: "1px solid #d6dbe3", zIndex: 1 };
  const td: React.CSSProperties = { padding: "5px 8px", borderBottom: "1px solid #eef1f6", verticalAlign: "top" };

  return (
    <StandardModal isOpen={open} onClose={onClose} title={`Import Preview — ${title}`}
      subtitle="Review & edit the rows below. Fix any red cells, then Import." size="full" showFooter={false}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))" }}>
          <b style={{ color: "rgb(var(--fg-default))" }}>{rows.length}</b> row{rows.length !== 1 ? "s" : ""} ·{" "}
          <span style={{ color: "#0a7d3c", fontWeight: 700 }}>{validRows.length} ready</span>
          {errorRows > 0 && <> · <span style={{ color: "#c0392b", fontWeight: 700 }}>{errorRows} with errors</span></>}
        </div>

        <div style={{ overflow: "auto", maxHeight: "56vh", border: "1px solid #d6dbe3", borderRadius: 10 }}>
          <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "center" }}>#</th>
                {fields.map((fd) => <th key={fd.key} style={th}>{fd.label}{fd.key === requiredKey ? " *" : ""}</th>)}
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} style={{ background: rowErrs(r) > 0 && rowHasData(r) ? "#fffafa" : "#fff" }}>
                  <td style={{ ...td, textAlign: "center", color: "rgb(var(--fg-subtle))", fontSize: 12 }}>{ri + 1}</td>
                  {fields.map((fd) => (
                    <td key={fd.key} style={td}>
                      <CellEditor fd={fd} value={r[fd.key] ?? ""} error={cellError(fd, r[fd.key] ?? "")} onChange={(v) => setCell(ri, fd.key, v)} />
                    </td>
                  ))}
                  <td style={{ ...td, textAlign: "center" }}>
                    <button onClick={() => removeRow(ri)} title="Remove row"
                      style={{ width: 26, height: 26, border: "1px solid #eec4c4", background: "rgb(var(--bg-surface))", color: "#b03030", borderRadius: 6, cursor: "pointer" }}>×</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={fields.length + 2} style={{ ...td, textAlign: "center", color: "rgb(var(--fg-subtle))", padding: 24 }}>No rows</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center", borderTop: "1px solid #eef1f6", paddingTop: 12 }}>
          {errorRows > 0 && <span style={{ fontSize: 12, color: "#c0392b", marginRight: "auto" }}>Fix the {errorRows} highlighted row(s) — only valid rows import.</span>}
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="action-create" size="sm" icon={Upload} loading={importing} disabled={!validRows.length} onClick={doImport}>
            Import {validRows.length} Row{validRows.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </StandardModal>
  );
}

/* ------------------------------------------------------------------ generic CRUD grid */
type Api<T> = {
  add: (code: string, b: unknown) => Promise<T>;
  update: (code: string, id: number, b: unknown) => Promise<T>;
  del: (code: string, id: number) => Promise<void>;
};

function EntityGrid<T extends { id: number; emailed?: boolean; tasked?: boolean; pointed?: boolean }>(props: {
  code: string; title: string; rows: T[]; columns: ColumnDef<T>[]; fields: FieldDef[];
  blank: Record<string, unknown>; apiFns: Api<T>; send: ("mail" | "task" | "point")[]; reload: () => void; onFlash: (m: string) => void;
  clientEmail?: string | null; clientName?: string | null; clientCode?: string | null; canEdit?: boolean;
  // Explicit singular label for the modal title + toasts. Defaults to `title` minus a trailing "s",
  // which is wrong when the title legitimately ends in "s" (e.g. "…Status") — pass it there.
  singular?: string;
  // "Send To → Point": creates a Point Management point from the row (Change Requests only).
  sendToPoint?: (code: string, rowId: number) => Promise<{ success: boolean; pointId?: number; product?: string; message?: string }>;
  // "Send To → Task": append the row to the acting user's TODAY worklog Draft in IndusInternalApp.
  sendToTask?: (code: string, rowId: number) => Promise<{ success: boolean; message?: string }>;
  // Optional summary block rendered between the header and the grid (e.g. the Milestone progress meter).
  summary?: ReactNode;
}) {
  const { code, title, rows, columns, fields, blank, apiFns, send, reload, onFlash, clientEmail, clientName, clientCode, canEdit = true, sendToPoint, sendToTask, summary } = props;
  const { openComposer } = useEmailComposer();
  const [modal, setModal] = useState<{ open: boolean; row: T | null }>({ open: false, row: null });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ open: boolean; rows: Record<string, string>[] }>({ open: false, rows: [] });
  const { showSuccess, showError, showConfirmation, AlertComponent } = useModalAlert();
  const singular = props.singular ?? title.replace(/s$/, "");
  const noun = singular.toLowerCase();

  const openCreate = () => setModal({ open: true, row: null });
  const openEdit = (row: T) => setModal({ open: true, row });
  const close = () => setModal({ open: false, row: null });

  const save = async (values: Record<string, unknown>) => {
    setSaving(true);
    const editing = !!modal.row;
    try {
      if (modal.row) await apiFns.update(code, modal.row.id, { ...modal.row, ...values });
      else await apiFns.add(code, values);
      close(); reload();
      showSuccess("Success", `${singular} ${editing ? "updated" : "created"} successfully.`, 2200);
    } catch (e) { showError("Save Failed", String(e)); } finally { setSaving(false); }
  };
  const doDelete = (row: T) => {
    // A Change Request that's already been pushed to Point Management (Bug Tool) is linked to a LIVE
    // point/ticket. Block deletion here so the linked ticket isn't orphaned — the user must remove
    // the point from the Point Management tool first, then delete it from the Tracker.
    const r = row as T & { pointed?: boolean; pointID?: number | null };
    if (r.pointed || r.pointID) {
      showError(
        "Remove from Point Management first",
        `This ${noun} has already been sent to Point Management (Bug Tool)${r.pointID ? ` as Ticket #${r.pointID}` : ""}. To delete it here, please first delete the linked point from the Point Management tool — then you can delete this ${noun}.`,
      );
      return;
    }
    showConfirmation(
      `Delete ${singular}`,
      `Are you sure you want to delete this ${noun}? This action cannot be undone.`,
      async () => {
        setBusyId(row.id);
        try { await apiFns.del(code, row.id); reload(); showSuccess("Deleted", `${singular} deleted successfully.`, 2200); }
        catch (e) { showError("Delete Failed", String(e)); } finally { setBusyId(null); }
      },
    );
  };
  const flag = async (row: T, kind: "emailed" | "tasked" | "pointed") => {
    setBusyId(row.id);
    try {
      await apiFns.update(code, row.id, { ...row, [kind]: true }); reload();
      onFlash(kind === "emailed" ? "Sent to mail" : kind === "tasked" ? "Sent to task" : "Sent to point");
    } catch (e) { alert(String(e)); } finally { setBusyId(null); }
  };

  // "Send To → Point": confirm first, then create a Point Management (Bug Tool) point + mark pointed.
  const sendPoint = (row: T) => {
    if (!sendToPoint) return flag(row, "pointed");
    showConfirmation(
      "Send to Point Management",
      "Are you sure you want to send this to Point Management (Bug Tool)? A new point/ticket will be created.",
      async () => {
        setBusyId(row.id);
        try {
          const r = await sendToPoint(code, row.id);
          if (r.success && r.pointId) {
            showSuccess("Sent to Point Management", `Point created — Ticket #${r.pointId}${r.product ? ` · ${r.product}` : ""}.`, 3500);
            reload();
          } else {
            showError("Could not create point", r.message || "Unknown error.");
          }
        } catch (e) { showError("Could not create point", String(e)); } finally { setBusyId(null); }
      }
    );
  };

  // "Send To → Task": confirm first, then append this row to the logged-in user's today Draft
  // worklog (IndusInternalApp).
  const sendTask = (row: T) => {
    if (!sendToTask) return flag(row, "tasked");
    showConfirmation(
      "Send Task to Internal App",
      "Are you sure you want to send this Task to Internal App? It will be added to your today's Draft worklog.",
      async () => {
        setBusyId(row.id);
        try {
          const r = await sendToTask(code, row.id);
          if (r.success) {
            showSuccess("Sent to Task", r.message || "Added to today's Draft worklog.", 3500);
            reload();
          } else {
            showError("Could not send to Task", r.message || "Unknown error.");
          }
        } catch (e) { showError("Could not send to Task", String(e)); } finally { setBusyId(null); }
      }
    );
  };

  // ── Excel: download a blank template (headers = form fields; select fields get a dropdown) ──
  const toYmd = (v: unknown): string => {
    if (v == null || v === "") return "";
    if (v instanceof Date && !isNaN(v.getTime()))
      return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? String(v).trim()
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const downloadTemplate = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(singular.slice(0, 28) || "Template");
      ws.columns = fields.map((fd) => ({
        header: fd.label + (fd.type === "date" ? " (YYYY-MM-DD)" : ""),
        key: fd.key,
        width: Math.max(16, Math.min(42, fd.label.length + 6)),
      }));
      const hdr = ws.getRow(1);
      hdr.font = { bold: true, color: { argb: "FF15233A" } };
      hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF1F8" } };
      hdr.alignment = { vertical: "middle" };
      // dropdown data-validation for select columns
      fields.forEach((fd, i) => {
        if (fd.type === "select" && fd.options?.length) {
          for (let r = 2; r <= 500; r++) {
            ws.getCell(r, i + 1).dataValidation = {
              type: "list", allowBlank: true, formulae: [`"${fd.options.join(",")}"`],
            };
          }
        }
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${title} Template.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) { showError("Template failed", String(e)); }
  };

  // ── Excel: import — parse, validate, add only valid rows ──
  const importExcel = async (file: File) => {
    setImporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) { showError("Import failed", "No sheet found in the file."); return; }

      // map header column -> field (match by label, tolerant of the "(YYYY-MM-DD)" hint)
      const colField: Record<number, FieldDef> = {};
      ws.getRow(1).eachCell((cell, col) => {
        const label = String(cell.value ?? "").replace(/\s*\(YYYY-MM-DD\)\s*$/i, "").trim().toLowerCase();
        const fd = fields.find((x) => x.label.trim().toLowerCase() === label);
        if (fd) colField[col] = fd;
      });
      if (!Object.keys(colField).length) {
        showError("Import failed", "No matching column headers. Please use the downloaded template.");
        return;
      }

      // Parse all non-empty rows into { fieldKey: value } — validation happens in the preview.
      const parsed: Record<string, string>[] = [];
      ws.eachRow((row, r) => {
        if (r === 1) return;
        const values: Record<string, string> = {};
        let any = false;
        for (const [colStr, fd] of Object.entries(colField)) {
          let raw: unknown = row.getCell(Number(colStr)).value;
          if (raw && typeof raw === "object") {
            const o = raw as { result?: unknown; text?: unknown };
            raw = o.result ?? o.text ?? raw;
          }
          let val = raw == null ? "" : String(raw).trim();
          if (val) any = true;
          if (fd.type === "date" && val) val = toYmd(raw);
          values[fd.key] = val;
        }
        if (any) parsed.push(values);
      });
      if (!parsed.length) { showError("Nothing to preview", "No data rows found in the file."); return; }
      setPreview({ open: true, rows: parsed });   // open the editable preview; import happens from there
    } catch (e) {
      showError("Import failed", String(e));
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  // Import the (already-validated) rows from the preview modal.
  const doImportRows = async (validRows: Record<string, string>[]) => {
    let ok = 0; const errs: string[] = [];
    for (const rec of validRows) {
      try { await apiFns.add(code, { ...blank, ...rec }); ok++; } catch (e) { errs.push(String(e)); }
    }
    reload();
    setPreview({ open: false, rows: [] });
    showSuccess("Import complete", `${ok} row${ok !== 1 ? "s" : ""} imported${errs.length ? `, ${errs.length} failed` : ""}.`, 2600);
  };

  // "Send To → Email": confirm first, then open the composer prefilled to the client with a
  // formatted summary of this row (built generically from the grid's columns). On Send, mark emailed (✓).
  const sendMail = (row: T) => {
    showConfirmation(
      "Send Email to Client",
      "Are you sure you want to send this to the client via Email? The email composer will open for you to review before sending.",
      () => openMailComposer(row)
    );
  };
  const openMailComposer = (row: T) => {
    // Always open the composer — even when the client has no email on file.
    // If we have one, prefill "To"; otherwise leave it empty for the user to fill.
    const rec = row as unknown as Record<string, unknown>;
    const lines = columns
      .filter((c) => (c as unknown as { accessorKey?: string }).accessorKey && typeof c.header === "string")
      .map((c) => {
        const key = (c as unknown as { accessorKey: string }).accessorKey;
        const v = rec[key];
        return v != null && String(v).trim() !== "" ? `${c.header as string}: ${v}` : null;
      })
      .filter(Boolean) as string[];
    const body = `Dear ${clientName || "Sir/Madam"},\n\nHere is the latest ${singular.toLowerCase()} update for your project${clientCode ? ` (${clientCode})` : ""}:\n\n${lines.join("\n")}\n\nRegards,\nIndus Analytics`;
    openComposer({
      to: clientEmail ? [{ email: clientEmail, name: clientName ?? undefined }] : [],
      subject: `${singular} Update — ${clientName || clientCode || "your project"}`,
      body,
      context: { clientCode: clientCode ?? undefined, clientName: clientName ?? undefined, module: title },
      onSent: () => flag(row, "emailed"),
    });
  };

  const cols = useMemo<ColumnDef<T>[]>(() => {
    const extra: ColumnDef<T>[] = [];
    if (send.length) {
      extra.push({
        id: "sendto", header: "Send To", enableSorting: false, size: send.length >= 3 ? 120 : send.length === 2 ? 90 : 70,
        cell: ({ row }) => {
          const r = row.original; const busy = busyId === r.id;
          return (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {send.includes("mail") && (r.emailed
                ? <span style={sentIcon} title="Emailed"><Check size={15} /></span>
                : <Button variant="ghost" size="xs" iconOnly icon={Mail} tooltip="Email" disabled={busy} onClick={() => sendMail(r)} />)}
              {send.includes("task") && (r.tasked
                ? <span style={sentIcon} title="Task sent"><Check size={15} /></span>
                : <Button variant="ghost" size="xs" iconOnly icon={ListTodo} tooltip="Send to Task (Worklog Draft)" disabled={busy} onClick={() => sendTask(r)} />)}
              {send.includes("point") && (r.pointed
                ? <span style={sentIcon} title="Sent to Point Management"><Check size={15} /></span>
                : <Button variant="ghost" size="xs" iconOnly icon={Target} tooltip="Send to Point Management" disabled={busy} onClick={() => sendPoint(r)} />)}
            </div>
          );
        },
      });
    }
    // Standard Actions column (View / Edit / Delete) — same component + look as /users.
    extra.push(createActionsColumn<T>({
      onView: (r) => openEdit(r),
      onEdit: (r) => openEdit(r),
      onDelete: (r) => doDelete(r),
      showView: true, showEdit: canEdit, showDelete: canEdit,
      mode: "buttons",
      primaryActions: ["view", "edit", "delete"],
      // doDelete() handles its own confirmation (and the "sent to Point Management" block), so the
      // grid's built-in confirm dialog is turned off to avoid a double prompt.
      confirmDelete: false,
    }));
    return [...columns, ...extra];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, send, busyId]);

  const initial = modal.row ? (modal.row as unknown as Record<string, unknown>) : blank;

  return (
    <TooltipProvider delayDuration={150}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {canEdit ? (
              <>
                {/* Download Template + Import Excel: desktop only (hidden on phones — bulk Excel work isn't practical there). */}
                <span className="hide-on-mobile" style={{ display: "contents" }}>
                  <Button variant="outline" size="sm" icon={Download} onClick={downloadTemplate}>Download Template</Button>
                  <Button variant="outline" size="sm" icon={Upload} loading={importing} onClick={() => importRef.current?.click()}>Import Excel</Button>
                </span>
                <input ref={importRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importExcel(f); }} />
                <button onClick={openCreate} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgb(var(--color-primary))", color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={15} /> Create
                </button>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "rgb(var(--fg-muted))", display: "inline-flex", alignItems: "center", gap: 5 }}><Eye size={13} /> View only</span>
            )}
          </div>
        </div>
        {summary}
        <DataGrid<T>
          data={rows}
          columns={cols}
          getRowId={(r) => String(r.id)}
          enableRowSelection
          rowSelectionMode="multi"
          enableColumnResizing
          enableColumnReordering
          enableColumnFreezing
          enableColumnVisibility
          enableSorting
          enableSearch
          enableBacchaSearch
          enableFilterRow
          enableExport
          enablePagination
          // Freeze the Send To column on the right ("actions" is auto-pinned right by the grid).
          rightFrozenColumns={send.length ? ["sendto"] : []}
          // Fresh, per-grid persisted-view key so code column sizes apply (see persisted-width gotcha).
          persistKey={`tracker-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-v1`}
        />
        <EntityFormModal open={modal.open} title={`${modal.row ? "Edit" : "New"} ${singular}`}
          fields={fields} initial={initial} saving={saving} onClose={close} onSave={save} readOnly={!canEdit} />
        <ImportPreviewModal open={preview.open} title={title} fields={fields} initialRows={preview.rows}
          onClose={() => setPreview({ open: false, rows: [] })} onImport={doImportRows} />
        <AlertComponent />
      </div>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ column + field configs */
const badgeCell = <T extends { status: string }>() =>
  ({ row }: { row: { original: T } }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge>;

// AI summary cell — shows the generated summary (full text on hover), or a dash when empty.
const summaryCell = <T extends { summary?: string }>() =>
  ({ row }: { row: { original: T } }) => {
    const s = (row.original.summary ?? "").trim();
    if (!s) return <span style={{ color: "rgb(var(--fg-muted))" }}>—</span>;
    return (
      <span title={s} style={{ display: "inline-flex", alignItems: "flex-start", gap: 5 }}>
        <Sparkles size={12} style={{ color: "rgb(var(--color-primary))", flexShrink: 0, marginTop: 2 }} />
        <span>{s}</span>
      </span>
    );
  };

/** Actual − Estimated in days (yyyy-MM-dd strings); "" until both dates are set. */
function milestoneVarianceDays(planned: unknown, actual: unknown): string {
  const est = String(planned ?? "").slice(0, 10), act = String(actual ?? "").slice(0, 10);
  if (!est || !act) return "";
  const d = Math.round((Date.parse(act) - Date.parse(est)) / 86400000);
  return Number.isFinite(d) ? String(d) : "";
}
/** "On Time" when Actual ≤ Estimated, "Delayed" when Actual is later; "" until both dates are set. */
function milestoneOnTimeStatus(planned: unknown, actual: unknown): string {
  const est = String(planned ?? "").slice(0, 10), act = String(actual ?? "").slice(0, 10);
  if (!est || !act) return "";
  return act > est ? "Delayed" : "On Time";
}

// Milestone status → bar/legend colour. Status colours are reserved + always shown WITH a text
// label + count (never colour alone), and read on both light & dark surfaces.
const MS_STATUS: { key: string; label: string; color: string }[] = [
  { key: "Complete",    label: "Complete",    color: "#16a34a" },
  { key: "In Progress", label: "In Progress", color: "#2563eb" },
  { key: "Delayed",     label: "Delayed",     color: "#dc2626" },
  { key: "On Hold",     label: "On Hold",     color: "#d97706" },
  { key: "Pending",     label: "Pending",     color: "#94a3b8" },
];

/** Progress meter for the Milestone Roadmap: overall % complete + a stacked status bar with a
 *  labelled legend, and a per-milestone (group) progress breakdown. Anything not "Complete" counts
 *  as pending. Renders nothing when there are no milestones. */
function MilestoneProgress({ milestones }: { milestones: Milestone[] }) {
  const { total, counts, groups } = useMemo(() => {
    const counts: Record<string, number> = {};
    const groups = new Map<string, { done: number; total: number }>();
    for (const m of milestones) {
      const s = MS_STATUS.some((x) => x.key === m.status) ? String(m.status) : "Pending";
      counts[s] = (counts[s] || 0) + 1;
      const g = (m.milestoneGroup || "").trim() || "Ungrouped";
      const rec = groups.get(g) || { done: 0, total: 0 };
      rec.total += 1;
      if (s === "Complete") rec.done += 1;
      groups.set(g, rec);
    }
    return { total: milestones.length, counts, groups };
  }, [milestones]);

  if (total === 0) return null;
  const done = counts["Complete"] || 0;
  const pct = Math.round((done / total) * 100);
  const groupList = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  const track = "rgba(148,163,184,.2)";

  return (
    <div style={{ background: "rgb(var(--bg-subtle))", border: "1px solid rgba(148,163,184,.25)", borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
        {/* Headline % complete */}
        <div style={{ textAlign: "center", minWidth: 88 }}>
          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: pct >= 100 ? "#16a34a" : "rgb(var(--fg-default))" }}>{pct}%</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgb(var(--fg-muted))", marginTop: 4, letterSpacing: .6 }}>COMPLETE</div>
        </div>
        {/* Stacked status bar + legend */}
        <div style={{ flex: 1, minWidth: 250 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
            <span style={{ color: "rgb(var(--fg-default))", fontWeight: 600 }}>{done} of {total} phases complete</span>
            <span style={{ color: "rgb(var(--fg-muted))" }}>{100 - pct}% pending</span>
          </div>
          <div style={{ display: "flex", height: 14, borderRadius: 8, overflow: "hidden", background: track, gap: 2 }}>
            {MS_STATUS.filter((s) => (counts[s.key] || 0) > 0).map((s) => (
              <div key={s.key} title={`${s.label}: ${counts[s.key]}`} style={{ width: `${(counts[s.key] / total) * 100}%`, background: s.color }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 10 }}>
            {MS_STATUS.filter((s) => (counts[s.key] || 0) > 0).map((s) => (
              <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "rgb(var(--fg-default))" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                {s.label} <b>{counts[s.key]}</b>
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Per-milestone progress */}
      {groupList.length > 1 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(148,163,184,.2)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "12px 22px" }}>
          {groupList.map(([g, rec]) => {
            const gp = Math.round((rec.done / rec.total) * 100);
            return (
              <div key={g}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: "rgb(var(--fg-default))", fontWeight: 600 }}>{g}</span>
                  <span style={{ color: "rgb(var(--fg-muted))" }}>{gp}% · {rec.done}/{rec.total}</span>
                </div>
                <div style={{ height: 8, borderRadius: 5, background: track, overflow: "hidden" }}>
                  <div style={{ width: `${gp}%`, height: "100%", background: gp >= 100 ? "#16a34a" : "rgb(var(--color-primary))", borderRadius: 5 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MILESTONE_COLS: ColumnDef<Milestone>[] = [
  { accessorKey: "milestoneGroup", header: "Roadmap to Success", size: 150 },
  { accessorKey: "name", header: "Phases", size: 170 },
  { accessorKey: "taskTimeline", header: "Task Timeline", size: 120 },
  { accessorKey: "plannedDate", header: "Estimated Start", size: 130 },
  { accessorKey: "actualDate", header: "Actual Start", size: 130 },
  { accessorKey: "endDate", header: "End Date", size: 120 },
  { accessorKey: "resPerson", header: "Res. Person (Indus)", size: 150 },
  { accessorKey: "status", header: "Status", size: 120, cell: badgeCell<Milestone>() },
  // Explicit cell → the grid's auto date-formatter (which triggers because the accessorKey contains
  // "date") is skipped, so this numeric variance shows as a plain number, not "1 Jan 2000".
  { accessorKey: "startDateVariance", header: "Start Var (Days)", size: 120, cell: ({ row }) => <span>{row.original.startDateVariance ?? ""}</span> },
  { accessorKey: "scheduledStartStatus", header: "Scheduled Start Status", size: 160 },
  { accessorKey: "remarkStartDelay", header: "Remark-1 (Start Delay)", size: 180 },
  { accessorKey: "timelineVariance", header: "Timeline Var (Days)", size: 130 },
  { accessorKey: "timelineVarianceStatus", header: "Timeline Var Status", size: 150 },
  { accessorKey: "remarkDuration", header: "Remark-2 (Duration)", size: 180 },
  { accessorKey: "summary", header: "Summary", size: 280, cell: summaryCell<Milestone>() },
];
const MILESTONE_FIELDS: FieldDef[] = [
  { key: "milestoneGroup", label: "Roadmap to Success" },
  { key: "name", label: "Phases" },
  { key: "taskTimeline", label: "Task Timeline" },
  { key: "plannedDate", label: "Estimated Start Date", type: "date" },
  { key: "actualDate", label: "Actual Start Date", type: "date" },
  { key: "endDate", label: "End Date", type: "date" },
  { key: "resPerson", label: "Res. Person (Indus)" },
  { key: "status", label: "Status", type: "select", options: ["Pending", "In Progress", "Complete", "Delayed", "On Hold"] },
  // Auto-filled from the dates (still editable): Start Date Variance = Actual − Estimated (days);
  // Timeline Variance Status = On Time when Actual ≤ Estimated, Delayed when Actual is later.
  { key: "startDateVariance", label: "Start Date Variance (Days)", compute: (v) => milestoneVarianceDays(v.plannedDate, v.actualDate) },
  { key: "scheduledStartStatus", label: "Scheduled Start Status" },
  { key: "timelineVariance", label: "Timeline Variance (Days)" },
  { key: "timelineVarianceStatus", label: "Timeline Variance Status", compute: (v) => milestoneOnTimeStatus(v.plannedDate, v.actualDate) },
  { key: "remarkStartDelay", label: "Remark-1 (Start Delay)", type: "textarea" },
  { key: "remarkDuration", label: "Remark-2 (Duration)", type: "textarea" },
  { key: "summary", label: "Summary", type: "aiSummary", full: true },
];
const MILESTONE_BLANK = { status: "Pending", sortOrder: 0 };

const TRAINING_COLS: ColumnDef<TrainingUpdate>[] = [
  { accessorKey: "moduleName", header: "Main Module", size: 150 },
  { accessorKey: "subModule", header: "Sub Module", size: 150 },
  { accessorKey: "timelineDays", header: "Timeline (Days)", size: 120 },
  { accessorKey: "logDate", header: "Schedule Date", size: 130 },
  { accessorKey: "startTime", header: "Start Time", size: 100 },
  { accessorKey: "endTime", header: "End Time", size: 100 },
  { accessorKey: "trainee", header: "Trainee Name", size: 150 },
  { accessorKey: "trainer", header: "Trainer from Indas", size: 150 },
  { accessorKey: "status", header: "Status", size: 120, cell: badgeCell<TrainingUpdate>() },
  { accessorKey: "details", header: "Details of Covered Modules", size: 220 },
  {
    accessorKey: "videoUrl", header: "YouTube Link", size: 130,
    cell: ({ row }) => {
      const u = (row.original.videoUrl ?? "").trim();
      if (!u) return "—";
      return (
        <a href={u} target="_blank" rel="noreferrer" title={u}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "rgb(var(--color-primary))", fontWeight: 600, textDecoration: "none" }}>
          <PlayCircle size={14} /> Watch
        </a>
      );
    },
  },
  { accessorKey: "remark", header: "Remark", size: 180 },
  { accessorKey: "summary", header: "Summary", size: 280, cell: summaryCell<TrainingUpdate>() },
];
const TRAINING_FIELDS: FieldDef[] = [
  // Row 1 — 4 fields (span 3 each = 12)
  { key: "moduleName", label: "Main Module", type: "module", span: 3 },
  { key: "subModule", label: "Sub Module", type: "submodule", dependsOn: "moduleName", span: 3 },
  { key: "timelineDays", label: "Timeline in Days", span: 3 },
  { key: "logDate", label: "Schedule Date", type: "date", span: 3 },
  // Row 2 — 3 fields (span 4 each = 12)
  { key: "startTime", label: "Start Time", type: "time", span: 4 },
  { key: "endTime", label: "End Time", type: "time", span: 4 },
  { key: "trainee", label: "Trainee Name", span: 4 },
  // Row 3 — 4 fields (span 3 each = 12)
  { key: "trainer", label: "Trainer from Indas", type: "user", span: 3 },
  { key: "status", label: "Status", type: "select", options: ["Scheduled", "Running", "Complete", "Hold"], span: 3 },
  { key: "videoUrl", label: "YouTube Link Attachment", type: "url", span: 3 },
  { key: "remark", label: "Remark", type: "textarea", span: 3, autoGrow: true },
  // Row 4 — full-width, auto-sizing (grows with the text typed in it)
  { key: "details", label: "Details of Covered Modules in Training", type: "textarea", full: true, autoGrow: true },
  // Row 5 — full-width
  { key: "summary", label: "Summary", type: "aiSummary", full: true },
];
const TRAINING_BLANK = { status: "Scheduled" };

const CR_COLS: ColumnDef<ChangeRequest>[] = [
  { accessorKey: "moduleName", header: "Module Name", size: 150 },
  { accessorKey: "subModule", header: "Sub Module Name", size: 160 },
  { accessorKey: "description", header: "Point Description", size: 240 },
  { accessorKey: "raisedBy", header: "Raised By", size: 130 },
  { accessorKey: "raisedDate", header: "Raised Date", size: 120 },
  { accessorKey: "reportedBy", header: "Reported By", size: 130 },
  { accessorKey: "queryType", header: "Query Type", size: 130 },
  { accessorKey: "status", header: "Status", size: 120, cell: badgeCell<ChangeRequest>() },
  { accessorKey: "pointID", header: "Point Ticket", size: 110, cell: ({ row }) => (row.original.pointID ? <span style={{ fontWeight: 700, color: "rgb(var(--color-primary))" }}>#{row.original.pointID}</span> : "—") },
  { accessorKey: "completionDate", header: "Completion Date", size: 130 },
  { accessorKey: "completionDays", header: "Completion Days", size: 130 },
  { accessorKey: "remark", header: "Remark", size: 180 },
  { accessorKey: "summary", header: "Summary", size: 280, cell: summaryCell<ChangeRequest>() },
];
const CR_FIELDS: FieldDef[] = [
  { key: "moduleName", label: "Module Name", type: "module" },
  { key: "subModule", label: "Sub Module Name", type: "submodule", dependsOn: "moduleName" },
  { key: "description", label: "Point Description", type: "textarea" },
  { key: "raisedBy", label: "Raised By" },
  { key: "raisedDate", label: "Raised Date", type: "date" },
  { key: "reportedBy", label: "Reported By", type: "user" },
  { key: "queryType", label: "Query Type", type: "select", options: ["Improvement", "Bug", "New Feature", "Configuration"] },
  { key: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Completed", "Rejected"] },
  { key: "completionDate", label: "Completion Date", type: "date" },
  { key: "completionDays", label: "Completion Days" },
  { key: "remark", label: "Remark", type: "textarea" },
  { key: "summary", label: "Summary", type: "aiSummary", full: true },
];
const CR_BLANK = { status: "Open", queryType: "Improvement", emailed: false, tasked: false, pointed: false };

// charges are free text — user may enter "300", "By Client", "By Indus", "Hotel charge - 300", etc.
const txt = (v?: string) => (v && v.trim() ? v : "—");

const ONSITE_COLS: ColumnDef<OnsiteVisit>[] = [
  { accessorKey: "person", header: "Person Name", size: 170 },
  { accessorKey: "age", header: "Age", size: 70 },
  { accessorKey: "mobileNo", header: "Mobile No", size: 130 },
  { accessorKey: "location", header: "Location", size: 150 },
  { accessorKey: "fromDate", header: "From", size: 120 },
  { accessorKey: "toDate", header: "To", size: 120 },
  { accessorKey: "days", header: "Days", size: 80 },
  { accessorKey: "ticketCharge", header: "Tickets", size: 140, cell: ({ row }) => txt(row.original.ticketCharge) },
  { accessorKey: "hotelCharge", header: "Hotel Charge", size: 150, cell: ({ row }) => txt(row.original.hotelCharge) },
  { accessorKey: "foodCharge", header: "Food Charge", size: 150, cell: ({ row }) => txt(row.original.foodCharge) },
  { accessorKey: "siteCharge", header: "Site Charge", size: 150, cell: ({ row }) => txt(row.original.siteCharge) },
  { accessorKey: "status", header: "Status", size: 120, cell: badgeCell<OnsiteVisit>() },
];

const SEND_MAIL_TASK: ("mail" | "task" | "point")[] = ["mail", "task"];
const SEND_MAIL_TASK_POINT: ("mail" | "task" | "point")[] = ["mail", "task", "point"];
const SEND_MAIL: ("mail" | "task" | "point")[] = ["mail"];
const ONSITE_FIELDS: FieldDef[] = [
  { key: "person", label: "Person Name" },
  { key: "age", label: "Age" },
  { key: "mobileNo", label: "Mobile No" },
  { key: "location", label: "Location" },
  { key: "fromDate", label: "From Date", type: "date" },
  { key: "toDate", label: "To Date", type: "date" },
  { key: "days", label: "Days", compute: (v) => daysBetween(v.fromDate, v.toDate) },
  { key: "status", label: "Status", type: "select", options: ["Planned", "Ongoing", "Complete"] },
  { key: "ticketCharge", label: "Tickets (Charge)" },
  { key: "hotelCharge", label: "Hotel Charge" },
  { key: "foodCharge", label: "Food Charge" },
  { key: "siteCharge", label: "Site Charge" },
];
const ONSITE_BLANK = { status: "Planned" };

/* ------------------------------------------------------------------ panel */
export default function TrackerPanel({ code, view, clientEmail, clientName, clientCode, clientApplication, canEdit = true }: { code: string; view: "kickoff" | "tracker" | "signoff" | "onsite"; clientEmail?: string | null; clientName?: string | null; clientCode?: string | null; clientApplication?: string | null; canEdit?: boolean }) {
  const [data, setData] = useState<Tracker | null>(null);
  const [sub, setSub] = useState("milestones");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try { setData(await api.getTracker(code)); } catch (e) { setErr(String(e)); }
  }, [code]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t); }, [flash]);

  // Roadmap-column authority: only granted users may edit Phases / Task Timeline / Estimated Start.
  const { data: session } = useSession();
  const [canEditRoadmap, setCanEditRoadmap] = useState(false);
  useEffect(() => {
    const uid = (session?.user as { UserID?: number } | undefined)?.UserID;
    if (!uid) return; // default (false) already denies until we know
    fetchUserPermissions(uid).then((p) => setCanEditRoadmap(p.has("milestone.editRoadmapColumns"))).catch(() => {});
  }, [session]);
  const milestoneFields = useMemo(
    () => MILESTONE_FIELDS.map((fd) => (["name", "taskTimeline", "plannedDate"].includes(fd.key) ? { ...fd, locked: !canEditRoadmap } : fd)),
    [canEditRoadmap],
  );

  if (err) return <div style={{ color: "#c0392b" }}>{err}</div>;
  if (!data) return <div style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>Loading…</div>;

  const flashBar = flash && (
    <div style={{ background: "#e6f6ec", color: "#1c6b3c", border: "1px solid #b7e2c6", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>✓ {flash}</div>
  );

  if (view === "kickoff") {
    return (
      <Card><CardHeader><CardTitle><PartyPopper size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Kick-Off</CardTitle></CardHeader>
        <CardContent>
          <p style={{ opacity: 0.7, fontSize: 13.5 }}>Kick-off checklist & document for this client. The kick-off milestones appear in the Tracker → Milestone Roadmap.</p>
          <div style={{ marginTop: 10, fontSize: 13 }}>
            {data.milestones.slice(0, 4).map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <Badge variant={statusVariant(m.status)}>{m.status}</Badge> <b>{m.name}</b> <span style={{ opacity: 0.55 }}>· {m.plannedDate ?? "—"}</span>
              </div>
            ))}
            {data.milestones.length === 0 && <div style={{ opacity: 0.6 }}>No kick-off milestones recorded yet.</div>}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (view === "signoff") {
    return (
      <Card><CardHeader><CardTitle><ClipboardCheck size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Sign-Off</CardTitle></CardHeader>
        <CardContent>
          <p style={{ opacity: 0.7, fontSize: 13.5 }}>Sign-off document & completion status. Completed once all milestones, training and change requests are closed.</p>
          <div style={{ marginTop: 10, display: "flex", gap: 20, fontSize: 13 }}>
            <div><b>{data.milestones.filter((m) => m.status === "Complete").length}</b>/{data.milestones.length} milestones complete</div>
            <div><b>{data.changeRequests.filter((c) => c.status === "Open").length}</b> open change requests</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (view === "onsite") {
    return (
      <div>
        {flashBar}
        <EntityGrid<OnsiteVisit> code={code} title="Onsite Visits" rows={data.onsite} columns={ONSITE_COLS}
          fields={ONSITE_FIELDS} blank={ONSITE_BLANK} send={SEND_MAIL} reload={load} onFlash={setFlash} clientEmail={clientEmail} clientName={clientName} clientCode={clientCode}
          apiFns={{ add: api.addOnsite, update: api.updateOnsite, del: api.deleteOnsite }} canEdit={canEdit} />
      </div>
    );
  }

  // tracker
  const subTabs = [
    { id: "milestones", label: "Milestone Roadmap" },
    { id: "training", label: "Training & Daily Status" },
    { id: "cr", label: "Change Request" },
  ];
  return (
    <div>
      {flashBar}
      <div className="scroll-tabs" style={{ marginBottom: 14 }}>
        <Tabs tabs={subTabs} activeTab={sub} onTabChange={setSub} variant="rounded" size="sm" />
      </div>
      {sub === "milestones" && (
        <EntityGrid<Milestone> code={code} title="Milestone Roadmap" rows={data.milestones} columns={MILESTONE_COLS}
          summary={<MilestoneProgress milestones={data.milestones} />}
          fields={milestoneFields} blank={MILESTONE_BLANK} send={SEND_MAIL_TASK} reload={load} onFlash={setFlash} clientEmail={clientEmail} clientName={clientName} clientCode={clientCode}
          sendToTask={(cd, id) => api.trackerRowToWorklog(cd, "milestone", id, { clientName: clientName ?? undefined })}
          apiFns={{ add: api.addMilestone, update: api.updateMilestone, del: api.deleteMilestone }} canEdit={canEdit} />
      )}
      {sub === "training" && (
        <EntityGrid<TrainingUpdate> code={code} title="Training & Daily Status" singular="Training & Daily Status" rows={data.training} columns={TRAINING_COLS}
          fields={TRAINING_FIELDS} blank={TRAINING_BLANK} send={SEND_MAIL_TASK} reload={load} onFlash={setFlash} clientEmail={clientEmail} clientName={clientName} clientCode={clientCode}
          sendToTask={(cd, id) => api.trackerRowToWorklog(cd, "training", id, { clientName: clientName ?? undefined })}
          apiFns={{ add: api.addTraining, update: api.updateTraining, del: api.deleteTraining }} canEdit={canEdit} />
      )}
      {sub === "cr" && (
        <EntityGrid<ChangeRequest> code={code} title="Change Requests" rows={data.changeRequests} columns={CR_COLS}
          fields={CR_FIELDS} blank={CR_BLANK} send={SEND_MAIL_TASK_POINT} reload={load} onFlash={setFlash} clientEmail={clientEmail} clientName={clientName} clientCode={clientCode}
          sendToPoint={(cd, id) => api.changeRequestToPoint(cd, id, { clientName: clientName ?? undefined, application: clientApplication ?? undefined })}
          sendToTask={(cd, id) => api.trackerRowToWorklog(cd, "changerequest", id, { clientName: clientName ?? undefined })}
          apiFns={{ add: api.addChangeRequest, update: api.updateChangeRequest, del: api.deleteChangeRequest }} canEdit={canEdit} />
      )}
    </div>
  );
}
