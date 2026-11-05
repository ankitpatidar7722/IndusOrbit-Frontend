"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, FileText, Image as ImageIcon, Trash2, Printer, Upload, ExternalLink } from "lucide-react";
import { api, type TrackerAttachment } from "@/lib/api";

/**
 * Attachments block for a Tracker form (PDF / images — e.g. the client-signed Training Sheet) plus an
 * optional "Print Training Sheet" button. On a saved row files upload immediately; on a NEW row they're
 * held in `pending` and the grid uploads them right after the row is created.
 */
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*";
const MAX = 15 * 1024 * 1024;
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const isPdf = (name: string, type?: string | null) => /pdf/i.test(type || "") || /\.pdf$/i.test(name);

export default function TrackerAttachments({ code, entity, rowId, readOnly, pending, setPending, onPrint, compact }: {
  code: string; entity: string; rowId: number | null; readOnly?: boolean;
  pending: File[]; setPending: (f: File[]) => void; onPrint?: () => void;
  /** Compact = a form field (label is the form's): just the Attach button + the file chips, no box. */
  compact?: boolean;
}) {
  const [items, setItems] = useState<TrackerAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!rowId) { setItems([]); return; }
    api.trackerAttachments(code, entity, rowId).then(setItems).catch(() => setItems([]));
  }, [code, entity, rowId]);
  useEffect(() => { load(); }, [load]);

  const onFiles = async (list: FileList | null) => {
    setErr(null);
    const files = Array.from(list ?? []);
    if (pick.current) pick.current.value = "";
    if (!files.length) return;
    const bad = files.find((f) => !/\.(pdf|jpe?g|png|webp|gif)$/i.test(f.name));
    if (bad) { setErr(`"${bad.name}" is not allowed — only PDF or image files.`); return; }
    const big = files.find((f) => f.size > MAX);
    if (big) { setErr(`"${big.name}" is larger than 15 MB.`); return; }
    if (!rowId) { setPending([...pending, ...files]); return; }
    setBusy(true);
    try { await api.uploadTrackerAttachments(code, entity, rowId, files); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const remove = async (a: TrackerAttachment) => {
    if (!rowId || !window.confirm(`Remove "${a.originalName}"?`)) return;
    setBusy(true);
    try { await api.deleteTrackerAttachment(code, entity, rowId, a.id); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const chip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12.5, background: "rgb(var(--bg-subtle))", color: "rgb(var(--fg-default))", maxWidth: 360 };
  const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
  const empty = items.length === 0 && pending.length === 0;
  const chips = (
    <>
      {items.map((a) => (
        <span key={a.id} style={chip} title={`${a.originalName} · ${kb(a.sizeBytes)}${a.uploadedByName ? ` · by ${a.uploadedByName}` : ""}`}>
          {isPdf(a.originalName, a.contentType) ? <FileText size={15} color="#dc2626" /> : <ImageIcon size={15} color="#2563eb" />}
          <a href={api.trackerAttachmentUrl(code, entity, rowId!, a.id)} target="_blank" rel="noreferrer"
            style={{ color: "inherit", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", pointerEvents: "auto" }}>
            {a.originalName}
          </a>
          <span style={{ color: "rgb(var(--fg-muted))", fontSize: 11 }}>{kb(a.sizeBytes)}</span>
          <a href={api.trackerAttachmentUrl(code, entity, rowId!, a.id)} target="_blank" rel="noreferrer" title="Open" style={{ display: "inline-flex", color: "rgb(var(--fg-muted))", pointerEvents: "auto" }}><ExternalLink size={13} /></a>
          {!readOnly && <button type="button" onClick={() => remove(a)} title="Remove" style={{ display: "inline-flex", border: "none", background: "transparent", color: "#dc2626", cursor: "pointer", padding: 0 }}><Trash2 size={13} /></button>}
        </span>
      ))}
      {pending.map((f, i) => (
        <span key={`p${i}`} style={{ ...chip, borderStyle: "dashed" }} title="Will upload when you save">
          {isPdf(f.name, f.type) ? <FileText size={15} color="#dc2626" /> : <ImageIcon size={15} color="#2563eb" />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
          <span style={{ color: "rgb(var(--fg-muted))", fontSize: 11 }}>{kb(f.size)} · on save</span>
          <button type="button" onClick={() => setPending(pending.filter((_, j) => j !== i))} title="Remove" style={{ display: "inline-flex", border: "none", background: "transparent", color: "#dc2626", cursor: "pointer", padding: 0 }}><Trash2 size={13} /></button>
        </span>
      ))}
    </>
  );

  if (compact) {
    return (
      <div>
        <input ref={pick} type="file" accept={ACCEPT} multiple hidden onChange={(e) => onFiles(e.target.files)} />
        {!readOnly && (
          <button type="button" disabled={busy} onClick={() => pick.current?.click()} title="PDF or image · max 15 MB each"
            style={{ ...btn, width: "100%", height: 40, justifyContent: "center", border: "1px dashed rgb(var(--color-primary))", background: "rgb(var(--color-primary) / 0.05)", color: "rgb(var(--color-primary))", opacity: busy ? 0.6 : 1 }}>
            <Upload size={14} /> {busy ? "Uploading…" : "Attach PDF / Image"}
          </button>
        )}
        {readOnly && empty && <div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))", height: 40, display: "flex", alignItems: "center" }}>No files attached.</div>}
        {!empty && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: readOnly ? 0 : 8 }}>{chips}</div>}
        {err && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{err}</div>}
      </div>
    );
  }

  return (
    <div style={{ gridColumn: "1 / -1", border: "1px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))" }}>
          <Paperclip size={14} /> Attachments <span style={{ fontWeight: 400 }}>(signed training sheet, PDF or image · max 15 MB each)</span>
        </span>
        <div style={{ flex: 1 }} />
        {onPrint && (
          <button type="button" onClick={onPrint} style={{ ...btn, border: "1px solid rgb(var(--color-primary))", background: "transparent", color: "rgb(var(--color-primary))", pointerEvents: "auto", opacity: 1 }}>
            <Printer size={14} /> Print Training Sheet
          </button>
        )}
        {!readOnly && (
          <button type="button" disabled={busy} onClick={() => pick.current?.click()}
            style={{ ...btn, border: "none", background: "rgb(var(--color-primary))", color: "#fff", opacity: busy ? 0.6 : 1 }}>
            <Upload size={14} /> {busy ? "Uploading…" : "Attach PDF / Image"}
          </button>
        )}
        <input ref={pick} type="file" accept={ACCEPT} multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>

      {!empty && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {chips}
        </div>
      )}
      {empty && <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 6 }}>No files attached yet. Print the sheet, get it signed at the client site, then attach the scan or photo here.</div>}
      {err && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{err}</div>}
    </div>
  );
}
