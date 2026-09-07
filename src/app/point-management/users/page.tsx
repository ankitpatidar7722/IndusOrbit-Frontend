"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Page, Button, Badge, StandardModal, Input, Dropdown } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import { Plus, Pencil, Power } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { gridFeatures, PmHeader } from "../shared";
import { pmApi, type PmUser, type TmsUserSave } from "@/lib/tms";

const ROLES = ["admin", "developer", "tester", "Support", "Marketing"];
const empty: TmsUserSave = { userID: 0, fullName: "", email: "", password: "", role: "developer", whatsAppNumber: "", isActive: true };

function ManageUsers() {
  const [rows, setRows] = useState<PmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<TmsUserSave | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    pmApi.adminUsers().then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);

  async function save() {
    if (!form) return;
    setBusy(true);
    try { await pmApi.saveUser(form); setForm(null); reload(); }
    catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }
  async function toggleActive(u: PmUser) {
    setBusy(true);
    try { await pmApi.setUserActive(u.userID, !u.isActive); reload(); }
    catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  const columns = useMemo<ColumnDef<PmUser>[]>(() => [
    { accessorKey: "fullName", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "role", header: "Role" },
    { accessorKey: "whatsAppNumber", header: "WhatsApp", cell: ({ row }) => row.original.whatsAppNumber ?? "—" },
    { accessorKey: "isActive", header: "Status", cell: ({ row }) => <Badge variant={row.original.isActive ? "success" : "secondary"}>{row.original.isActive ? "Active" : "Inactive"}</Badge> },
    {
      id: "actions", header: "Actions",
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          <Button size="sm" variant="action-edit" icon={Pencil} disabled={busy}
            onClick={() => setForm({ userID: row.original.userID, fullName: row.original.fullName, email: row.original.email ?? "", password: "", role: row.original.role ?? "developer", whatsAppNumber: row.original.whatsAppNumber ?? "", isActive: row.original.isActive })}>
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

  if (loading) return <BrandedLoader size="lg" text="Loading users…" />;

  return (
    <Page>
      <PmHeader page="users" />
      {err && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err}</small></div>}
      <div style={{ marginBottom: 14 }}>
        <Button onClick={() => setForm({ ...empty })}><Plus size={15} style={{ marginRight: 6 }} /> Add User</Button>
      </div>
      <DataGrid title={`${rows.length} user(s)`} data={rows} columns={columns} getRowId={(r) => String(r.userID)}
        mainColumns="fullName" {...gridFeatures} />

      <StandardModal isOpen={!!form} onClose={() => setForm(null)} title={form?.userID ? "Edit User" : "Add User"} size="md" className="pm-modal-center"
        showFooter saveLabel="Save" onSave={save} onCancel={() => setForm(null)} saving={busy}>
        {form && (
          <div style={{ display: "grid", gap: 12 }}>
            <Fld label="Full name *"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Fld>
            <Fld label="Email *"><Input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Fld>
            <Fld label={form.userID ? "Password (leave blank to keep)" : "Password"}><Input type="password" value={form.password ?? ""} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Fld>
            <Fld label="Role">
              <Dropdown value={form.role} onValueChange={(v) => setForm({ ...form, role: String(v) })}
                options={ROLES.map((r) => ({ value: r, label: r }))} size="md" />
            </Fld>
            <Fld label="WhatsApp number"><Input value={form.whatsAppNumber ?? ""} onChange={(e) => setForm({ ...form, whatsAppNumber: e.target.value })} placeholder="+91…" /></Fld>
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
  return <PmGuard module="/point-management/users"><ManageUsers /></PmGuard>;
}
