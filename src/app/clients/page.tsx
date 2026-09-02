"use client";
import { useEffect, useMemo, useState } from "react";
import { Page } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import type { ColumnDef } from "@tanstack/react-table";
import { FolderPlus, FolderKanban } from "lucide-react";
// Full-featured grid (same one used on /users).
import { DataGrid, createActionsColumn } from "@/components/datagrid";
import { customersApi, fmtDate, type CustomerCard } from "@/lib/customers";
import ProvisioningWizard from "@/app/customers/ProvisioningWizard";
import DeleteCustomerModal from "@/app/customers/DeleteCustomerModal";
import ClientDetailModal from "./ClientDetailModal";
import { useSession } from "next-auth/react";
import { fetchMyModulePerms } from "@/lib/myPermissions";

const APP_LABEL: Record<string, string> = { estimoprime: "Estimoprime", multiunit: "MultiUnit", printudeerp: "PrintudeERP", desktop: "Desktop" };
const appLabel = (a?: string | null) => (a ? APP_LABEL[a.toLowerCase()] ?? a : "—");
const dash = (v?: string | null) => (v && String(v).trim() ? v : "—");
// Colored status pill: Active = green, Expired/Suspended = red, else neutral.
function statusPill(s?: string | null) {
  if (!s || !String(s).trim()) return <div style={{ textAlign: "center", color: "rgb(var(--fg-subtle))" }}>—</div>;
  const low = s.toLowerCase();
  const c = low === "active"
    ? { bg: "#e6f6ec", fg: "#1c8a4a", bd: "#b7e2c6" }
    : (low === "expired" || low === "suspended")
      ? { bg: "#fdecec", fg: "#c0392b", bd: "#f4c9c9" }
      : { bg: "#eef1f6", fg: "#5b6b7f", bd: "#dbe2ea" };
  return <div style={{ textAlign: "center" }}><span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 700, padding: "3px 11px", borderRadius: 999, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, whiteSpace: "nowrap" }}>{s}</span></div>;
}

export default function ClientsPage() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rows, setRows] = useState<CustomerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<CustomerCard | null>(null);
  // "Create Client Project" is authority-gated by the "Clients" module's CanSave permission
  // (User Management → Module Authority). Fail-open (true) until we know, so a transient error
  // never hides it for a legitimate user.
  const { data: session } = useSession();
  const [canCreate, setCanCreate] = useState(true);

  const reload = () => customersApi.list().then(setRows).catch((e) => setErr(String(e)));
  useEffect(() => {
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  // Gate the Create button on the acting user's CanSave for the "Clients" module.
  useEffect(() => {
    const uid = (session?.user as { UserID?: number } | undefined)?.UserID;
    if (!uid) return;
    fetchMyModulePerms(uid)
      .then((perms) => { const c = perms["/clients"]; if (c) setCanCreate(c.canSave); })
      .catch(() => { /* keep fail-open default */ });
  }, [session]);

  // Collapse exact-duplicate rows (same id + code + app) from the control DB.
  const data = useMemo(() => {
    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = `${r.companyUserID}|${r.companyUniqueCode ?? ""}|${(r.applicationName ?? "").toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [rows]);

  const openDetail = (c: CustomerCard) => setDetailId(c.companyUserID);

  const columns = useMemo<ColumnDef<CustomerCard>[]>(() => [
    { accessorKey: "companyUniqueCode", header: "Client Code", size: 120, meta: { inputType: "text" }, cell: ({ row }) => <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{dash(row.original.companyUniqueCode)}</span> },
    { accessorKey: "companyName", header: "Client Name", size: 220, meta: { inputType: "text" }, cell: ({ row }) => <span style={{ fontWeight: 700, color: "rgb(var(--fg-default))" }}>{dash(row.original.companyName)}</span> },
    { id: "application", accessorFn: (c) => appLabel(c.applicationName), header: "Application", size: 130, meta: { inputType: "text" } },
    { accessorKey: "address", header: "Client Address", size: 200, meta: { inputType: "text" }, cell: ({ row }) => dash(row.original.address) },
    { accessorKey: "companyCode", header: "Company Code", size: 130, meta: { inputType: "text" }, cell: ({ row }) => dash(row.original.companyCode) },
    { accessorKey: "companyUserID", header: "Company Login Name", size: 180, meta: { inputType: "text" }, cell: ({ row }) => <span style={{ fontFamily: "monospace" }}>{dash(row.original.companyUserID)}</span> },
    { accessorKey: "mobile", header: "Mobile No", size: 130, meta: { inputType: "text" }, cell: ({ row }) => dash(row.original.mobile) },
    { accessorKey: "email", header: "Email", size: 220, meta: { inputType: "text" }, cell: ({ row }) => <span style={{ color: "rgb(var(--fg-muted))" }}>{dash(row.original.email)}</span> },
    { id: "erpStatus", accessorFn: (c) => c.subscriptionStatus ?? "", header: "ERP Status", size: 175, minSize: 165, meta: { inputType: "text" }, cell: ({ row }) => statusPill(row.original.subscriptionStatus) },
    { id: "cloudStatus", accessorFn: (c) => c.cloudSubscriptionStatus ?? "", header: "Cloud Status", size: 175, minSize: 165, meta: { inputType: "text" }, cell: ({ row }) => statusPill(row.original.cloudSubscriptionStatus) },
    { ...createActionsColumn<CustomerCard>({
      onView: openDetail,
      onEdit: openDetail,
      onDelete: (c) => setDelTarget(c),
      showView: true, showEdit: true, showDelete: true,
      mode: "buttons", primaryActions: ["view", "edit", "delete"],
    }), size: 96, minSize: 96 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  if (loading) return <BrandedLoader size="lg" text="Loading clients…" />;

  return (
    <Page>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 22 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "rgb(var(--color-primary))", color: "#fff", flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(31,69,118,.45)" }}>
          <FolderKanban size={24} />
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "rgb(var(--fg-default))", margin: 0, letterSpacing: 0.2 }}>Client Projects</h1>
      </div>

      {err && <div style={{ color: "#c0392b", marginBottom: 12 }}>Load error: <small>{err}</small></div>}
      {flash && <div style={{ background: "#e6f6ec", color: "#1c6b3c", border: "1px solid #b7e2c6", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>✓ {flash}</div>}

      {canCreate && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={() => setWizardOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgb(var(--color-primary))", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            <FolderPlus size={15} /> Create Client Project
          </button>
        </div>
      )}

      <div style={{ border: "1px solid #a9b6c8", borderRadius: 12, overflow: "hidden", background: "rgb(var(--bg-surface))", boxShadow: "0 1px 3px rgba(16,24,40,.08), 0 8px 24px -18px rgba(16,24,40,.25)" }}>
      <DataGrid<CustomerCard>
        data={data}
        columns={columns}
        getRowId={(r) => `${r.companyUserID}|${r.companyUniqueCode ?? ""}|${(r.applicationName ?? "").toLowerCase()}`}
        title="Clients"
        persistKey="clients-grid-v2"
        mainColumns="companyName"
        onRowClick={openDetail}   // grid fires this on row double-click → open the detail page
        enableRowSelection
        rowSelectionMode="single"
        rightFrozenColumns={["erpStatus", "cloudStatus"]}
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
      />
      </div>

      <ProvisioningWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onDone={() => { setWizardOpen(false); setFlash("Client project created successfully."); reload(); }}
      />
      <DeleteCustomerModal
        target={delTarget}
        isOpen={!!delTarget}
        onClose={() => setDelTarget(null)}
        onDeleted={(msg) => { setDelTarget(null); setFlash(msg); reload(); }}
      />
      <ClientDetailModal id={detailId} isOpen={!!detailId} onClose={() => setDetailId(null)} onChanged={reload} />
    </Page>
  );
}
