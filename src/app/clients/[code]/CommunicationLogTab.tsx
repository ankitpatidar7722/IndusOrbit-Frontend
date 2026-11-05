"use client";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { Button, Input, StandardModal, useModalAlert } from "indas-ui";
import KDropdown from "@/components/KDropdown";
import { Plus, Phone, Mail, MessageSquare, Video, Users2, Smartphone } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGrid, createActionsColumn } from "@/components/datagrid";
import { api, type CommunicationEntry, type CommunicationSave } from "@/lib/api";

/**
 * Communication Log — the 4th Tracker tab. A timestamped, accountable timeline of every interaction
 * between Indus and the client (call / email / WhatsApp / meeting) with its outcome (Connected, No
 * Answer, …) so neither side can dispute what happened later. Emails sent from the app are auto-pulled
 * in read-only. "Who logged it + when" is server-set; entries are soft-deleted (kept in history).
 */
const MODES = ["Call", "Email", "WhatsApp", "Meeting", "SMS", "Video Call"];
const DIRECTIONS = ["Outbound", "Inbound"];
const OUTCOMES = ["Connected", "No Answer", "Busy", "Call Back", "Resolved", "Pending"];

const blank = (): CommunicationSave => ({ commDateTime: "", mode: "Call", direction: "Outbound", contactPerson: "", contactInfo: "", outcome: "Connected", durationMinutes: null, subject: "", notes: "", followUpDate: "", handledBy: "" });

const pad = (n: number) => String(n).padStart(2, "0");
const nowLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toLocalInput = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d.getTime())) return ""; return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtWhen = (iso?: string | null) => { if (!iso) return "—"; const d = new Date(iso); if (isNaN(d.getTime())) return String(iso).slice(0, 16); let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${pad(d.getDate())}-${MON[d.getMonth()]}-${String(d.getFullYear()).slice(2)} · ${h}:${pad(d.getMinutes())} ${ap}`; };
const fmtDate = (s?: string | null) => { if (!s) return "—"; const d = new Date(s); if (isNaN(d.getTime())) return String(s).slice(0, 10); return `${pad(d.getDate())}-${MON[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`; };

const MODE_ICON: Record<string, React.ReactNode> = {
  Call: <Phone size={12} />, Email: <Mail size={12} />, WhatsApp: <MessageSquare size={12} />,
  Meeting: <Users2 size={12} />, "Video Call": <Video size={12} />, SMS: <Smartphone size={12} />,
};
function outcomeStyle(o?: string | null): CSSProperties {
  const base: CSSProperties = { display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" };
  switch ((o || "").toLowerCase()) {
    case "connected": case "resolved": case "sent": return { ...base, background: "#e6f6ec", color: "#166534" };
    case "no answer": return { ...base, background: "#fdeaea", color: "#b91c1c" };
    case "busy": return { ...base, background: "#fff4e5", color: "#b45309" };
    case "call back": return { ...base, background: "#eef2ff", color: "#4338ca" };
    case "failed": return { ...base, background: "#fdeaea", color: "#b91c1c" };
    default: return { ...base, background: "#f1f5f9", color: "#475569" };
  }
}
const card: CSSProperties = { background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--bd-default))", borderRadius: 12, padding: "12px 14px" };
const lbl: CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "rgb(var(--fg-muted))", marginBottom: 4 };

export default function CommunicationLogTab({ code, clientName, canEdit, onFlash }: { code: string; clientName?: string | null; canEdit: boolean; onFlash: (m: string) => void }) {
  const { data: session } = useSession();
  const me = (session?.user as { name?: string } | undefined)?.name ?? "";
  const { showError, showConfirmation, AlertComponent } = useModalAlert();
  const [rows, setRows] = useState<CommunicationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; editId: number | null; view?: boolean }>({ open: false, editId: null });
  const [f, setF] = useState<CommunicationSave>(blank());
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.getCommunications(code).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [code]);
  useEffect(() => { load(); }, [load]);

  const sum = useMemo(() => {
    const low = (s?: string | null) => (s || "").toLowerCase();
    const connected = rows.filter((r) => ["connected", "resolved", "sent"].includes(low(r.outcome))).length;
    const noAns = rows.filter((r) => low(r.outcome) === "no answer").length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const pending = rows.filter((r) => { if (!r.followUpDate) return false; const d = new Date(r.followUpDate); return !isNaN(d.getTime()) && d >= today; }).length;
    return { total: rows.length, connected, noAns, last: rows[0]?.when ?? rows[0]?.loggedAt, pending };
  }, [rows]);

  const openNew = () => { setF({ ...blank(), handledBy: me, commDateTime: nowLocal() }); setModal({ open: true, editId: null }); };
  const fill = (r: CommunicationEntry) =>
    setF({ commDateTime: toLocalInput(r.when), mode: r.mode, direction: r.direction, contactPerson: r.contactPerson ?? "", contactInfo: r.contactInfo ?? "", outcome: r.outcome ?? "Connected", durationMinutes: r.durationMinutes ?? null, subject: r.subject ?? "", notes: r.notes ?? "", followUpDate: r.followUpDate ? String(r.followUpDate).slice(0, 10) : "", handledBy: r.handledBy ?? "" });
  const openEdit = (r: CommunicationEntry) => { fill(r); setModal({ open: true, editId: r.id }); };
  // View (also a phone card tap): the same form, read-only — the only way to see an auto-pulled email entry in full.
  const openView = (r: CommunicationEntry) => { fill(r); setModal({ open: true, editId: r.id, view: true }); };

  const columns = useMemo<ColumnDef<CommunicationEntry>[]>(() => [
    { id: "when", accessorFn: (r) => r.when ?? "", header: "Date & Time", size: 170,
      cell: ({ row: { original: r } }) => <div><div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmtWhen(r.when)}</div>{r.durationMinutes ? <div style={{ fontSize: 11, color: "rgb(var(--fg-muted))" }}>{r.durationMinutes} min</div> : null}</div> },
    { accessorKey: "mode", header: "Type", size: 120,
      cell: ({ row: { original: r } }) => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#e2edfa", color: "rgb(var(--color-primary))", whiteSpace: "nowrap" }}>{MODE_ICON[r.mode] ?? null} {r.mode}</span> },
    { accessorKey: "direction", header: "Direction", size: 110,
      cell: ({ row: { original: r } }) => <span style={{ fontWeight: 700, color: r.direction === "Inbound" ? "#7c3aed" : "#2563eb", whiteSpace: "nowrap" }}>{r.direction === "Inbound" ? "Inbound ↙" : "Outbound ↗"}</span> },
    { id: "contact", accessorFn: (r) => `${r.contactPerson ?? ""} ${r.contactInfo ?? ""}`.trim(), header: "Client Contact", size: 180,
      cell: ({ row: { original: r } }) => <div><div style={{ fontWeight: 600 }}>{r.contactPerson || "—"}</div>{r.contactInfo ? <div style={{ fontSize: 11.5, color: "rgb(var(--fg-muted))", wordBreak: "break-all" }}>{r.contactInfo}</div> : null}</div> },
    { accessorKey: "outcome", header: "Outcome", size: 120, cell: ({ row: { original: r } }) => <span style={outcomeStyle(r.outcome)}>{r.outcome || "—"}</span> },
    { id: "subject", accessorFn: (r) => `${r.subject ?? ""} ${r.notes ?? ""}`.trim(), header: "Subject / Discussion", size: 280,
      cell: ({ row: { original: r } }) => <div><div style={{ fontWeight: 700 }}>{r.subject || "—"}</div>{r.notes ? <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 2, whiteSpace: "normal" }}>{r.notes}</div> : null}{r.source === "email" ? <div style={{ fontSize: 10.5, color: "rgb(var(--fg-muted))", marginTop: 2, fontStyle: "italic" }}>Auto from Email History</div> : null}</div> },
    { id: "handledBy", accessorFn: (r) => r.handledBy || r.loggedBy || "", header: "Handled By", size: 150 },
    { id: "followUp", accessorFn: (r) => r.followUpDate ?? "", header: "Follow-up", size: 110,
      cell: ({ row: { original: r } }) => r.followUpDate ? <span style={{ color: "#d97706", fontWeight: 700, whiteSpace: "nowrap" }}>{fmtDate(r.followUpDate)}</span> : <span style={{ color: "rgb(var(--fg-muted))" }}>—</span> },
    // Same View / Edit / Delete buttons as the other tabs; auto-pulled email entries are view-only.
    createActionsColumn<CommunicationEntry>({
      onView: (r) => openView(r), onEdit: (r) => openEdit(r), onDelete: (r) => del(r),
      showView: true,
      showEdit: (r) => canEdit && !!r.editable,
      showDelete: (r) => canEdit && !!r.editable && busyId !== r.id,
      mode: "buttons", primaryActions: ["view", "edit", "delete"], confirmDelete: false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canEdit, busyId]);
  const save = async () => {
    if (!f.mode || !f.direction || !f.outcome) { showError("Required", "Type, Direction and Outcome are required."); return; }
    setSaving(true);
    try {
      const body: CommunicationSave = { ...f, durationMinutes: f.durationMinutes ? Number(f.durationMinutes) : null };
      if (modal.editId) await api.updateCommunication(code, modal.editId, body); else await api.addCommunication(code, body);
      setModal({ open: false, editId: null }); onFlash(modal.editId ? "Communication updated." : "Communication logged."); load();
    } catch (e) { showError("Save failed", String(e)); } finally { setSaving(false); }
  };
  const del = (r: CommunicationEntry) => showConfirmation(
    "Remove Communication",
    "Remove this communication entry? It stays in history as deleted (not erased).",
    async () => {
      setBusyId(r.id);
      try { await api.deleteCommunication(code, r.id); onFlash("Entry removed."); load(); }
      catch (e) { showError("Delete failed", String(e)); } finally { setBusyId(null); }
    },
  );

  const Cards = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
      {[
        { n: sum.total, l: "Total Interactions", c: "rgb(var(--fg-default))" },
        { n: sum.connected, l: "Connected", c: "#16a34a" },
        { n: sum.noAns, l: "No Answer / Missed", c: "#dc2626" },
        { n: fmtWhen(sum.last), l: "Last Contact", c: "rgb(var(--fg-default))", small: true },
        { n: sum.pending, l: "Pending Follow-ups", c: "#d97706" },
      ].map((x, i) => (
        <div key={i} style={card}>
          <div style={{ fontSize: x.small ? 14 : 22, fontWeight: 800, color: x.c }}>{x.n}</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "rgb(var(--fg-muted))", marginTop: 2 }}>{x.l}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {Cards}
      {/* Desktop header (title + Log button); on phones the grid's own header + "+" replace it, like the other tabs. */}
      <div className="hide-on-phone" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Communication Log</div>
        <div style={{ flex: 1 }} />
        {canEdit && <Button size="sm" icon={Plus} onClick={openNew}>Log Communication</Button>}
      </div>

      {/* Shared DataGrid (same as the other Tracker tabs) — on a phone it turns into tap-able cards with
          its own search + "+" button, so this tab behaves exactly like Change Request etc. */}
      {loading ? (
        <div style={{ ...card, textAlign: "center", padding: "30px 0", color: "rgb(var(--fg-muted))" }}>Loading…</div>
      ) : (
        <DataGrid<CommunicationEntry>
          data={rows}
          columns={columns}
          getRowId={(r) => `${r.source}-${r.id}`}
          phoneTitle="Communication Log"
          onCreate={canEdit ? openNew : undefined}
          createLabel="Log Communication"
          onRefresh={load}
          enableColumnResizing
          enableColumnVisibility
          enableSorting
          enableSearch
          enableFilterRow
          enableExport
          enablePagination
          persistKey="tracker-communication-log-v1"
        />
      )}

      <div style={{ fontSize: 11.5, color: "rgb(var(--fg-muted))", marginTop: 8 }}>
        🔒 Every entry records who logged it + the exact time (not editable); entries are never erased (soft-delete keeps history). Emails sent from the app appear here automatically.
      </div>

      {/* Always mounted (only isOpen toggles), like the other tabs' forms: mounting it already-open on a phone
          swapped the dialog element right after opening, and the back-button guard then closed it at once. */}
        <StandardModal isOpen={modal.open} title={modal.view ? "Communication" : modal.editId ? "Edit Communication" : "Log Communication"} onClose={() => setModal({ open: false, editId: null })} size="lg" showFooter={false} disableOutsideClose>
          <div style={{ padding: 2 }}>
            <div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))", marginBottom: 12 }}>Interaction with <b>{clientName || "this client"}</b>. &ldquo;Handled By&rdquo; + the exact log time are recorded automatically.</div>
            <div className="form-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px 14px", ...(modal.view ? { pointerEvents: "none", opacity: 0.92 } : {}) }}>
              <div><label style={lbl}>Date &amp; Time</label><input type="datetime-local" value={f.commDateTime ?? ""} onChange={(e) => setF({ ...f, commDateTime: e.target.value })} style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1px solid rgb(var(--bd-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", boxSizing: "border-box" }} /></div>
              <div><label style={lbl}>Type</label><KDropdown value={f.mode} onValueChange={(v) => setF({ ...f, mode: String(v) })} options={MODES.map((m) => ({ value: m, label: m }))} size="md" /></div>
              <div><label style={lbl}>Direction</label><KDropdown value={f.direction} onValueChange={(v) => setF({ ...f, direction: String(v) })} options={DIRECTIONS.map((d) => ({ value: d, label: d }))} size="md" /></div>
              <div><label style={lbl}>Outcome</label><KDropdown value={f.outcome} onValueChange={(v) => setF({ ...f, outcome: String(v) })} options={OUTCOMES.map((o) => ({ value: o, label: o }))} size="md" /></div>
              <div><label style={lbl}>Client Contact Person</label><Input value={f.contactPerson ?? ""} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} placeholder="e.g. Rakesh (Owner)" /></div>
              <div><label style={lbl}>Contact No / Email</label><Input value={f.contactInfo ?? ""} onChange={(e) => setF({ ...f, contactInfo: e.target.value })} placeholder="+91… / name@…" /></div>
              <div><label style={lbl}>Duration (min)</label><Input type="number" value={(f.durationMinutes ?? "") as never} onChange={(e) => setF({ ...f, durationMinutes: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><label style={lbl}>Follow-up Date</label><input type="date" value={f.followUpDate ?? ""} onChange={(e) => setF({ ...f, followUpDate: e.target.value })} style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1px solid rgb(var(--bd-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", boxSizing: "border-box" }} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Subject</label><Input value={f.subject ?? ""} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Short topic" /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Discussion / Notes</label>
                <textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="What was discussed…" rows={3}
                  style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid rgb(var(--bd-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16, paddingTop: 12, borderTop: "1px solid rgb(var(--bd-default))" }}>
              <Button size="sm" variant="action-cancel" onClick={() => setModal({ open: false, editId: null })}>{modal.view ? "Close" : "Cancel"}</Button>
              {!modal.view && <Button size="sm" variant="action-save" loading={saving} onClick={save}>{modal.editId ? "Save Changes" : "Log It"}</Button>}
            </div>
          </div>
        </StandardModal>
      <AlertComponent />
    </div>
  );
}
