"use client";
import { useContext, useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from "react";
import { Button, useModalAlert, StandardModal } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGrid, EditableCell } from "@/components/datagrid";
import { Upload, DatabaseZap, CheckCircle2, Save, Trash2, RotateCcw, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { type BulkClientContext, BulkCompactContext } from "@/components/bulk/BulkModuleShell";
import {
  getAllSpareParts, validateSpareParts, importSpareParts, softDeleteSparePart, getSparePartCount,
  clearAllSparePartData, getHSNGroups, getUnits,
  ValidationStatus,
  type SparePartMasterDto, type SparePartValidationResultDto,
} from "@/bulk/services/api";
import { getSparePartMasterStandardColumns, validateExcelColumns } from "@/bulk/utils/excelColumnValidator";
import MasterToolbar from "@/components/bulk/modules/MasterToolbar";
import SecurityClearModal from "@/components/bulk/modules/SecurityClearModal";
import ValidationSummary from "@/components/bulk/modules/ValidationSummary";

// Spare Part Master — Indus360-native rebuild of SparePartMasterEnhanced (flat, no group). Same
// feature set as HSN Master, on the picked client's DB (X-Target-Company).

type Mode = "idle" | "loaded" | "preview" | "validated";
type Filter = "all" | "valid" | "duplicate" | "missing" | "mismatch" | "invalid";

const SPARE_TYPES = ["Electronics", "Electrical", "Mechanical", "Others"].map((v) => ({ label: v, value: v }));
const CELL_BG: Record<number, string> = {
  [ValidationStatus.MissingData]: "rgba(59,130,246,0.16)",
  [ValidationStatus.Mismatch]: "rgba(234,179,8,0.20)",
  [ValidationStatus.InvalidContent]: "rgba(168,85,247,0.18)",
};
const CRED_INP: CSSProperties = {
  padding: "8px 10px", borderRadius: 8, fontSize: 13, width: "100%",
  border: "1px solid rgb(var(--border-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))",
};
const safeFloat = (v: unknown): number => { const n = parseFloat(String(v ?? "").trim()); return isNaN(n) ? 0 : n; };

export default function SparePartMasterModule({ client }: { client: BulkClientContext }) {
  const { showSuccess, showError, showConfirmation, AlertComponent } = useModalAlert();
  const [rows, setRows] = useState<SparePartMasterDto[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const { setHasData } = useContext(BulkCompactContext);
  useEffect(() => { setHasData(mode !== "idle"); }, [mode, setHasData]);
  const [result, setResult] = useState<SparePartValidationResultDto | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [hsnGroups, setHsnGroups] = useState<{ label: string; value: string }[]>([]);
  const [units, setUnits] = useState<{ label: string; value: string }[]>([]);
  const [summary, setSummary] = useState<{ title: string; messages: string[] } | null>(null);
  const [selected, setSelected] = useState<(SparePartMasterDto & { __i: number })[]>([]);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearError, setClearError] = useState("");
  const [freshMode, setFreshMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editable = mode === "preview" || mode === "validated";

  useEffect(() => {
    getHSNGroups().then((g: unknown) => {
      const a = Array.isArray(g) ? g as Record<string, unknown>[] : [];
      setHsnGroups(a.map((r) => ({ label: String(r.displayName ?? r.hsnGroup ?? ""), value: String(r.displayName ?? r.hsnGroup ?? "") })).filter((o) => o.value));
    }).catch(() => setHsnGroups([]));
    getUnits().then((u: unknown) => {
      const a = Array.isArray(u) ? u as Record<string, unknown>[] : [];
      setUnits(a.map((r) => ({ label: String(r.unitSymbol ?? r.unit ?? ""), value: String(r.unitSymbol ?? r.unit ?? "") })).filter((o) => o.value));
    }).catch(() => setUnits([]));
  }, [client.companyUserId]);

  const vMap = useMemo(() => {
    const m = new Map<number, { rowStatus: number; cells: Record<string, number> }>();
    if (result?.rows) {
      for (const r of result.rows as unknown as Array<{ rowIndex: number; rowStatus: number; cellValidations?: Array<{ columnName: string; status: number }> }>) {
        const cells: Record<string, number> = {};
        (r.cellValidations ?? []).forEach((c) => { cells[(c.columnName || "").toLowerCase()] = c.status; });
        m.set(r.rowIndex, { rowStatus: r.rowStatus, cells });
      }
    }
    return m;
  }, [result]);

  const cellBg = useCallback((rowIndex: number, field: string): string | undefined => {
    const rv = vMap.get(rowIndex);
    if (!rv) return undefined;
    if (rv.rowStatus === ValidationStatus.Duplicate) return "rgba(239,68,68,0.14)";
    const st = rv.cells[field.toLowerCase()];
    return st != null ? CELL_BG[st] : undefined;
  }, [vMap]);

  const updateCell = useCallback((rowIndex: number, field: keyof SparePartMasterDto, value: unknown) => {
    setRows((prev) => prev.map((r, i) => i === rowIndex ? { ...r, [field]: value } as SparePartMasterDto : r));
  }, []);

  const shown = useMemo(() => {
    if (filter === "all" || !result) return rows.map((r, i) => ({ ...r, __i: i }));
    return rows.map((r, i) => ({ ...r, __i: i })).filter((r) => {
      const rv = vMap.get(r.__i); if (!rv) return false;
      if (filter === "valid") return rv.rowStatus === ValidationStatus.Valid;
      if (filter === "duplicate") return rv.rowStatus === ValidationStatus.Duplicate;
      const has = (s: number) => Object.values(rv.cells).some((v) => v === s);
      if (filter === "missing") return has(ValidationStatus.MissingData);
      if (filter === "mismatch") return has(ValidationStatus.Mismatch);
      if (filter === "invalid") return has(ValidationStatus.InvalidContent);
      return true;
    });
  }, [rows, filter, result, vMap]);

  const columns = useMemo<ColumnDef<SparePartMasterDto & { __i: number }>[]>(() => {
    const txt = (field: keyof SparePartMasterDto, header: string, type: "text" | "number" = "text") => ({
      accessorKey: field as string, header,
      cell: ({ row }: { row: { original: SparePartMasterDto & { __i: number } } }) => {
        const i = row.original.__i;
        const val = (row.original as unknown as Record<string, unknown>)[field as string];
        return (
          <div style={{ background: cellBg(i, field as string), margin: "-6px -10px", padding: "6px 10px" }}>
            {editable ? <EditableCell value={val} type={type} onSave={(v: unknown) => updateCell(i, field, type === "number" ? safeFloat(v) : v)} /> : <span>{String(val ?? "")}</span>}
          </div>
        );
      },
    });
    const dd = (field: keyof SparePartMasterDto, header: string, opts: { label: string; value: string }[]) => ({
      accessorKey: field as string, header,
      cell: ({ row }: { row: { original: SparePartMasterDto & { __i: number } } }) => {
        const i = row.original.__i;
        const val = (row.original as unknown as Record<string, unknown>)[field as string];
        return (
          <div style={{ background: cellBg(i, field as string), margin: "-6px -10px", padding: "6px 10px" }}>
            {editable ? <EditableCell value={val} type="dropdown" options={opts} onSave={(v: unknown) => updateCell(i, field, v)} /> : <span>{String(val ?? "")}</span>}
          </div>
        );
      },
    });
    return [
      txt("sparePartName", "Spare Part Name"),
      txt("sparePartGroup", "Spare Part Group"),
      dd("hsnGroup", "HSN Group", hsnGroups),
      dd("unit", "Unit", units),
      txt("rate", "Rate", "number"),
      dd("sparePartType", "Spare Part Type", SPARE_TYPES),
      txt("minimumStockQty", "Minimum Stock Qty", "number"),
      txt("purchaseOrderQuantity", "PO Quantity", "number"),
      txt("stockRefCode", "Stock Ref Code"),
      txt("supplierReference", "Supplier Reference"),
      txt("narration", "Narration"),
    ];
  }, [editable, cellBg, updateCell, hsnGroups, units]);

  const loadData = async () => {
    setBusy(true);
    try { const d = await getAllSpareParts(); setRows(Array.isArray(d) ? d : []); setMode("loaded"); setResult(null); setFilter("all"); }
    catch { showError("Load failed", "Could not load spare parts for this client."); }
    finally { setBusy(false); }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext !== ".xlsx") { showError("Invalid file", "Please upload a .xlsx file only."); if (fileRef.current) fileRef.current.value = ""; return; }
    const nameNoExt = file.name.slice(0, file.name.lastIndexOf(".")).trim();
    if (nameNoExt.toLowerCase() !== "spare part master") { showError("Invalid file name", "Expected: Spare Part Master.xlsx"); if (fileRef.current) fileRef.current.value = ""; return; }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        const headerCols: string[] = (() => {
          const ref = ws["!ref"]; if (!ref) return json.length ? Object.keys(json[0]) : [];
          const { s, e } = XLSX.utils.decode_range(ref); const cols: string[] = [];
          for (let c = s.c; c <= e.c; c++) { const cell = ws[XLSX.utils.encode_cell({ r: s.r, c })]; if (cell?.v !== undefined && String(cell.v).trim() !== "") cols.push(String(cell.v)); }
          return cols;
        })();
        const cv = validateExcelColumns(headerCols, getSparePartMasterStandardColumns());
        if (!cv.isValid) { showError("Invalid Excel format", cv.message); if (fileRef.current) fileRef.current.value = ""; return; }
        const mapped = json.map((r) => ({
          sparePartName: String(r["SparePartName"] ?? r["Spare Part Name"] ?? "").trim(),
          sparePartGroup: String(r["SparePartGroup"] ?? r["Spare Part Group"] ?? "").trim(),
          hsnGroup: String(r["HSNGroup"] ?? r["HSN Group"] ?? "").trim(),
          unit: String(r["Unit"] ?? "").trim(),
          rate: safeFloat(r["Rate"]),
          sparePartType: String(r["SparePartType"] ?? r["Spare Part Type"] ?? "").trim(),
          minimumStockQty: safeFloat(r["MinimumStockQty"] ?? r["Minimum Stock Qty"]),
          purchaseOrderQuantity: safeFloat(r["PurchaseOrderQuantity"] ?? r["PO Quantity"]),
          stockRefCode: String(r["StockRefCode"] ?? "").trim(),
          supplierReference: String(r["SupplierReference"] ?? "").trim(),
          narration: String(r["Narration"] ?? "").trim(),
          companyID: 2,
        } as SparePartMasterDto));
        setRows(mapped); setMode("preview"); setResult(null); setFilter("all");
        showSuccess("File loaded", `${mapped.length} row(s) loaded. Click "Check Validation".`, 2500);
      } catch { showError("Parse failed", "Could not read the Excel file."); }
      finally { if (fileRef.current) fileRef.current.value = ""; }
    };
    reader.readAsBinaryString(file);
  };

  const buildSummary = (res: SparePartValidationResultDto) => {
    const s = res.summary as unknown as Record<string, number>;
    const total = (s.duplicateCount ?? 0) + (s.missingDataCount ?? 0) + (s.mismatchCount ?? 0) + (s.invalidContentCount ?? 0);
    const byCol = new Map<string, Set<string>>();
    (res.rows as unknown as Array<{ rowStatus: number; cellValidations?: Array<{ columnName: string; status: number }> }>).forEach((row) => {
      if (row.rowStatus === ValidationStatus.Duplicate) byCol.set("Spare Part Name", (byCol.get("Spare Part Name") ?? new Set()).add("Duplicate data found"));
      (row.cellValidations ?? []).forEach((c) => {
        const col = c.columnName || "Unknown";
        const reason = c.status === ValidationStatus.MissingData ? "Missing" : c.status === ValidationStatus.Mismatch ? "Master Mismatch" : c.status === ValidationStatus.InvalidContent ? "Invalid Format" : "Invalid";
        byCol.set(col, (byCol.get(col) ?? new Set()).add(reason));
      });
    });
    const messages = Array.from(byCol.entries()).map(([col, rs]) => `${col} — ${Array.from(rs).join(", ")}`);
    return { title: `Validation Failed: ${total} Issue${total !== 1 ? "s" : ""} Found`, messages: messages.length ? messages : ["Please review the grid for specific issues."] };
  };

  const validate = async () => {
    if (!rows.length) return;
    setBusy(true); setResult(null);
    try { const res = await validateSpareParts(rows); setResult(res); setMode("validated"); if (res.isValid) showSuccess("Validation passed", "All records are valid.", 2500); }
    catch { showError("Validation failed", "Could not validate. Please try again."); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!rows.length) { showError("No data", "Nothing to import."); return; }
    setBusy(true);
    try {
      const res = await validateSpareParts(rows); setResult(res);
      if (!res.isValid) { showError("Fix errors first", "Correct the issues shown in the Validation Summary before saving."); return; }
      const imp = await importSpareParts(rows);
      if (imp.success) {
        showSuccess("Imported", `${imp.importedRows ?? rows.length} record(s) imported.`, 3000);
        if ((imp.errorRows ?? 0) > 0 && imp.errorMessages?.length) setSummary({ title: `${imp.errorRows} Row(s) Failed During Import`, messages: imp.errorMessages });
        setResult(null); setMode("idle"); await loadData();
      } else setSummary({ title: "Import Failed", messages: imp.errorMessages?.length ? imp.errorMessages : [imp.message || "Import failed."] });
    } catch { showError("Import failed", "Could not import. Please try again."); }
    finally { setBusy(false); }
  };

  const exportData = async () => {
    try {
      const cols = columns.map((c) => ({ header: String((c as { header: string }).header), key: (c as { accessorKey: string }).accessorKey }));
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Spare Part Master");
      ws.addRow(cols.map((c) => c.header)); ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(cols.map((c) => (r as unknown as Record<string, unknown>)[c.key] ?? "")));
      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), "Spare Part Master.xlsx");
    } catch { showError("Export failed", "Could not export the data."); }
  };

  const deleteSelected = () => {
    if (!selected.length) { showError("No rows selected", "Select at least one row to delete."); return; }
    const soft = mode === "loaded";
    const noun = soft ? "record" : "Excel row";
    const n = selected.length;
    showConfirmation("Confirm Delete", `Are you sure you want to delete ${n} ${noun}${n > 1 ? "s" : ""}?`, async () => {
      if (soft) {
        setBusy(true);
        try {
          for (const r of selected) { const id = (r as unknown as { sparePartID?: number }).sparePartID; if (id) await softDeleteSparePart(id); }
          showSuccess("Deleted", `${n} record(s) deleted.`, 2500); setSelected([]); await loadData();
        } catch { showError("Delete failed", "Could not delete the selected records."); }
        finally { setBusy(false); }
      } else { const drop = new Set(selected.map((r) => r.__i)); setRows((prev) => prev.filter((_, i) => !drop.has(i))); setResult(null); setSelected([]); }
    });
  };

  const startClear = async () => {
    setBusy(true);
    let count = 1;
    try { count = await getSparePartCount(); } catch { /* proceed */ } finally { setBusy(false); }
    if (count === 0) { if (freshMode) { setFreshMode(false); fileRef.current?.click(); return; } showError("No data", "No spare part data to clear for this client."); return; }
    setClearError(""); setClearOpen(true);
  };
  const freshUpload = () => { setFreshMode(true); startClear(); };
  const doClear = async (username: string, password: string, reason: string) => {
    setClearError(""); setBusy(true);
    try {
      const res = await clearAllSparePartData(username, password, reason);
      const wasFresh = freshMode;
      showSuccess("Cleared", `${(res as { deletedCount?: number }).deletedCount ?? 0} record(s) cleared.`, 2500);
      setRows([]); setResult(null); setMode("idle"); setClearOpen(false); setFreshMode(false);
      if (wasFresh) setTimeout(() => fileRef.current?.click(), 200);
    } catch { setClearError("Invalid credentials or the clear failed. Check the username / password and try again."); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onFile} />
      <MasterToolbar mode={mode} rowCount={rows.length} selectedCount={selected.length} busy={busy} isValid={!!result?.isValid}
        onLoad={loadData} onClear={startClear} onDelete={deleteSelected} onFreshUpload={freshUpload}
        onExistingUpload={() => fileRef.current?.click()} onExport={exportData} onValidate={validate} onSave={save} />

      {result && <ValidationSummary summary={result.summary} active={filter} onFilter={setFilter} />}

      {mode !== "idle" ? (
        <DataGrid<SparePartMasterDto & { __i: number }>
          data={shown} columns={columns} getRowId={(r) => String(r.__i)} title={`Spare Part Master · ${mode}`} loading={busy}
          onRowSelect={setSelected} enableRowSelection rowSelectionMode="multi"
          enableColumnResizing enableSorting enableSearch enablePagination enableExport
        />
      ) : (
        <div style={{ padding: "36px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          Click <b>Load Data</b> to view existing spare parts, or <b>Upload Excel</b> to import (use <b>Download Template</b> for the format).
        </div>
      )}

      <SecurityClearModal open={clearOpen} groupLabel="Spare Part" companyName={client.companyName} companyUserId={client.companyUserId}
        busy={busy} error={clearError} onCancel={() => { setClearOpen(false); setFreshMode(false); }} onSubmit={doClear} />

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
