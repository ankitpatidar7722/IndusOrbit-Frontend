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
  getLedgersByGroup, validateLedgers, importLedgers, clearAllLedgerData, softDeleteLedger, getLedgerCount,
  getCountryStates, getSalesRepresentatives, getClients, getDepartments,
  ValidationStatus, type LedgerMasterDto, type LedgerValidationResultDto,
} from "@/bulk/services/api";
import { getLedgerStandardColumns, validateExcelColumns } from "@/bulk/utils/excelColumnValidator";
import MasterToolbar from "@/components/bulk/modules/MasterToolbar";
import SecurityClearModal from "@/components/bulk/modules/SecurityClearModal";
import ValidationSummary from "@/components/bulk/modules/ValidationSummary";

// Ledger Master — Indus360-native rebuild of LedgerMasterEnhanced. ONE column set with per-group
// SHOW/HIDE flags derived from ledgerGroupName (supplier/employee/consignee/vendors/transporters).
// Country→State cascades per row; mailingAddress/legalName are derived at save. Client's DB via X-Target-Company.

type Row = Record<string, unknown> & { __i: number };
type Mode = "idle" | "loaded" | "preview" | "validated";
type Filter = "all" | "valid" | "duplicate" | "missing" | "mismatch" | "invalid";
type Kind = "t" | "n" | "date" | "clients" | "countries" | "state" | "dept" | "reps" | "bool";
type CountryState = { country?: string; state?: string };

const LED_NUM = ["deliveredQtyTolerance", "distance", "ledgerID", "ledgerGroupID", "departmentID", "refClientID"];
const LED_BOOL = ["gstApplicable", "isDeletedTransaction"];
const num = (v: unknown): number => { const n = parseFloat(String(v ?? "").trim()); return isNaN(n) ? 0 : n; };

function buildMailingAddress(r: Row): string {
  const parts: string[] = [];
  [r.address1, r.address2, r.address3].forEach((a) => { if (a && String(a).trim()) parts.push(String(a).trim()); });
  if ((r.city && String(r.city).trim()) || (r.pincode && String(r.pincode).trim())) parts.push(`${r.city ?? ""}-${r.pincode ?? ""}`);
  if ((r.state && String(r.state).trim()) || (r.country && String(r.country).trim())) parts.push(`${r.state ?? ""} - ${r.country ?? ""}`);
  return parts.join(", ");
}

function cleanForApi(row: Row, groupId: number): LedgerMasterDto {
  const r: Row = { ...row };
  r.legalName = r.mailingName || r.ledgerName || "";
  r.mailingAddress = buildMailingAddress(r);
  const out: Record<string, unknown> = {}; const rawValues: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === "__i" || k === "_rowIndex") continue;
    if (v === undefined || v === null || v === "") continue;
    if (LED_NUM.includes(k)) { const n = Number(v); if (isNaN(n)) rawValues[k] = v; else out[k] = n; }
    else if (LED_BOOL.includes(k)) { if (v === "TRUE" || v === true) out[k] = true; else if (v === "FALSE" || v === false) out[k] = false; else rawValues[k] = v; }
    else out[k] = String(v); // all remaining ledger fields are C# strings — coerce Excel numerics (e.g. a numeric Pincode) so JSON matches
  }
  out.ledgerGroupID = groupId;
  if (Object.keys(rawValues).length) out.rawValues = rawValues;
  return out as unknown as LedgerMasterDto;
}

const NON_EMPTY = ["ledgerName", "mailingName", "address1", "city", "gstNo", "mobileNo", "email", "panNo", "clientName", "departmentName"];
const CRED_INP: CSSProperties = { padding: "8px 10px", borderRadius: 8, fontSize: 13, width: "100%", border: "1px solid rgb(var(--border-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" };
const CELL_BG: Record<number, string> = { [ValidationStatus.MissingData]: "rgba(59,130,246,0.16)", [ValidationStatus.Mismatch]: "rgba(234,179,8,0.20)", [ValidationStatus.InvalidContent]: "rgba(168,85,247,0.18)" };
const BOOL_OPTS = [{ label: "TRUE", value: "TRUE" }, { label: "FALSE", value: "FALSE" }];

export default function LedgerMasterModule({ client, groupId, groupName }: { client: BulkClientContext; groupId: number; groupName: string }) {
  const { showSuccess, showError, showConfirmation, AlertComponent } = useModalAlert();
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const { setHasData } = useContext(BulkCompactContext);
  useEffect(() => { setHasData(mode !== "idle"); }, [mode, setHasData]);
  const [result, setResult] = useState<LedgerValidationResultDto | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [countryStates, setCountryStates] = useState<CountryState[]>([]);
  const [clientOpts, setClientOpts] = useState<{ label: string; value: string }[]>([]);
  const [deptOpts, setDeptOpts] = useState<{ label: string; value: string }[]>([]);
  const [repOpts, setRepOpts] = useState<{ label: string; value: string }[]>([]);
  const [summary, setSummary] = useState<{ title: string; messages: string[] } | null>(null);
  const [selected, setSelected] = useState<Row[]>([]);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearError, setClearError] = useState("");
  const [freshMode, setFreshMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editable = mode === "preview" || mode === "validated";
  const gn = groupName.toLowerCase();
  const flags = useMemo(() => ({
    isSupplier: gn.includes("supplier"), isEmployee: gn.includes("employee"), isConsignee: gn.includes("consignee"),
    isVendor: gn.includes("vendors"), isTransporter: gn.includes("transporters"),
  }), [gn]);

  useEffect(() => {
    getCountryStates().then((cs: unknown) => setCountryStates(Array.isArray(cs) ? cs as CountryState[] : [])).catch(() => setCountryStates([]));
    getClients().then((c: unknown) => { const a = Array.isArray(c) ? c as Record<string, unknown>[] : []; setClientOpts(a.map((r) => { const v = String(r.ledgerName ?? r.LedgerName ?? ""); return { label: v, value: v }; }).filter((o) => o.value)); }).catch(() => setClientOpts([]));
    getDepartments().then((d: unknown) => { const a = Array.isArray(d) ? d as Record<string, unknown>[] : []; setDeptOpts(a.map((r) => { const v = String(r.departmentName ?? r.DepartmentName ?? ""); return { label: v, value: v }; }).filter((o) => o.value)); }).catch(() => setDeptOpts([]));
    getSalesRepresentatives().then((s: unknown) => { const a = Array.isArray(s) ? s as Record<string, unknown>[] : []; setRepOpts(a.map((r) => { const v = String(r.employeeName ?? r.EmployeeName ?? ""); return { label: v, value: v }; }).filter((o) => o.value)); }).catch(() => setRepOpts([]));
  }, [client.companyUserId]);

  const countryOpts = useMemo(() => {
    const seen = new Set<string>(); const out: { label: string; value: string }[] = [];
    countryStates.forEach((cs) => { const c = (cs.country ?? "").trim(); if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); out.push({ label: c, value: c }); } });
    return out;
  }, [countryStates]);
  const stateOptsFor = useCallback((country: unknown) => {
    const c = String(country ?? "").toLowerCase();
    const seen = new Set<string>(); const out: { label: string; value: string }[] = [];
    countryStates.filter((cs) => (cs.country ?? "").toLowerCase() === c).forEach((cs) => { const s = (cs.state ?? "").trim(); if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push({ label: s, value: s }); } });
    return out;
  }, [countryStates]);

  // The full column list (grid order) with per-group hide predicates.
  const colDefs = useMemo<{ field: string; header: string; kind: Kind; hide: boolean }[]>(() => {
    const { isSupplier, isEmployee, isConsignee, isVendor, isTransporter } = flags;
    const defs: { field: string; header: string; kind: Kind; hide: boolean }[] = [
      { field: "ledgerName", header: "LedgerName", kind: "t", hide: false },
      { field: "mailingName", header: "MailingName", kind: "t", hide: false },
      { field: "clientName", header: "ClientName", kind: "clients", hide: !isConsignee },
      { field: "address1", header: "Address1", kind: "t", hide: false },
      { field: "address2", header: "Address2", kind: "t", hide: false },
      { field: "address3", header: "Address3", kind: "t", hide: false },
      { field: "country", header: "Country", kind: "countries", hide: false },
      { field: "state", header: "State", kind: "state", hide: false },
      { field: "city", header: "City", kind: "t", hide: false },
      { field: "pincode", header: "Pincode", kind: "t", hide: false },
      { field: "telephoneNo", header: "TelephoneNo", kind: "t", hide: false },
      { field: "email", header: "Email", kind: "t", hide: false },
      { field: "mobileNo", header: "MobileNo", kind: "t", hide: false },
      { field: "dateOfBirth", header: "DateOfBirth", kind: "date", hide: !isEmployee },
      { field: "panNo", header: "PANNo", kind: "t", hide: false },
      { field: "departmentName", header: "DepartmentName", kind: "dept", hide: !isEmployee },
      { field: "designation", header: "Designation", kind: "t", hide: !isEmployee },
      { field: "website", header: "Website", kind: "t", hide: isEmployee },
      { field: "gstNo", header: "GSTNo", kind: "t", hide: isEmployee },
      { field: "currencyCode", header: "CurrencyCode", kind: "t", hide: !isSupplier && !isVendor },
      { field: "salesRepresentative", header: "SalesRepresentative", kind: "reps", hide: isSupplier || isEmployee || isConsignee || isVendor || isTransporter },
      { field: "supplyTypeCode", header: "SupplyTypeCode", kind: "t", hide: isEmployee || isVendor || isTransporter },
      { field: "gstApplicable", header: "GSTApplicable", kind: "bool", hide: isEmployee || isConsignee || isTransporter },
      { field: "refCode", header: "RefCode", kind: "t", hide: isEmployee || isVendor || isTransporter },
      { field: "gstRegistrationType", header: "GSTRegistrationType", kind: "t", hide: isEmployee || isConsignee || isVendor || isTransporter },
      { field: "creditDays", header: "CreditDays", kind: "t", hide: isSupplier || isEmployee || isConsignee || isVendor || isTransporter },
      { field: "deliveredQtyTolerance", header: "DeliveredQtyTolerance", kind: "n", hide: isEmployee || isConsignee || isVendor || isTransporter },
    ];
    return defs.filter((c) => !c.hide);
  }, [flags]);

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
    setRows((prev) => prev.map((r, i) => {
      if (i !== rowIndex) return r;
      const next = { ...r, [field]: value };
      if (field === "country") next.state = ""; // country change resets state (cascade)
      return next;
    }));
  }, []);

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

  const columns = useMemo<ColumnDef<Row>[]>(() => colDefs.map(({ field, header, kind }) => ({
    accessorKey: field, header,
    cell: ({ row }: { row: { original: Row } }) => {
      const i = row.original.__i; const val = row.original[field];
      const opts = kind === "clients" ? clientOpts : kind === "countries" ? countryOpts : kind === "dept" ? deptOpts
        : kind === "reps" ? repOpts : kind === "bool" ? BOOL_OPTS : kind === "state" ? stateOptsFor(row.original.country) : null;
      const inner = !editable
        ? <span>{String(val ?? "")}</span>
        : kind === "n" ? <EditableCell value={val} type="number" onSave={(v: unknown) => updateCell(i, field, num(v))} />
        : kind === "date" ? <EditableCell value={val} type="date" onSave={(v: unknown) => updateCell(i, field, v)} />
        : opts ? <EditableCell value={val} type="dropdown" options={opts} onSave={(v: unknown) => updateCell(i, field, v)} />
        : <EditableCell value={val} type="text" onSave={(v: unknown) => updateCell(i, field, v)} />;
      return <div style={{ background: cellBg(i, field), margin: "-6px -10px", padding: "6px 10px" }}>{inner}</div>;
    },
  })), [colDefs, editable, cellBg, updateCell, clientOpts, countryOpts, deptOpts, repOpts, stateOptsFor]);

  const normCountry = useCallback((v: unknown) => {
    const s = String(v ?? "").trim(); if (!s) return v;
    const hit = countryStates.find((cs) => (cs.country ?? "").toLowerCase() === s.toLowerCase());
    return hit?.country ?? s;
  }, [countryStates]);
  const normState = useCallback((v: unknown) => {
    const s = String(v ?? "").trim(); if (!s) return v;
    const hit = countryStates.find((cs) => (cs.state ?? "").toLowerCase() === s.toLowerCase());
    return hit?.state ?? s;
  }, [countryStates]);

  const loadData = async () => {
    setBusy(true);
    try { const d = await getLedgersByGroup(groupId); setRows(Array.isArray(d) ? d as unknown as Row[] : []); setMode("loaded"); setResult(null); setFilter("all"); }
    catch { showError("Load failed", "Could not load ledgers for this client / group."); }
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
        const cv = validateExcelColumns(headerCols, getLedgerStandardColumns(groupName));
        if (!cv.isValid) { showError("Invalid Excel format", cv.message); if (fileRef.current) fileRef.current.value = ""; return; }
        const g = (r: Record<string, unknown>, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v !== undefined && v !== null && String(v) !== "") return v; } return undefined; };
        const toDob = (v: unknown) => { if (typeof v === "number") { try { return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().split("T")[0]; } catch { return v; } } return v; };
        const mapped: Row[] = json.map((r, index) => {
          const gst = g(r, "GSTApplicable", "gstApplicable");
          const row: Row = {
            __i: index, ledgerGroupID: groupId, legalName: "", mailingAddress: "",
            ledgerName: g(r, "LedgerName", "ledgerName"), mailingName: g(r, "MailingName", "mailingName"),
            clientName: g(r, "ClientName", "Client Name", "clientName"),
            address1: g(r, "Address1", "address1"), address2: g(r, "Address2", "address2"), address3: g(r, "Address3", "address3"),
            country: normCountry(g(r, "Country", "country")), state: normState(g(r, "State", "state")), city: g(r, "City", "city"), pincode: g(r, "Pincode", "pincode"),
            telephoneNo: g(r, "TelephoneNo", "telephoneNo"), email: g(r, "Email", "email"), mobileNo: g(r, "MobileNo", "mobileNo"),
            website: g(r, "Website", "website"), panNo: g(r, "PANNo", "panNo"), gstNo: g(r, "GSTNo", "gstNo"),
            salesRepresentative: g(r, "SalesRepresentative", "salesRepresentative"),
            supplyTypeCode: g(r, "SupplyTypeCode", "supplyTypeCode") ?? "B2B",
            gstApplicable: gst == null ? "TRUE" : String(gst).toUpperCase() === "FALSE" ? "FALSE" : "TRUE",
            refCode: g(r, "RefCode", "refCode") ?? "",
            gstRegistrationType: g(r, "GSTRegistrationType", "gstRegistrationType") ?? "Regular",
            creditDays: g(r, "CreditDays", "creditDays"),
            deliveredQtyTolerance: g(r, "DeliveredQtyTolerance", "deliveredQtyTolerance"),
            currencyCode: g(r, "CurrencyCode", "currencyCode"),
            departmentName: g(r, "DepartmentName", "Department Name", "DEPARTMENT NAME", "departmentname"),
            designation: g(r, "Designation", "designation", "DESIGNATION"),
            dateOfBirth: toDob(g(r, "DateOfBirth", "dateOfBirth")),
          };
          return row;
        }).filter((row) => NON_EMPTY.some((k) => { const v = row[k]; return v !== undefined && v !== null && String(v).trim() !== ""; }));
        setRows(mapped); setMode("preview"); setResult(null); setFilter("all");
        showSuccess("File loaded", `${mapped.length} row(s) loaded. Click "Check Validation".`, 2500);
      } catch { showError("Parse failed", "Could not read the Excel file."); }
      finally { if (fileRef.current) fileRef.current.value = ""; }
    };
    reader.readAsBinaryString(file);
  };

  const buildSummary = (res: LedgerValidationResultDto) => {
    const s = res.summary;
    const total = (s.duplicateCount ?? 0) + (s.missingDataCount ?? 0) + (s.mismatchCount ?? 0) + (s.invalidContentCount ?? 0);
    const byCol = new Map<string, Set<string>>();
    res.rows.forEach((row) => {
      if (row.rowStatus === ValidationStatus.Duplicate) byCol.set("Ledger", (byCol.get("Ledger") ?? new Set()).add("Duplicate data found"));
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
      const payload = rows.map((r) => cleanForApi(r, groupId));
      const res = await validateLedgers(payload, groupId); setResult(res); setMode("validated");
      if (res.isValid) showSuccess("Validation passed", "All records are valid.", 2500);
    } catch { showError("Validation failed", "Could not validate. Please try again."); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!rows.length) { showError("No data", "Nothing to import."); return; }
    setBusy(true);
    try {
      const payload = rows.map((r) => cleanForApi(r, groupId));
      const res = await validateLedgers(payload, groupId); setResult(res);
      // Re-validate on Save (fresh, current data) and hard-block on ANY validation error — consistent
      // with the other 4 masters, so no invalid/missing/mismatch/duplicate row can be imported.
      if (!res.isValid) { showError("Fix errors first", "Correct the issues shown in the Validation Summary before saving."); return; }
      const imp = await importLedgers(payload, groupId);
      if (imp.success) {
        showSuccess("Imported", `${imp.importedRows ?? rows.length} record(s) imported.`, 3000);
        if ((imp.errorRows ?? 0) > 0 && imp.errorMessages?.length) setSummary({ title: `${imp.errorRows} Row(s) Skipped During Import`, messages: imp.errorMessages });
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
          for (const r of selected) { const id = (r as { ledgerID?: number }).ledgerID; if (id) await softDeleteLedger(id); }
          showSuccess("Deleted", `${n} record(s) deleted.`, 2500); setSelected([]); await loadData();
        } catch { showError("Delete failed", "Could not delete the selected records."); }
        finally { setBusy(false); }
      } else { const drop = new Set(selected.map((r) => r.__i)); setRows((prev) => prev.filter((_, i) => !drop.has(i))); setResult(null); setSelected([]); }
    });
  };

  const startClear = async () => {
    setBusy(true);
    let count = 1;
    try { count = await getLedgerCount(groupId); } catch { /* proceed */ } finally { setBusy(false); }
    if (count === 0) { if (freshMode) { setFreshMode(false); fileRef.current?.click(); return; } showError("No data", "No ledger data to clear for this group."); return; }
    setClearError(""); setClearOpen(true);
  };
  const freshUpload = () => { setFreshMode(true); startClear(); };
  const doClear = async (username: string, password: string, reason: string) => {
    setClearError(""); setBusy(true);
    try {
      const res = await clearAllLedgerData(groupId, username, password, reason);
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
          data={shown} columns={columns} getRowId={(r) => String(r.__i)} title={`Ledger Master · ${groupName} · ${mode}`} loading={busy}
          onRowSelect={setSelected} enableRowSelection rowSelectionMode="multi"
          enableColumnResizing enableSorting enableSearch enablePagination enableExport
        />
      ) : (
        <div style={{ padding: "36px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          Group <b>{groupName}</b> selected. Click <b>Load Data</b> to view existing ledgers, or <b>Upload Excel</b> to import (use <b>Download Template</b> for the <b>{groupName}.xlsx</b> format).
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
