"use client";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Page, Button, StandardModal, Textarea, useModalAlert } from "indas-ui";
import { DataGrid } from "@/components/datagrid";
import { Check, X, RotateCcw, Eye } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { gridFeatures, PmHeader, managePointColumns } from "../shared";
import { usePointDrawer, PointDrawer } from "../PointDrawer";
import { pmApi, type PointGridRow } from "@/lib/tms";

function VerifyTickets({ tmsUserId }: { tmsUserId: number }) {
  const [tab, setTab] = useState<0 | 2>(0); // 0 = Active (pending), 2 = Un-Active
  const [rows, setRows] = useState<PointGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const [rejectFor, setRejectFor] = useState<PointGridRow | null>(null);
  const [remark, setRemark] = useState("");
  const { showSuccess, showError, AlertComponent } = useModalAlert();

  function reload() {
    setLoading(true);
    pmApi.verificationQueue(tab).then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }
  useEffect(reload, [tab]);
  const drawer = usePointDrawer(reload);

  async function verify(id: number) {
    setBusy(id);
    try {
      await pmApi.markVerified(id);
      setRows((r) => r.filter((x) => x.pointID !== id));
      showSuccess("Verified", `Ticket #${id} has been verified and approved for assignment.`, 3000);
    } catch (e) { showError("Verify failed", String(e)); }
    finally { setBusy(null); }
  }
  async function confirmReject() {
    if (!rejectFor) return;
    const id = rejectFor.pointID;
    setBusy(id);
    try {
      await pmApi.markUnActive(id, remark.trim());
      setRows((r) => r.filter((x) => x.pointID !== id));
      setRejectFor(null); setRemark("");
      showSuccess("Rejected", `Ticket #${id} has been rejected (marked un-active).`, 3000);
    } catch (e) { showError("Reject failed", String(e)); }
    finally { setBusy(null); }
  }
  // Undo an accidental Un-Active — move the point back to the Active (pending verification) queue.
  async function reactivate(id: number) {
    setBusy(id);
    try {
      await pmApi.reactivate(id);
      setRows((r) => r.filter((x) => x.pointID !== id));
      showSuccess("Activated", `Ticket #${id} moved back to Active (pending verification).`, 3000);
    } catch (e) { showError("Activate failed", String(e)); }
    finally { setBusy(null); }
  }

  const columns = useMemo<ColumnDef<PointGridRow>[]>(() => {
    // Same columns as Manage Points…
    const base = managePointColumns();
    // …plus a frozen Verify / Reject action column (Active tab only).
    if (tab === 0) {
      base.push({
        id: "actions", header: "Actions", enableSorting: false, enableHiding: false, size: 270,
        cell: ({ row }) => (
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            <Button size="sm" variant="outline" icon={Eye} onClick={() => drawer.open(row.original.pointID)}>View</Button>
            <Button size="sm" variant="action-save" icon={Check} onClick={() => verify(row.original.pointID)} disabled={busy === row.original.pointID}>
              Verify
            </Button>
            <Button size="sm" variant="action-delete" icon={X} onClick={() => { setRejectFor(row.original); setRemark(""); }} disabled={busy === row.original.pointID}>
              Reject
            </Button>
          </div>
        ),
      });
    } else if (tab === 2) {
      // Un-Active tab: show the reject Reason (AdminRemark), and let an accidental un-active be restored.
      base.push({
        accessorKey: "adminRemark", header: "Reason", size: 260,
        cell: ({ row }) => { const v = (row.original.adminRemark ?? "").trim(); return v ? v : "—"; },
      });
      base.push({
        id: "actions", header: "Actions", enableSorting: false, enableHiding: false, size: 220,
        cell: ({ row }) => (
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            <Button size="sm" variant="outline" icon={Eye} onClick={() => drawer.open(row.original.pointID)}>View</Button>
            <Button size="sm" variant="action-save" icon={RotateCcw} onClick={() => reactivate(row.original.pointID)} disabled={busy === row.original.pointID}>
              Activate
            </Button>
          </div>
        ),
      });
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, busy]);

  return (
    <Page>
      <PmHeader page="verify" />
      {err && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err}</small></div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {([[0, "Active"], [2, "Un-Active"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ padding: "8px 18px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 700,
              border: "1px solid " + (tab === v ? "rgb(var(--color-primary))" : "#d8dee9"), background: tab === v ? "rgb(var(--color-primary))" : "transparent", color: tab === v ? "#fff" : "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      <DataGrid
        title={`${rows.length} point(s)`}
        data={rows} columns={columns} loading={loading}
        getRowId={(r) => String(r.pointID)}
        mainColumns="description"
        rightFrozenColumns={["actions"]}
        {...gridFeatures}
      />

      <StandardModal
        isOpen={!!rejectFor}
        onClose={() => setRejectFor(null)}
        title="Reject / Mark Un-Active"
        className="pm-modal-center"
        subtitle={rejectFor ? `#${rejectFor.pointID}${rejectFor.customerName ? ` — ${rejectFor.customerName}` : ""}` : ""}
        size="md"
        showFooter
        saveLabel="Confirm Reject"
        onSave={confirmReject}
        onCancel={() => setRejectFor(null)}
        saving={busy === rejectFor?.pointID}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.6, marginBottom: 6 }}>Admin remark (reason)</div>
        <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={4} placeholder="Why is this being rejected?" />
      </StandardModal>

      <PointDrawer drawer={drawer} actions={null} uploaderId={tmsUserId} />
      <AlertComponent />
    </Page>
  );
}

export default function Page_() {
  const { ctx } = usePmContext();
  return <PmGuard module="/point-management/verify">{ctx ? <VerifyTickets tmsUserId={ctx.tmsUserId} /> : null}</PmGuard>;
}
