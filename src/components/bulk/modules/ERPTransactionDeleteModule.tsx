"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button, Dropdown, useModalAlert } from "indas-ui";
import { Trash2, Database, AlertTriangle, ShieldAlert, Lock, CheckCircle2, XCircle, Info, Loader2, ListChecks } from "lucide-react";
import type { BulkClientContext } from "@/components/bulk/BulkModuleShell";
import {
  getModules, checkMasterUsage, deleteMasterData, deleteUnusedMasterData, getBulkTargetCompany,
  type ModuleDto, type MasterUsageResult, type DeleteMasterDataResult,
} from "@/bulk/services/api";

// "ERP Transaction Delete" — Indus360 rebuild of ERPTransactionDelete.tsx (improved UI, all features):
// Tab 1 Master-wise delete (usage pre-check → delete-all OR delete-unused, single credential auth) and
// Tab 2 clear ALL transactions (3-step captcha confirm → credentials → STREAMING progress). Operates on
// the picked client's DB (X-Target-Company). Every guard, mode and message from the original is kept.

type Tab = "master" | "transaction";
const MODULES_WITH_SUB = ["item master", "item masters", "ledger master", "ledger masters", "tool master", "tool masters"];
const INP: CSSProperties = { padding: "9px 11px", borderRadius: 9, fontSize: 13.5, width: "100%", border: "1px solid rgb(var(--border-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" };
const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 };
const genCaptcha = () => { const a = Math.floor(Math.random() * 50) + 20, b = Math.floor(Math.random() * 30) + 10; return { a, b, ans: a - b }; };

// ── Reusable overlay ─────────────────────────────────────────────────────────
function Overlay({ children, onClose, z = 9999 }: { children: React.ReactNode; onClose?: () => void; z?: number }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: z, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      {children}
    </div>
  );
}
function Card({ children, accent = "rgb(var(--color-primary))", width = 460 }: { children: React.ReactNode; accent?: string; width?: number }) {
  return <div style={{ width, maxWidth: "100%", background: "rgb(var(--bg-surface))", borderRadius: 20, boxShadow: "0 24px 64px -12px rgba(2,6,23,0.5)", border: `2px solid ${accent}`, padding: "24px", maxHeight: "92vh", overflowY: "auto" }}>{children}</div>;
}

export default function ERPTransactionDeleteModule({ client }: { client: BulkClientContext }) {
  const { showSuccess, showError, AlertComponent } = useModalAlert();
  const [tab, setTab] = useState<Tab>("master");
  const [modules, setModules] = useState<ModuleDto[]>([]);
  const [subModules, setSubModules] = useState<ModuleDto[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [subId, setSubId] = useState("");
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<MasterUsageResult | null>(null);
  const [authKind, setAuthKind] = useState<"" | "delete" | "unused">("");
  const [authError, setAuthError] = useState("");
  const [creds, setCreds] = useState({ username: "", password: "", reason: "" });
  // transaction flow
  const [step, setStep] = useState(0); // 1-3 captcha, 4 credential
  const [cap, setCap] = useState(genCaptcha());
  const [capIn, setCapIn] = useState("");
  const [capErr, setCapErr] = useState(false);
  const [prog, setProg] = useState<null | { pct: number; current: number; total: number; table: string; message: string; done: boolean }>(null);
  const [success, setSuccess] = useState<null | { count: number; group: string }>(null);

  useEffect(() => {
    getModules("Masters_All").then((m) => setModules(m ?? [])).catch(() => showError("Load failed", "Failed to load modules. Please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.companyUserId]);

  const opt = (arr: ModuleDto[]) => arr.map((m) => ({ value: String(m.moduleId), label: m.moduleDisplayName || m.moduleName }));
  const selModule = useMemo(() => modules.find((m) => String(m.moduleId) === moduleId), [modules, moduleId]);
  const selSub = useMemo(() => subModules.find((m) => String(m.moduleId) === subId), [subModules, subId]);
  const selModName = selModule?.moduleDisplayName || selModule?.moduleName || "";
  const showSub = MODULES_WITH_SUB.includes((selModName).toLowerCase()) && subModules.length > 0;
  const canDelete = !!selModule && (!showSub || !!subId);
  const subModuleId = showSub && subId ? parseInt(subId) : 0;
  const groupLabel = `${selModName}${selSub ? ` - ${selSub.moduleDisplayName || selSub.moduleName}` : ""}`;

  const onModuleChange = async (id: string) => {
    setModuleId(id); setSubId(""); setSubModules([]);
    const m = modules.find((x) => String(x.moduleId) === id); if (!m) return;
    const name = m.moduleDisplayName || m.moduleName;
    setBusy(true);
    try {
      let subs = await getModules(name);
      if (!subs?.length) { // singular/plural fallback (Item Master ↔ Item Masters …)
        const alt = name.endsWith("s") ? name.slice(0, -1) : `${name}s`;
        subs = await getModules(alt).catch(() => []);
      }
      setSubModules(subs ?? []);
    } catch { setSubModules([]); } finally { setBusy(false); }
  };

  // ── Master delete: usage check → branch ──────────────────────────────────
  const onMasterDelete = async () => {
    if (!selModule) return;
    setBusy(true);
    try {
      const res = await checkMasterUsage(selModule.moduleName, subModuleId);
      if (res.isUsed) setUsage(res);
      else if ((res.totalItemsInGroup ?? 0) === 0) showError("Nothing to delete", "No active items found in this group to delete.");
      else { setUsage(res); setAuthError(""); setCreds({ username: "", password: "", reason: "" }); setAuthKind("delete"); }
    } catch (e) { showError("Usage check failed", (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as { message?: string })?.message || "Unknown error"); }
    finally { setBusy(false); }
  };
  const startUnused = () => { setUsage((u) => u); setAuthError(""); setCreds({ username: "", password: "", reason: "" }); setAuthKind("unused"); };

  const submitMasterAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creds.username.trim() || !creds.reason.trim()) { setAuthError("Username and reason are required."); return; }
    if (!selModule) return;
    setAuthError(""); setBusy(true);
    try {
      const fn = authKind === "unused" ? deleteUnusedMasterData : deleteMasterData;
      const res: DeleteMasterDataResult = await fn(selModule.moduleName, subModuleId, creds.username, creds.password, creds.reason);
      if (res.success) { setAuthKind(""); setUsage(null); setSuccess({ count: res.deletedCount, group: `${groupLabel}${authKind === "unused" ? " (Unused)" : ""}` }); }
      else setAuthError(res.message || (authKind === "unused" ? "Unused items deletion failed" : "Delete operation failed"));
    } catch (e) {
      const st = (e as { response?: { status?: number } })?.response?.status;
      setAuthError(st === 401 ? "Invalid username or password. Please try again." : (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Delete failed. Please try again.");
    } finally { setBusy(false); }
  };

  // ── Transaction delete: 3 captcha + credential + streaming ───────────────
  const startTx = () => { setStep(1); setCap(genCaptcha()); setCapIn(""); setCapErr(false); setCreds({ username: "", password: "", reason: "" }); setAuthError(""); };
  const cancelTx = () => { setStep(0); setCapErr(false); };
  const capNext = () => { if (parseInt(capIn) !== cap.ans) { setCapErr(true); return; } if (step < 3) { setStep(step + 1); setCap(genCaptcha()); setCapIn(""); setCapErr(false); } else setStep(4); };

  const submitTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creds.username.trim() || !creds.reason.trim()) { setAuthError("Username and reason are required."); return; }
    setAuthError(""); setBusy(true);
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";
    try {
      const res = await fetch(`${base}/bulk/api/transactiondelete/clear-all-transactions`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Target-Company": getBulkTargetCompany() || "" },
        body: JSON.stringify({ Username: creds.username, Password: creds.password, Reason: creds.reason }),
      });
      if (!res.ok) { setBusy(false); setAuthError(res.status === 401 ? "Invalid username or password. Please try again." : (await res.text()) || `Execution failed with status ${res.status}`); return; }
      setStep(0); setProg({ pct: 0, current: 0, total: 0, table: "", message: "Starting…", done: false });
      const reader = res.body?.getReader(); const dec = new TextDecoder(); let buf = "";
      if (reader) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n"); buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let d: { type: string; total?: number; current?: number; percentage?: number; table?: string; message?: string; processed?: number };
            try { d = JSON.parse(line); } catch { continue; }
            if (d.type === "start") setProg({ pct: 0, current: 0, total: d.total ?? 0, table: "", message: d.message ?? "Deleting…", done: false });
            else if (d.type === "progress") setProg({ pct: d.percentage ?? 0, current: d.current ?? 0, total: d.total ?? 0, table: d.table ?? "", message: d.message ?? "", done: false });
            else if (d.type === "complete") { setProg({ pct: 100, current: d.total ?? 0, total: d.total ?? 0, table: "", message: d.message ?? "Completed", done: true }); setTimeout(() => { setProg(null); setSuccess({ count: d.processed ?? 0, group: "All Transactions" }); }, 700); }
            else if (d.type === "error") { setProg(null); if ((d.message || "").toLowerCase().includes("password") || (d.message || "").toLowerCase().includes("username")) { setStep(4); setAuthError(d.message || "Authorization failed."); } else showError("Delete failed", d.message || "Error during deletion."); }
          }
        }
      }
    } catch (e) { setProg(null); showError("Server error", (e as { message?: string })?.message || "Error communicating with the server."); }
    finally { setBusy(false); }
  };

  const TAB_BTN = (t: Tab, label: string, Icon: typeof Database) => (
    <button onClick={() => setTab(t)} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "transparent", border: "none", borderBottom: `2px solid ${tab === t ? "#dc2626" : "transparent"}`, color: tab === t ? "#dc2626" : "rgb(var(--fg-muted))" }}>
      <Icon size={17} /> {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      {/* Page title comes from the shell's top-centre header — no duplicate title block here. */}
      <div style={{ background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-default))", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid rgb(var(--border-default))" }}>
          {TAB_BTN("master", "Master Wise Data", Database)}
          {TAB_BTN("transaction", "All Transaction without Master", Trash2)}
        </div>

        <div style={{ padding: 22 }}>
          {tab === "master" ? (
            <>
              <div style={{ display: "flex", gap: 10, background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.4)", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
                <AlertTriangle size={20} color="#ca8a04" style={{ flexShrink: 0 }} />
                <div><div style={{ fontSize: 13.5, fontWeight: 700, color: "#a16207" }}>Warning: This permanently deletes the selected master data.</div><div style={{ fontSize: 12, color: "#a16207" }}>Please ensure you have a backup before proceeding.</div></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: showSub ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 20, maxWidth: showSub ? "100%" : 420 }}>
                <div><div style={lbl}>Module Name <span style={{ color: "#dc2626" }}>*</span></div><Dropdown value={moduleId} onValueChange={(v) => onModuleChange(String(v))} options={opt(modules)} placeholder="Select Module Name" searchable size="md" /></div>
                {showSub && <div><div style={lbl}>Sub Module Name <span style={{ color: "#dc2626" }}>*</span></div><Dropdown value={subId} onValueChange={(v) => setSubId(String(v))} options={opt(subModules)} placeholder="Select Sub-module" searchable size="md" /></div>}
              </div>
              <div style={{ textAlign: "center" }}>
                <Button size="md" variant="action-delete" icon={busy ? Loader2 : Trash2} onClick={onMasterDelete} disabled={!canDelete || busy}>{busy ? "Checking…" : "Delete Master Data"}</Button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
                <ShieldAlert size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                <div><div style={{ fontSize: 13.5, fontWeight: 800, color: "#b91c1c" }}>Danger: This deletes ALL transactional data (master tables preserved).</div><div style={{ fontSize: 12, color: "#b91c1c" }}>Includes Stock, Tool, Ledger transactions, etc.</div></div>
              </div>
              <div style={{ textAlign: "center", padding: "26px 0", border: "1px dashed rgb(var(--border-default))", borderRadius: 12, background: "rgba(148,163,184,0.06)" }}>
                <Database size={40} color="rgb(var(--fg-muted))" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: "rgb(var(--fg-default))" }}>Delete All Transactions</div>
                <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))", margin: "6px 0 16px" }}>Removes all transactional records while preserving master data.</div>
                <Button size="md" variant="action-delete" icon={Trash2} onClick={startTx} disabled={busy}>Delete All Transactions</Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Usage warning modal */}
      {usage && usage.isUsed && authKind === "" && (
        <Overlay onClose={() => setUsage(null)}><Card accent="#ea580c" width={520}>
          <div style={{ textAlign: "center", marginBottom: 12 }}><span style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", background: "rgba(234,88,12,0.12)", color: "#ea580c" }}><AlertTriangle size={26} /></span></div>
          <h2 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "#c2410c", margin: "0 0 4px" }}>Cannot Delete Master Data</h2>
          <p style={{ textAlign: "center", fontSize: 12.5, color: "rgb(var(--fg-muted))", margin: "0 0 14px" }}>{groupLabel} ({usage.totalItemsInGroup} items)</p>
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#b91c1c", marginBottom: 14 }}>Items in this group are used in transactions. Clear the records listed below before deleting the master data.</div>
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {usage.usages.filter((u) => u.count > 0).map((u, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, border: "1px solid rgb(var(--border-default))", borderRadius: 9, padding: "9px 11px" }}>
                <XCircle size={16} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-default))" }}>{u.area}</span><span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "rgba(239,68,68,0.12)", padding: "1px 8px", borderRadius: 999 }}>{u.count} items</span></div><div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 2 }}>{u.description}</div></div>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "rgb(var(--color-primary))", marginBottom: 6 }}><Info size={15} /> Required Steps</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "rgb(var(--fg-default))", lineHeight: 1.7 }}>
              {usage.usages.filter((u) => u.count > 0).map((u, i) => <li key={i}>Clear {u.area} records first</li>)}
              <li>Return here and delete the master data</li>
            </ol>
          </div>
          {usage.unusedItemsCount > 0 && (
            <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={18} color="#16a34a" /><div><div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>{usage.unusedItemsCount} unused item(s) found</div><div style={{ fontSize: 12, color: "#16a34a" }}>Safe to delete</div></div></div>
              <Button size="sm" variant="action-delete" icon={Trash2} onClick={startUnused}>Delete ({usage.unusedItemsCount})</Button>
            </div>
          )}
          <Button size="md" variant="action-secondary" onClick={() => setUsage(null)}>Understood, Close</Button>
        </Card></Overlay>
      )}

      {/* Master / Unused auth modal */}
      {authKind && (
        <Overlay onClose={() => setAuthKind("")}><Card accent="#16a34a">
          <div style={{ textAlign: "center", marginBottom: 12 }}><span style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", background: "rgba(34,197,94,0.12)", color: "#16a34a" }}><CheckCircle2 size={26} /></span></div>
          <h2 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "#15803d", margin: "0 0 8px" }}>{authKind === "unused" ? "Delete Unused Items" : "Safe to Delete"}</h2>
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: "#15803d", textAlign: "center", marginBottom: 12 }}>Not used in any transactions, job cards, QC inspections, or purchases.</div>
          <p style={{ fontSize: 13, color: "rgb(var(--fg-default))", margin: "0 0 14px", textAlign: "center" }}>
            {authKind === "unused" ? `${usage?.unusedItemsCount ?? 0} unused item(s)` : `${usage?.totalItemsInGroup ?? 0} item(s)`} in <b>{groupLabel}</b>. Enter your username and reason to proceed.
          </p>
          <form onSubmit={submitMasterAuth} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div><div style={lbl}>Username <span style={{ color: "#dc2626" }}>*</span></div><input required value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} style={INP} /></div>
            <div><div style={lbl}>Password <span style={{ color: "rgb(var(--fg-muted))", fontWeight: 400 }}>(optional)</span></div><input type="password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} style={INP} /></div>
            <div><div style={lbl}>Reason for Deletion <span style={{ color: "#dc2626" }}>*</span></div><textarea required rows={3} value={creds.reason} onChange={(e) => setCreds({ ...creds, reason: e.target.value })} placeholder="Please provide the reason for deletion…" style={INP} /></div>
            {authError && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#dc2626", fontSize: 12.5, fontWeight: 600 }}><ShieldAlert size={15} /> {authError}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 2 }}>
              <Button size="sm" variant="action-secondary" type="button" onClick={() => setAuthKind("")}>Cancel</Button>
              <Button size="sm" variant="action-delete" type="submit" disabled={busy}>{authKind === "unused" ? `Delete ${usage?.unusedItemsCount ?? 0} Unused` : "Confirm Delete"}</Button>
            </div>
          </form>
        </Card></Overlay>
      )}

      {/* Transaction confirm — captcha steps 1-3 */}
      {step >= 1 && step <= 3 && (
        <Overlay onClose={cancelTx}><Card accent="#dc2626">
          <div style={{ textAlign: "center", marginBottom: 12 }}><span style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,0.12)", color: "#dc2626" }}><ShieldAlert size={26} /></span></div>
          <h2 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "#dc2626", margin: "0 0 8px", textTransform: "uppercase" }}>Confirmation Required ({step}/3)</h2>
          <p style={{ textAlign: "center", fontSize: 14, color: "rgb(var(--fg-default))", margin: "0 0 16px", lineHeight: 1.5 }}>
            {step === 1 ? "Are you sure you want to clear ALL transactional data for this client?" : step === 2 ? "Have you discussed with the client that this data needs to be cleared?" : "Have you received an email from the client asking to clear the data?"}
          </p>
          <div style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.28)", borderRadius: 14, padding: "16px 18px", marginBottom: 18 }}>
            <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "rgb(var(--color-primary))", letterSpacing: 1.4, marginBottom: 12 }}>SECURITY VERIFICATION — SOLVE THIS</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 30, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "rgb(var(--color-primary))" }}>{cap.a}</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: "rgb(var(--fg-muted))" }}>−</span>
              <span style={{ fontSize: 30, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "rgb(var(--color-primary))" }}>{cap.b}</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: "rgb(var(--fg-muted))" }}>=</span>
              <span style={{ fontSize: 30, fontWeight: 900, color: "rgba(100,116,139,0.5)" }}>?</span>
            </div>
            <input autoFocus type="number" value={capIn} placeholder="Enter answer" onChange={(e) => { setCapIn(e.target.value); setCapErr(false); }} onKeyDown={(e) => { if (e.key === "Enter") capNext(); }}
              style={{ width: "100%", textAlign: "center", padding: "10px 12px", borderRadius: 10, fontSize: 18, fontWeight: 700, fontFamily: "ui-monospace, monospace", border: `2px solid ${capErr ? "#dc2626" : "rgb(var(--border-default))"}`, background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" }} />
            {capErr && <p style={{ color: "#dc2626", fontSize: 12.5, margin: "8px 0 0", textAlign: "center", fontWeight: 600 }}>Incorrect answer. Please try again.</p>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button size="md" variant="action-secondary" onClick={cancelTx} className="flex-1">No, Cancel</Button>
            <Button size="md" variant="action-delete" onClick={capNext}>Yes, Proceed</Button>
          </div>
        </Card></Overlay>
      )}

      {/* Transaction credential — step 4 */}
      {step === 4 && (
        <Overlay onClose={cancelTx}><Card accent="#dc2626">
          <div style={{ textAlign: "center", marginBottom: 12 }}><span style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,0.12)", color: "#dc2626" }}><Lock size={26} /></span></div>
          <h2 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "rgb(var(--fg-default))", margin: "0 0 4px" }}>Security Verification</h2>
          <p style={{ textAlign: "center", fontSize: 12.5, color: "rgb(var(--fg-muted))", margin: "0 0 16px" }}>Authorise with a valid <b>{client.companyName}</b> user.</p>
          <form onSubmit={submitTx} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div><div style={lbl}>Username <span style={{ color: "#dc2626" }}>*</span></div><input required value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} style={INP} /></div>
            <div><div style={lbl}>Password <span style={{ color: "rgb(var(--fg-muted))", fontWeight: 400 }}>(optional)</span></div><input type="password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} style={INP} /></div>
            <div><div style={lbl}>Reason for Deletion <span style={{ color: "#dc2626" }}>*</span></div><textarea required rows={3} value={creds.reason} onChange={(e) => setCreds({ ...creds, reason: e.target.value })} placeholder="Please explicitly state why data is being cleared…" style={INP} /></div>
            {authError && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#dc2626", fontSize: 12.5, fontWeight: 600 }}><ShieldAlert size={15} /> {authError}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 2 }}>
              <Button size="sm" variant="action-secondary" type="button" onClick={cancelTx}>Cancel</Button>
              <Button size="sm" variant="action-delete" type="submit" disabled={busy}>Authorize & Clear Data</Button>
            </div>
          </form>
        </Card></Overlay>
      )}

      {/* Streaming progress */}
      {prog && (
        <Overlay z={10000}><Card accent="rgb(var(--color-primary))" width={480}>
          <div style={{ textAlign: "center", marginBottom: 12 }}><span style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", background: "rgba(31,69,118,0.12)", color: "rgb(var(--color-primary))" }}><Database size={26} className="animate-pulse" /></span></div>
          <h2 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "rgb(var(--fg-default))", margin: "0 0 4px" }}>Deleting Transactions</h2>
          <p style={{ textAlign: "center", fontSize: 12.5, color: "rgb(var(--fg-muted))", margin: "0 0 16px" }}>{prog.message}</p>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}><span style={{ color: "rgb(var(--fg-muted))" }}>Progress</span><span style={{ color: "rgb(var(--color-primary))" }}>{prog.pct}%</span></div>
          <div style={{ height: 12, borderRadius: 999, background: "rgba(148,163,184,0.2)", overflow: "hidden" }}><div style={{ height: "100%", width: `${prog.pct}%`, background: "linear-gradient(90deg,#3b82f6,rgb(var(--color-primary)))", transition: "width .3s" }} /></div>
          <div style={{ textAlign: "center", fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 8 }}>{prog.current} / {prog.total} tables processed</div>
          {prog.table && <div style={{ marginTop: 10, background: "rgba(148,163,184,0.1)", borderRadius: 9, padding: "8px 12px", fontSize: 12 }}><span style={{ color: "rgb(var(--fg-muted))" }}>Currently Processing: </span><span style={{ fontFamily: "ui-monospace, monospace", color: "rgb(var(--fg-default))", fontWeight: 700 }}>{prog.table}</span></div>}
          {prog.done && <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(34,197,94,0.12)", borderRadius: 9, padding: "10px", color: "#16a34a", fontWeight: 700, fontSize: 13 }}><CheckCircle2 size={17} /> Completed Successfully!</div>}
        </Card></Overlay>
      )}

      {/* Success */}
      {success && (
        <Overlay onClose={() => setSuccess(null)} z={10001}><Card accent="#dc2626" width={380}>
          <div style={{ textAlign: "center" }}>
            <span style={{ display: "inline-flex", width: 58, height: 58, borderRadius: "50%", alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,0.12)", color: "#dc2626", marginBottom: 12 }}><CheckCircle2 size={30} /></span>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: "#dc2626", margin: "0 0 6px" }}>Clear All Data Successful!</h2>
            <p style={{ fontSize: 13, color: "rgb(var(--fg-muted))", margin: 0 }}>Successfully deleted</p>
            <div style={{ fontSize: 40, fontWeight: 900, color: "#dc2626", lineHeight: 1.2 }}>{success.count}</div>
            <p style={{ fontSize: 13, color: "rgb(var(--fg-default))", margin: "0 0 16px" }}>{success.count === 1 ? "row" : "rows"} from <b>{success.group}</b></p>
            <Button size="md" variant="action-delete" onClick={() => setSuccess(null)}><ListChecks size={16} /> OK</Button>
          </div>
        </Card></Overlay>
      )}
      <AlertComponent />
    </div>
  );
}
