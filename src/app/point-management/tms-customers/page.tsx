"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Page, Button, Badge, StandardModal, Input } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import { Plus, Pencil, Power } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { gridFeatures, PmHeader } from "../shared";
import { pmApi, type PmCustomer, type TmsCustomerSave } from "@/lib/tms";

const empty: TmsCustomerSave = { customerID: 0, customerName: "", companyName: "", contactPerson: "", contactEmail: "", contactPhone: "", isActive: true };

function ManageCustomers() {
  const [rows, setRows] = useState<PmCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<TmsCustomerSave | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    pmApi.adminCustomers().then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);

  async function save() {
    if (!form) return;
    setBusy(true);
    try { await pmApi.saveCustomer(form); setForm(null); reload(); }
    catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }
  async function toggleActive(c: PmCustomer) {
    setBusy(true);
    try { await pmApi.setCustomerActive(c.customerID, !c.isActive); reload(); }
    catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  const columns = useMemo<ColumnDef<PmCustomer>[]>(() => [
    { accessorKey: "companyName", header: "Company" },
    { accessorKey: "customerName", header: "Customer" },
    { accessorKey: "contactPerson", header: "Contact", cell: ({ row }) => row.original.contactPerson ?? "—" },
    { accessorKey: "contactEmail", header: "Email", cell: ({ row }) => row.original.contactEmail ?? "—" },
    { accessorKey: "contactPhone", header: "Phone", cell: ({ row }) => row.original.contactPhone ?? "—" },
    { accessorKey: "isActive", header: "Status", cell: ({ row }) => <Badge variant={row.original.isActive ? "success" : "secondary"}>{row.original.isActive ? "Active" : "Inactive"}</Badge> },
    {
      id: "actions", header: "Actions",
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          <Button size="sm" variant="action-edit" icon={Pencil} disabled={busy}
            onClick={() => setForm({ customerID: row.original.customerID, customerName: row.original.customerName, companyName: row.original.companyName, contactPerson: row.original.contactPerson ?? "", contactEmail: row.original.contactEmail ?? "", contactPhone: row.original.contactPhone ?? "", isActive: row.original.isActive })}>
            Edit
          </Button>
          <Button size="sm" variant={row.original.isActive ? "action-delete" : "action-save"} icon={Power} disabled={busy} onClick={() => toggleActive(row.original)}>
            {row.original.isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busy]);

  if (loading) return <BrandedLoader size="lg" text="Loading customers…" />;

  return (
    <Page>
      <PmHeader page="tms-customers" />
      {err && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err}</small></div>}
      <div style={{ marginBottom: 14 }}>
        <Button onClick={() => setForm({ ...empty })}><Plus size={15} style={{ marginRight: 6 }} /> Add Customer</Button>
      </div>
      <DataGrid title={`${rows.length} customer(s)`} data={rows} columns={columns} getRowId={(r) => String(r.customerID)}
        mainColumns="companyName" {...gridFeatures} />

      <StandardModal isOpen={!!form} onClose={() => setForm(null)} title={form?.customerID ? "Edit Customer" : "Add Customer"} size="md" className="pm-modal-center"
        showFooter saveLabel="Save" onSave={save} onCancel={() => setForm(null)} saving={busy}>
        {form && (
          <div style={{ display: "grid", gap: 12 }}>
            <Fld label="Company name *"><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Fld>
            <Fld label="Customer name"><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></Fld>
            <Fld label="Contact person"><Input value={form.contactPerson ?? ""} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></Fld>
            <Fld label="Contact email"><Input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={form.contactEmail ?? ""} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Fld>
            <Fld label="Contact phone"><Input type="tel" inputMode="tel" value={form.contactPhone ?? ""} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Fld>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
            </label>
          </div>
        )}
      </StandardModal>
    </Page>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 12, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", fontWeight: 600, marginBottom: 5 }}>{label}</div>{children}</div>;
}

export default function Page_() {
  return <PmGuard module="/point-management/tms-customers"><ManageCustomers /></PmGuard>;
}
