"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, Button, useModalAlert, Dropdown } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, XCircle, Send, Check } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import DateField from "@/components/DateField";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { lblStyle, clearBtnStyle, gridFeatures, PmHeader, managePointColumns } from "../shared";
import { usePointDrawer, usePointIdFromUrl, PointDrawer } from "../PointDrawer";
import { pmApi, type PointGridRow, type PmCustomer } from "@/lib/tms";

const STATUSES = [
  "Queue", "Assigned", "In Progress", "DevCompleted", "PendingSupport", "SupportVerified",
  "PendingMerge", "PendingQC", "In-Testing", "Testing-Completed", "ReOpened", "Hold", "Reject", "Closed",
];

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
      id: "actions", header: "Action", enableSorting: false, enableHiding: false, size: 130,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
          <Button variant="ghost" size="xs" iconOnly icon={Eye} tooltip="View" onClick={() => drawer.open(row.original.pointID)} />
          {row.original.trackerChangeRequestId
            ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, color: "#1e7e46" }} title={`Already sent to Tracker — Change Request #${row.original.trackerChangeRequestId}`}><Check size={16} /></span>
            : <Button variant="ghost" size="xs" iconOnly icon={Send} tooltip="Send To → Tracker" onClick={() => sendToTracker(row.original)} />}
          <Button variant="ghost" size="xs" iconOnly icon={XCircle} tooltip="Close" onClick={() => closePoint(row.original)} />
        </div>
      ),
    },
  ], [drawer, closePoint, sendToTracker]);

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
          rightFrozenColumns={["actions"]}
          {...gridFeatures}
        />
      )}

      <PointDrawer drawer={drawer} actions={null} uploaderId={tmsUserId} />
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
