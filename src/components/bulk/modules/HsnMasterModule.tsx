"use client";
import { useContext, useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from "react";
import { Button, useModalAlert, StandardModal } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGrid, EditableCell } from "@/components/datagrid";
import { Download, Upload, DatabaseZap, CheckCircle2, Save, Trash2, RotateCcw, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { type BulkClientContext, BulkCompactContext } from "@/components/bulk/BulkModuleShell";
import {
  getHSNs, validateHSNs, importHSNs, getItemGroupNames, getHSNCount, clearHSNData, softDeleteHSN,
  ValidationStatus,
  type HSNMasterDto, type HSNValidationResultDto,
} from "@/bulk/services/api";
import { getHSNMasterStandardColumns, validateExcelColumns } from "@/bulk/utils/excelColumnValidator";
import MasterToolbar from "@/components/bulk/modules/MasterToolbar";
import SecurityClearModal from "@/components/bulk/modules/SecurityClearModal";
import ValidationSummary from "@/components/bulk/modules/ValidationSummary";

// HSN / Product Group Master — Indus360-native rebuild of HSNMasterEnhanced. Same feature set
// (load / upload+column-check / validate+coloring / import / delete / filter / template) using
// indas-ui + the /users DataGrid, operating on the picked client's DB (via X-Target-Company).

type Mode = "idle" | "loaded" | "preview" | "validated";
type Filter = "all" | "valid" | "duplicate" | "missing" | "mismatch" | "invalid";

const CATEGORY_OPTIONS = ["Raw Material", "Finish Goods", "Spare Parts", "Service", "Tool"].map((v) => ({ label: v, value: v }));

const CRED_INP: CSSProperties = {
  padding: "8px 10px", borderRadius: 8, fontSize: 13, width: "100%",
  border: "1px solid rgb(var(--border-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))",
};

// Validation status → cell background (mirrors the original blue/yellow/purple + red-row for duplicate)
const CELL_BG: Record<number, string> = {
  [ValidationStatus.MissingData]: "rgba(59,130,246,0.16)",   // blue
  [ValidationStatus.Mismatch]: "rgba(234,179,8,0.20)",       // yellow
  [ValidationStatus.InvalidContent]: "rgba(168,85,247,0.18)", // purple
};

const safeFloat = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").trim());
  return isNaN(n) ? 0 : n;
};

export default function HsnMasterModule({ client }: { client: BulkClientContext }) {
  const { showSuccess, showError, showConfirmation, AlertComponent } = useModalAlert();
  const [rows, setRows] = useState<HSNMasterDto[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const { setHasData } = useContext(BulkCompactContext);
  useEffect(() => { setHasData(mode !== "idle"); }, [mode, setHasData]);
  const [result, setResult] = useState<HSNValidationResultDto | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [itemGroups, setItemGroups] = useState<{ label: string; value: string }[]>([]);
  const [summary, setSummary] = useState<{ title: string; messages: string[] } | null>(null);
  const [selected, setSelected] = useState<(HSNMasterDto & { __i: number })[]>([]);
  // Clear All Data / Fresh Upload — shared 3-captcha + credential flow (SecurityClearModal).
  const [clearOpen, setClearOpen] = useState(false);
  const [clearError, setClearError] = useState("");
  const [freshMode, setFreshMode] = useState(false); // Fresh Upload = clear-then-upload
  const fileRef = useRef<HTMLInputElement>(null);

  const editable = mode === "preview" || mode === "validated";

  // Item-group names for the raw-material dropdown, from THIS client's DB.
  useEffect(() => {
    getItemGroupNames()
      .then((names) => setItemGroups((Array.isArray(names) ? names : []).map((n) => ({ label: String(n), value: String(n) })).filter((o) => o.value)))
      .catch(() => setItemGroups([]));
  }, [client.companyUserId]);

  // rowIndex → row validation (for cell/row coloring + filtering)
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
    if (rv.rowStatus === ValidationStatus.Duplicate) return "rgba(239,68,68,0.14)"; // whole row red
    const st = rv.cells[field.toLowerCase()];
    return st != null ? CELL_BG[st] : undefined;
  }, [vMap]);

  const updateCell = useCallback((rowIndex: number, field: keyof HSNMasterDto, value: unknown) => {
    setRows((prev) => prev.map((r, i) => {
      if (i !== rowIndex) return r;
      const next = { ...r, [field]: value } as HSNMasterDto;
      // Product Type != Raw Material → Item Group Name doesn't apply, clear it (matches BulkImport).
      if (field === "productCategory" && String(value ?? "").trim().toLowerCase() !== "raw material") next.itemGroupName = "";
      return next;
    }));
  }, []);

  // Rows passing the active validation filter.
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

  // ---- columns ----
  const columns = useMemo<ColumnDef<HSNMasterDto & { __i: number }>[]>(() => {
    const txt = (field: keyof HSNMasterDto, header: string, type: "text" | "number" = "text") => ({
      accessorKey: field as string, header,
      cell: ({ row }: { row: { original: HSNMasterDto & { __i: number } } }) => {
        const i = row.original.__i;
        const val = (row.original as unknown as Record<string, unknown>)[field as string];
        return (
          <div style={{ background: cellBg(i, field as string), margin: "-6px -10px", padding: "6px 10px" }}>
            {editable
              ? <EditableCell value={val} type={type} onSave={(v: unknown) => updateCell(i, field, type === "number" ? safeFloat(v) : v)} />
              : <span>{String(val ?? "")}</span>}
          </div>
        );
      },
    });
    const dd = (field: keyof HSNMasterDto, header: string, opts: { label: string; value: string }[], editableFn?: (r: HSNMasterDto) => boolean) => ({
      accessorKey: field as string, header,
      cell: ({ row }: { row: { original: HSNMasterDto & { __i: number } } }) => {
        const i = row.original.__i;
        const val = (row.original as unknown as Record<string, unknown>)[field as string];
        const canEdit = editable && (editableFn ? editableFn(row.original) : true);
        return (
          <div style={{ background: cellBg(i, field as string), margin: "-6px -10px", padding: "6px 10px" }}>
            {canEdit
              ? <EditableCell value={val} type="dropdown" options={opts} onSave={(v: unknown) => updateCell(i, field, v)} />
              : <span>{String(val ?? "")}</span>}
          </div>
        );
      },
    });
    return [
      txt("productHSNName", "Group Name"),
      txt("displayName", "Display Name"),
      txt("hsnCode", "HSN Code"),
      dd("productCategory", "Product Type", CATEGORY_OPTIONS),
      txt("gstTaxPercentage", "GST %", "number"),
      txt("cgstTaxPercentage", "CGST %", "number"),
      txt("sgstTaxPercentage", "SGST %", "number"),
      txt("igstTaxPercentage", "IGST %", "number"),
      dd("itemGroupName", "Item Group Name", itemGroups, (r) => (r.productCategory || "").trim().toLowerCase() === "raw material"),
    ];
  }, [editable, cellBg, updateCell, itemGroups]);

  // ---- actions ----
  const loadData = async () => {
    setBusy(true);
    try {
      const data = await getHSNs();
      setRows(Array.isArray(data) ? data : []);
      setMode("loaded"); setResult(null); setFilter("all");
    } catch { showError("Load failed", "Could not load HSN data for this client."); }
    finally { setBusy(false); }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext !== ".xlsx") { showError("Invalid file", "Please upload a .xlsx file only."); if (fileRef.current) fileRef.current.value = ""; return; }
    const nameNoExt = file.name.slice(0, file.name.lastIndexOf(".")).trim();
    if (nameNoExt.toLowerCase() !== "hsn master") { showError("Invalid file name", "Expected: HSN Master.xlsx"); if (fileRef.current) fileRef.current.value = ""; return; }
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
        const cv = validateExcelColumns(headerCols, getHSNMasterStandardColumns());
        if (!cv.isValid) { showError("Invalid Excel format", cv.message); if (fileRef.current) fileRef.current.value = ""; return; }
        const mapped: HSNMasterDto[] = json.map((r) => ({
          productHSNName: String(r["Group Name"] ?? "").trim(),
          displayName: String(r["Display Name"] ?? r["DisplayName"] ?? "").trim(),
          hsnCode: String(r["HSN Code"] ?? r["HSNCode"] ?? "").trim(),
          productCategory: String(r["Product Type"] ?? r["ProductType"] ?? r["ProductCategory"] ?? "").trim(),
          gstTaxPercentage: safeFloat(r["GST %"] ?? r["GSTTaxPercentage"]),
          cgstTaxPercentage: safeFloat(r["CGST %"] ?? r["CGSTTaxPercentage"]),
          sgstTaxPercentage: safeFloat(r["SGST %"] ?? r["SGSTTaxPercentage"]),
          igstTaxPercentage: safeFloat(r["IGST %"] ?? r["IGSTTaxPercentage"]),
          itemGroupName: String(r["ItemGroupName"] ?? r["Item Group Name"] ?? "").trim(),
          companyID: 2,
        } as HSNMasterDto));
        setRows(mapped); setMode("preview"); setResult(null); setFilter("all");
        showSuccess("File loaded", `${mapped.length} row(s) loaded. Click "Check Validation".`, 2500);
      } catch { showError("Parse failed", "Could not read the Excel file."); }
      finally { if (fileRef.current) fileRef.current.value = ""; }
    };
    reader.readAsBinaryString(file);
  };

  const buildSummary = (res: HSNValidationResultDto) => {
    const s = res.summary as unknown as Record<string, number>;
    const total = (s.duplicateCount ?? 0) + (s.missingDataCount ?? 0) + (s.mismatchCount ?? 0) + (s.invalidContentCount ?? 0);
    const byCol = new Map<string, Set<string>>();
    (res.rows as unknown as Array<{ rowStatus: number; cellValidations?: Array<{ columnName: string; status: number }> }>).forEach((row) => {
      if (row.rowStatus === ValidationStatus.Duplicate) { byCol.set("HSN Code", (byCol.get("HSN Code") ?? new Set()).add("Duplicate data found")); }
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
    try {
      const res = await validateHSNs(rows);
      setResult(res); setMode("validated");
      if (res.isValid) showSuccess("Validation passed", "All records are valid and ready to import.", 2500);
      // Issues are shown in the Validation Summary row below (no popup) — matches BulkImport.
    } catch { showError("Validation failed", "Could not validate. Please try again."); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!rows.length) { showError("No data", "Nothing to import."); return; }
    setBusy(true);
    try {
      const res = await validateHSNs(rows);
      setResult(res);
      if (!res.isValid) { showError("Fix errors first", "Correct the issues shown in the Validation Summary before saving."); return; }
      const imp = await importHSNs(rows);
      if (imp.success) {
        showSuccess("Imported", `${imp.importedRows ?? rows.length} record(s) imported.`, 3000);
        if ((imp.errorRows ?? 0) > 0 && imp.errorMessages?.length) setSummary({ title: `${imp.errorRows} Row(s) Failed During Import`, messages: imp.errorMessages });
        setResult(null); setMode("idle");
        await loadData();
      } else {
        setSummary({ title: "Import Failed", messages: imp.errorMessages?.length ? imp.errorMessages : [imp.message || "Import failed."] });
      }
    } catch { showError("Import failed", "Could not import. Please try again."); }
    finally { setBusy(false); }
  };

  // Export EVERY grid column (header ↔ field) so all data transfers — not just the columns whose header
  // happens to normalise to the DTO field name. Empty grid ⇒ header-only template.
  const exportData = async () => {
    try {
      const cols = columns.map((c) => ({ header: String((c as { header: string }).header), key: (c as { accessorKey: string }).accessorKey }));
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("HSN Master");
      ws.addRow(cols.map((c) => c.header)); ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(cols.map((c) => (r as unknown as Record<string, unknown>)[c.key] ?? "")));
      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), "HSN Master.xlsx");
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
          for (const r of selected) {
            const id = (r as unknown as { productHSNID?: number }).productHSNID;
            if (id) await softDeleteHSN(id);
          }
          showSuccess("Deleted", `${n} record(s) deleted.`, 2500);
          setSelected([]); await loadData();
        } catch { showError("Delete failed", "Could not delete the selected records."); }
        finally { setBusy(false); }
      } else {
        const drop = new Set(selected.map((r) => r.__i));
        setRows((prev) => prev.filter((_, i) => !drop.has(i)));
        setResult(null); setSelected([]);
      }
    });
  };

  // Clear All Data / Fresh Upload — open the shared 3-captcha + credential flow.
  const startClear = async () => {
    setBusy(true);
    let count = 1;
    try { count = await getHSNCount(); } catch { /* proceed */ }
    finally { setBusy(false); }
    if (count === 0) {
      if (freshMode) { setFreshMode(false); fileRef.current?.click(); return; } // nothing to clear → straight to upload
      showError("No data", "No HSN data to clear for this client."); return;
    }
    setClearError(""); setClearOpen(true);
  };
  const freshUpload = () => { setFreshMode(true); startClear(); };
  const doClear = async (username: string, password: string, reason: string) => {
    setClearError(""); setBusy(true);
    try {
      const res = await clearHSNData(2, username, password, reason);
      const wasFresh = freshMode;
      showSuccess("Cleared", `${(res as { importedRows?: number }).importedRows ?? 0} record(s) cleared.`, 2500);
      setRows([]); setResult(null); setMode("idle"); setClearOpen(false); setFreshMode(false);
      if (wasFresh) setTimeout(() => fileRef.current?.click(), 200); // Fresh Upload: open file picker after clear
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
        <DataGrid<HSNMasterDto & { __i: number }>
          data={shown}
          columns={columns}
          getRowId={(r) => String(r.__i)}
          title={`HSN Master · ${mode}`}
          loading={busy}
          onRowSelect={setSelected}
          enableRowSelection rowSelectionMode="multi"
          enableColumnResizing enableSorting enableSearch enablePagination enableExport
        />
      ) : (
        <div style={{ padding: "36px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          Click <b>Load Data</b> to view existing HSN masters, or <b>Upload Excel</b> to import (use <b>Download Template</b> for the format).
        </div>
      )}

      <SecurityClearModal open={clearOpen} groupLabel="HSN" companyName={client.companyName} companyUserId={client.companyUserId}
        busy={busy} error={clearError} onCancel={() => { setClearOpen(false); setFreshMode(false); }} onSubmit={doClear} />

      {/* Validation / import summary modal */}
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
