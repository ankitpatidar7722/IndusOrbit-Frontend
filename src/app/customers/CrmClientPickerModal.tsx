"use client";
import { useEffect, useMemo, useState } from "react";
import { StandardModal, Badge, Button, Tabs } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Check as CheckIcon, FileText } from "lucide-react";
import { DataGrid } from "@/components/datagrid";
import BrandedLoader from "@/components/BrandedLoader";
import { crmApi, type CrmClient } from "@/lib/crm";

const statusVariant = (s?: string | null): "success" | "warning" | "info" | "secondary" => {
  const x = (s || "").toLowerCase();
  if (x.includes("active")) return "success";
  if (x.includes("new")) return "info";
  if (x.includes("hold") || x.includes("hot")) return "warning";
  return "secondary";
};
const dash = (v?: string | null) => (v && String(v).trim() ? v : "—");

/** Picker over IndusInternalApp's CRM "Clients" list (read directly from the shared IndusAppDB —
 *  see lib/crm.ts). Check one row + "Apply" hands the picked client back to the caller (the
 *  provisioning wizard). "View" opens a read-only detail card, doesn't select. */
export default function CrmClientPickerModal({ isOpen, onClose, onPick }: {
  isOpen: boolean; onClose: () => void; onPick: (client: CrmClient) => void;
}) {
  const [rows, setRows] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<CrmClient[]>([]);
  const [viewing, setViewing] = useState<CrmClient | null>(null);
  // Pending = client's DB not created yet; Proceed = DB already created (dbStatus === "Created").
  const [tab, setTab] = useState<"pending" | "proceed">("pending");

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true); setErr(null); setSelected([]); setViewing(null); setTab("pending");
    crmApi.clients().then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, [isOpen]);

  const isCreated = (r: CrmClient) => r.dbStatus === "Created";
  const pending = useMemo(() => rows.filter((r) => !isCreated(r)), [rows]);
  const proceed = useMemo(() => rows.filter((r) => isCreated(r)), [rows]);
  const shown = tab === "proceed" ? proceed : pending;

  const columns = useMemo<ColumnDef<CrmClient>[]>(() => [
    { accessorKey: "companyName", header: "Company Name", size: 200, meta: { inputType: "text" } },
    { accessorKey: "contactPersonName", header: "Contact Name", size: 170, meta: { inputType: "text" }, cell: ({ row }) => dash(row.original.contactPersonName) },
    { accessorKey: "address", header: "Address", size: 200, meta: { inputType: "text" }, cell: ({ row }) => dash(row.original.address) },
    { accessorKey: "phoneNumber", header: "Phone", size: 140, meta: { inputType: "text" }, cell: ({ row }) => dash(row.original.phoneNumber) },
    { accessorKey: "email", header: "Email", size: 190, meta: { inputType: "text" }, cell: ({ row }) => dash(row.original.email) },
    { accessorKey: "segment", header: "Segment", size: 120, meta: { inputType: "text" }, cell: ({ row }) => dash(row.original.segment) },
    { accessorKey: "indasProduct", header: "Indus Product", size: 170, meta: { inputType: "text" }, cell: ({ row }) => dash(row.original.indasProduct) },
    { accessorKey: "assignedToName", header: "Sales Person", size: 150, meta: { inputType: "text" }, cell: ({ row }) => dash(row.original.assignedToName) },
    {
      accessorKey: "proposalDocumentName", header: "Proposal Document", size: 260, meta: { inputType: "text" },
      cell: ({ row }) => {
        const u = row.original.proposalDocumentUrl, n = row.original.proposalDocumentName;
        if (!u || !n) return <span style={{ opacity: 0.5 }}>—</span>;
        return (
          <a href={u} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#1c8a4a", fontWeight: 600, textDecoration: "none", maxWidth: "100%" }} title={n}>
            <FileText size={14} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span>
          </a>
        );
      },
    },
    {
      id: "actions", header: "Action", enableSorting: false, enableHiding: false, size: 70,
      cell: ({ row }) => <Button variant="ghost" size="xs" iconOnly icon={Eye} tooltip="View" onClick={() => setViewing(row.original)} />,
    },
  ], []);

  return (
    <StandardModal isOpen={isOpen} onClose={onClose} title="Pick a CRM Client"
      subtitle="From the internal CRM app's Clients list — check one and Apply to prefill this wizard." size="xl" className="pm-modal-center">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 320 }}>
          <Tabs
            tabs={[
              { id: "pending", label: `Pending (${pending.length})` },
              { id: "proceed", label: `Proceed (${proceed.length})` },
            ]}
            activeTab={tab}
            onTabChange={(id) => { setTab(id as "pending" | "proceed"); setSelected([]); }}
            variant="pill"
            size="sm"
          />
        </div>
        <Button disabled={selected.length !== 1} onClick={() => { if (selected[0]) { onPick(selected[0]); onClose(); } }}>
          <CheckIcon size={15} style={{ marginRight: 6 }} /> Apply
        </Button>
      </div>
      {err && <div style={{ color: "#c0392b", marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {loading ? <BrandedLoader size="md" text="Loading CRM clients…" /> : (
        <DataGrid<CrmClient>
          title=""
          data={shown} columns={columns}
          getRowId={(r) => String(r.customerID)}
          onRowSelect={setSelected}
          mainColumns="companyName"
          // Freeze Proposal Document + Action to the right (order matters — rightmost last).
          rightFrozenColumns={["proposalDocumentName", "actions"]}
          // Bounded height so the internal grid body scrolls and the pagination bar stays visible
          // inside the modal (default maxHeight is ~full-viewport, which pushed it below the clip).
          maxHeight="52vh"
          enableRowSelection
          rowSelectionMode="single"
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
          paginationPageSize={100}
          paginationPageSizeOptions={[100, 200, 500, 1000]}
        />
      )}

      {/* Read-only detail card — "View" action, doesn't select the row */}
      <StandardModal isOpen={!!viewing} onClose={() => setViewing(null)} title={viewing?.companyName ?? ""}
        subtitle={viewing?.status ? undefined : undefined} size="md" className="pm-modal-center">
        {viewing && (
          <div style={{ display: "grid", gap: 10 }}>
            {viewing.status && <div><Badge variant={statusVariant(viewing.status)}>{viewing.status}</Badge></div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Info label="Contact Name" value={viewing.contactPersonName} />
              <Info label="Phone" value={viewing.phoneNumber} />
              <Info label="Email" value={viewing.email} />
              <Info label="Segment" value={viewing.segment} />
              <Info label="Company Size" value={viewing.companySize} />
              <Info label="Indus Product" value={viewing.indasProduct} />
              <Info label="Sales Person" value={viewing.assignedToName} />
              <Info label="City" value={viewing.city} />
              <Info label="State" value={viewing.state} />
              <Info label="Country" value={viewing.country} />
              <Info label="GST No" value={viewing.gst} />
              <Info label="PAN No" value={viewing.companyPAN} />
              <Info label="Website" value={viewing.website} />
            </div>
            <Info label="Address" value={viewing.address} />
            <div style={{ background: "rgb(var(--bg-subtle))", border: "1px solid #eef1f5", borderRadius: 10, padding: "9px 12px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "rgb(var(--fg-subtle))", marginBottom: 3 }}>Proposal Document</div>
              {viewing.proposalDocumentUrl && viewing.proposalDocumentName
                ? <a href={viewing.proposalDocumentUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#1c8a4a", fontWeight: 600, textDecoration: "none" }}>
                    <FileText size={14} /> {viewing.proposalDocumentName}
                  </a>
                : <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgb(var(--fg-default))" }}>—</div>}
            </div>
          </div>
        )}
      </StandardModal>
    </StandardModal>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ background: "rgb(var(--bg-subtle))", border: "1px solid #eef1f5", borderRadius: 10, padding: "9px 12px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "rgb(var(--fg-subtle))", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgb(var(--fg-default))", wordBreak: "break-word" }}>{dash(value)}</div>
    </div>
  );
}
