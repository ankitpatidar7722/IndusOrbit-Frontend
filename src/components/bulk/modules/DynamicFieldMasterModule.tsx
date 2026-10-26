"use client";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Button, useModalAlert } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Boxes, Layers, Save, Loader2, CheckSquare, Menu, ListOrdered, ArrowLeft } from "lucide-react";
import KDropdown from "@/components/KDropdown";
import { DataGrid } from "@/components/datagrid";
import { BulkCompactContext, type BulkClientContext } from "@/components/bulk/BulkModuleShell";
import {
  dynamicFieldMasterApi, FIELD_MASTER_TYPES,
  type FieldMasterType, type FieldSubModule, type FieldComparison,
} from "@/lib/dynamicFieldMaster";

const labelStyle = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))", marginBottom: 6 } as const;
const isPresent = (r: FieldComparison) => r.existsInClient && !r.isDeletedInClient;

/**
 * Dynamic Field Master — pick a Module (Item/Ledger/Tool Master) + a Sub Module (that master's group).
 * Two independent screens:
 *   • "fields" (default): add / remove the group's fields — checkbox grid, Save = sync (existing field
 *     ORDER is never changed; new fields append at the end).
 *   • "sequence" (via Change Sequence): shows ONLY the fields already in this client, drag ≡ to reorder,
 *     Save Sequence persists the order as each field's FieldDrawSequence (this client only, Source untouched).
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
  const [mode, setMode] = useState<"fields" | "sequence">("fields");
  const [seqRows, setSeqRows] = useState<FieldComparison[]>([]); // the client's own fields being reordered
  const [seqLoading, setSeqLoading] = useState(false);

  // Sub Modules (groups) for the chosen master.
  useEffect(() => {
    setGroupId(""); setGroups([]); setRows([]); setMode("fields");
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
    setRows([]); setMode("fields");
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
  const presentCount = useMemo(() => rows.filter(isPresent).length, [rows]);
  const allChecked = rows.length > 0 && rows.every((r) => r.status);

  const toggleRow = useCallback((fieldId: number) =>
    setRows((prev) => prev.map((r) => (r.fieldId === fieldId ? { ...r, status: !r.status } : r))), []);
  const toggleAll = () => { const next = !allChecked; setRows((prev) => prev.map((r) => ({ ...r, status: next }))); };

  const reloadComparison = async () =>
    dynamicFieldMasterApi.comparison(type as FieldMasterType, Number(groupId), client.companyUserId);

  // ── Add / remove fields ──
  const save = async () => {
    if (!type || !groupId || !rows.length) return;
    setSaving(true);
    try {
      await dynamicFieldMasterApi.sync(type as FieldMasterType, Number(groupId), rows, client.companyUserId);
      setRows(await reloadComparison());
      showSuccess("Saved successfully", `Fields updated for ${client.companyName}. Existing field order was kept.`, 4000);
    } catch (e) {
      showError("Save failed", e instanceof Error ? e.message : "Could not sync fields. Please try again.");
    } finally { setSaving(false); }
  };

  // ── Change Sequence ── fields come straight from the DESTINATION (client) DB, so fields the client has
  // that the Source does NOT are still reorderable.
  const enterSequence = async () => {
    if (!type || !groupId) return;
    setMode("sequence"); setSeqRows([]); setSeqLoading(true);
    try {
      setSeqRows(await dynamicFieldMasterApi.clientFields(type as FieldMasterType, Number(groupId), client.companyUserId));
    } catch (e) {
      showError("Load failed", e instanceof Error ? e.message : "Could not load the client's fields.");
      setMode("fields");
    } finally { setSeqLoading(false); }
  };
  const exitSequence = () => setMode("fields");
  const saveSequence = async () => {
    if (!type || !groupId || !seqRows.length) return;
    setSaving(true);
    try {
      await dynamicFieldMasterApi.saveSequence(type as FieldMasterType, Number(groupId), seqRows, client.companyUserId);
      setRows(await reloadComparison());
      setMode("fields");
      showSuccess("Sequence saved", `Field order saved for ${client.companyName}.`, 4000);
    } catch (e) {
      showError("Save failed", e instanceof Error ? e.message : "Could not save the field order. Please try again.");
    } finally { setSaving(false); }
  };

  // Columns for the "fields" (add/remove) screen — a checkbox + the In Client status.
  const fieldsColumns = useMemo<ColumnDef<FieldComparison>[]>(() => [
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
        return isPresent(r)
          ? <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>✓ Present</span>
          : r.existsInClient && r.isDeletedInClient
            ? <span style={{ fontSize: 12, fontWeight: 600, color: "#d97706" }}>Deleted</span>
            : <span style={{ fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))" }}>○ Not in client</span>;
      },
    },
  ], [toggleRow]);

  // Columns for the "sequence" (reorder) screen — a position number + field info (drag ≡ handle is added by the grid).
  const seqColumns = useMemo<ColumnDef<FieldComparison>[]>(() => [
    { id: "pos", header: "#", size: 52, enableSorting: false, enableColumnFilter: false,
      cell: ({ row }) => <span style={{ fontSize: 12.5, fontWeight: 700, color: "rgb(var(--color-primary))" }}>{row.index + 1}</span> },
    { accessorKey: "fieldName", header: "Field Name" },
    { accessorKey: "fieldDisplayName", header: "Display Name" },
    { accessorKey: "fieldDataType", header: "Data Type" },
    { accessorKey: "fieldType", header: "Field Type" },
  ], []);

  const ready = !!type && !!groupId;

  return (
    <div style={{ width: "100%" }}>
      <AlertComponent />

      {/* Module + Sub Module pickers — collapse into a thin info bar once fields are on screen. */}
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
        </div>
      )}

      {ready && mode === "fields" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))" }}>
              Targeting <b style={{ color: "rgb(var(--fg-default))" }}>{client.companyName}</b>
              {" · "}<b style={{ color: "rgb(var(--color-primary))" }}>{selectedCount}</b> of {rows.length} field{rows.length === 1 ? "" : "s"} selected
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Button size="sm" variant="action-secondary" icon={ListOrdered} onClick={enterSequence} disabled={loading || presentCount === 0}>Change Sequence</Button>
              <Button size="sm" variant="action-secondary" icon={CheckSquare} onClick={toggleAll} disabled={loading || !rows.length}>{allChecked ? "Uncheck All" : "Check All"}</Button>
              <Button size="sm" variant="action-save" icon={saving ? Loader2 : Save} onClick={save} disabled={saving || loading || !rows.length}>{saving ? "Saving…" : "Save to Client"}</Button>
            </div>
          </div>

          {rows.length ? (
            <DataGrid<FieldComparison>
              data={rows} columns={fieldsColumns} getRowId={(r) => String(r.fieldId)}
              title={`${rows.length} field${rows.length === 1 ? "" : "s"}`} loading={loading} mainColumns="fieldName"
              enableColumnResizing enableSearch enableSorting enableExport enableFilterRow enablePagination
            />
          ) : (
            <div style={{ padding: "36px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
              {loading ? "Loading fields…" : "No fields in this sub module."}
            </div>
          )}
        </>
      )}

      {ready && mode === "sequence" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))" }}>
              Reordering <b style={{ color: "rgb(var(--fg-default))" }}>{client.companyName}</b>&apos;s fields · <b>{seqRows.length}</b> field{seqRows.length === 1 ? "" : "s"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Button size="sm" variant="action-secondary" icon={ArrowLeft} onClick={exitSequence} disabled={saving}>Back</Button>
              <Button size="sm" variant="action-save" icon={saving ? Loader2 : Save} onClick={saveSequence} disabled={saving || !seqRows.length}>{saving ? "Saving…" : "Save Sequence"}</Button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Menu size={13} /> Drag rows by the <b>≡</b> handle to set the field order — on Save it becomes each field&apos;s sequence in <b>this client only</b> (Source stays unchanged).
          </div>

          {seqRows.length ? (
            <DataGrid<FieldComparison>
              data={seqRows} columns={seqColumns} getRowId={(r) => String(r.fieldId)}
              title={`${seqRows.length} field${seqRows.length === 1 ? "" : "s"} — drag to reorder`} loading={seqLoading || saving} mainColumns="fieldName"
              enableColumnResizing enableSearch enableExport
              enableRowReordering onRowOrderChange={(next) => setSeqRows(next)}
              enablePagination={false}
            />
          ) : (
            <div style={{ padding: "36px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
              {seqLoading ? "Loading this client's fields…" : "No fields in this client yet — add some from the Fields screen first."}
            </div>
          )}
        </>
      )}
    </div>
  );
}
