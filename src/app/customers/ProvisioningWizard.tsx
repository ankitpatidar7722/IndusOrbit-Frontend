"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Input, Dropdown } from "indas-ui";
import { Database, CreditCard, Building2, GitBranch, Factory, CheckCircle2, Copy, X, ChevronLeft, PartyPopper, Check } from "lucide-react";
import { customersApi } from "@/lib/customers";
import {
  provisioningApi, generateDatabaseName,
  type SetupDatabaseResponse, type CompanyMasterRequest, type BranchMasterRequest,
  type ProductionUnitRequest, type CompleteSetupResponse,
} from "@/lib/provisioning";

const APP_OPTIONS = ["estimoprime", "multiunit", "PrintudeERP"];
const BACKUP_TYPES = ["Offset", "Flexo", "Rotogravure"];
// Per-application login URL shown on the success screen (keys are lower-cased).
const APP_LOGIN_URL: Record<string, string> = {
  estimoprime: "https://estimo.indusanalytics.co.in/CompanyLogin.aspx",
  printudeerp: "https://erp.printude.ai",
  multiunit: "https://estimomultiunit.indusanalytics.co.in/CompanyLogin.aspx",
};

const STEPS = [
  { n: 1, label: "Database", icon: Database },
  { n: 2, label: "Subscription", icon: CreditCard },
  { n: 3, label: "Company", icon: Building2 },
  { n: 4, label: "Branch", icon: GitBranch },
  { n: 5, label: "Production", icon: Factory },
];

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", display: "block", marginBottom: 5 };
// Servers the user has actually used are remembered in localStorage so they
// re-appear in the Server dropdown next time (merged with the API server list).
const SERVER_STORE = "pm.provision.servers";
const loadStoredServers = (): string[] => { try { return JSON.parse(localStorage.getItem(SERVER_STORE) || "[]"); } catch { return []; } };
const rememberServer = (s: string) => { const t = (s || "").trim(); if (!t) return; const cur = loadStoredServers(); if (!cur.includes(t)) localStorage.setItem(SERVER_STORE, JSON.stringify([...cur, t])); };
const sect: React.CSSProperties = { display: "none" };  // old inline section labels hidden — the header card shows the title

const STEP_META: Record<number, { title: string; sub: string; icon: React.ElementType }> = {
  1: { title: "Database Setup", sub: "Select a server, application type, and client name. A new database will be created from the template.", icon: Database },
  2: { title: "Subscription Details", sub: "Enter the client's contact, subscription and login details.", icon: CreditCard },
  3: { title: "Company Master", sub: "Set up the company master record for this client.", icon: Building2 },
  4: { title: "Branch Master", sub: "Configure the primary branch for this company.", icon: GitBranch },
  5: { title: "Production Unit", sub: "Add the production unit details to complete the setup.", icon: Factory },
};

/** Premium field label: colored required asterisk + optional "AUTO" chip. */
function Label({ text, extra }: { text: string; extra?: string }) {
  const req = /\*\s*$/.test(text);
  const base = text.replace(/\s*\*\s*$/, "");
  return (
    <label style={lbl}>
      {base}{req && <span style={{ color: "#e11d48", marginLeft: 2 }}>*</span>}
      {extra && <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4, background: "#e2edfa", color: "rgb(var(--color-primary))", padding: "2px 7px", borderRadius: 999, textTransform: "uppercase", verticalAlign: "middle" }}>{extra}</span>}
    </label>
  );
}

export default function ProvisioningWizard({ isOpen, onClose, onDone }: { isOpen: boolean; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // step 1
  const [servers, setServers] = useState<string[]>([]);
  const [backupDbs, setBackupDbs] = useState<string[]>([]);
  const [db, setDb] = useState({ server: "", app: "", backupType: "", clientName: "", dbName: "", backupDb: "", dbEdited: false });
  const [setup, setSetup] = useState<SetupDatabaseResponse | null>(null);

  // step 2 (subscription)
  const [sub, setSub] = useState<Record<string, unknown>>({ subscriptionStatus: "Active", country: "India", loginAllowed: 1 });

  // step 3-5
  const [company, setCompany] = useState<CompanyMasterRequest>({ connectionString: "", companyID: 2, companyName: "" });
  const [branch, setBranch] = useState<BranchMasterRequest>({ connectionString: "", branchID: 1, branchName: "" });
  const [prod, setProd] = useState<ProductionUnitRequest>({ connectionString: "", productionUnitName: "" });
  const [done, setDone] = useState<CompleteSetupResponse | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1); setMaxStep(1); setErr(null); setSetup(null); setDone(null);
    setDb({ server: "", app: "", backupType: "", clientName: "", dbName: "", backupDb: "", dbEdited: false });
    setSub({ subscriptionStatus: "Active", country: "India", loginAllowed: 1 });
    provisioningApi.servers()
      .then((r) => { const merged = Array.from(new Set([...r.servers, ...loadStoredServers()])); setServers(merged); setDb((p) => ({ ...p, server: merged[0] ?? "" })); })
      .catch(() => { const s = loadStoredServers(); setServers(s); setDb((p) => ({ ...p, server: s[0] ?? "" })); });
    customersApi.nextCode().then((r) => setSub((p) => ({ ...p, companyUniqueCode: r.companyUniqueCode }))).catch(() => {});
  }, [isOpen]);

  // auto db name + backup list when app/client change
  useEffect(() => {
    if (!db.dbEdited && db.clientName) setDb((p) => ({ ...p, dbName: generateDatabaseName(p.app, p.clientName) }));
  }, [db.app, db.clientName, db.dbEdited]);
  useEffect(() => {
    if (db.app) provisioningApi.backupDatabases(db.app).then((r) => setBackupDbs(r.databases || [])).catch(() => setBackupDbs([]));
  }, [db.app]);

  const go = (n: number) => { setStep(n); setMaxStep((m) => Math.max(m, n)); setErr(null); };

  async function step1() {
    if (!db.server || !db.app || !db.backupType || !db.clientName.trim() || !db.dbName.trim() || !db.backupDb) {
      setErr("All fields are required."); return;
    }
    if (setup && setup.databaseName === db.dbName.trim()) { go(2); return; }
    setBusy(true); setErr(null);
    try {
      const r = await provisioningApi.setupDatabase({
        server: db.server, applicationName: db.app, backupType: db.backupType,
        clientName: db.clientName.trim(), databaseName: db.dbName.trim(), backupDatabaseName: db.backupDb,
      });
      if (!r.success) { setErr(r.message); return; }
      setSetup(r);
      rememberServer(db.server);
      setSub((p) => ({ ...p, conn_String: r.connectionString, applicationName: r.applicationName, companyName: r.clientName }));
      setCompany((p) => ({ ...p, connectionString: r.connectionString, companyName: r.clientName }));
      go(2);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  async function step2() {
    if (!sub.companyName || !sub.companyUserID || !sub.password) { setErr("Client Name, Login Name and Password are required."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await customersApi.create(sub);
      if (!r.success) { setErr(r.message); return; }
      setCompany((p) => ({ ...p, connectionString: (sub.conn_String as string) ?? p.connectionString, companyName: sub.companyName as string, city: sub.city as string, state: sub.state as string, country: (sub.country as string) ?? "India", email: sub.email as string, gstin: sub.gstin as string, mobileNO: sub.mobile as string, address: sub.address as string, address1: sub.address as string }));
      go(3);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  async function step3() {
    if (!company.companyName?.trim()) { setErr("Company Name is required."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await provisioningApi.saveCompanyMaster(company);
      if (!r.success) { setErr(r.message); return; }
      setBranch((p) => ({ ...p, connectionString: company.connectionString, branchName: company.companyName, mailingName: company.companyName, city: company.city, state: company.state, country: company.country ?? "India", pincode: company.pincode, mobileNo: company.mobileNO, email: company.email, gstin: company.gstin, companyID: r.companyID }));
      go(4);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  async function step4() {
    if (!branch.branchName?.trim()) { setErr("Branch Name is required."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await provisioningApi.saveBranchMaster(branch);
      if (!r.success) { setErr(r.message); return; }
      setProd((p) => ({ ...p, connectionString: company.connectionString, productionUnitName: company.productionUnitName || company.companyName, address: company.productionUnitAddress || company.address, city: company.city, state: company.state, gstNo: company.gstin, pincode: company.pincode, country: company.country ?? "India", pan: company.pan }));
      go(5);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  async function step5() {
    if (!prod.productionUnitName?.trim()) { setErr("Production Unit Name is required."); return; }
    setBusy(true); setErr(null);
    try {
      const pu = await provisioningApi.saveProductionUnit(prod);
      if (!pu.success) { setErr(pu.message); return; }
      const cs = await provisioningApi.completeSetup({ connectionString: prod.connectionString, city: company.city, state: company.state, country: company.country, companyUserID: sub.companyUserID as string });
      if (!cs.success) { setErr(cs.message); return; }
      setDone(cs); setStep(6);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  const T = (label: string, val: unknown, on: (v: string) => void, opts?: { type?: string; readOnly?: boolean; hint?: string }) => (
    <div><Label text={label} extra={opts?.hint} />
      <Input type={opts?.type ?? "text"} value={(val as string | number | undefined) ?? ""} onChange={(e) => on(e.target.value)} readOnly={opts?.readOnly}
        style={opts?.readOnly ? { background: "#eef4fb", color: "#1e2a3d", fontWeight: 700, letterSpacing: 0.3 } : undefined} />
    </div>
  );
  const S = (label: string, val: string, on: (v: string) => void, options: string[], extra?: { searchable?: boolean; allowCustom?: boolean }) => (
    <div><Label text={label} />
      <Dropdown
        value={val ?? ""}
        onValueChange={(v) => on(String(v))}
        options={options.map((o) => ({ value: o, label: o }))}
        placeholder={extra?.allowCustom ? "Select or type…" : "Select…"}
        searchable={extra?.searchable}
        allowTextInput={extra?.allowCustom}
        allowCustomValues={extra?.allowCustom}
        size="md"
      />
    </div>
  );

  if (!isOpen || typeof document === "undefined") return null;
  const meta = STEP_META[step];
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(12,20,33,.55)", display: "grid", placeItems: "center", padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(1120px,97vw)", maxHeight: "94vh", display: "flex", flexDirection: "column", background: "rgb(var(--bg-surface))", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.42)" }}>

        {/* premium gradient header + step pills */}
        <div style={{ background: "linear-gradient(100deg,color-mix(in srgb, rgb(var(--color-primary)) 75%, black),rgb(var(--color-primary)) 52%,color-mix(in srgb, rgb(var(--color-primary)) 60%, white))", color: "#fff", padding: "15px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,.16)", display: "grid", placeItems: "center", flexShrink: 0 }}><Database size={20} /></div>
          <div style={{ flex: 1, minWidth: 170 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.2 }}>Complete Company Setup</div>
            <div style={{ fontSize: 12, opacity: 0.82, marginTop: 1 }}>{step <= 5 ? `Step ${step} of 5 · ${meta?.title ?? ""}` : "Setup complete"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {STEPS.map((s) => {
              const active = step === s.n, doneStep = step > s.n;
              return (
                <button key={s.n} onClick={() => s.n <= maxStep && go(s.n)} disabled={s.n > maxStep}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                    cursor: s.n <= maxStep ? "pointer" : "default", opacity: s.n > maxStep ? 0.6 : 1,
                    background: active ? "#fff" : "rgba(255,255,255,.14)", color: active ? "rgb(var(--color-primary))" : "#fff" }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 800,
                    background: active ? "rgb(var(--color-primary))" : doneStep ? "#3fbf6a" : "rgba(255,255,255,.28)", color: "#fff" }}>{doneStep ? "✓" : s.n}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
          <button onClick={onClose} title="Close" style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "rgba(255,255,255,.16)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><X size={17} /></button>
        </div>

        {/* scrollable body */}
        <div style={{ padding: "18px 22px 20px", overflowY: "auto", flex: 1 }}>
          {step <= 5 && meta && (
            <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 15px", background: "linear-gradient(180deg,#f4f8fd,#eef4fb)", border: "1px solid #dfeaf6", borderRadius: 13, marginBottom: 18 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#e2edfa", color: "rgb(var(--color-primary))", display: "grid", placeItems: "center", flexShrink: 0 }}><meta.icon size={19} /></div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: "rgb(var(--fg-default))" }}>{meta.title}</div>
                <div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))", marginTop: 1 }}>{meta.sub}</div>
              </div>
            </div>
          )}

          {err && <div style={{ color: "#b42318", background: "#fef3f2", border: "1px solid #fecdca", borderRadius: 9, padding: "9px 13px", fontSize: 13, marginBottom: 14, fontWeight: 600 }}>{err}</div>}

      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 16px" }}>
          <div style={sect}>Database Setup</div>
          {S("Server *", db.server, (v) => { setDb((p) => ({ ...p, server: v })); if (v && !servers.includes(v)) { setServers((prev) => [...prev, v]); rememberServer(v); } }, servers, { searchable: true, allowCustom: true })}
          {S("Application *", db.app, (v) => setDb((p) => ({ ...p, app: v })), APP_OPTIONS)}
          {S("Backup Type *", db.backupType, (v) => setDb((p) => ({ ...p, backupType: v })), BACKUP_TYPES)}
          {T("Client Name *", db.clientName, (v) => setDb((p) => ({ ...p, clientName: v })))}
          {T("Database Name *", db.dbName, (v) => setDb((p) => ({ ...p, dbName: v, dbEdited: true })))}
          {S("Backup Database *", db.backupDb, (v) => setDb((p) => ({ ...p, backupDb: v })), backupDbs, { searchable: true })}
          <div style={{ gridColumn: "1 / -1", fontSize: 12, opacity: 0.65 }}>
            Will restore <b>{db.dbName || "—"}</b> on <b>{db.server || "—"}</b> from template <b>{db.backupDb || "—"}</b>.
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px 18px" }}>
          {T("Client Code", sub.companyUniqueCode, () => {}, { readOnly: true, hint: "auto" })}
          {T("Client Name *", sub.companyName, (v) => setSub((p) => ({ ...p, companyName: v })))}
          {T("Company Code", sub.companyCode, (v) => setSub((p) => ({ ...p, companyCode: v })))}
          {T("GSTIN", sub.gstin, (v) => setSub((p) => ({ ...p, gstin: v })))}
          {T("City", sub.city, (v) => setSub((p) => ({ ...p, city: v })))}
          {T("State", sub.state, (v) => setSub((p) => ({ ...p, state: v })))}
          {T("Address", sub.address as string, (v) => setSub((p) => ({ ...p, address: v })))}
          {T("Email", sub.email, (v) => setSub((p) => ({ ...p, email: v })), { type: "email" })}
          {T("Mobile", sub.mobile, (v) => setSub((p) => ({ ...p, mobile: v })))}
          {S("ERP Status", sub.subscriptionStatus as string, (v) => setSub((p) => ({ ...p, subscriptionStatus: v })), ["Active", "Expired"])}
          {S("Cloud Status", sub.cloudSubscriptionStatus as string, (v) => setSub((p) => ({ ...p, cloudSubscriptionStatus: v })), ["Active", "Expired", "Trial", "Suspended"])}
          {T("Company Login Name *", sub.companyUserID, (v) => setSub((p) => ({ ...p, companyUserID: v })))}
          {T("Password *", sub.password, (v) => setSub((p) => ({ ...p, password: v })))}
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 16px" }}>
          <div style={sect}>Company Master</div>
          {T("Company ID", company.companyID, (v) => setCompany((p) => ({ ...p, companyID: Number(v) || 2 })), { type: "number" })}
          {T("Company Name *", company.companyName, (v) => setCompany((p) => ({ ...p, companyName: v })))}
          {T("GSTIN", company.gstin, (v) => setCompany((p) => ({ ...p, gstin: v })))}
          {T("Address 1", company.address1, (v) => setCompany((p) => ({ ...p, address1: v })))}
          {T("City", company.city, (v) => setCompany((p) => ({ ...p, city: v })))}
          {T("State", company.state, (v) => setCompany((p) => ({ ...p, state: v })))}
          {T("Country", company.country, (v) => setCompany((p) => ({ ...p, country: v })))}
          {T("Pincode", company.pincode, (v) => setCompany((p) => ({ ...p, pincode: v })))}
          {T("Mobile No", company.mobileNO, (v) => setCompany((p) => ({ ...p, mobileNO: v })))}
          {T("Email", company.email, (v) => setCompany((p) => ({ ...p, email: v })))}
          {T("PAN", company.pan, (v) => setCompany((p) => ({ ...p, pan: v })))}
          {T("Prod. Unit Name", company.productionUnitName, (v) => setCompany((p) => ({ ...p, productionUnitName: v })))}
        </div>
      )}

      {step === 4 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 16px" }}>
          <div style={sect}>Branch Master</div>
          {T("Branch ID", branch.branchID, (v) => setBranch((p) => ({ ...p, branchID: Number(v) || 1 })), { type: "number" })}
          {T("Branch Name *", branch.branchName, (v) => setBranch((p) => ({ ...p, branchName: v })))}
          {T("Mailing Name", branch.mailingName, (v) => setBranch((p) => ({ ...p, mailingName: v })))}
          {T("City", branch.city, (v) => setBranch((p) => ({ ...p, city: v })))}
          {T("District", branch.district, (v) => setBranch((p) => ({ ...p, district: v })))}
          {T("State", branch.state, (v) => setBranch((p) => ({ ...p, state: v })))}
          {T("Country", branch.country, (v) => setBranch((p) => ({ ...p, country: v })))}
          {T("Pincode", branch.pincode, (v) => setBranch((p) => ({ ...p, pincode: v })))}
          {T("Mobile No", branch.mobileNo, (v) => setBranch((p) => ({ ...p, mobileNo: v })))}
          {T("Email", branch.email, (v) => setBranch((p) => ({ ...p, email: v })))}
          {T("GSTIN", branch.gstin, (v) => setBranch((p) => ({ ...p, gstin: v })))}
        </div>
      )}

      {step === 5 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 16px" }}>
          <div style={sect}>Production Unit</div>
          {T("Prod. Unit Name *", prod.productionUnitName, (v) => setProd((p) => ({ ...p, productionUnitName: v })))}
          {T("City", prod.city, (v) => setProd((p) => ({ ...p, city: v })))}
          {T("State", prod.state, (v) => setProd((p) => ({ ...p, state: v })))}
          {T("GST No", prod.gstNo, (v) => setProd((p) => ({ ...p, gstNo: v })))}
          {T("Pincode", prod.pincode, (v) => setProd((p) => ({ ...p, pincode: v })))}
          {T("Country", prod.country, (v) => setProd((p) => ({ ...p, country: v })))}
          {T("PAN", prod.pan, (v) => setProd((p) => ({ ...p, pan: v })))}
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Address</label>
            <Input value={prod.address ?? ""} onChange={(e) => setProd((p) => ({ ...p, address: e.target.value }))} /></div>
        </div>
      )}

      {step === 6 && done && (() => {
        const loginUrl = APP_LOGIN_URL[(setup?.applicationName || "").toLowerCase()] || "https://estimo.indusanalytics.co.in/CompanyLogin.aspx";
        const creds: [string, string][] = [
          ["Company Name", (sub.companyName as string) || setup?.clientName || "—"],
          ["URL", loginUrl],
          ["Company Login Name", done.companyUserID || "—"],
          ["Password", done.password || "—"],
          ["User Name", done.userName || "—"],
          ["Password", done.userPassword || "—"],
        ];
        const copyText = creds.map(([k, v]) => `${k}: ${v}`).join("\n");
        return (
          <div style={{ textAlign: "center", padding: "6px 10px" }}>
            <div style={{ width: 62, height: 62, borderRadius: 16, margin: "6px auto 14px", display: "grid", placeItems: "center", background: "linear-gradient(150deg,#12a150,#22c06a)", color: "#fff", boxShadow: "0 12px 26px -10px rgba(18,161,80,.7)" }}>
              <PartyPopper size={30} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "rgb(var(--fg-default))" }}>Congratulations!</h3>
            <p style={{ opacity: 0.62, marginTop: 5, fontSize: 13.5 }}>Setup complete. The client can now login with the credentials below.</p>

            <div style={{ maxWidth: 580, margin: "20px auto 0", textAlign: "left", background: "rgb(var(--bg-surface))", border: "1px solid #e5ebf3", borderRadius: 14, overflow: "hidden", boxShadow: "0 12px 32px -20px rgba(16,24,40,.25)" }}>
              {creds.map(([k, v], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "11px 16px", borderTop: i ? "1px solid #eef2f7" : "none" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "rgb(var(--fg-muted))", flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: k === "URL" ? 11 : 13, fontWeight: 700, color: "rgb(var(--fg-default))", fontFamily: "monospace", background: "#eef4fb", padding: "4px 12px", borderRadius: 8, maxWidth: "68%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", direction: k === "URL" ? "rtl" : "ltr" }} title={v}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 22 }}>
              <button onClick={() => { navigator.clipboard?.writeText(copyText); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgb(var(--bg-surface))", color: "rgb(var(--color-primary))", border: "1.5px solid #cdddf1", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied!" : "Copy Credentials"}
              </button>
              <button onClick={() => onDone()}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#fff", border: "none", borderRadius: 10, padding: "10px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "linear-gradient(100deg,rgb(var(--color-primary)),color-mix(in srgb, rgb(var(--color-primary)) 60%, white))", boxShadow: "0 6px 16px -6px rgba(31,69,118,.6)" }}>
                <CheckCircle2 size={16} /> Done
              </button>
            </div>
          </div>
        );
      })()}

        </div>{/* end scrollable body */}

        {/* footer */}
        {step <= 5 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 22px", borderTop: "1px solid #eef1f6", background: "rgb(var(--bg-subtle))", flexShrink: 0 }}>
            <button onClick={() => (step > 1 ? go(step - 1) : onClose())} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-muted))", border: "1px solid #d7deea", borderRadius: 10, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
              {step > 1 ? <ChevronLeft size={16} /> : <X size={15} />} {step > 1 ? "Back" : "Cancel"}
            </button>
            <button disabled={busy} onClick={() => [step1, step2, step3, step4, step5][step - 1]()}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer",
                background: busy ? "#8496ad" : "linear-gradient(100deg,rgb(var(--color-primary)),color-mix(in srgb, rgb(var(--color-primary)) 60%, white))", boxShadow: busy ? "none" : "0 6px 16px -6px rgba(31,69,118,.6)" }}>
              {step === 1 ? <Database size={16} /> : step === 5 ? <CheckCircle2 size={16} /> : null}
              {busy ? "Working…" : step === 1 ? "Create Database & Continue" : step === 5 ? "Save & Finish" : "Save & Continue"}
            </button>
          </div>
        )}
      </div>{/* end modal card */}
    </div>,
    document.body
  );
}
