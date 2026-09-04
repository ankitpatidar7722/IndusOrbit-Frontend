"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Page, Button, Badge, StandardModal, Dropdown, useModalAlert } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import { UserCog, XCircle } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { gridFeatures, PmHeader } from "../shared";
import { pmApi, statusVariant, priorityVariant, fmtDate, type AssignmentRow, type PmUser } from "@/lib/tms";

const dash = (v?: string | null) => (v && String(v).trim() ? v : "—");

function ManageAssignments({ tmsUserId }: { tmsUserId: number }) {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [devs, setDevs] = useState<PmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showSuccess, showError, AlertComponent } = useModalAlert();

  const [reassignFor, setReassignFor] = useState<AssignmentRow | null>(null);
  const [newDev, setNewDev] = useState<number | "">("");

  const reload = useCallback(() => {
    setLoading(true);
    pmApi.assignments().then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { reload(); pmApi.users("Developer").then(setDevs).catch(() => {}); }, [reload]);

  async function doReassign() {
    if (!reassignFor || !reassignFor.ticketID || !newDev) return;
    setBusy(true);
    const devName = devs.find((d) => d.userID === newDev)?.fullName ?? "";
    const pointId = reassignFor.pointID;
    try {
      await pmApi.reassignTicket(reassignFor.ticketID, Number(newDev), tmsUserId);
      setReassignFor(null); setNewDev("");
      showSuccess("Reassigned", `Point #${pointId} reassigned to ${devName}.`, 2500);
      reload();
    } catch (e) { showError("Could not reassign", String(e)); }
    finally { setBusy(false); }
  }
  async function doClose(r: AssignmentRow) {
    if (!confirm(`Close point #${r.pointID}?`)) return;
    setBusy(true);
    try {
      const res = await pmApi.closePoint(r.pointID);
      if (res.ok) { showSuccess("Point closed", `Point #${r.pointID} has been closed.`, 2500); reload(); }
      else showError("Could not close", res.message || "Unknown error.");
    } catch (e) { showError("Could not close", String(e)); }
    finally { setBusy(false); }
  }

  const columns = useMemo<ColumnDef<AssignmentRow>[]>(() => [
    { accessorKey: "pointID", header: "Ticket ID", size: 90 },
    { accessorKey: "assignedToName", header: "Assign To", size: 150, cell: ({ row }) => dash(row.original.assignedToName) },
    { accessorKey: "assignedByName", header: "Assign By", size: 150, cell: ({ row }) => dash(row.original.assignedByName) },
    { accessorKey: "assignDate", header: "Assign Date", size: 150, cell: ({ row }) => fmtDate(row.original.assignDate) },
    { accessorKey: "reportedByName", header: "Reported By", size: 150, cell: ({ row }) => dash(row.original.reportedByName) },
    { accessorKey: "status", header: "Status", size: 130, cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
    { accessorKey: "priority", header: "Priority", size: 110, cell: ({ row }) => <Badge variant={priorityVariant(row.original.priority)}>{row.original.priority}</Badge> },
    { accessorKey: "description", header: "Description", size: 260, cell: ({ row }) => dash(row.original.description) },
    { accessorKey: "customerName", header: "Customer", size: 160, cell: ({ row }) => dash(row.original.customerName) },
    { accessorKey: "productName", header: "Product", size: 150, cell: ({ row }) => dash(row.original.productName) },
    { accessorKey: "module", header: "Module", size: 150, cell: ({ row }) => dash(row.original.module) },
    { accessorKey: "subModule", header: "Sub Module", size: 160, cell: ({ row }) => dash(row.original.subModule) },
    {
      id: "actions", header: "Action", enableSorting: false, enableHiding: false, size: 240,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          <Button size="sm" variant="action-edit" icon={UserCog} onClick={() => { setReassignFor(row.original); setNewDev(""); }} disabled={busy}>
            Reassign
          </Button>
          <Button size="sm" variant="action-delete" icon={XCircle} onClick={() => doClose(row.original)} disabled={busy || row.original.status === "Closed"}>
            Close
          </Button>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busy, devs]);

  if (loading) return <BrandedLoader size="lg" text="Loading assignments…" />;

  return (
    <Page>
      <PmHeader page="manage-assignments" />
      {err && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err}</small></div>}
      <DataGrid title={`${rows.length} point(s)`} data={rows} columns={columns} getRowId={(r) => String(r.pointID)}
        mainColumns="assignedToName" rightFrozenColumns={["actions"]} {...gridFeatures} />

      <StandardModal
        isOpen={!!reassignFor}
        onClose={() => setReassignFor(null)}
        title="Reassign Point"
        className="pm-modal-center"
        subtitle={reassignFor ? `#${reassignFor.pointID} — currently ${reassignFor.assignedToName ?? "—"}` : ""}
        size="sm"
        showFooter saveLabel="Reassign" onSave={doReassign} onCancel={() => setReassignFor(null)} saving={busy}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.6, marginBottom: 6 }}>New developer</div>
        <Dropdown value={newDev ? String(newDev) : ""} onValueChange={(v) => setNewDev(v ? Number(v) : "")}
          options={[{ value: "", label: "— Select developer —" }, ...devs.map((d) => ({ value: String(d.userID), label: d.fullName }))]}
          placeholder="— Select developer —" searchable size="md" />
      </StandardModal>
      <AlertComponent />
    </Page>
  );
}

export default function Page_() {
  const { ctx } = usePmContext();
  return (
    <PmGuard module="/point-management/manage-assignments">
      {ctx ? <ManageAssignments tmsUserId={ctx.tmsUserId} /> : null}
    </PmGuard>
  );
}
