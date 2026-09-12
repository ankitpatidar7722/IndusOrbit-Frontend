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
  getAllTools, getToolHSNGroups, getToolUnits, softDeleteTool, validateTools, importTools,
  clearAllToolData, getToolCount, ValidationStatus, type ToolMasterDto, type ToolValidationResultDto,
} from "@/bulk/services/api";
import { getToolMasterStandardColumns, validateExcelColumns } from "@/bulk/utils/excelColumnValidator";
import MasterToolbar from "@/components/bulk/modules/MasterToolbar";
import SecurityClearModal from "@/components/bulk/modules/SecurityClearModal";
import ValidationSummary from "@/components/bulk/modules/ValidationSummary";

// Tool Master — Indus360-native rebuild of ToolMasterEnhanced. GROUP-BASED via numeric toolGroupId
// (3=DIE, 5=PRINTING CYL, 6=ANILOX, 7=EMBOSSING, 8=FLEXO DIE, 13=SIM, else=PLATES). Operates on the
// picked client's DB (X-Target-Company). Same feature set as the other masters.

type Row = Record<string, unknown> & { __i: number };
type Mode = "idle" | "loaded" | "preview" | "validated";
type Filter = "all" | "valid" | "duplicate" | "missing" | "mismatch" | "invalid";
type Kind = "t" | "n" | "hsn" | "unit" | string[];
type Col = [field: string, header: string, kind: Kind];

// Per-group columns (grid order), keyed by toolGroupId. FLEXO(8)/SIM(13) label clientName as "LedgerName".
const TOOL_COLS: Record<string, Col[]> = {
  "3": [ // DIE
    ["clientName", "ClientName", "t"], ["jobName", "JobName", "t"], ["sizeL", "SizeL", "n"], ["sizeW", "SizeW", "n"], ["sizeH", "SizeH", "n"],
    ["upsAround", "UpsAround", "n"], ["upsAcross", "UpsAcross", "n"], ["totalUps", "TotalUps", "n"], ["productHSNName", "ProductHSNName", "hsn"],
    ["purchaseUnit", "PurchaseUnit", "unit"], ["purchaseRate", "PurchaseRate", "n"], ["stockUnit", "StockUnit", "unit"], ["toolName", "ToolName", "t"], ["toolRefCode", "ToolRefCode", "t"],
  ],
  "5": [ // PRINTING CYLINDER
    ["sizeW", "SizeW", "n"], ["manufacturer", "Manufacturer", "t"], ["noOfTeeth", "NoOfTeeth", "n"], ["circumferenceMM", "CircumferenceMM", "n"], ["circumferenceInch", "CircumferenceInch", "n"],
    ["productHSNName", "ProductHSNName", "hsn"], ["purchaseUnit", "PurchaseUnit", "unit"], ["purchaseRate", "PurchaseRate", "n"], ["stockUnit", "StockUnit", "unit"], ["toolName", "ToolName", "t"], ["toolRefCode", "ToolRefCode", "t"],
  ],
  "6": [ // ANILOX CYLINDER
    ["sizeW", "SizeW", "n"], ["manufacturer", "Manufacturer", "t"], ["bcm", "BCM", "n"], ["lpi", "LPI", "n"], ["productHSNName", "ProductHSNName", "hsn"],
    ["purchaseUnit", "PurchaseUnit", "unit"], ["purchaseRate", "PurchaseRate", "n"], ["stockUnit", "StockUnit", "unit"], ["toolName", "ToolName", "t"], ["toolRefCode", "ToolRefCode", "t"],
  ],
  "7": [ // EMBOSSING CYLINDER (same as PRINTING)
    ["sizeW", "SizeW", "n"], ["manufacturer", "Manufacturer", "t"], ["noOfTeeth", "NoOfTeeth", "n"], ["circumferenceMM", "CircumferenceMM", "n"], ["circumferenceInch", "CircumferenceInch", "n"],
    ["productHSNName", "ProductHSNName", "hsn"], ["purchaseUnit", "PurchaseUnit", "unit"], ["purchaseRate", "PurchaseRate", "n"], ["stockUnit", "StockUnit", "unit"], ["toolName", "ToolName", "t"], ["toolRefCode", "ToolRefCode", "t"],
  ],
  "8": [ // FLEXO DIE
    ["clientName", "LedgerName", "t"], ["jobName", "JobName", "t"], ["sizeL", "SizeL", "n"], ["sizeH", "SizeH", "n"], ["upsAround", "UpsAround", "n"], ["upsAcross", "UpsAcross", "n"], ["totalUps", "TotalUps", "n"],
    ["productHSNName", "ProductHSNName", "hsn"], ["toolName", "ToolName", "t"], ["toolType", "ToolType", "t"], ["aroundGap", "AroundGap", "n"], ["acrossGap", "AcrossGap", "n"],
    ["unitSymbol", "UnitSymbol", "unit"], ["purchaseUnit", "PurchaseUnit", "unit"], ["purchaseRate", "PurchaseRate", "n"], ["referenceToolNo", "ReferenceToolNo", "t"], ["estimateRate", "EstimateRate", "n"], ["stockUnit", "StockUnit", "unit"], ["toolRefCode", "ToolRefCode", "t"],
  ],
  "13": [ // SIM
    ["clientName", "LedgerName", "t"], ["jobName", "JobName", "t"], ["sizeL", "SizeL", "n"], ["positive", "Positive", "t"], ["negative", "Negative", "t"], ["sizeW", "SizeW", "n"],
    ["upsAround", "UpsAround", "n"], ["upsAcross", "UpsAcross", "n"], ["totalUps", "TotalUps", "n"], ["productHSNName", "ProductHSNName", "hsn"], ["toolName", "ToolName", "t"], ["toolType", "ToolType", "t"],
    ["master", "Master", "t"], ["sim", "Sim", "t"], ["unitSymbol", "UnitSymbol", "unit"], ["purchaseUnit", "PurchaseUnit", "unit"], ["purchaseRate", "PurchaseRate", "n"], ["referenceToolNo", "ReferenceToolNo", "t"], ["estimateRate", "EstimateRate", "n"], ["stockUnit", "StockUnit", "unit"], ["toolRefCode", "ToolRefCode", "t"], ["location", "Location", "t"],
  ],
  "__DEFAULT__": [ // PLATES
    ["toolType", "ToolType", "t"], ["jobName", "JobName", "t"], ["sizeL", "SizeL", "n"], ["sizeW", "SizeW", "n"], ["totalUps", "TotalUps", "n"], ["purchaseRate", "PurchaseRate", "n"],
    ["purchaseUnit", "PurchaseUnit", "unit"], ["stockUnit", "StockUnit", "unit"], ["toolName", "ToolName", "t"], ["productHSNName", "ProductHSNName", "hsn"], ["toolRefCode", "ToolRefCode", "t"],
  ],
};
const colsForTool = (id: number): Col[] => TOOL_COLS[String(id)] ?? TOOL_COLS["__DEFAULT__"];
const CYL_OR_SIM = new Set([5, 6, 7, 13]);

const TOOL_NUM = ["sizeL", "sizeW", "sizeH", "purchaseRate", "purchaseOrderQuantity", "minimumStockQty", "circumferenceMM", "circumferenceInch", "bcm", "lpi", "aroundGap", "acrossGap", "estimateRate"];
const TOOL_INT = ["upsAround", "upsAcross", "totalUps", "shelfLife", "noOfTeeth", "toolID", "toolGroupID", "productHSNID"];
const TOOL_BOOL = ["isStandardItem", "isRegularItem", "isDeletedTransaction"];
const num = (v: unknown): number => { const n = parseFloat(String(v ?? "").trim()); return isNaN(n) ? 0 : n; };
const int = (v: unknown): number => { const n = parseInt(String(v ?? "").trim(), 10); return isNaN(n) ? 0 : n; };

// Derivations: totalUps = around*across (if empty), purchaseRate 0→1, toolName←jobName (DIE/FLEXO/PLATES), toolType default (PLATES).
function recompute(row: Row, id: number, groupName: string): Row {
  const r: Row = { ...row };
  const ua = int(r.upsAround), uc = int(r.upsAcross);
  if ((r.totalUps == null || r.totalUps === "" || int(r.totalUps) === 0) && ua > 0 && uc > 0) r.totalUps = ua * uc;
  if (num(r.purchaseRate) === 0) r.purchaseRate = 1;
  const isDefault = !CYL_OR_SIM.has(id) && id !== 3 && id !== 8;
  if (id === 3 || id === 8 || isDefault) { if (!r.toolName || r.toolName === "") r.toolName = r.jobName; }
  if (isDefault && (!r.toolType || r.toolType === "")) r.toolType = groupName;
  return r;
}

function cleanForApi(row: Row, id: number, groupName: string): ToolMasterDto {
  const src = recompute(row, id, groupName);
  const out: Record<string, unknown> = {}; const rawValues: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === "__i" || k === "_rowIndex" || k === "hsnCode") continue;
    if (v === undefined || v === null || v === "") continue;
    if (TOOL_INT.includes(k)) { const n = parseInt(String(v), 10); if (isNaN(n)) rawValues[k] = v; else out[k] = n; }
    else if (TOOL_NUM.includes(k)) { const n = Number(v); if (isNaN(n)) rawValues[k] = v; else out[k] = n; }
    else if (TOOL_BOOL.includes(k)) { if (v === "TRUE" || v === true) out[k] = true; else if (v === "FALSE" || v === false) out[k] = false; else rawValues[k] = v; }
    else out[k] = String(v); // remaining tool fields are C# strings — coerce Excel numerics
  }
  out.toolGroupID = id;
  if (Object.keys(rawValues).length) out.rawValues = rawValues;
  return out as unknown as ToolMasterDto;
}

const NON_EMPTY = ["toolName", "jobName", "clientName", "sizeW", "sizeL", "manufacturer", "productHSNName", "toolRefCode", "positive", "master"];
const CRED_INP: CSSProperties = { padding: "8px 10px", borderRadius: 8, fontSize: 13, width: "100%", border: "1px solid rgb(var(--border-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" };
const CELL_BG: Record<number, string> = { [ValidationStatus.MissingData]: "rgba(59,130,246,0.16)", [ValidationStatus.Mismatch]: "rgba(234,179,8,0.20)", [ValidationStatus.InvalidContent]: "rgba(168,85,247,0.18)" };

export default function ToolMasterModule({ client, groupId, groupName }: { client: BulkClientContext; groupId: number; groupName: string }) {
  const { showSuccess, showError, showConfirmation, AlertComponent } = useModalAlert();
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const { setHasData } = useContext(BulkCompactContext);
  useEffect(() => { setHasData(mode !== "idle"); }, [mode, setHasData]);
  const [result, setResult] = useState<ToolValidationResultDto | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [unitOpts, setUnitOpts] = useState<{ label: string; value: string }[]>([]);
  const [hsnOpts, setHsnOpts] = useState<{ label: string; value: string }[]>([]);
  const [summary, setSummary] = useState<{ title: string; messages: string[] } | null>(null);
  const [selected, setSelected] = useState<Row[]>([]);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearError, setClearError] = useState("");
  const [freshMode, setFreshMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editable = mode === "preview" || mode === "validated";
  const cols = useMemo(() => colsForTool(groupId), [groupId]);

  useEffect(() => {
    getToolHSNGroups().then((g) => setHsnOpts((g ?? []).map((h) => ({ label: h.displayName, value: h.displayName })).filter((o) => o.value))).catch(() => setHsnOpts([]));
    getToolUnits().then((u: unknown) => { const a = Array.isArray(u) ? u as Record<string, unknown>[] : []; setUnitOpts(a.map((r) => ({ label: String(r.unitSymbol ?? ""), value: String(r.unitSymbol ?? "") })).filter((o) => o.value)); }).catch(() => setUnitOpts([]));
  }, [groupId, client.companyUserId]);

  const optsFor = useCallback((kind: Kind): { label: string; value: string }[] => {
    if (kind === "unit") return unitOpts; if (kind === "hsn") return hsnOpts;
    if (Array.isArray(kind)) return kind.map((v) => ({ label: v, value: v })); return [];
  }, [unitOpts, hsnOpts]);

  const vMap = useMemo(() => {
    const m = new Map<number, { rowStatus: number; cells: Record<string, number> }>();
    if (result?.rows) for (const r of result.rows) {
      const cells: Record<string, number> = {};
      (r.cellValidations ?? []).forEach((c) => { cells[(c.columnName || "").toLowerCase()] = c.status; });
      m.set(r.rowIndex, { rowStatus: r.rowStatus, cells });
    }
    return m;
  }, [result]);

  const cellBg = useCallback((rowIndex: number, field: string): string | undefined => {
    const rv = vMap.get(rowIndex); if (!rv) return undefined;
    if (rv.rowStatus === ValidationStatus.Duplicate) return "rgba(239,68,68,0.14)";
    const st = rv.cells[field.toLowerCase()]; return st != null ? CELL_BG[st] : undefined;
  }, [vMap]);

  const updateCell = useCallback((rowIndex: number, field: string, value: unknown) => {
    setRows((prev) => prev.map((r, i) => i === rowIndex ? recompute({ ...r, [field]: value }, groupId, groupName) : r));
  }, [groupId, groupName]);

  const shown = useMemo(() => {
    const withIdx = rows.map((r, i) => ({ ...r, __i: i }));
    if (filter === "all" || !result) return withIdx;
    return withIdx.filter((r) => {
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

  const columns = useMemo<ColumnDef<Row>[]>(() => cols.map(([field, header, kind]) => ({
    accessorKey: field, header,
    cell: ({ row }: { row: { original: Row } }) => {
      const i = row.original.__i; const val = row.original[field];
      const inner = !editable
        ? <span>{String(val ?? "")}</span>
        : kind === "t" ? <EditableCell value={val} type="text" onSave={(v: unknown) => updateCell(i, field, v)} />
        : kind === "n" ? <EditableCell value={val} type="number" onSave={(v: unknown) => updateCell(i, field, num(v))} />
        : <EditableCell value={val} type="dropdown" options={optsFor(kind)} onSave={(v: unknown) => updateCell(i, field, v)} />;
      return <div style={{ background: cellBg(i, field), margin: "-6px -10px", padding: "6px 10px" }}>{inner}</div>;
    },
  })), [cols, editable, cellBg, updateCell, optsFor]);

  const loadData = async () => {
    setBusy(true);
    try { const d = await getAllTools(groupId); setRows(Array.isArray(d) ? d as Row[] : []); setMode("loaded"); setResult(null); setFilter("all"); }
    catch { showError("Load failed", "Could not load tools for this client / group."); }
    finally { setBusy(false); }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext !== ".xlsx") { showError("Invalid Excel Version", "Please upload a .xlsx file only."); if (fileRef.current) fileRef.current.value = ""; return; }
    const nameNoExt = file.name.slice(0, file.name.lastIndexOf(".")).trim();
    if (nameNoExt.toLowerCase() !== groupName.toLowerCase()) { showError("Invalid File Name", `Expected: ${groupName}.xlsx`); if (fileRef.current) fileRef.current.value = ""; return; }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        const headerCols: string[] = (() => {
          const ref = ws["!ref"]; if (!ref) return json.length ? Object.keys(json[0]) : [];
          const { s, e } = XLSX.utils.decode_range(ref); const c: string[] = [];
          for (let col = s.c; col <= e.c; col++) { const cell = ws[XLSX.utils.encode_cell({ r: s.r, c: col })]; if (cell?.v !== undefined && String(cell.v).trim() !== "") c.push(String(cell.v)); }
          return c;
        })();
        const cv = validateExcelColumns(headerCols, getToolMasterStandardColumns(groupId));
        if (!cv.isValid) { showError("Invalid Excel format", cv.message); if (fileRef.current) fileRef.current.value = ""; return; }
        const g = (r: Record<string, unknown>, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v !== undefined && v !== null && String(v) !== "") return v; } return undefined; };
        const mapped: Row[] = json.map((r, index) => recompute({
          __i: index, toolGroupID: groupId,
          clientName: g(r, "ClientName", "LedgerName", "clientName"), jobName: g(r, "JobName", "jobName"), toolName: g(r, "ToolName", "toolName"),
          toolType: g(r, "ToolType", "toolType"), toolRefCode: g(r, "ToolRefCode", "toolRefCode"),
          sizeL: g(r, "SizeL", "sizeL"), sizeW: g(r, "SizeW", "sizeW"), sizeH: g(r, "SizeH", "sizeH"),
          upsAround: g(r, "UpsAround", "upsAround"), upsAcross: g(r, "UpsAcross", "upsAcross"), totalUps: g(r, "TotalUps", "totalUps"),
          productHSNName: g(r, "ProductHSNName", "productHSNName"), purchaseUnit: g(r, "PurchaseUnit", "purchaseUnit"), purchaseRate: g(r, "PurchaseRate", "purchaseRate"),
          stockUnit: g(r, "StockUnit", "stockUnit"), unitSymbol: g(r, "UnitSymbol", "unitSymbol"),
          manufacturer: g(r, "Manufacturer", "manufacturer"), noOfTeeth: g(r, "NoOfTeeth", "noOfTeeth"),
          circumferenceMM: g(r, "CircumferenceMM", "circumferenceMM"), circumferenceInch: g(r, "CircumferenceInch", "circumferenceInch"),
          bcm: g(r, "BCM", "bcm"), lpi: g(r, "LPI", "lpi"), aroundGap: g(r, "AroundGap", "aroundGap"), acrossGap: g(r, "AcrossGap", "acrossGap"),
          referenceToolNo: g(r, "ReferenceToolNo", "referenceToolNo"), estimateRate: g(r, "EstimateRate", "estimateRate"),
          positive: g(r, "Positive", "positive"), negative: g(r, "Negative", "negative"), master: g(r, "Master", "master"), sim: g(r, "Sim", "sim"), location: g(r, "Location", "location"),
        }, groupId, groupName)).filter((row) => NON_EMPTY.some((k) => { const v = row[k]; return v !== undefined && v !== null && String(v).trim() !== ""; }));
        setRows(mapped); setMode("preview"); setResult(null); setFilter("all");
        showSuccess("File loaded", `${mapped.length} row(s) loaded. Click "Check Validation".`, 2500);
      } catch { showError("Parse failed", "Could not read the Excel file."); }
      finally { if (fileRef.current) fileRef.current.value = ""; }
    };
    reader.readAsBinaryString(file);
  };

  const buildSummary = (res: ToolValidationResultDto) => {
    const s = res.summary;
    const total = (s.duplicateCount ?? 0) + (s.missingDataCount ?? 0) + (s.mismatchCount ?? 0) + (s.invalidContentCount ?? 0);
    const byCol = new Map<string, Set<string>>();
    res.rows.forEach((row) => {
      if (row.rowStatus === ValidationStatus.Duplicate) byCol.set("Tool", (byCol.get("Tool") ?? new Set()).add("Duplicate data found"));
      (row.cellValidations ?? []).forEach((c) => {
        const reason = c.status === ValidationStatus.MissingData ? "Missing" : c.status === ValidationStatus.Mismatch ? "Master Mismatch" : c.status === ValidationStatus.InvalidContent ? "Invalid Format" : "Invalid";
        byCol.set(c.columnName || "Unknown", (byCol.get(c.columnName || "Unknown") ?? new Set()).add(reason));
      });
    });
    const messages = Array.from(byCol.entries()).map(([c, rs]) => `${c} — ${Array.from(rs).join(", ")}`);
    return { title: `Validation Failed: ${total} Issue${total !== 1 ? "s" : ""} Found`, messages: messages.length ? messages : ["Please review the grid for specific issues."] };
  };

  const validate = async () => {
    if (!rows.length) return; setBusy(true); setResult(null);
    try {
      const payload = rows.map((r) => cleanForApi(r, groupId, groupName));
      const res = await validateTools(payload, groupId); setResult(res); setMode("validated");
      if (res.isValid) showSuccess("Validation passed", "All records are valid.", 2500);
    } catch { showError("Validation failed", "Could not validate. Please try again."); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!rows.length) { showError("No data", "Nothing to import."); return; }
    setBusy(true);
    try {
      const payload = rows.map((r) => cleanForApi(r, groupId, groupName));
      const res = await validateTools(payload, groupId); setResult(res);
      if (!res.isValid) { showError("Fix errors first", "Correct the issues shown in the Validation Summary before saving."); return; }
      const imp = await importTools(payload, groupId);
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
      const ws = wb.addWorksheet(groupName.slice(0, 31));
      ws.addRow(cols.map((c) => c.header)); ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(cols.map((c) => (r as Record<string, unknown>)[c.key] ?? "")));
      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `${groupName}.xlsx`);
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
          for (const r of selected) { const id = (r as { toolID?: number }).toolID; if (id) await softDeleteTool(id); }
          showSuccess("Deleted", `${n} record(s) deleted.`, 2500); setSelected([]); await loadData();
        } catch { showError("Delete failed", "Could not delete the selected records."); }
        finally { setBusy(false); }
      } else { const drop = new Set(selected.map((r) => r.__i)); setRows((prev) => prev.filter((_, i) => !drop.has(i))); setResult(null); setSelected([]); }
    });
  };

  const startClear = async () => {
    setBusy(true);
    let count = 1;
    try { count = await getToolCount(groupId); } catch { /* proceed */ } finally { setBusy(false); }
    if (count === 0) { if (freshMode) { setFreshMode(false); fileRef.current?.click(); return; } showError("No data", "No tool data to clear for this group."); return; }
    setClearError(""); setClearOpen(true);
  };
  const freshUpload = () => { setFreshMode(true); startClear(); };
  const doClear = async (username: string, password: string, reason: string) => {
    setClearError(""); setBusy(true);
    try {
      const res = await clearAllToolData(username, password, reason, groupId);
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
        <DataGrid<Row>
          data={shown} columns={columns} getRowId={(r) => String(r.__i)} title={`Tool Master · ${groupName} · ${mode}`} loading={busy}
          onRowSelect={setSelected} enableRowSelection rowSelectionMode="multi"
          enableColumnResizing enableSorting enableSearch enablePagination enableExport
        />
      ) : (
        <div style={{ padding: "36px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          Group <b>{groupName}</b> selected. Click <b>Load Data</b> to view existing tools, or <b>Upload Excel</b> to import (use <b>Download Template</b> for the <b>{groupName}.xlsx</b> format).
        </div>
      )}

      <SecurityClearModal open={clearOpen} groupLabel={groupName} companyName={client.companyName} companyUserId={client.companyUserId}
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
