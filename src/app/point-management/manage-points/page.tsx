"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, useModalAlert, Dropdown, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, XCircle, Send, Check, Edit, Trash2, type LucideIcon } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import DateField from "@/components/DateField";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { lblStyle, clearBtnStyle, gridFeatures, PmHeader, managePointColumns } from "../shared";
import { usePointDrawer, usePointIdFromUrl, PointDrawer } from "../PointDrawer";
import PointEditModal from "../PointEditModal";
import { pmApi, type PointGridRow, type PmCustomer } from "@/lib/tms";

const STATUSES = [
  "Queue", "Assigned", "In Progress", "DevCompleted", "PendingSupport", "SupportVerified",
  "PendingMerge", "PendingQC", "In-Testing", "Testing-Completed", "ReOpened", "Hold", "Reject", "Closed",
];

// Per-action hover tone — mirrors the DataGrid ActionsColumn (used by /users) exactly.
const ACTION_TONE = {
  view:   "hover:text-[rgb(var(--color-info))] hover:bg-[rgb(var(--color-info-subtle))]",
  edit:   "hover:text-[rgb(var(--color-orange))] hover:bg-[rgb(var(--color-orange-subtle))]",
  delete: "hover:text-[rgb(var(--color-error))] hover:bg-[rgb(var(--color-error-subtle))]",
  close:  "hover:text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary-subtle))]",
  send:   "hover:text-[rgb(var(--color-info))] hover:bg-[rgb(var(--color-info-subtle))]",
} as const;

/** Flat icon action with a hover Tooltip — same look as the /users grid's Actions column
 *  (`p-1 rounded transition-colors`, 16px icon, per-action hover colour). */
function IconAction({ icon: Icon, label, tone, onClick, disabled }: {
  icon: LucideIcon; label: string; tone: keyof typeof ACTION_TONE; onClick: () => void; disabled?: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={label} disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`p-1 rounded transition-colors text-[rgb(var(--fg-default))] ${ACTION_TONE[tone]} disabled:opacity-40 disabled:cursor-not-allowed`}>
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ManagePoints({ tmsUserId, isAdmin }: { tmsUserId: number; isAdmin: boolean }) {
  const [rows, setRows] = useState<PointGridRow[]>([]);
  const [customers, setCustomers] = useState<PmCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const { showSuccess, showError, AlertComponent } = useModalAlert();

  const [status, setStatus] = useState("");
  const [custId, setCustId] = useState<number | undefined>();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editPoint, setEditPoint] = useState<PointGridRow | null>(null);   // Edit modal (Queue points only)

  const filter = useMemo(() => ({
    status: status || "All", custId, from: from || undefined, to: to || undefined,
    // Everyone sees only the points THEY added (ReportedBy = them) — admin alone sees everyone's.
    reportedBy: isAdmin ? undefined : tmsUserId,
  }), [status, custId, from, to, isAdmin, tmsUserId]);

  const load = useCallback(() => {
    setLoading(true);
    pmApi.points(filter).then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { pmApi.customers().then(setCustomers).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const drawer = usePointDrawer(load);   // "View" opens the point detail drawer
  usePointIdFromUrl(drawer.open);

  const closePoint = useCallback(async (r: PointGridRow) => {
    if (r.status === "Closed") { showError("Already closed", `Point #${r.pointID} is already closed.`); return; }
    if (!window.confirm(`Close point #${r.pointID}?`)) return;
    try {
      const res = await pmApi.closePoint(r.pointID);
      if (res.ok) { showSuccess("Point closed", `Point #${r.pointID} has been closed.`, 2500); load(); }
      else showError("Could not close", res.message || "Unknown error.");
    } catch (e) { showError("Could not close", String(e)); }
  }, [showSuccess, showError, load]);

  // Delete — soft-delete, only for Queue-status points (backend enforces this too).
  const deletePoint = useCallback(async (r: PointGridRow) => {
    if (!window.confirm(`Delete point #${r.pointID}? This can only be done while it is in Queue.`)) return;
    try {
      const res = await pmApi.deletePoint(r.pointID);
      if (res.ok) { showSuccess("Point deleted", `Point #${r.pointID} has been deleted.`, 2500); load(); }
      else showError("Could not delete", res.message || "Unknown error.");
    } catch (e) { showError("Could not delete", String(e)); }
  }, [showSuccess, showError, load]);

  // "Send To → Tracker": mirror of the client Tracker's "Send To → Point" button, reversed —
  // creates (or, if already linked, just reports) a Change Request for this point under the
  // matching client. Backend is duplicate-safe (one point → at most one Change Request).
  const sendToTracker = useCallback(async (r: PointGridRow) => {
    try {
      const res = await pmApi.sendToTracker(r.pointID);
      if (res.success) {
        showSuccess(
          res.alreadyLinked ? "Already in Tracker" : "Sent to Tracker",
          res.alreadyLinked
            ? `Point #${r.pointID} is already linked to Change Request #${res.crId} (client ${res.clientCode}).`
            : `Point #${r.pointID} added to the client Tracker — Change Request #${res.crId} (client ${res.clientCode}).`,
          3500
        );
        // Flip the row to its "already sent" (✓) state immediately, no full reload needed.
        setRows((prev) => prev.map((p) => p.pointID === r.pointID ? { ...p, trackerChangeRequestId: res.crId ?? p.trackerChangeRequestId } : p));
      } else {
        showError("Could not send to Tracker", res.message || "Unknown error.");
      }
    } catch (e) { showError("Could not send to Tracker", String(e)); }
  }, [showSuccess, showError]);

  const columns = useMemo<ColumnDef<PointGridRow>[]>(() => [
    ...managePointColumns(),
    {
      // Send To → Tracker gets its own column (✓ once linked).
      id: "sendtracker", header: "Send to Tracker", enableSorting: false, enableHiding: false, size: 120,
      cell: ({ row }) => (
        <div style={{ display: "flex", justifyContent: "center" }}>
          {row.original.trackerChangeRequestId
            ? (
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, color: "#1e7e46" }}><Check size={16} /></span>
              </TooltipTrigger><TooltipContent>{`Already sent to Tracker — Change Request #${row.original.trackerChangeRequestId}`}</TooltipContent></Tooltip></TooltipProvider>
            )
            : <IconAction icon={Send} label="Send to Tracker" tone="send" onClick={() => sendToTracker(row.original)} />}
        </div>
      ),
    },
    {
      // View always. Edit + Delete only for Queue points. Close hidden once Closed (view-only).
      id: "actions", header: "Action", enableSorting: false, enableHiding: false, size: 150,
      cell: ({ row }) => {
        const r = row.original;
        const isQueue = r.status === "Queue";
        const isClosed = r.status === "Closed";
        return (
          <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
            <IconAction icon={Eye} label="View" tone="view" onClick={() => drawer.open(r.pointID)} />
            {isQueue && <IconAction icon={Edit} label="Edit" tone="edit" onClick={() => setEditPoint(r)} />}
            {isQueue && <IconAction icon={Trash2} label="Delete" tone="delete" onClick={() => deletePoint(r)} />}
            {!isClosed && <IconAction icon={XCircle} label="Close" tone="close" onClick={() => closePoint(r)} />}
          </div>
        );
      },
    },
  ], [drawer, closePoint, deletePoint, sendToTracker]);

  return (
    <Page>
      <PmHeader page="manage-points" />
      {err && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err}</small></div>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <div style={{ width: 200 }}>
          <Dropdown value={status} onValueChange={(v) => setStatus(String(v))}
            options={[{ value: "", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: s }))]} searchable size="md" />
        </div>
        <div style={{ width: 200 }}>
          <Dropdown value={custId != null ? String(custId) : ""} onValueChange={(v) => setCustId(v ? Number(v) : undefined)}
            options={[{ value: "", label: "All customers" }, ...customers.map((c) => ({ value: String(c.customerID), label: c.companyName }))]} searchable size="md" />
        </div>
        <label style={lblStyle}>From <DateField value={from} onChange={setFrom} style={{ width: 150 }} /></label>
        <label style={lblStyle}>To <DateField value={to} onChange={setTo} style={{ width: 150 }} /></label>
        {(status || custId || from || to) && (
          <button style={clearBtnStyle} onClick={() => { setStatus(""); setCustId(undefined); setFrom(""); setTo(""); }}>Clear</button>
        )}
      </div>

      {loading ? <BrandedLoader size="md" text="Loading points…" /> : (
        <DataGrid
          title={`${rows.length} point(s)`}
          data={rows} columns={columns}
          getRowId={(r) => String(r.pointID)}
          mainColumns="description"
          rightFrozenColumns={["sendtracker", "actions"]}
          {...gridFeatures}
        />
      )}

      <PointDrawer drawer={drawer} actions={null} uploaderId={tmsUserId} />
      <PointEditModal
        open={editPoint !== null}
        point={editPoint}
        onClose={() => setEditPoint(null)}
        onSaved={(m) => { showSuccess("Point updated", m, 2500); load(); }}
        onError={(m) => showError("Could not update", m)}
      />
      <AlertComponent />
    </Page>
  );
}

export default function Page_() {
  const { ctx } = usePmContext();
  const isAdmin = (ctx?.tmsRole ?? "").toLowerCase() === "admin";
  return (
    <PmGuard module="/point-management/manage-points">
      {ctx ? <ManagePoints tmsUserId={ctx.tmsUserId} isAdmin={isAdmin} /> : null}
    </PmGuard>
  );
}
