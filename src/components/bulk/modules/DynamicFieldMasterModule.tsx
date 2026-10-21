"use client";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Button, useModalAlert } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Boxes, Layers, Save, Loader2, CheckSquare } from "lucide-react";
import KDropdown from "@/components/KDropdown";
import { DataGrid } from "@/components/datagrid";
import { BulkCompactContext, type BulkClientContext } from "@/components/bulk/BulkModuleShell";
import {
  dynamicFieldMasterApi, FIELD_MASTER_TYPES,
  type FieldMasterType, type FieldSubModule, type FieldComparison,
} from "@/lib/dynamicFieldMaster";

const labelStyle = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))", marginBottom: 6 } as const;

/**
 * Dynamic Field Master — pick a Module (Item/Ledger/Tool) + a Sub Module (that master's group); the grid
 * lists that group's fields from the shared Source DB, pre-ticking the ones already present (not
 * soft-deleted) in the picked client's DB. Tick/untick + Save copies the chosen fields Source → client.
 */
export default function DynamicFieldMasterModule({ client }: { client: BulkClientContext }) {
  const { compact, setHasData } = useContext(BulkCompactContext);
  const { showSuccess, showError, AlertComponent } = useModalAlert();

  const [type, setType] = useState<FieldMasterType | "">("");
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState<FieldSubModule[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [rows, setRows] = useState<FieldComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sub Modules (groups) for the chosen master.
  useEffect(() => {
    setGroupId(""); setGroups([]); setRows([]);
    if (!type) return;
    setLoadingGroups(true);
    dynamicFieldMasterApi.subModules(type, client.companyUserId)
      .then(setGroups)
      .catch((e) => showError("Load failed", e instanceof Error ? e.message : "Failed to load sub modules."))
      .finally(() => setLoadingGroups(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, client.companyUserId]);

  // Fields for the chosen group (Source vs client).
  useEffect(() => {
    setRows([]);
    if (!type || !groupId) return;
    setLoading(true);
    dynamicFieldMasterApi.comparison(type as FieldMasterType, Number(groupId), client.companyUserId)
      .then(setRows)
      .catch((e) => showError("Load failed", e instanceof Error ? e.message : "Failed to load fields."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, groupId, client.companyUserId]);

  // Tell the shell when data is on screen → it auto-collapses the Product/Client picker.
  useEffect(() => { setHasData(rows.length > 0); }, [rows.length, setHasData]);

  const groupOptions = useMemo(() => groups.map((g) => ({ value: String(g.groupId), label: g.groupName })), [groups]);
  const selectedCount = useMemo(() => rows.filter((r) => r.status).length, [rows]);
  const allChecked = rows.length > 0 && rows.every((r) => r.status);

  const toggleRow = useCallback((fieldId: number) =>
    setRows((prev) => prev.map((r) => (r.fieldId === fieldId ? { ...r, status: !r.status } : r))), []);
  const toggleAll = () => { const next = !allChecked; setRows((prev) => prev.map((r) => ({ ...r, status: next }))); };

  const save = async () => {
    if (!type || !groupId || !rows.length) return;
    setSaving(true);
    try {
      await dynamicFieldMasterApi.sync(type as FieldMasterType, Number(groupId), rows, client.companyUserId);
      const fresh = await dynamicFieldMasterApi.comparison(type as FieldMasterType, Number(groupId), client.companyUserId);
      setRows(fresh);
      showSuccess("Saved successfully", `${selectedCount} field${selectedCount === 1 ? "" : "s"} synced to ${client.companyName}.`, 4000);
    } catch (e) {
      showError("Save failed", e instanceof Error ? e.message : "Could not sync fields. Please try again.");
    } finally { setSaving(false); }
  };

  const columns = useMemo<ColumnDef<FieldComparison>[]>(() => [
    {
      id: "sel", header: "", size: 48, enableSorting: false, enableColumnFilter: false,
      cell: ({ row }) => (
        <input type="checkbox" checked={row.original.status} onChange={() => toggleRow(row.original.fieldId)}
          style={{ width: 16, height: 16, cursor: "pointer" }} />
      ),
    },
    { accessorKey: "fieldName", header: "Field Name" },
    { accessorKey: "fieldDisplayName", header: "Display Name" },
    { accessorKey: "fieldDataType", header: "Data Type" },
    { accessorKey: "fieldType", header: "Field Type" },
    {
      accessorKey: "existsInClient", header: "In Client", enableColumnFilter: false,
      cell: ({ row }) => {
        const r = row.original;
        return r.existsInClient && !r.isDeletedInClient
          ? <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>✓ Present</span>
          : r.existsInClient && r.isDeletedInClient
            ? <span style={{ fontSize: 12, fontWeight: 600, color: "#d97706" }}>Deleted</span>
            : <span style={{ fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))" }}>○ Not in client</span>;
      },
    },
  ], [toggleRow]);

  const ready = !!type && !!groupId;

  return (
    <div style={{ width: "100%" }}>
      <AlertComponent />

      {/* Module + Sub Module pickers — collapse into a thin info bar once fields are on screen. No "Change"
          button here: the shell's single "Change" (which shares this same `compact` flag) re-expands both. */}
      {compact && ready ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14, padding: "8px 14px", border: "1px solid rgb(var(--border-default))", borderRadius: 10, background: "rgb(var(--bg-subtle))" }}>
          <Layers size={15} style={{ color: "rgb(var(--fg-muted))" }} />
          <span style={{ fontSize: 13, color: "rgb(var(--fg-muted))" }}>Module <b style={{ color: "rgb(var(--fg-default))" }}>{FIELD_MASTER_TYPES.find((t) => t.value === type)?.label}</b></span>
          <span style={{ color: "rgb(var(--fg-muted))" }}>·</span>
          <span style={{ fontSize: 13, color: "rgb(var(--fg-muted))" }}>Sub Module <b style={{ color: "rgb(var(--fg-default))" }}>{groupOptions.find((g) => g.value === groupId)?.label}</b></span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 18, justifyContent: "center", alignItems: "flex-end" }}>
          <div style={{ minWidth: 240 }}>
            <div style={labelStyle}><Boxes size={16} /> Module Name</div>
            <KDropdown value={type} onValueChange={(v) => setType(v as FieldMasterType)} options={FIELD_MASTER_TYPES} placeholder="— Select module —" searchable size="md" />
          </div>
          <div style={{ minWidth: 280 }}>
            <div style={labelStyle}><Layers size={16} /> Sub Module</div>
            <KDropdown value={groupId} onValueChange={(v) => setGroupId(String(v))} options={groupOptions}
              placeholder={!type ? "Select a module first" : loadingGroups ? "Loading…" : groupOptions.length ? "— Select sub module —" : "No sub modules"} searchable size="md" />
          </div>
          {/* No collapse button here — the shell renders a single "Collapse selectors" control (shared `compact`). */}
        </div>
      )}

      {ready && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))" }}>
              Targeting <b style={{ color: "rgb(var(--fg-default))" }}>{client.companyName}</b>
              {" · "}<b style={{ color: "rgb(var(--color-primary))" }}>{selectedCount}</b> of {rows.length} field{rows.length === 1 ? "" : "s"} selected
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Button size="sm" variant="action-secondary" icon={CheckSquare} onClick={toggleAll} disabled={loading || !rows.length}>{allChecked ? "Uncheck All" : "Check All"}</Button>
              <Button size="sm" variant="action-save" icon={saving ? Loader2 : Save} onClick={save} disabled={saving || loading || !rows.length}>{saving ? "Saving…" : "Save to Client"}</Button>
            </div>
          </div>

          {rows.length ? (
            <DataGrid<FieldComparison>
              data={rows} columns={columns} getRowId={(r) => String(r.fieldId)}
              title={`${rows.length} field${rows.length === 1 ? "" : "s"}`} loading={loading} mainColumns="fieldName"
              enableColumnResizing enableSorting enableSearch enablePagination enableExport enableFilterRow
            />
          ) : (
            <div style={{ padding: "36px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
              {loading ? "Loading fields…" : "No fields in this sub module."}
            </div>
          )}
        </>
      )}
    </div>
  );
}
