"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Button, Dropdown, useModalAlert, StandardModal } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGrid } from "@/components/datagrid";
import { Boxes, RefreshCw, Save, CheckSquare } from "lucide-react";
import type { BulkClientContext } from "@/components/bulk/BulkModuleShell";
import { getModuleAuthorityData, saveModuleAuthority, type ModuleAuthorityRowDto } from "@/bulk/services/api";

// "Module Authority" — Indus360-native rebuild of DynamicModule.tsx. Pick a SOURCE product
// (Estimoprime / Printude), load its module catalog, toggle each module's status, then Save to
// sync the on/off set into the picked client's DB (X-Target-Company set by BulkModuleShell).

type Row = ModuleAuthorityRowDto & { _status: boolean; _id: number };
const PRODUCTS = [{ label: "Estimoprime", value: "Estimoprime" }, { label: "Printude", value: "Printude" }];
const labelStyle = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))", marginBottom: 6 } as const;

export default function ModuleAuthorityModule({ client }: { client: BulkClientContext }) {
  const { showSuccess, showError, AlertComponent } = useModalAlert();
  const defaultProduct = (client.applicationName ?? "").toLowerCase().replace(/[^a-z]/g, "").includes("prin") ? "Printude" : "Estimoprime";
  const [product, setProduct] = useState(defaultProduct);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [saveSummary, setSaveSummary] = useState<{ inserted: number; deleted: number; maintained: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try { const d = await getModuleAuthorityData(product); setRows((d ?? []).map((r, i) => ({ ...r, _status: r.status, _id: i }))); }
    catch { showError("Load failed", "Could not load the module list for this product / client."); }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  useEffect(() => { load(); }, [load, client.companyUserId]);

  const toggleRow = useCallback((id: number) => {
    setRows((prev) => prev.map((m) => m._id === id ? { ...m, _status: !m._status } : m));
  }, []);
  const allChecked = rows.length > 0 && rows.every((m) => m._status);
  const toggleAll = useCallback(() => {
    setRows((prev) => { const all = prev.every((m) => m._status); return prev.map((m) => ({ ...m, _status: !all })); });
  }, []);

  const changeCount = useMemo(() => rows.filter((m) => m._status !== m.status).length, [rows]);
  const checkedCount = useMemo(() => rows.filter((m) => m._status).length, [rows]);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: "moduleHeadName", header: "Group" },
    { accessorKey: "moduleName", header: "Module Name" },
    { accessorKey: "moduleDisplayName", header: "Display Name" },
    {
      accessorKey: "existsInLoginDb", header: "In Client DB",
      cell: ({ row }) => row.original.existsInLoginDb
        ? <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>● In DB</span>
        : <span style={{ fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))" }}>○ Not in DB</span>,
    },
    {
      accessorKey: "_status", header: "Status",
      cell: ({ row }) => {
        const r = row.original; const changed = r._status !== r.status;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: changed ? (r._status ? "rgba(34,197,94,0.16)" : "rgba(239,68,68,0.12)") : undefined, margin: "-6px -10px", padding: "6px 10px", borderRadius: 6 }}>
            <input type="checkbox" checked={r._status} onChange={() => toggleRow(r._id)} style={{ width: 16, height: 16, cursor: "pointer" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: r._status ? "#16a34a" : "rgb(var(--fg-muted))" }}>{r._status ? "Active" : "Inactive"}</span>
            {changed && <span style={{ fontSize: 10, fontWeight: 700, color: "rgb(var(--color-primary))" }}>• changed</span>}
          </div>
        );
      },
    },
  ], [toggleRow]);

  const save = async () => {
    if (!rows.length) { showError("No data", "Nothing to save."); return; }
    setBusy(true);
    try {
      const payload = rows.map((m) => ({ moduleHeadName: m.moduleHeadName, moduleName: m.moduleName, moduleDisplayName: m.moduleDisplayName, status: m._status }));
      const res = await saveModuleAuthority(product, payload);
      setSaveSummary(res);
      showSuccess("Saved", `Synced ${res.total} module(s) for ${client.companyName}.`, 3000);
      await load();
    } catch { showError("Save failed", "Could not sync module authority. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16, justifyContent: "center" }}>
        <div style={{ minWidth: 220 }}>
          <div style={labelStyle}><Boxes size={16} /> Source Product</div>
          <Dropdown value={product} onValueChange={(v) => setProduct(String(v))} options={PRODUCTS} placeholder="— Select product —" size="md" />
        </div>
        <Button size="sm" variant="action-secondary" icon={RefreshCw} onClick={load} disabled={busy}>Reload</Button>
        <Button size="sm" variant="action-secondary" icon={CheckSquare} onClick={toggleAll} disabled={busy || !rows.length}>{allChecked ? "Uncheck All" : "Check All"}</Button>
        <Button size="sm" variant="action-save" icon={Save} onClick={save} disabled={busy || !rows.length || changeCount === 0}>Save{changeCount ? ` (${changeCount})` : ""}</Button>
      </div>

      {rows.length > 0 && (
        <div style={{ textAlign: "center", fontSize: 12, color: "rgb(var(--fg-muted))", marginBottom: 10 }}>
          {rows.length} modules · <b style={{ color: "#16a34a" }}>{checkedCount} active</b> · {changeCount > 0 ? <b style={{ color: "rgb(var(--color-primary))" }}>{changeCount} unsaved change{changeCount !== 1 ? "s" : ""}</b> : "no unsaved changes"}
        </div>
      )}

      {rows.length ? (
        <DataGrid<Row>
          data={rows} columns={columns} getRowId={(r) => String(r._id)} title={`Module Authority · ${product}`} loading={busy}
          enableColumnResizing enableSorting enableSearch enablePagination enableExport
        />
      ) : (
        <div style={{ padding: "36px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          {busy ? "Loading modules…" : "No modules found. Pick a Source Product and click Reload."}
        </div>
      )}

      {saveSummary && (
        <StandardModal isOpen title="Sync Complete" onClose={() => setSaveSummary(null)} size="sm">
          <div style={{ padding: 8, fontSize: 14, lineHeight: 1.9, color: "rgb(var(--fg-default))" }}>
            <div>✅ Enabled (inserted): <b>{saveSummary.inserted}</b></div>
            <div>🗑️ Disabled (removed): <b>{saveSummary.deleted}</b></div>
            <div>↔️ Unchanged (maintained): <b>{saveSummary.maintained}</b></div>
            <div style={{ marginTop: 6, borderTop: "1px solid rgb(var(--border-default))", paddingTop: 6 }}>Total processed: <b>{saveSummary.total}</b></div>
          </div>
        </StandardModal>
      )}
      <AlertComponent />
    </div>
  );
}
