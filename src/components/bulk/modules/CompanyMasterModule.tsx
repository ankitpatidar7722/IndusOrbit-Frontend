"use client";
import { useContext, useEffect, useState, type CSSProperties } from "react";
import { Button, Tabs, useModalAlert } from "indas-ui";
import { Pencil, Save, X, Loader2, LayoutGrid } from "lucide-react";
import { type BulkClientContext, BulkCompactContext } from "@/components/bulk/BulkModuleShell";
import { getCompany, updateCompany, setBulkTargetCompany, type CompanyDto } from "@/bulk/services/api";

// "Company Master" — Indus360 rebuild of BulkImport's 13-tab CompanyMaster. Same tabs, same fields per
// tab, same input types — ONLY the UI is Indus360 (indas-ui Tabs + clean field display). The full ~150-
// field CompanyDto is loaded into state and PUT back whole on save, so the ~60 fields not shown in any
// tab (API tokens, RDLC prints, buffers…) round-trip UNCHANGED. Operates on the picked client's DB.

type FT = "t" | "e" | "n" | "a" | "p" | "b"; // text · email · number · textarea · password · toggle(bool)
type Fld = [k: keyof CompanyDto, label: string, type: FT];
type Sec = { title: string; cols?: 1 | 2 | 3; toggles?: boolean; fields: Fld[]; rowSizes?: number[]; splitInto?: number[]; half?: boolean };
type TabDef = { id: string; label: string; sections: Sec[] };

const TABS: TabDef[] = [
  { id: "0", label: "Company Info", sections: [
    { title: "Identity", cols: 3, fields: [["companyName", "Company Name", "t"], ["productionUnitName", "Production Unit Name", "t"], ["tallyCompanyName", "Tally Company Name", "t"]] },
    { title: "Address", rowSizes: [3, 4], fields: [["address1", "Address Line 1", "t"], ["address2", "Address Line 2", "t"], ["address3", "Address Line 3", "t"], ["country", "Country", "t"], ["state", "State", "t"], ["city", "City", "t"], ["pincode", "Pincode", "t"]] },
    { title: "Contact", cols: 2, fields: [["mobileNO", "Mobile Number", "t"], ["email", "Email", "e"]] },
    { title: "Statutory Numbers", cols: 2, fields: [["pan", "PAN", "t"], ["cinNo", "CIN Number", "t"], ["gstin", "GSTIN", "t"], ["stateTinNo", "State TIN No", "t"]] },
    { title: "Status", toggles: true, fields: [["isActive", "Is Active", "b"]] },
  ] },
  { id: "1", label: "Production Unit", sections: [
    { title: "Production Unit Details", cols: 2, fields: [["productionUnitAddress", "Production Unit Address", "a"], ["productionEntryBackDay", "Production Entry Back Day", "t"]] },
    { title: "Production Unit Settings", toggles: true, splitInto: [3, 2], fields: [["manualProductionEntryTime", "Manual Production Entry Time", "b"], ["jobScheduleReleaseRequired", "Job Schedule Release Required", "b"], ["generateVoucherNoByProductionUnit", "Generate Voucher No By Production Unit", "b"], ["byPassInventoryForProduction", "Bypass Inventory For Production", "b"], ["isProductionSlipGenerated", "Is Production Slip Generated", "b"]] },
  ] },
  { id: "2", label: "Tax Config", sections: [
    { title: "Purchase Tolerance", cols: 2, fields: [["purchaseTolerance", "Purchase Tolerance (%)", "n"]] },
    { title: "Tax Settings", toggles: true, fields: [["isSalesTax", "Sales Tax", "b"], ["isGstApplicable", "GST Applicable", "b"], ["isVatApplicable", "VAT Applicable", "b"], ["isEinvoiceApplicable", "E-Invoice Applicable", "b"], ["taxApplicableBranchWise", "Tax Applicable Branch Wise", "b"]] },
  ] },
  { id: "3", label: "Estimation", sections: [
    { title: "Decimal Place Settings", cols: 3, fields: [["estimationRoundOffDecimalPlace", "Estimation RoundOff Decimal Place", "n"], ["purchaseRoundOffDecimalPlace", "Purchase RoundOff Decimal Place", "n"], ["invoiceRoundOffDecimalPlace", "Invoice RoundOff Decimal Place", "n"], ["estimationPerUnitCostDecimalPlace", "Estimation Per Unit Cost Decimal Place", "n"], ["roundOffImpressionValue", "RoundOff Impression Value", "n"], ["wtCalculateOnEstimation", "Wt. Calculate On Estimation", "t"]] },
    { title: "Calculation Flags", toggles: true, half: true, fields: [["autoRoundOffNotApplicable", "Auto RoundOff Not Applicable", "b"]] },
    { title: "Estimation Settings", cols: 2, half: true, fields: [["showPlanUptoWastagePerc", "Show Plan Upto Wastage %", "n"]] },
  ] },
  { id: "4", label: "Domain Features", sections: [
    { title: "Domain Modules", toggles: true, fields: [["flexoDomainEnable", "Flexo Domain Enable", "b"], ["offsetDomainEnable", "Offset Domain Enable", "b"], ["corrugationDomainEnable", "Corrugation Domain Enable", "b"], ["rotoDomainEnable", "Roto Domain Enable", "b"]] },
    { title: "Planning Features", toggles: true, fields: [["bookPlanningFeatureEnable", "Book Planning Feature Enable", "b"], ["rigidBoxPlanningFeatureEnable", "Rigid Box Planning Feature Enable", "b"], ["shipperPlanningFeatureEnable", "Shipper Planning Feature Enable", "b"]] },
  ] },
  { id: "5", label: "Approvals", sections: [
    { title: "Approval Workflows", toggles: true, fields: [["isInternalApprovalRequired", "Internal Approval Required", "b"], ["isRequisitionApproval", "Requisition Approval", "b"], ["isPOApprovalRequired", "PO Approval Required", "b"], ["isInvoiceApprovalRequired", "Invoice Approval Required", "b"], ["isSalesOrderApprovalRequired", "Sales Order Approval Required", "b"], ["isJobReleaseFeatureRequired", "Job Release Feature Required", "b"], ["byPassCostApproval", "Bypass Cost Approval", "b"]] },
  ] },
  { id: "6", label: "Production Settings", sections: [
    { title: "Production Settings", toggles: true, fields: [["isWastageAddInPrintingRate", "Wastage Add In Printing Rate", "b"], ["materialConsumptionDetailsFlage", "Material Consumption Details Flag", "b"], ["productionProcessWiseToleranceRequired", "Production Process Wise Tolerance Required", "b"]] },
  ] },
  { id: "7", label: "System Config", sections: [
    { title: "Application Config", cols: 2, fields: [["applicationConfiguration", "Application Configuration", "a"], ["apiBasicAuthUserName", "API Basic Auth Username", "t"], ["apiBasicAuthPassword", "API Basic Auth Password", "p"], ["otpVerificationExcludedDevices", "OTP Verification Excluded Devices", "a"]] },
    { title: "System Flags", toggles: true, fields: [["otpVerificationFeatureEnabled", "OTP Verification Feature Enabled", "b"], ["multipleFYearNotRequired", "Multiple FYear Not Required", "b"], ["isProductCatalogCreated", "Is Product Catalog Created", "b"]] },
  ] },
  { id: "8", label: "Workflow", sections: [
    { title: "Automation Data", cols: 2, fields: [["isAutoRequisitionCreation", "Auto Requisition Creation", "n"]] },
    { title: "Workflow Automation", toggles: true, fields: [["autoIndentFeatureRequired", "Auto Indent Feature Required", "b"], ["isPicklistFeatureRequired", "Picklist Feature Required", "b"], ["isSupplierItemAllocationRequired", "Supplier Item Allocation Required", "b"]] },
  ] },
  { id: "9", label: "Communication", sections: [
    { title: "Communication & CRM", toggles: true, fields: [["isCrmActivated", "CRM Activated", "b"], ["isWhatsAppActivated", "WhatsApp Activated", "b"], ["isEmailActivated", "Email Activated", "b"], ["isNotificationEnabled", "Notification Enabled", "b"]] },
  ] },
  { id: "10", label: "Client Comm.", sections: [
    { title: "Client Notifications", toggles: true, fields: [["isJobScheduled_SendToClient", "Job Scheduled → Send To Client", "b"], ["isOrderReady_QcAndPacking_SendToClient", "Order Ready (QC & Packing) → Send To Client", "b"], ["isInvoice_Ready_SendToClient", "Invoice Ready → Send To Client", "b"], ["isSales_Order_Approve_ByClient", "Sales Order Approve → By Client", "b"]] },
  ] },
  { id: "11", label: "Printing & Docs", sections: [
    { title: "Printing & Document Settings", toggles: true, fields: [["isInvoicePrintProductWise", "Invoice Print Product Wise", "b"], ["isInvoiceBlockFeatureRequired", "Invoice Block Feature Required", "b"], ["isQuotationVisibleAfterSO", "Quotation Visible After SO", "b"], ["unitwisePrintoutSetting", "Unitwise Printout Setting", "b"]] },
  ] },
  { id: "12", label: "Prefixes", sections: [
    { title: "Document Prefixes", cols: 2, fields: [["productCatlogPrefix", "Product Catalog Prefix", "t"], ["jobCardPrefix", "Job Card Prefix", "t"]] },
  ] },
];
const TAB_LIST = TABS.map((t) => ({ id: t.id, label: t.label }));

// Field/section styling mirrors /clients (ClientDetailBody): bordered SectionCard with a subtle header
// band (icon + uppercase title) + a fixed N-column grid; each field is a small label over a boxed value.
const CT = {
  surface: "rgb(var(--bg-surface))", subtle: "rgb(var(--bg-subtle))", fg: "rgb(var(--fg-default))",
  muted: "rgb(var(--fg-muted))", bd: "rgb(var(--bd-default))", primary: "rgb(var(--color-primary))",
};
const lbl: CSSProperties = { fontSize: 10.5, fontWeight: 600, letterSpacing: 0.1, color: CT.muted, display: "block", marginBottom: 2 };
const roBox: CSSProperties = { minHeight: 38, padding: "7px 11px", border: `1px solid ${CT.bd}`, borderRadius: 8, background: CT.subtle, display: "flex", alignItems: "center", boxSizing: "border-box", overflow: "hidden" };
const fldInput: CSSProperties = { width: "100%", height: 38, padding: "0 11px", fontSize: 13.5, border: `1px solid ${CT.bd}`, borderRadius: 8, background: CT.surface, color: CT.fg, outline: "none", boxSizing: "border-box" };
const fldArea: CSSProperties = { ...fldInput, height: "auto", padding: "8px 11px", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 };
const valueCss: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: CT.fg, wordBreak: "break-word", lineHeight: 1.3 };

export default function CompanyMasterModule({ client }: { client: BulkClientContext }) {
  const { showSuccess, showError, AlertComponent } = useModalAlert();
  const [company, setCompany] = useState<CompanyDto | null>(null);
  const [form, setForm] = useState<CompanyDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);
  const [tab, setTab] = useState("0");
  // Collapse the shell's Product/Client picker into a thin bar once the company profile is on screen —
  // the card/form view then gets the full height ("Change" / "Collapse selectors" toggle it back).
  const { setHasData } = useContext(BulkCompactContext);
  useEffect(() => { setHasData(!loading && !!company); }, [loading, company, setHasData]);

  // Auto-load on mount. IMPORTANT: this effect can run BEFORE BulkModuleShell's [clientId] effect sets
  // the X-Target-Company header (child effects fire before parent effects), so we set the target for THIS
  // client ourselves right before the request — otherwise getCompany() goes out with no target and 400s.
  // The `cancelled` guard stops a superseded/StrictMode-duplicate load from firing a spurious error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setBulkTargetCompany(client.companyUserId);
      try { const c = await getCompany(); if (!cancelled) { setCompany(c); setForm(c); } }
      catch { if (!cancelled) showError("Load failed", "Could not load the company profile for this client."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.companyUserId]);

  const set = <K extends keyof CompanyDto>(k: K, v: CompanyDto[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const startEdit = () => { setForm(company ? { ...company } : null); setEdit(true); };
  const cancel = () => { setForm(company ? { ...company } : null); setEdit(false); };
  const save = async () => {
    if (!form) return;
    setSaving(true);
    try { await updateCompany(form); setCompany(form); setEdit(false); showSuccess("Saved", "Company profile updated.", 2800); }
    catch { showError("Save failed", "Could not update the company profile."); }
    finally { setSaving(false); }
  };

  // Render FUNCTIONS (not components) — defining components inside the parent would remount every input
  // on each keystroke and drop focus. Called as fns, their output reconciles by position → focus kept.
  const renderField = (f: Fld) => {
    const [k, label, type] = f;
    const raw = form?.[k];
    const star = k === "companyName" ? <span style={{ color: "#dc2626" }}> *</span> : null;
    if (!edit) {
      let node: React.ReactNode;
      if (k === "applicationConfiguration" && raw) node = <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#16a34a" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} className="animate-pulse" /> Configuration Active</span>;
      else if (raw === "" || raw == null) node = <span style={{ fontStyle: "italic", color: CT.muted, fontSize: 12.5 }}>Not configured</span>;
      else node = <span style={valueCss}>{type === "p" ? "••••••••" : String(raw)}</span>;
      return <div key={k}><span style={lbl}>{label}{star}</span><div style={roBox}>{node}</div></div>;
    }
    const onChange = (v: string) => set(k, (type === "n" ? (v === "" ? null : parseFloat(v)) : v) as CompanyDto[typeof k]);
    return (
      <div key={k}>
        <span style={lbl}>{label}{star}</span>
        {type === "a"
          ? <textarea rows={3} value={String(raw ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={`Enter ${label.toLowerCase()}`} style={fldArea} />
          : <input type={type === "n" ? "number" : type === "e" ? "email" : type === "p" ? "password" : "text"} value={String(raw ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={`Enter ${label.toLowerCase()}`} style={fldInput} />}
      </div>
    );
  };

  // Toggle = field name on the LEFT, ON/OFF switch on the RIGHT — one click flips it (edit mode), fast.
  const renderToggle = (f: Fld) => {
    const [k, label] = f; const on = !!form?.[k];
    const flip = () => { if (edit) set(k, (!on) as CompanyDto[typeof k]); };
    return (
      <div key={k} onClick={flip} role={edit ? "button" : undefined} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 2px", cursor: edit ? "pointer" : "default", userSelect: "none" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: CT.fg, lineHeight: 1.3 }}>{label}</span>
        <span aria-hidden style={{ width: 42, height: 23, borderRadius: 999, padding: 2, flexShrink: 0, background: on ? "#22c55e" : CT.bd, transition: "background .15s", opacity: edit ? 1 : 0.9, display: "inline-flex", alignItems: "center" }}>
          <span style={{ width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transform: on ? "translateX(19px)" : "translateX(0)", transition: "transform .15s" }} />
        </span>
      </div>
    );
  };

  // One section card. Toggle sections auto-split into two side-by-side cards; `rowSizes` breaks a text
  // section into explicit rows (Address → [3,4]). Returned by value so `half` sections can be wrapped
  // into a shared side-by-side row (see the grouping below).
  const renderSection = (s: Sec): React.ReactNode => {
    const splitInto = s.splitInto ?? (s.toggles && s.fields.length >= 2
      ? [Math.ceil(s.fields.length / 2), s.fields.length - Math.ceil(s.fields.length / 2)]
      : undefined);
    if (splitInto) {
      const chunks: Fld[][] = splitInto.reduce<{ out: Fld[][]; i: number }>((a, n) => { a.out.push(s.fields.slice(a.i, a.i + n)); a.i += n; return a; }, { out: [], i: 0 }).out;
      return (
        <div key={s.title} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "0 2px" }}>
            <LayoutGrid size={13} style={{ color: CT.primary }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: CT.fg, letterSpacing: 0.4, textTransform: "uppercase" }}>{s.title}</span>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
            {chunks.map((chunk, ci) => (
              <div key={ci} style={{ flex: 1, minWidth: 280, background: CT.surface, border: `1px solid ${CT.bd}`, borderRadius: 12, padding: "4px 14px" }}>
                {chunk.map((f) => renderToggle(f))}
              </div>
            ))}
          </div>
        </div>
      );
    }
    const cap = s.toggles ? 4 : 5;
    const rows: Fld[][] = s.rowSizes
      ? s.rowSizes.reduce<{ out: Fld[][]; i: number }>((a, n) => { a.out.push(s.fields.slice(a.i, a.i + n)); a.i += n; return a; }, { out: [], i: 0 }).out
      : [s.fields];
    return (
      <div key={s.title} style={{ background: CT.surface, border: `1px solid ${CT.bd}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: CT.subtle, borderBottom: `1px solid ${CT.bd}` }}>
          <LayoutGrid size={13} style={{ color: CT.primary }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: CT.fg, letterSpacing: 0.4, textTransform: "uppercase" }}>{s.title}</span>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((rowFields, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(rowFields.length, cap)}, minmax(0, 1fr))`, gap: "10px 20px", alignItems: "start" }}>
              {rowFields.map((f) => (s.toggles ? renderToggle(f) : renderField(f)))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) return <div style={{ padding: "60px 0", textAlign: "center", color: "rgb(var(--fg-muted))" }}><Loader2 size={26} className="animate-spin" style={{ margin: "0 auto" }} /><div style={{ marginTop: 10, fontSize: 14 }}>Loading company profile…</div></div>;
  if (!form) return <div style={{ padding: "60px 0", textAlign: "center", color: "rgb(var(--fg-muted))" }}>No company profile found for this client.</div>;

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  // Group consecutive `half` sections so they render side by side (Estimation: Calculation Flags + Estimation Settings).
  const groups: Sec[][] = [];
  for (const s of active.sections) {
    const last = groups[groups.length - 1];
    if (s.half && last && last[last.length - 1].half) last.push(s);
    else groups.push([s]);
  }

  return (
    <div style={{ width: "100%" }}>
      {/* Actions bar — the page title comes from the shell's top-centre header, so no duplicate title here. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {edit && <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "rgba(234,179,8,0.15)", padding: "4px 10px", borderRadius: 999 }} className="animate-pulse">Editing Mode</span>}
        {edit ? <>
          <Button size="sm" variant="action-secondary" icon={X} onClick={cancel} disabled={saving}>Cancel</Button>
          <Button size="sm" variant="action-save" icon={saving ? Loader2 : Save} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        </> : <Button size="sm" icon={Pencil} onClick={startEdit}>Edit Details</Button>}
      </div>

      {/* Tabs (scrollable — 13 tabs) */}
      <div style={{ overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        <div style={{ minWidth: "max-content" }}>
          <Tabs tabs={TAB_LIST} activeTab={tab} onTabChange={(id) => setTab(String(id))} variant="rounded" size="sm" />
        </div>
      </div>

      {/* Active tab sections — each a /clients-style bordered card. Consecutive `half` sections render
          SIDE BY SIDE in one row (Estimation: Calculation Flags + Estimation Settings). */}
      {groups.map((group, gi) => (
        group.length === 1
          ? renderSection(group[0])
          : (
            <div key={`grp-${gi}`} style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
              {group.map((s) => (
                <div key={s.title} style={{ flex: 1, minWidth: 320 }}>{renderSection(s)}</div>
              ))}
            </div>
          )
      ))}
      <AlertComponent />
    </div>
  );
}
