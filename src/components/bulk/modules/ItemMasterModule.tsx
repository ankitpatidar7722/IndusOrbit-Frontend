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
  getAllItems, getItemHSNGroups, getItemUnits, getItemSubGroups, softDeleteItem,
  validateItems, importItems, clearAllItemData, getItemCount,
  ValidationStatus, type ItemMasterDto, type ItemValidationResultDto, type FieldUnitsDto,
} from "@/bulk/services/api";
import { getItemMasterStandardColumns, validateExcelColumns } from "@/bulk/utils/excelColumnValidator";
import MasterToolbar from "@/components/bulk/modules/MasterToolbar";
import SecurityClearModal from "@/components/bulk/modules/SecurityClearModal";
import ValidationSummary from "@/components/bulk/modules/ValidationSummary";
import { bulkApiError } from "@/components/bulk/modules/apiError";

// Item Master — Indus360-native rebuild of ItemMasterEnhanced. GROUP-BASED: the column set,
// computed fields and composite itemName all switch on groupName (exact, case-sensitive). Operates
// on the picked client's DB via X-Target-Company. Same feature set as HSN/SparePart + per-group logic.

type Row = Record<string, unknown> & { __i: number };
type Mode = "idle" | "loaded" | "preview" | "validated";
type Filter = "all" | "valid" | "duplicate" | "missing" | "mismatch" | "invalid";
// col kind: t=text n=number ro=readonly(computed) | pu/eu/su=unit dropdowns | hsn | sub | bool | string[]=literal dropdown
type Kind = "t" | "n" | "ro" | "pu" | "eu" | "su" | "hsn" | "sub" | "bool" | string[];
type Col = [field: string, header: string, kind: Kind];

const BOOL_OPTS = [{ label: "TRUE", value: "TRUE" }, { label: "FALSE", value: "FALSE" }];
const PACKING = ["Sheet", "Gross", "Ream", "Packet"];
const CERT = ["NONE", "FSC", "PEFC"];
const ROLL_TYPE = ["Paper", "Film"];

// Per-group columns (grid order, from ItemMasterEnhanced columnDefs).
const GROUP_COLS: Record<string, Col[]> = {
  "PAPER": [
    ["paperGroup", "PaperGroup", "t"], ["quality", "Quality", "t"], ["gsm", "GSM", "n"],
    ["manufecturer", "Manufecturer", "t"], ["finish", "Finish", "t"], ["manufecturerItemCode", "ManufecturerItemCode", "t"],
    ["caliper", "Caliper", "ro"], ["sizeW", "SizeW", "n"], ["sizeL", "SizeL", "n"],
    ["purchaseUnit", "PurchaseUnit", "pu"], ["purchaseRate", "PurchaseRate", "n"], ["shelfLife", "ShelfLife", "n"],
    ["estimationUnit", "EstimationUnit", "eu"], ["estimationRate", "EstimationRate", "n"], ["stockUnit", "StockUnit", "su"],
    ["minimumStockQty", "MinimumStockQty", "n"], ["isStandardItem", "IsStandardItem", "t"], ["isRegularItem", "IsRegularItem", "t"],
    ["packingType", "PackingType", PACKING], ["unitPerPacking", "UnitPerPacking", "n"], ["wtPerPacking", "WtPerPacking", "n"],
    ["itemSize", "ItemSize", "ro"], ["stockRefCode", "StockRefCode", "t"], ["itemName", "ItemName", "t"],
    ["productHSNName", "ProductHSNName", "hsn"], ["certificationType", "Certification Type", CERT],
  ],
  "REEL": [
    ["paperGroup", "PaperGroup", "t"], ["quality", "Quality", "t"], ["bf", "BF", "t"], ["sizeW", "SizeW", "n"], ["gsm", "GSM", "n"],
    ["caliper", "Caliper", "ro"], ["manufecturer", "Manufecturer", "t"], ["manufecturerItemCode", "ManufecturerItemCode", "t"],
    ["finish", "Finish", "t"], ["shelfLife", "ShelfLife", "n"], ["purchaseUnit", "PurchaseUnit", "pu"], ["purchaseRate", "PurchaseRate", "n"],
    ["estimationUnit", "EstimationUnit", "eu"], ["estimationRate", "EstimationRate", "n"], ["stockUnit", "StockUnit", "su"],
    ["minimumStockQty", "MinimumStockQty", "n"], ["isStandardItem", "IsStandardItem", "bool"], ["isRegularItem", "IsRegularItem", "bool"],
    ["stockRefCode", "StockRefCode", "t"], ["productHSNName", "ProductHSNName", "hsn"], ["certificationType", "CertificationType", CERT],
    ["itemName", "ItemName", "t"],
  ],
  "INK & ADDITIVES": [
    ["itemSubGroupName", "ItemSubGroupName", "sub"], ["itemType", "ItemType", "t"], ["inkColour", "InkColour", "t"], ["pantoneCode", "PantoneCode", "t"],
    ["manufecturer", "Manufecturer", "t"], ["manufecturerItemCode", "ManufecturerItemCode", "t"], ["shelfLife", "ShelfLife", "n"],
    ["purchaseUnit", "PurchaseUnit", "pu"], ["purchaseRate", "PurchaseRate", "n"], ["estimationUnit", "EstimationUnit", "eu"], ["estimationRate", "EstimationRate", "n"],
    ["stockUnit", "StockUnit", "su"], ["minimumStockQty", "MinimumStockQty", "n"], ["stockType", "StockType", "t"],
    ["isStandardItem", "IsStandardItem", "bool"], ["isRegularItem", "IsRegularItem", "bool"], ["purchaseOrderQuantity", "PurchaseOrderQuantity", "n"],
    ["stockRefCode", "StockRefCode", "t"], ["productHSNName", "ProductHSNName", "hsn"], ["itemName", "ItemName", "t"],
  ],
  "OTHER MATERIAL": [
    ["itemSubGroupName", "ItemSubGroupName", "sub"], ["quality", "Quality", "t"], ["manufecturer", "Manufecturer", "t"], ["manufecturerItemCode", "ManufecturerItemCode", "t"],
    ["shelfLife", "ShelfLife", "n"], ["purchaseUnit", "PurchaseUnit", "pu"], ["purchaseRate", "PurchaseRate", "n"], ["estimationUnit", "EstimationUnit", "eu"],
    ["estimationRate", "EstimationRate", "n"], ["stockUnit", "StockUnit", "su"], ["minimumStockQty", "MinimumStockQty", "n"], ["stockType", "StockType", "t"],
    ["isStandardItem", "IsStandardItem", "bool"], ["isRegularItem", "IsRegularItem", "bool"], ["purchaseOrderQuantity", "PurchaseOrderQuantity", "n"],
    ["stockRefCode", "StockRefCode", "t"], ["productHSNName", "ProductHSNName", "hsn"], ["itemName", "ItemName", "t"],
  ],
  "VARNISHES & COATINGS": [
    ["itemType", "ItemType", "t"], ["quality", "Quality", "t"], ["itemSubGroupName", "ItemSubGroupName", "sub"], ["manufecturer", "Manufecturer", "t"],
    ["manufecturerItemCode", "ManufecturerItemCode", "t"], ["shelfLife", "ShelfLife", "n"], ["purchaseUnit", "PurchaseUnit", "pu"], ["purchaseRate", "PurchaseRate", "n"],
    ["estimationUnit", "EstimationUnit", "eu"], ["estimationRate", "EstimationRate", "n"], ["stockUnit", "StockUnit", "su"], ["minimumStockQty", "MinimumStockQty", "n"],
    ["stockType", "StockType", "t"], ["isStandardItem", "IsStandardItem", "bool"], ["isRegularItem", "IsRegularItem", "bool"], ["purchaseOrderQuantity", "PurchaseOrderQuantity", "n"],
    ["stockRefCode", "StockRefCode", "t"], ["productHSNName", "ProductHSNName", "hsn"], ["itemName", "ItemName", "t"],
  ],
  "LAMINATION FILM": [
    ["quality", "Quality", "t"], ["itemSubGroupName", "ItemSubGroupName", "sub"], ["manufecturer", "Manufecturer", "t"], ["manufecturerItemCode", "ManufecturerItemCode", "t"],
    ["sizeW", "SizeW", "n"], ["thickness", "Thickness", "n"], ["density", "Density", "n"], ["shelfLife", "ShelfLife", "n"],
    ["purchaseUnit", "PurchaseUnit", "pu"], ["purchaseRate", "PurchaseRate", "n"], ["estimationUnit", "EstimationUnit", "eu"], ["estimationRate", "EstimationRate", "n"],
    ["stockUnit", "StockUnit", "su"], ["minimumStockQty", "MinimumStockQty", "n"], ["stockType", "StockType", "t"], ["isStandardItem", "IsStandardItem", "bool"],
    ["isRegularItem", "IsRegularItem", "bool"], ["purchaseOrderQuantity", "PurchaseOrderQuantity", "n"], ["stockRefCode", "StockRefCode", "t"],
    ["productHSNName", "ProductHSNName", "hsn"], ["itemName", "ItemName", "t"],
  ],
  "ROLL": [
    ["itemType", "ItemType", ROLL_TYPE], ["quality", "Quality", "t"], ["manufecturer", "Manufacturer", "t"], ["manufecturerItemCode", "ManufacturerItemCode", "t"],
    ["gsm", "GSM", "n"], ["releaseGSM", "ReleaseGSM", "n"], ["adhesiveGSM", "AdhesiveGSM", "n"], ["sizeW", "SizeW", "n"], ["thickness", "Thickness", "n"],
    ["density", "Density", "n"], ["totalGSM", "TotalGSM", "ro"], ["shelfLife", "ShelfLife", "n"], ["purchaseUnit", "PurchaseUnit", "pu"], ["purchaseRate", "PurchaseRate", "n"],
    ["estimationUnit", "EstimationUnit", "eu"], ["estimationRate", "EstimationRate", "n"], ["stockUnit", "StockUnit", "su"], ["minimumStockQty", "MinimumStockQty", "n"],
    ["isStandardItem", "IsStandardItem", "bool"], ["isRegularItem", "IsRegularItem", "bool"], ["stockRefCode", "StockRefCode", "t"],
    ["productHSNName", "ProductHSNName", "hsn"], ["itemName", "ItemName", "t"],
  ],
  "SHIPPER CARTON": [
    ["quality", "Quality", "t"], ["itemSubGroupName", "ItemSubGroupName", "sub"], ["noOfPly", "NoOfPly", "n"], ["itemType", "ItemType", "t"],
    ["sizeL", "SizeL", "n"], ["sizeW", "SizeW", "n"], ["sizeH", "SizeH", "n"], ["manufecturer", "Manufecturer", "t"], ["manufecturerItemCode", "ManufecturerItemCode", "t"],
    ["emptyCartonWt", "EmptyCartonWt", "n"], ["purchaseUnit", "PurchaseUnit", "pu"], ["purchaseRate", "PurchaseRate", "n"], ["purchaseOrderQuantity", "PurchaseOrderQuantity", "n"],
    ["shelfLife", "ShelfLife", "n"], ["estimationUnit", "EstimationUnit", "eu"], ["estimationRate", "EstimationRate", "n"], ["stockUnit", "StockUnit", "su"],
    ["minimumStockQty", "MinimumStockQty", "n"], ["stockType", "StockType", "t"], ["isRegularItem", "IsRegularItem", "bool"], ["productHSNName", "ProductHSNName", "hsn"],
    ["capacity", "Capacity", "n"], ["cbf", "CBF", "n"], ["cbm", "CBM", "n"], ["stockRefCode", "StockRefCode", "t"], ["itemName", "ItemName", "t"],
  ],
  "__DEFAULT__": [
    ["itemName", "Item Name", "t"], ["hsnGroup", "HSN Group", "hsn"], ["stockUnit", "Stock Unit", "su"], ["purchaseUnit", "Purchase Unit", "pu"],
    ["estimationUnit", "Estimation Unit", "eu"], ["unitPerPacking", "Unit/Packing", "n"], ["wtPerPacking", "Wt/Packing", "n"], ["conversionFactor", "Conv. Factor", "n"],
    ["stockType", "Stock Type", "t"], ["stockCategory", "Stock Category", "t"], ["sizeW", "Size W", "n"], ["sizeL", "Size L", "n"],
    ["purchaseRate", "Purchase Rate", "n"], ["stockRefCode", "Stock Ref Code", "t"], ["itemDescription", "Description", "t"],
  ],
};
const colsForGroup = (g: string): Col[] => GROUP_COLS[g] ?? GROUP_COLS["__DEFAULT__"];

const NUMERIC = ["gsm", "sizeW", "sizeL", "sizeH", "purchaseRate", "caliper", "estimationRate", "minimumStockQty", "unitPerPacking", "wtPerPacking", "conversionFactor", "shelfLife", "purchaseOrderQuantity", "thickness", "density", "releaseGSM", "adhesiveGSM", "totalGSM", "noOfPly", "emptyCartonWt", "capacity", "cbf", "cbm", "itemID", "itemGroupID", "productHSNID", "itemSubGroupID"];
const BOOL_FIELDS = ["isStandardItem", "isRegularItem", "isDeletedTransaction"];
const num = (v: unknown): number => { const n = parseFloat(String(v ?? "").trim()); return isNaN(n) ? 0 : n; };
const round1 = (v: number) => parseFloat(v.toFixed(1));

// Composite itemName + computed fields (caliper/itemSize/wtPerPacking/totalGSM), per group.
function recompute(row: Row, group: string): Row {
  const r: Row = { ...row };
  const g = (r.gsm != null ? num(r.gsm) : 0), sw = num(r.sizeW), sl = num(r.sizeL), upp = num(r.unitPerPacking);
  if (group === "PAPER" || group === "REEL") r.caliper = g > 0 ? parseFloat((g / 1000).toFixed(3)) : null;
  if (["PAPER", "REEL", "ROLL", "LAMINATION FILM", "FOIL"].includes(group) && r.sizeW != null && r.sizeW !== "") r.sizeW = round1(sw);
  if (group === "PAPER") {
    if (r.sizeL != null && r.sizeL !== "") r.sizeL = round1(sl);
    r.itemSize = sw > 0 && sl > 0 ? `${round1(sw)} X ${round1(sl)}` : null;
    r.wtPerPacking = sw > 0 && sl > 0 && g > 0 && upp > 0 ? parseFloat(((sw * sl * g * upp) / 1000000000).toFixed(9)) : null;
  }
  if (group === "ROLL") r.totalGSM = num(r.gsm) + num(r.releaseGSM) + num(r.adhesiveGSM);

  const s = (k: string) => { const v = r[k]; return v == null || v === "" ? "" : String(v); };
  const np = (k: string, suf?: string) => { const v = num(r[k]); return v > 0 ? (suf ? `${v} ${suf}` : String(v)) : ""; };
  const join = (parts: (string | false)[], sep: string) => parts.filter((p) => p && p !== "-").join(sep);
  let name: string | null = null;
  switch (group) {
    case "PAPER": name = join([s("quality"), np("gsm", "GSM"), s("manufecturer"), s("finish"), s("itemSize") && `${s("itemSize")} MM`], " ,"); break;
    case "REEL": name = join([s("bf"), s("quality"), np("gsm", "GSM"), s("manufecturer"), s("finish"), np("sizeW"), r.caliper != null ? String(r.caliper) : ""], " "); break;
    case "INK & ADDITIVES": name = join([s("itemType"), s("inkColour"), s("pantoneCode")], ", "); break;
    case "VARNISHES & COATINGS": name = join([s("itemType"), s("quality")], ", "); break;
    case "LAMINATION FILM": name = join([s("quality"), np("sizeW", "MM"), np("thickness", "MICRON"), s("manufecturer")], ", "); break;
    case "FOIL": name = join([s("manufecturerItemCode"), s("quality"), np("sizeW", "mm")], ", "); break;
    case "ROLL": name = join([s("quality"), np("gsm", "GSM"), np("releaseGSM", "GSM"), np("adhesiveGSM", "GSM"), s("manufecturer"), np("sizeW", "MM")], ", "); break;
    case "OTHER MATERIAL": name = s("quality"); break;
    case "SHIPPER CARTON": name = join([s("quality"), np("sizeL") && `${np("sizeL")} x`, np("sizeW") && `${np("sizeW")} x`, np("sizeH"), np("noOfPly") && `${np("noOfPly")} Ply`, s("manufecturerItemCode")], ", "); break;
    default: name = null; // __DEFAULT__ / unknown → user-entered itemName
  }
  if (name != null) r.itemName = name;
  return r;
}

// Build the API payload: strip helpers, coerce numbers/bools, collect invalid raws (drives purple highlight).
function cleanForApi(row: Row, groupId: number, group: string): ItemMasterDto {
  const src = recompute(row, group);
  const out: Record<string, unknown> = {}; const rawValues: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === "__i" || k === "hsnCode" || k === "tempId" || k === "dynamicFields") continue;
    if (v === undefined || v === null || v === "") continue;
    if (NUMERIC.includes(k)) { const n = Number(v); if (isNaN(n)) rawValues[k] = v; else out[k] = n; }
    else if (BOOL_FIELDS.includes(k)) { if (v === "TRUE" || v === true) out[k] = true; else if (v === "FALSE" || v === false) out[k] = false; else rawValues[k] = v; }
    else out[k] = String(v); // remaining item fields are C# strings — coerce Excel numerics
  }
  if (out.sizeW != null) out.sizeW = round1(Number(out.sizeW));
  if (out.sizeL != null && group === "PAPER") out.sizeL = round1(Number(out.sizeL));
  if (out.wtPerPacking != null) out.wtPerPacking = parseFloat(Number(out.wtPerPacking).toFixed(9));
  out.itemGroupID = groupId;
  if (Object.keys(rawValues).length) out.rawValues = rawValues;
  return out as unknown as ItemMasterDto;
}

// Upload defaults (per group), applied before recompute.
function applyDefaults(row: Row, group: string): Row {
  const r: Row = { ...row };
  if (r.shelfLife == null || r.shelfLife === "") r.shelfLife = 365;
  if (r.isStandardItem == null || r.isStandardItem === "") r.isStandardItem = "TRUE";
  if (r.isRegularItem == null || r.isRegularItem === "") r.isRegularItem = "TRUE";
  if (r.purchaseOrderQuantity == null || r.purchaseOrderQuantity === "") r.purchaseOrderQuantity = 0;
  if (["INK & ADDITIVES", "VARNISHES & COATINGS", "OTHER MATERIAL", "LAMINATION FILM", "FOIL", "ROLL", "SHIPPER CARTON"].includes(group) && (r.stockType == null || r.stockType === "")) r.stockType = "JOB CONSUMABLES";
  if (group === "INK & ADDITIVES" && !r.itemType) r.itemType = "INK";
  if (group === "VARNISHES & COATINGS" && !r.itemType) r.itemType = "Varnish";
  if (group === "ROLL" && !r.itemType) r.itemType = "Paper";
  if (group === "SHIPPER CARTON" && !r.itemType) r.itemType = "E";
  if (group === "PAPER" && !r.paperGroup) r.paperGroup = "Paper";
  if (group === "REEL") { if (!r.paperGroup) r.paperGroup = "Reel"; if (r.bf == null || r.bf === "") r.bf = "0"; }
  return r;
}

const NON_EMPTY = ["quality", "gsm", "manufecturer", "finish", "manufecturerItemCode", "sizeW", "sizeL", "sizeH", "purchaseUnit", "purchaseRate", "stockUnit", "estimationUnit", "estimationRate", "productHSNName", "hsnGroup", "itemSubGroupName", "inkColour", "pantoneCode", "bf", "thickness", "density", "releaseGSM", "adhesiveGSM", "noOfPly", "emptyCartonWt", "capacity", "cbf", "cbm"];

const CRED_INP: CSSProperties = { padding: "8px 10px", borderRadius: 8, fontSize: 13, width: "100%", border: "1px solid rgb(var(--border-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" };
const CELL_BG: Record<number, string> = { [ValidationStatus.MissingData]: "rgba(59,130,246,0.16)", [ValidationStatus.Mismatch]: "rgba(234,179,8,0.20)", [ValidationStatus.InvalidContent]: "rgba(168,85,247,0.18)" };

export default function ItemMasterModule({ client, groupId, groupName }: { client: BulkClientContext; groupId: number; groupName: string }) {
  const { showSuccess, showError, showConfirmation, AlertComponent } = useModalAlert();
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const { setHasData } = useContext(BulkCompactContext);
  useEffect(() => { setHasData(mode !== "idle"); }, [mode, setHasData]);
  const [result, setResult] = useState<ItemValidationResultDto | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [units, setUnits] = useState<FieldUnitsDto>({ purchaseUnit: [], estimationUnit: [], stockUnit: [] });
  const [hsnOpts, setHsnOpts] = useState<{ label: string; value: string }[]>([]);
  const [subOpts, setSubOpts] = useState<{ label: string; value: string }[]>([]);
  const [summary, setSummary] = useState<{ title: string; messages: string[] } | null>(null);
  const [selected, setSelected] = useState<Row[]>([]);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearError, setClearError] = useState("");
  const [freshMode, setFreshMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editable = mode === "preview" || mode === "validated";
  const cols = useMemo(() => colsForGroup(groupName), [groupName]);
  const toOpts = (a: string[]) => a.map((v) => ({ label: v, value: v }));

  useEffect(() => {
    getItemHSNGroups().then((g) => setHsnOpts((g ?? []).map((h) => ({ label: h.displayName, value: h.displayName })).filter((o) => o.value))).catch(() => setHsnOpts([]));
    getItemUnits(groupId).then((u) => setUnits(u ?? { purchaseUnit: [], estimationUnit: [], stockUnit: [] })).catch(() => setUnits({ purchaseUnit: [], estimationUnit: [], stockUnit: [] }));
    getItemSubGroups(groupId).then((s) => setSubOpts((s ?? []).map((x) => ({ label: x.itemSubGroupName, value: x.itemSubGroupName })).filter((o) => o.value))).catch(() => setSubOpts([]));
  }, [groupId, client.companyUserId]);

  const optsFor = useCallback((kind: Kind): { label: string; value: string }[] => {
    if (kind === "pu") return toOpts(units.purchaseUnit); if (kind === "eu") return toOpts(units.estimationUnit); if (kind === "su") return toOpts(units.stockUnit);
    if (kind === "hsn") return hsnOpts; if (kind === "sub") return subOpts; if (kind === "bool") return BOOL_OPTS;
    if (Array.isArray(kind)) return toOpts(kind); return [];
  }, [units, hsnOpts, subOpts]);

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
    setRows((prev) => prev.map((r, i) => i === rowIndex ? recompute({ ...r, [field]: value }, groupName) : r));
  }, [groupName]);

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
      const bg = cellBg(i, field);
      const inner = kind === "ro" || !editable
        ? <span style={{ color: kind === "ro" ? "rgb(var(--fg-muted))" : undefined }}>{String(val ?? "")}</span>
        : kind === "t" ? <EditableCell value={val} type="text" onSave={(v: unknown) => updateCell(i, field, v)} />
        : kind === "n" ? <EditableCell value={val} type="number" onSave={(v: unknown) => updateCell(i, field, num(v))} />
        : <EditableCell value={val} type="dropdown" options={optsFor(kind)} onSave={(v: unknown) => updateCell(i, field, v)} />;
      return <div style={{ background: kind === "ro" ? "rgba(148,163,184,0.14)" : bg, margin: "-6px -10px", padding: "6px 10px" }}>{inner}</div>;
    },
  })), [cols, editable, cellBg, updateCell, optsFor]);

  const loadData = async () => {
    setBusy(true);
    try { const d = await getAllItems(groupId); setRows(Array.isArray(d) ? d as Row[] : []); setMode("loaded"); setResult(null); setFilter("all"); }
    catch { showError("Load failed", "Could not load items for this client / group."); }
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
        const cv = validateExcelColumns(headerCols, getItemMasterStandardColumns(groupName));
        if (!cv.isValid) { showError("Invalid Excel format", cv.message); if (fileRef.current) fileRef.current.value = ""; return; }
        const g = (r: Record<string, unknown>, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v !== undefined && v !== null && String(v) !== "") return v; } return undefined; };
        const mapped: Row[] = json.map((r, index) => {
          const row: Row = {
            __i: index, itemGroupID: groupId,
            itemName: g(r, "ItemName", "itemName"), hsnGroup: g(r, "HSNGroup", "hsnGroup"),
            stockUnit: g(r, "StockUnit", "stockUnit"), purchaseUnit: g(r, "PurchaseUnit", "purchaseUnit"), estimationUnit: g(r, "EstimationUnit", "estimationUnit"),
            unitPerPacking: g(r, "UnitPerPacking", "unitPerPacking"), wtPerPacking: g(r, "WtPerPacking", "wtPerPacking"), conversionFactor: g(r, "ConversionFactor", "conversionFactor"),
            stockType: g(r, "StockType", "stockType"), stockCategory: g(r, "StockCategory", "stockCategory"),
            sizeW: g(r, "SizeW", "sizeW"), sizeL: g(r, "SizeL", "sizeL"), sizeH: g(r, "SizeH", "sizeH"),
            purchaseRate: g(r, "PurchaseRate", "purchaseRate"), stockRefCode: g(r, "StockRefCode", "stockRefCode"), itemDescription: g(r, "ItemDescription", "itemDescription"),
            quality: g(r, "Quality", "quality"), gsm: g(r, "GSM", "gsm"), manufecturer: g(r, "Manufecturer", "Manufacturer", "manufecturer"),
            finish: g(r, "Finish", "finish"), manufecturerItemCode: g(r, "ManufecturerItemCode", "ManufacturerItemCode", "manufecturerItemCode"),
            shelfLife: g(r, "ShelfLife", "shelfLife"), estimationRate: g(r, "EstimationRate", "estimationRate"), minimumStockQty: g(r, "MinimumStockQty", "minimumStockQty"),
            packingType: g(r, "PackingType", "packingType"), certificationType: g(r, "CertificationType", "certificationType") ?? "NONE",
            paperGroup: g(r, "PaperGroup", "paperGroup"), productHSNName: g(r, "ProductHSNName", "productHSNName"),
            itemSubGroupName: g(r, "ItemSubGroupName", "itemSubGroupName"), itemType: g(r, "ItemType", "itemType"),
            inkColour: g(r, "InkColour", "inkColour"), pantoneCode: g(r, "PantoneCode", "pantoneCode"),
            purchaseOrderQuantity: g(r, "PurchaseOrderQuantity", "purchaseOrderQuantity"), thickness: g(r, "Thickness", "thickness"), density: g(r, "Density", "density"),
            releaseGSM: g(r, "ReleaseGSM", "releaseGSM"), adhesiveGSM: g(r, "AdhesiveGSM", "adhesiveGSM"), totalGSM: g(r, "TotalGSM", "totalGSM"),
            noOfPly: g(r, "NoOfPly", "noOfPly"), emptyCartonWt: g(r, "EmptyCartonWt", "emptyCartonWt"), capacity: g(r, "Capacity", "capacity"),
            cbf: g(r, "CBF", "cbf"), cbm: g(r, "CBM", "cbm"),
          };
          const bf = g(r, "BF", "bf"); if (bf !== undefined) row.bf = bf;
          const isS = g(r, "IsStandardItem", "isStandardItem"); if (isS !== undefined) row.isStandardItem = String(isS).toUpperCase() === "FALSE" ? "FALSE" : "TRUE";
          const isR = g(r, "IsRegularItem", "isRegularItem"); if (isR !== undefined) row.isRegularItem = String(isR).toUpperCase() === "FALSE" ? "FALSE" : "TRUE";
          return recompute(applyDefaults(row, groupName), groupName);
        }).filter((row) => NON_EMPTY.some((k) => { const v = row[k]; return v !== undefined && v !== null && String(v).trim() !== ""; }));
        setRows(mapped); setMode("preview"); setResult(null); setFilter("all");
        showSuccess("File loaded", `${mapped.length} row(s) loaded. Click "Check Validation".`, 2500);
      } catch { showError("Parse failed", "Could not read the Excel file."); }
      finally { if (fileRef.current) fileRef.current.value = ""; }
    };
    reader.readAsBinaryString(file);
  };

  const buildSummary = (res: ItemValidationResultDto) => {
    const s = res.summary;
    const total = (s.duplicateCount ?? 0) + (s.missingDataCount ?? 0) + (s.mismatchCount ?? 0) + (s.invalidContentCount ?? 0);
    const byCol = new Map<string, Set<string>>();
    res.rows.forEach((row) => {
      if (row.rowStatus === ValidationStatus.Duplicate) byCol.set("Item", (byCol.get("Item") ?? new Set()).add("Duplicate data found"));
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
      const res = await validateItems(payload, groupId); setResult(res); setMode("validated");
      if (res.isValid) showSuccess("Validation passed", "All records are valid.", 2500);
    } catch (e) { console.error("[Item validate]", e); showError("Validation failed", bulkApiError(e, "Could not validate.")); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!rows.length) { showError("No data", "Nothing to import."); return; }
    setBusy(true);
    try {
      const payload = rows.map((r) => cleanForApi(r, groupId, groupName));
      const res = await validateItems(payload, groupId); setResult(res);
      if (!res.isValid) { showError("Fix errors first", "Correct the issues shown in the Validation Summary before saving."); return; }
      const imp = await importItems(payload, groupId);
      if (imp.success) {
        showSuccess("Imported", `${imp.importedRows ?? rows.length} record(s) imported.`, 3000);
        if ((imp.errorRows ?? 0) > 0 && imp.errorMessages?.length) setSummary({ title: `${imp.errorRows} Row(s) Failed During Import`, messages: imp.errorMessages });
        setResult(null); setMode("idle"); await loadData();
      } else setSummary({ title: "Import Failed", messages: imp.errorMessages?.length ? imp.errorMessages : [imp.message || "Import failed."] });
    } catch (e) { console.error("[Item save]", e); showError("Import failed", bulkApiError(e, "Could not import.")); }
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
          for (const r of selected) { const id = (r as { itemID?: number }).itemID; if (id) await softDeleteItem(id); }
          showSuccess("Deleted", `${n} record(s) deleted.`, 2500); setSelected([]); await loadData();
        } catch { showError("Delete failed", "Could not delete the selected records."); }
        finally { setBusy(false); }
      } else { const drop = new Set(selected.map((r) => r.__i)); setRows((prev) => prev.filter((_, i) => !drop.has(i))); setResult(null); setSelected([]); }
    });
  };

  const startClear = async () => {
    setBusy(true);
    let count = 1;
    try { count = await getItemCount(groupId); } catch { /* proceed */ } finally { setBusy(false); }
    if (count === 0) { if (freshMode) { setFreshMode(false); fileRef.current?.click(); return; } showError("No data", "No item data to clear for this group."); return; }
    setClearError(""); setClearOpen(true);
  };
  const freshUpload = () => { setFreshMode(true); startClear(); };
  const doClear = async (username: string, password: string, reason: string) => {
    setClearError(""); setBusy(true);
    try {
      const res = await clearAllItemData(username, password, reason, groupId);
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
          data={shown} columns={columns} getRowId={(r) => String(r.__i)} title={`Item Master · ${groupName} · ${mode}`} loading={busy}
          onRowSelect={setSelected} enableRowSelection rowSelectionMode="multi"
          enableColumnResizing enableSorting enableSearch enablePagination enableExport
        />
      ) : (
        <div style={{ padding: "36px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          Group <b>{groupName}</b> selected. Click <b>Load Data</b> to view existing items, or <b>Upload Excel</b> to import (use <b>Download Template</b> for the <b>{groupName}.xlsx</b> format).
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
