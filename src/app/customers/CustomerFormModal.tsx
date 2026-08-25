"use client";
import { useEffect, useState } from "react";
import { StandardModal, Dropdown, Tabs, Button } from "indas-ui";
import { Building2, CreditCard, Cloud, KeyRound, Save, Wand2, type LucideIcon } from "lucide-react";
import { customersApi, type CustomerDetail, type SubscriptionSave } from "@/lib/customers";
import MessageFormatPopup from "./MessageFormatPopup";
import DateField from "@/components/DateField";

const APP_OPTIONS = ["estimoprime", "multiunit", "PrintudeERP"];
const STATUS_OPTIONS = ["Active", "Expired"];
const toDateInput = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : "");

// Theme tokens (indas-ui) — never hardcode colors (frontend-design skill rule #1).
const T = {
  surface: "rgb(var(--bg-surface))",
  subtle: "rgb(var(--bg-subtle))",
  fg: "rgb(var(--fg-default))",
  muted: "rgb(var(--fg-muted))",
  bd: "rgb(var(--bd-default))",
  primary: "rgb(var(--color-primary))",
  onPrimary: "#fff",
  error: "rgb(var(--color-error))",
};

const fldLabel: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 5 };
const fldInput: React.CSSProperties = { width: "100%", height: 40, padding: "0 12px", fontSize: 13.5, border: `1px solid ${T.bd}`, borderRadius: 9, background: T.surface, outline: "none", boxSizing: "border-box", color: T.fg };
const fldArea: React.CSSProperties = { width: "100%", padding: "9px 12px", fontSize: 13.5, border: `1px solid ${T.bd}`, borderRadius: 9, background: T.surface, outline: "none", boxSizing: "border-box", color: T.fg, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 };
const readOnlyInput: React.CSSProperties = { ...fldInput, background: T.subtle, color: T.muted };

/**
 * Client Project create/edit modal — Parkson "User Master" style built to the
 * frontend-design skill: StandardModal + full-width icon pill tabs (indas-ui Tabs,
 * theme tokens), per-tab field grids, one form under the hood.
 */
export default function CustomerFormModal({
  mode, initial, isOpen, onClose, onSaved,
}: {
  mode: "create" | "edit";
  initial: CustomerDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [f, setF] = useState<SubscriptionSave>({});
  const [tab, setTab] = useState("company");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msgPopup, setMsgPopup] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErr(null);
    setTab("company");
    if (mode === "edit" && initial) {
      setF({ ...initial, originalCompanyUserID: initial.companyUserID });
    } else {
      setF({ subscriptionStatus: "Active", country: "India", loginAllowed: 1 });
      customersApi.nextCode().then((r) => setF((p) => ({ ...p, companyUniqueCode: r.companyUniqueCode, maxCompanyUniqueCode: r.maxCompanyUniqueCode }))).catch(() => {});
    }
  }, [isOpen, mode, initial]);

  const set = (k: keyof SubscriptionSave, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!f.companyName?.trim()) { setErr("Client Name is required (Company Detail tab)."); setTab("company"); return; }
    if (!f.companyUserID?.trim()) { setErr("Company Login Name is required (Login & Access tab)."); setTab("login"); return; }
    if (/\s/.test(f.companyUserID)) { setErr("Login Name must not contain spaces."); setTab("login"); return; }
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) { setErr("Enter a valid email."); setTab("company"); return; }
    if (f.mobile && !/^\d+$/.test(String(f.mobile))) { setErr("Mobile must be numeric."); setTab("company"); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = mode === "edit" ? await customersApi.update(f) : await customersApi.create(f);
      if (res.success) onSaved(res.message);
      else setErr(res.message);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── field render helpers ──
  const Text = (label: string, k: keyof SubscriptionSave, opts?: { type?: string; readOnly?: boolean; full?: boolean }) => (
    <div style={{ gridColumn: opts?.full ? "1 / -1" : undefined }}>
      <label style={fldLabel}>{label}</label>
      <input type={opts?.type ?? "text"} value={(f[k] as string | number | undefined) ?? ""}
        onChange={(e) => set(k, opts?.type === "number" ? Number(e.target.value) : e.target.value)}
        readOnly={opts?.readOnly} style={opts?.readOnly ? readOnlyInput : fldInput} />
    </div>
  );
  const DateF = (label: string, k: keyof SubscriptionSave) => (
    <div>
      <label style={fldLabel}>{label}</label>
      <DateField value={f[k] as string | undefined} onChange={(v) => set(k, v)} />
    </div>
  );
  const Sel = (label: string, k: keyof SubscriptionSave, options: string[]) => (
    <div>
      <label style={fldLabel}>{label}</label>
      <Dropdown value={(f[k] as string) ?? ""} onValueChange={(v) => set(k, String(v))}
        options={options.map((o) => ({ value: o, label: o }))} placeholder="Select…" searchable size="md" />
    </div>
  );

  const tabDefs: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "company", label: "Company Detail", icon: Building2 },
    { id: "erp", label: "ERP Subscription", icon: CreditCard },
    { id: "cloud", label: "Cloud Subscription", icon: Cloud },
    { id: "login", label: "Login & Access", icon: KeyRound },
  ];
  const saveLabel = mode === "edit" ? "Save Changes" : "Create Client";

  const Footer = () => (
    <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, paddingTop: 14, borderTop: `1px solid ${T.bd}` }}>
      <Button variant="action-cancel" size="sm" onClick={onClose}>Cancel</Button>
      <Button variant="action-save" size="sm" icon={Save} loading={saving} onClick={handleSave}>{saving ? "Saving…" : saveLabel}</Button>
    </div>
  );

  return (
    <StandardModal
      isOpen={isOpen}
      // While the Format-Message popup is open, ignore the dialog's own close.
      onClose={() => { if (!msgPopup) onClose(); }}
      title={mode === "edit" ? `Edit — ${initial?.companyName ?? ""}` : "New Client Project"}
      subtitle={mode === "edit" ? (initial?.companyUniqueCode ?? undefined) : (f.companyUniqueCode ? `Client Code ${f.companyUniqueCode}` : undefined)}
      size="xl"
      showFooter={false}
    >
      {/* Full-width icon pill tabs (indas-ui) */}
      <Tabs tabs={tabDefs} activeTab={tab} onTabChange={setTab} variant="pill" size="md" fullWidth />
      {err && <div style={{ color: T.error, fontSize: 12.5, marginTop: 10, fontWeight: 600 }}>{err}</div>}

      <div style={{ marginTop: 16 }}>
        {tab === "company" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px 16px" }}>
            {Text("Client Code", "companyUniqueCode", { readOnly: true })}
            {Text("Client Name *", "companyName")}
            {Text("Company Code", "companyCode")}
            {Sel("Application", "applicationName", APP_OPTIONS)}
            {Text("Application Version", "applicationVersion")}
            {Text("GSTIN", "gstin")}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={fldLabel}>Address</label>
              <textarea value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} rows={2} style={fldArea} />
            </div>
            {Text("City", "city")}
            {Text("State", "state")}
            {Text("Country", "country")}
            {Text("Email", "email", { type: "email" })}
            {Text("Mobile", "mobile")}
            {Text("F-Year", "fYear")}
            <Footer />
          </div>
        )}

        {tab === "erp" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "14px 16px" }}>
            {Sel("Status", "subscriptionStatus", STATUS_OPTIONS)}
            {DateF("From Date", "fromDate")}
            {DateF("To Date", "toDate")}
            {DateF("Payment Due", "paymentDueDate")}
            {Text("Login Allowed", "loginAllowed", { type: "number" })}
            <div>
              <label style={fldLabel}>Message Active</label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", height: 40 }}>
                <input type="checkbox" checked={!!f.isMessageActive} onChange={(e) => set("isMessageActive", e.target.checked)} style={{ width: 16, height: 16, accentColor: "rgb(var(--color-primary))" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.fg }}>{f.isMessageActive ? "On" : "Off"}</span>
              </label>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={fldLabel}>Status Description</label>
              <input value={f.statusDescription ?? ""} onChange={(e) => set("statusDescription", e.target.value)} style={fldInput} />
            </div>
            {f.isMessageActive && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label style={{ ...fldLabel, marginBottom: 0 }}>ERP Message</label>
                  <Button variant="ghost" size="xs" icon={Wand2} onClick={() => setMsgPopup(true)}>Format Message</Button>
                </div>
                <textarea value={f.subscriptionStatusMessage ?? ""} onChange={(e) => set("subscriptionStatusMessage", e.target.value)} rows={2} style={fldArea} />
              </div>
            )}
            <Footer />
          </div>
        )}

        {tab === "cloud" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "14px 16px" }}>
            {Sel("Cloud Status", "cloudSubscriptionStatus", STATUS_OPTIONS)}
            {DateF("From Date", "cloudFromDate")}
            {DateF("To Date", "cloudToDate")}
            {DateF("Payment Due Date", "cloudPaymentDueDate")}
            <Footer />
          </div>
        )}

        {tab === "login" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
            {Text("Company Login Name *", "companyUserID")}
            {Text("Password", "password")}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={fldLabel}>Connection String</label>
              <textarea value={f.conn_String ?? ""} onChange={(e) => set("conn_String", e.target.value)} rows={2} style={fldArea} />
            </div>
            <Footer />
          </div>
        )}
      </div>

      <MessageFormatPopup
        visible={msgPopup}
        onClose={() => setMsgPopup(false)}
        onLoadMessage={(title, content) => setF((prev) => ({ ...prev, statusDescription: title, subscriptionStatusMessage: content }))}
      />
    </StandardModal>
  );
}
