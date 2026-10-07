"use client";
import { useContext, useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from "react";
import { Button, useModalAlert, StandardModal } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGrid, EditableCell } from "@/components/datagrid";
import { Upload, DatabaseZap, CheckCircle2, Save, Trash2, RotateCcw, FileDown, PackageSearch } from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { WarehouseDto } from "@/bulk/services/api";
import SecurityClearModal from "@/components/bulk/modules/SecurityClearModal";
import ValidationSummary from "@/components/bulk/modules/ValidationSummary";
import { softBtn, BTN } from "@/components/bulk/modules/toolbarButtonStyle";
import { BulkCompactContext } from "@/components/bulk/BulkModuleShell";

// Shared stock-upload grid + enrich→validate→import flow, parameterized by a per-kind adapter
// (Item / Tool / Spare Part). Native Indus360 rebuild of ItemStockUpload/ToolStockUpload/
// SparePartMasterStockUpload. Validation status is a STRING here (Valid/Duplicate/MissingData/
// Mismatch/InvalidContent), unlike the numeric enum used by the master imports.

export type Row = Record<string, unknown> & { __i: number };
export type StockColKind = "ro" | "n" | "t" | "wh" | "bin";
export type StockCol = [field: string, header: string, kind: StockColKind];

export interface StockValidationResult {
  isValid: boolean;
  summary: { totalRows: number; validRows: number; duplicateCount: number; missingDataCount: number; mismatchCount: number; invalidContentCount: number };
  rows: { rowIndex: number; rowStatus: string; errorMessage?: string; cellValidations: { columnName: string; status: string; validationMessage: string }[] }[];
}
export interface StockImportResult { success: boolean; totalRows: number; importedRows: number; failedRows: number; message: string; errorMessages: string[] }

export interface StockAdapter {
  kind: "item" | "tool" | "sparepart";
  filename: string;                              // e.g. "PAPERStock" | "SparePartStock"
  columns: StockCol[];
  idField: string;                               // itemID | toolID | spareID (for delete/duplicate identity)
  load: () => Promise<unknown[]>;                // Check Stock (existing, read-only)
  loadMaster: () => Promise<unknown[]>;          // Load Data (master template to enter qty)
  enrich: (rows: Row[]) => Promise<{ rows: unknown[]; invalid: string[] }>;
  validate: (rows: Row[]) => Promise<StockValidationResult>;
  save: (rows: Row[]) => Promise<StockImportResult>;
  warehouses: () => Promise<WarehouseDto[]>;
  bins: (wh: string) => Promise<WarehouseDto[]>;
  mapUpload: (r: Record<string, unknown>) => Row | null;
  reset?: {
    itemStock: (u: string, p: string, reason: string, ids: number[], from?: string, to?: string) => Promise<unknown>;
    floorStock: (u: string, p: string, reason: string, from?: string, to?: string) => Promise<unknown>;
  };
}

type Mode = "idle" | "loaded" | "template" | "preview" | "validated";
type Filter = "all" | "valid" | "duplicate" | "missing" | "mismatch" | "invalid";

const CELL_BG: Record<string, string> = { MissingData: "rgba(59,130,246,0.16)", Mismatch: "rgba(234,179,8,0.20)", InvalidContent: "rgba(168,85,247,0.18)" };
const CRED_INP: CSSProperties = { padding: "8px 10px", borderRadius: 8, fontSize: 13, width: "100%", border: "1px solid rgb(var(--border-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" };
const num = (v: unknown): number => { const n = parseFloat(String(v ?? "").trim()); return isNaN(n) ? 0 : n; };
const toOpts = (a: string[]) => a.map((v) => ({ label: v, value: v }));

export default function StockGrid({ adapter, companyName, companyUserId }: { adapter: StockAdapter; companyName: string; companyUserId: string }) {
  const { showSuccess, showError, AlertComponent } = useModalAlert();
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const { setHasData } = useContext(BulkCompactContext); // tell the shell to collapse the pickers once stock data is on screen
  useEffect(() => { setHasData(mode !== "idle"); }, [mode, setHasData]);
  const [result, setResult] = useState<StockValidationResult | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [whOpts, setWhOpts] = useState<{ label: string; value: string }[]>([]);
  const [binsCache, setBinsCache] = useState<Record<string, { label: string; value: string }[]>>({});
  const [summary, setSummary] = useState<{ title: string; messages: string[] } | null>(null);
  const [selected, setSelected] = useState<Row[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // reset flow (item): date range → pick items → shared 3-captcha + credential (SecurityClearModal).
  // (floor reset skips the item-picker — floor stock is warehouse-level, not per item.)
  const [resetKind, setResetKind] = useState<"" | "item" | "floor">("");
  const [resetDatesOpen, setResetDatesOpen] = useState(false);
  const [resetSecOpen, setResetSecOpen] = useState(false);
  const [resetError, setResetError] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  // item-picker (which items' stock to zero out) — mirrors the old BulkImport "Select Items to Reset".
  const [resetSelectOpen, setResetSelectOpen] = useState(false);
  const [resetLoadingItems, setResetLoadingItems] = useState(false);
  const [resetItems, setResetItems] = useState<{ id: number; code: string; name: string; qty: number; unit: string }[]>([]);
  const [resetSel, setResetSel] = useState<Set<number>>(new Set());
  const [resetSearch, setResetSearch] = useState("");

  const editable = mode === "template" || mode === "preview" || mode === "validated";

  useEffect(() => {
    adapter.warehouses().then((w) => setWhOpts(toOpts(Array.from(new Set((w ?? []).map((x) => x.warehouseName).filter(Boolean))).sort()))).catch(() => setWhOpts([]));
    setRows([]); setMode("idle"); setResult(null); setFilter("all"); setBinsCache({});
  }, [adapter]);

  const ensureBins = useCallback(async (wh: string) => {
    if (!wh) return;
    setBinsCache((prev) => { if (prev[wh]) return prev; return prev; });
    if (binsCache[wh]) return;
    try { const b = await adapter.bins(wh); setBinsCache((prev) => ({ ...prev, [wh]: toOpts(Array.from(new Set((b ?? []).map((x) => x.binName ?? "").filter(Boolean))).sort()) })); }
    catch { setBinsCache((prev) => ({ ...prev, [wh]: [] })); }
  }, [adapter, binsCache]);

  const ensureAllBins = useCallback((rs: Row[]) => {
    Array.from(new Set(rs.map((r) => String(r.warehouseName ?? "")).filter(Boolean))).forEach((wh) => ensureBins(wh));
  }, [ensureBins]);

  const vMap = useMemo(() => {
    const m = new Map<number, { rowStatus: string; cells: Record<string, string> }>();
    if (result?.rows) for (const r of result.rows) {
      const cells: Record<string, string> = {};
      (r.cellValidations ?? []).forEach((c) => { cells[(c.columnName || "").toLowerCase()] = c.status; });
      m.set(r.rowIndex, { rowStatus: r.rowStatus, cells });
    }
    return m;
  }, [result]);

  const cellBg = useCallback((rowIndex: number, field: string): string | undefined => {
    const rv = vMap.get(rowIndex); if (!rv) return undefined;
    if (rv.rowStatus === "Duplicate") return "rgba(239,68,68,0.14)";
    const st = rv.cells[field.toLowerCase()]; return st ? CELL_BG[st] : undefined;
  }, [vMap]);

  const updateCell = useCallback((rowIndex: number, field: string, value: unknown) => {
    setRows((prev) => prev.map((r, i) => {
      if (i !== rowIndex) return r;
      const next = { ...r, [field]: value };
      if (field === "warehouseName") { next.binName = ""; ensureBins(String(value ?? "")); }
      return next;
    }));
    setResult(null); // any edit invalidates prior validation
  }, [ensureBins]);

  const shown = useMemo(() => {
    const withIdx = rows.map((r, i) => ({ ...r, __i: i }));
    if (filter === "all" || !result) return withIdx;
    return withIdx.filter((r) => {
      const rv = vMap.get(r.__i); if (!rv) return false;
      if (filter === "valid") return rv.rowStatus === "Valid";
      if (filter === "duplicate") return rv.rowStatus === "Duplicate";
      const has = (s: string) => Object.values(rv.cells).some((v) => v === s);
      if (filter === "missing") return has("MissingData");
      if (filter === "mismatch") return has("Mismatch");
      if (filter === "invalid") return has("InvalidContent");
      return true;
    });
  }, [rows, filter, result, vMap]);

  const columns = useMemo<ColumnDef<Row>[]>(() => adapter.columns.map(([field, header, kind]) => ({
    accessorKey: field, header,
    cell: ({ row }: { row: { original: Row } }) => {
      const i = row.original.__i; const val = row.original[field];
      const ro = kind === "ro" || !editable;
      const opts = kind === "wh" ? whOpts : kind === "bin" ? (binsCache[String(row.original.warehouseName ?? "")] ?? []) : null;
      const inner = ro
        ? <span style={{ color: kind === "ro" ? "rgb(var(--fg-muted))" : undefined }}>{String(val ?? "")}</span>
        : kind === "n" ? <EditableCell value={val} type="number" onSave={(v: unknown) => updateCell(i, field, num(v))} />
        : opts ? <EditableCell value={val} type="dropdown" options={opts} onSave={(v: unknown) => updateCell(i, field, v)} />
        : <EditableCell value={val} type="text" onSave={(v: unknown) => updateCell(i, field, v)} />;
      return <div style={{ background: kind === "ro" ? "rgba(148,163,184,0.12)" : cellBg(i, field), margin: "-6px -10px", padding: "6px 10px" }}>{inner}</div>;
    },
  })), [adapter.columns, editable, whOpts, binsCache, cellBg, updateCell]);

  const loadMaster = async () => {
    setBusy(true);
    try { const d = await adapter.loadMaster(); const rs = (Array.isArray(d) ? d : []) as Row[]; setRows(rs); setMode("template"); setResult(null); setFilter("all"); ensureAllBins(rs); }
    catch { showError("Load failed", "Could not load the master template."); } finally { setBusy(false); }
  };
  const checkStock = async () => {
    setBusy(true);
    try { const d = await adapter.load(); const rs = (Array.isArray(d) ? d : []) as Row[]; setRows(rs); setMode("loaded"); setResult(null); setFilter("all"); ensureAllBins(rs); }
    catch { showError("Load failed", "Could not load existing stock."); } finally { setBusy(false); }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext !== ".xlsx") { showError("Invalid Excel Version", "Please upload a .xlsx file only."); if (fileRef.current) fileRef.current.value = ""; return; }
    const nameNoExt = file.name.slice(0, file.name.lastIndexOf(".")).trim();
    if (nameNoExt.toLowerCase() !== adapter.filename.toLowerCase()) { showError("Invalid File Name", `Expected: ${adapter.filename}.xlsx`); if (fileRef.current) fileRef.current.value = ""; return; }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[];
        const mapped = json.map(adapter.mapUpload).filter((r): r is Row => r !== null);
        if (!mapped.length) { showError("No rows", "No valid rows found in the file."); if (fileRef.current) fileRef.current.value = ""; return; }
        setBusy(true);
        const enriched = await adapter.enrich(mapped);
        const rs = (enriched.rows ?? []) as Row[];
        setRows(rs); setMode("preview"); setResult(null); setFilter("all"); ensureAllBins(rs);
        if (enriched.invalid?.length) setSummary({ title: `${enriched.invalid.length} code(s) not found in master`, messages: enriched.invalid.slice(0, 50) });
        else showSuccess("File loaded", `${rs.length} row(s) enriched. Enter warehouse/bin, then Check Validation.`, 2600);
      } catch { showError("Parse failed", "Could not read / enrich the Excel file."); }
      finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
    };
    reader.readAsBinaryString(file);
  };

  const buildSummary = (res: StockValidationResult) => {
    const s = res.summary;
    const total = (s.duplicateCount ?? 0) + (s.missingDataCount ?? 0) + (s.mismatchCount ?? 0) + (s.invalidContentCount ?? 0);
    const byCol = new Map<string, Set<string>>();
    res.rows.forEach((row) => {
      if (row.rowStatus === "Duplicate") byCol.set("Row", (byCol.get("Row") ?? new Set()).add("Duplicate (Item+Batch+Warehouse+Bin)"));
      (row.cellValidations ?? []).forEach((c) => {
        const reason = c.status === "MissingData" ? "Missing" : c.status === "Mismatch" ? "Master Mismatch" : c.status === "InvalidContent" ? "Invalid Format" : c.status;
        byCol.set(c.columnName || "Unknown", (byCol.get(c.columnName || "Unknown") ?? new Set()).add(reason));
      });
    });
    const messages = Array.from(byCol.entries()).map(([c, rs]) => `${c} — ${Array.from(rs).join(", ")}`);
    return { title: `Validation Failed: ${total} Issue${total !== 1 ? "s" : ""} Found`, messages: messages.length ? messages : ["Please review the grid for specific issues."] };
  };

  const validate = async () => {
    if (!rows.length) return; setBusy(true); setResult(null);
    try { const res = await adapter.validate(rows); setResult(res); setMode("validated"); if (res.isValid) showSuccess("Validation passed", "All rows are valid.", 2500); }
    catch { showError("Validation failed", "Could not validate. Please try again."); } finally { setBusy(false); }
  };

  const save = async () => {
    if (!rows.length) { showError("No data", "Nothing to save."); return; }
    setBusy(true);
    try {
      const res = await adapter.validate(rows); setResult(res);
      if (!res.isValid) { showError("Fix errors first", "Correct the issues shown in the Validation Summary (duplicates / invalid) before saving."); return; }
      const imp = await adapter.save(rows);
      if (imp.success) {
        showSuccess("Imported", `${imp.importedRows ?? rows.length} stock row(s) imported.`, 3000);
        if ((imp.failedRows ?? 0) > 0 && imp.errorMessages?.length) setSummary({ title: `${imp.failedRows} Row(s) Failed`, messages: imp.errorMessages });
        setRows([]); setResult(null); setMode("idle");
      } else setSummary({ title: "Import Failed", messages: imp.errorMessages?.length ? imp.errorMessages : [imp.message || "Import failed."] });
    } catch { showError("Import failed", "Could not import. Please try again."); }
    finally { setBusy(false); }
  };

  // Export current grid data (BulkImport "Export"; empty grid ⇒ header-only template). Re-uploadable.
  const exportData = async () => {
    try {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(adapter.filename.slice(0, 31));
      ws.addRow(adapter.columns.map(([, h]) => h)); ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(adapter.columns.map(([f]) => r[f] ?? "")));
      const buf = await wb.xlsx.writeBuffer(); saveAs(new Blob([buf]), `${adapter.filename}.xlsx`);
    } catch { showError("Export failed", "Could not export the data."); }
  };

  const deleteSelected = () => {
    if (!selected.length) { showError("No rows selected", "Select at least one row to remove."); return; }
    if (mode === "loaded") { showError("Read-only", "Existing stock (Check Stock) can't be edited here. Use Load Data or Upload."); return; }
    const drop = new Set(selected.map((r) => r.__i)); setRows((prev) => prev.filter((_, i) => !drop.has(i))); setResult(null); setSelected([]);
  };

  // ---- reset flow (item only) ----
  const startReset = (kind: "item" | "floor") => { setResetKind(kind); setDates({ from: "", to: "" }); setResetDatesOpen(true); };
  const cancelReset = () => { setResetKind(""); setResetDatesOpen(false); setResetSelectOpen(false); setResetSecOpen(false); setResetError(""); setResetSearch(""); };
  const datesNext = async () => {
    if ((dates.from && !dates.to) || (!dates.from && dates.to)) { showError("Date range", "Enter both dates, or leave both blank for ALL."); return; }
    setResetDatesOpen(false); setResetError("");
    if (resetKind === "item") await openItemSelect();  // pick which items to reset
    else setResetSecOpen(true);                          // floor → straight to security
  };

  // Load the items that currently have stock (grouped, with total qty) and open the picker. Pre-selects
  // the grid-selected items if any, else selects all. Only the ticked items' stock gets zeroed out.
  const openItemSelect = async () => {
    setResetSelectOpen(true); setResetLoadingItems(true); setResetSearch(""); setResetSel(new Set());
    try {
      const data = (await adapter.load()) as Record<string, unknown>[];
      const grouped = new Map<number, { id: number; code: string; name: string; qty: number; unit: string }>();
      for (const row of data ?? []) {
        const id = Number(row.itemID ?? row.ItemID ?? (row as Record<string, unknown>)[adapter.idField]);
        if (!id) continue;
        if (!grouped.has(id)) grouped.set(id, { id, code: String(row.itemCode ?? row.ItemCode ?? ""), name: String(row.itemName ?? row.ItemName ?? ""), qty: 0, unit: String(row.stockUnit ?? row.StockUnit ?? "") });
        grouped.get(id)!.qty += num(row.receiptQuantity ?? row.ReceiptQuantity);
      }
      const list = [...grouped.values()].sort((a, b) => a.code.localeCompare(b.code));
      setResetItems(list);
      const gridIds = new Set(selected.map((r) => Number((r as Record<string, unknown>)[adapter.idField])).filter((n) => n > 0));
      setResetSel(gridIds.size ? gridIds : new Set(list.map((i) => i.id)));
    } catch {
      showError("Error", "Failed to load stock items for selection.");
      setResetSelectOpen(false); setResetKind("");
    } finally { setResetLoadingItems(false); }
  };
  const selectNext = () => {
    if (resetSel.size === 0) { showError("No items selected", "Tick at least one item to reset."); return; }
    setResetSelectOpen(false); setResetSecOpen(true);
  };

  const doReset = async (username: string, password: string, reason: string) => {
    if (!adapter.reset) return;
    setResetError(""); setBusy(true);
    try {
      const from = dates.from || undefined, to = dates.to || undefined;
      if (resetKind === "item") {
        const ids = Array.from(resetSel).filter((n) => n > 0);  // the items ticked in the picker
        await adapter.reset.itemStock(username, password, reason, ids, from, to);
      } else await adapter.reset.floorStock(username, password, reason, from, to);
      showSuccess("Reset complete", resetKind === "item" ? "Item stock reset." : "Floor stock reset.", 2600);
      setRows([]); setResult(null); setMode("idle"); cancelReset();
    } catch { setResetError("Invalid credentials or the reset failed. Check the username / password and try again."); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onFile} />
      <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto", marginBottom: 14, justifyContent: "center", paddingBottom: 2 }}>
        <Button size="sm" variant="action-secondary" icon={DatabaseZap} onClick={loadMaster} disabled={busy} style={softBtn(BTN.load.base, BTN.load.text, busy)}>Load Data</Button>
        <Button size="sm" variant="action-secondary" icon={PackageSearch} onClick={checkStock} disabled={busy} style={softBtn(BTN.violet.base, BTN.violet.text, busy)}>Check Stock</Button>
        {adapter.reset && <>
          <Button size="sm" variant="action-delete" icon={RotateCcw} onClick={() => startReset("item")} disabled={busy}>Reset Item Stock</Button>
          <Button size="sm" variant="action-delete" icon={RotateCcw} onClick={() => startReset("floor")} disabled={busy}>Reset Floor Stock</Button>
        </>}
        <Button size="sm" variant="action-secondary" icon={Upload} onClick={() => fileRef.current?.click()} disabled={busy} style={softBtn(BTN.navy.base, BTN.navy.text, busy)}>Upload Excel</Button>
        {(mode === "preview" || mode === "validated" || mode === "template") && (
          <Button size="sm" variant="action-secondary" icon={Trash2} onClick={deleteSelected} disabled={busy || !selected.length} style={softBtn(BTN.amber.base, BTN.amber.text, busy || !selected.length)}>Delete Excel Row ({selected.length})</Button>
        )}
        {mode !== "idle" && <Button size="sm" variant="action-secondary" icon={FileDown} onClick={exportData} disabled={busy} style={softBtn(BTN.cyan.base, BTN.cyan.text, busy)}>Export</Button>}
        {(mode === "preview" || mode === "validated") && <Button size="sm" variant="action-secondary" icon={CheckCircle2} onClick={validate} disabled={busy || !rows.length} style={softBtn(BTN.pink.base, BTN.pink.text, busy || !rows.length)}>Check Validation</Button>}
        {result?.isValid && <Button size="sm" variant="action-save" icon={Save} onClick={save} disabled={busy}>Save Data</Button>}
      </div>

      {result && <ValidationSummary summary={result.summary} active={filter} onFilter={setFilter} />}

      {rows.length ? (
        <DataGrid<Row>
          data={shown} columns={columns} getRowId={(r) => String(r.__i)} title={`Stock · ${adapter.filename} · ${mode}`} loading={busy}
          onRowSelect={setSelected} enableRowSelection rowSelectionMode="multi"
          enableColumnResizing enableSorting enableSearch enablePagination enableExport
        />
      ) : (
        <div style={{ padding: "36px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          <b>Load Data</b> = master items to enter quantities · <b>Check Stock</b> = existing stock (read-only) · <b>Upload Excel</b> = import a <b>{adapter.filename}.xlsx</b> file.
        </div>
      )}

      {/* Reset — date range, then the shared 3-captcha + credential flow */}
      {resetDatesOpen && (
        <StandardModal isOpen title={`${resetKind === "item" ? "Reset Item Stock" : "Reset Floor Stock"} — Date Range`} onClose={cancelReset} size="sm">
          <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))" }}>Enter both dates to reset a range, or leave both blank for ALL dates{resetKind === "item" ? " — you'll pick which items next" : ""}, for <b>{companyName}</b>.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>From</div><input type="date" value={dates.from} onChange={(e) => setDates({ ...dates, from: e.target.value })} style={CRED_INP} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>To</div><input type="date" value={dates.to} onChange={(e) => setDates({ ...dates, to: e.target.value })} style={CRED_INP} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button size="sm" variant="action-secondary" onClick={cancelReset}>Cancel</Button>
              <Button size="sm" onClick={datesNext}>Next</Button>
            </div>
          </div>
        </StandardModal>
      )}
      {/* Reset (item) — pick which items' stock to zero out (mirrors the old BulkImport "Select Items to Reset"). */}
      {resetSelectOpen && (() => {
        const q = resetSearch.trim().toLowerCase();
        const filtered = q ? resetItems.filter((it) => it.code.toLowerCase().includes(q) || it.name.toLowerCase().includes(q)) : resetItems;
        const allFilteredSel = filtered.length > 0 && filtered.every((it) => resetSel.has(it.id));
        const allSelected = resetItems.length > 0 && resetSel.size === resetItems.length;
        const toggle = (id: number) => setResetSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
        const toggleAll = () => setResetSel((prev) => { const n = new Set(prev); filtered.forEach((it) => { if (allFilteredSel) n.delete(it.id); else n.add(it.id); }); return n; });
        return (
          <StandardModal isOpen title="Select Items to Reset" onClose={cancelReset} size="md">
            <div style={{ padding: 4, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))" }}>Only the ticked items&rsquo; stock will be zeroed out for <b>{companyName}</b>.</div>
              {resetLoadingItems ? (
                <div style={{ padding: "34px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 13 }}>Loading items…</div>
              ) : resetItems.length === 0 ? (
                <div style={{ padding: "34px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 13 }}>No stock items found for this group.</div>
              ) : (
                <>
                  <input value={resetSearch} onChange={(e) => setResetSearch(e.target.value)} placeholder="Search item code or name…" style={CRED_INP} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px 8px", borderBottom: "1px solid rgb(var(--border-default))" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      <input type="checkbox" checked={allFilteredSel} onChange={toggleAll} /> Select All
                    </label>
                    <span style={{ fontSize: 12, color: "rgb(var(--fg-muted))" }}>{resetSel.size} of {resetItems.length} selected</span>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                    {filtered.map((it) => (
                      <label key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: "1px solid rgb(var(--border-default))", cursor: "pointer" }}>
                        <input type="checkbox" checked={resetSel.has(it.id)} onChange={() => toggle(it.id)} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-default))" }}>{it.code}</div>
                          <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name || "—"}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "rgb(var(--color-primary))" }}>{it.qty}</div>
                          <div style={{ fontSize: 11, color: "rgb(var(--fg-muted))" }}>{it.unit}</div>
                        </div>
                      </label>
                    ))}
                    {filtered.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 12.5 }}>No items match &ldquo;{resetSearch}&rdquo;.</div>}
                  </div>
                </>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <Button size="sm" variant="action-secondary" onClick={cancelReset}>Cancel</Button>
                <Button size="sm" onClick={selectNext} disabled={resetLoadingItems || resetSel.size === 0}>Next{allSelected ? " (All)" : ` (${resetSel.size})`}</Button>
              </div>
            </div>
          </StandardModal>
        );
      })()}

      <SecurityClearModal open={resetSecOpen} groupLabel={resetKind === "item" ? "Item Stock" : "Floor Stock"} companyName={companyName} companyUserId={companyUserId}
        busy={busy} error={resetError} actionLabel="Reset Stock" onCancel={cancelReset} onSubmit={doReset} />

      {summary && (
        <StandardModal isOpen title={summary.title} onClose={() => setSummary(null)} size="md">
          <div style={{ padding: 4 }}>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "rgb(var(--fg-default))", lineHeight: 1.7 }}>
              {summary.messages.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        </StandardModal>
      )}
      <AlertComponent />
    </div>
  );
}
