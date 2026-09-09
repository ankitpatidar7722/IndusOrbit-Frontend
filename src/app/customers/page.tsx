"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Page, StatsGrid, StatsCard, Grid, Card, CardContent,
  Badge, Input, Button, StandardModal,
} from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import {
  Building2, MapPin, Phone, Mail, Calendar, ShieldCheck, CreditCard, Search, Server, Plus, Pencil, Trash2, SlidersHorizontal,
} from "lucide-react";
import { customersApi, fmtDate, type CustomerCard, type CustomerDetail, type CustomerStats } from "@/lib/customers";
import { subscriptionVariant } from "@/lib/ui";
import CustomerFormModal from "./CustomerFormModal";
import DeleteCustomerModal from "./DeleteCustomerModal";
import ProvisioningWizard from "./ProvisioningWizard";
import ModuleManagerModal from "./ModuleManagerModal";

const APP_LABEL: Record<string, string> = {
  estimoprime: "EstimoPrime", multiunit: "MultiUnit", printudeerp: "PrintudeERP",
};
const appLabel = (a?: string | null) => (a ? APP_LABEL[a.toLowerCase()] ?? a : "—");

function Field({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: mono ? "monospace" : undefined, wordBreak: "break-word" }}>{value ?? "—"}</div>
    </div>
  );
}

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerCard[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [appFilter, setAppFilter] = useState<string>("All");

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formInitial, setFormInitial] = useState<CustomerDetail | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<CustomerCard | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [modOpen, setModOpen] = useState(false);
  const [modTarget, setModTarget] = useState<CustomerCard | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([customersApi.list(), customersApi.stats()])
      .then(([list, s]) => { setRows(list); setStats(s); })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  async function reload() {
    const [list, s] = await Promise.all([customersApi.list(), customersApi.stats()]);
    setRows(list);
    setStats(s);
  }

  function openCreate() { setFormMode("create"); setFormInitial(null); setFormOpen(true); }
  async function openEdit(id: string) {
    setFormMode("edit");
    try { setFormInitial(await customersApi.detail(id)); setFormOpen(true); }
    catch (e) { setErr(String(e)); }
  }
  function openDelete(c: CustomerCard) { setDelTarget(c); setDelOpen(true); }
  function afterSave(msg: string) { setFormOpen(false); setFlash(msg); reload(); }
  function afterDelete(msg: string) { setDelOpen(false); setFlash(msg); reload(); }

  const apps = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.applicationName && set.add(r.applicationName));
    return ["All", ...Array.from(set)];
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (appFilter !== "All" && r.applicationName !== appFilter) return false;
      if (!term) return true;
      return [r.companyName, r.companyUniqueCode, r.city, r.state, r.gstin, r.mobile, r.email, r.companyUserID]
        .some((v) => (v || "").toLowerCase().includes(term));
    });
  }, [rows, q, appFilter]);

  async function openDetail(id: string) {
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await customersApi.detail(id));
    } catch (e) {
      setErr(String(e));
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) return <BrandedLoader text="Loading customers…" />;

  return (
    <Page title="Customers" description="All client subscriptions">
      {err && <div style={{ color: "#c0392b", marginBottom: 12 }}>Load error: <small>{err}</small></div>}
      {flash && (
        <div style={{ background: "#e6f6ec", color: "#1c6b3c", border: "1px solid #b7e2c6", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
          ✓ {flash}
        </div>
      )}

      <StatsGrid columns={3}>
        <StatsCard title="Total Clients" value={stats?.total ?? 0} />
        <StatsCard title="Active" value={stats?.active ?? 0} variant="accent" />
        <StatsCard title="Expired" value={stats?.expired ?? 0} variant="warning" />
      </StatsGrid>

      {/* toolbar: search + application filter */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "18px 0 14px" }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 10, opacity: 0.5 }} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, city, GSTIN…" style={{ paddingLeft: 30 }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {apps.map((a) => (
            <button
              key={a}
              onClick={() => setAppFilter(a)}
              style={{
                padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                border: "1px solid var(--bd-default, #d8dee9)",
                background: appFilter === a ? "rgb(var(--color-primary))" : "transparent",
                color: appFilter === a ? "#fff" : "inherit",
              }}
            >
              {a === "All" ? "All" : appLabel(a)}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, opacity: 0.6 }}>{filtered.length} of {rows.length}</span>
          <Button size="sm" variant="outline" onClick={() => setWizardOpen(true)}><Server size={15} style={{ verticalAlign: -3, marginRight: 4 }} />Provision Client</Button>
          <Button size="sm" onClick={openCreate}><Plus size={15} style={{ verticalAlign: -3, marginRight: 4 }} />New Subscription</Button>
        </div>
      </div>

      <Grid columns={{ sm: 1, md: 2, lg: 3 }} gap={4}>
        {filtered.map((c, i) => (
          <Card key={`${c.companyUserID || c.companyUniqueCode || "no-id"}-${i}`}>
            <CardContent>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: "linear-gradient(135deg,rgb(var(--color-primary)),color-mix(in srgb, rgb(var(--color-primary)) 60%, white))", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, flexShrink: 0 }}>
                  {c.companyName?.[0] ?? "?"}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.companyName}</div>
                    <Badge variant={subscriptionVariant(c.subscriptionStatus)}>{c.subscriptionStatus ?? "—"}</Badge>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                    {c.companyUniqueCode ?? "—"} · <CreditCard size={11} style={{ display: "inline", verticalAlign: -1 }} /> {appLabel(c.applicationName)}
                    {c.applicationVersion ? ` v${c.applicationVersion}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 6, fontSize: 12.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, opacity: 0.85 }}>
                  <MapPin size={13} style={{ opacity: 0.6 }} /> {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, opacity: 0.85 }}>
                  <Phone size={13} style={{ opacity: 0.6 }} /> {c.mobile || "—"}
                  <Mail size={13} style={{ opacity: 0.6, marginLeft: 10 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email || "—"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, opacity: 0.85 }}>
                  <Calendar size={13} style={{ opacity: 0.6 }} /> {fmtDate(c.fromDate)} → {fmtDate(c.toDate)}
                </div>
              </div>

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--bd-subtle,#eef1f6)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 11.5, opacity: 0.6, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.gstin || "No GSTIN"}</span>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Button size="sm" variant="ghost" title="Modules" onClick={() => { setModTarget(c); setModOpen(true); }}><SlidersHorizontal size={14} /></Button>
                  <Button size="sm" variant="ghost" title="Edit" onClick={() => openEdit(c.companyUserID)}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" title="Delete" onClick={() => openDelete(c)}><Trash2 size={14} /></Button>
                  <Button size="sm" variant="outline" onClick={() => openDetail(c.companyUserID)}>View</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </Grid>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, opacity: 0.6 }}>No customers match your filter.</div>
      )}

      {/* Detail modal */}
      <StandardModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail?.companyName ?? "Customer"}
        subtitle={detail ? `${detail.companyUniqueCode ?? ""} · ${appLabel(detail.applicationName)}` : undefined}
        badge={detail ? { label: detail.subscriptionStatus ?? "—", variant: (detail.subscriptionStatus === "Expired" ? "destructive" : "default") } : undefined}
        size="lg"
        showFooter={false}
      >
        {detailLoading || !detail ? (
          <div style={{ padding: 30, textAlign: "center", opacity: 0.6 }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
            <div>
              <h4 style={sectionStyle}><Building2 size={14} /> Company</h4>
              <Field label="Client Code" value={detail.companyUniqueCode} />
              <Field label="Company Name" value={detail.companyName} />
              <Field label="Company Code" value={detail.companyCode} />
              <Field label="Application" value={`${appLabel(detail.applicationName)}${detail.applicationVersion ? " v" + detail.applicationVersion : ""}`} />
              <Field label="GSTIN" value={detail.gstin} mono />
              <Field label="F-Year" value={detail.fYear} />
            </div>
            <div>
              <h4 style={sectionStyle}><MapPin size={14} /> Address &amp; Contact</h4>
              <Field label="Address" value={detail.address} />
              <Field label="City / State" value={[detail.city, detail.state].filter(Boolean).join(", ")} />
              <Field label="Country" value={detail.country} />
              <Field label="Email" value={detail.email} />
              <Field label="Mobile" value={detail.mobile} />
            </div>
            <div>
              <h4 style={sectionStyle}><CreditCard size={14} /> Subscription</h4>
              <Field label="Status" value={<Badge variant={subscriptionVariant(detail.subscriptionStatus)}>{detail.subscriptionStatus ?? "—"}</Badge>} />
              <Field label="From → To" value={`${fmtDate(detail.fromDate)} → ${fmtDate(detail.toDate)}`} />
              <Field label="Payment Due" value={fmtDate(detail.paymentDueDate)} />
              <Field label="Status Description" value={detail.statusDescription} />
              <Field label="ERP Message" value={detail.subscriptionStatusMessage} />
              <Field label="Login Allowed" value={detail.loginAllowed != null ? String(detail.loginAllowed) : "—"} />
            </div>
            <div>
              <h4 style={sectionStyle}><ShieldCheck size={14} /> Access</h4>
              <Field label="Company Login" value={detail.companyUserID} mono />
              <Field label="Last Login" value={fmtDate(detail.lastLoginDateTime)} />
              <h4 style={{ ...sectionStyle, marginTop: 16 }}><Server size={14} /> Database</h4>
              <Field label="Connection String" value={<span style={{ fontSize: 11 }}>{detail.conn_String}</span>} mono />
            </div>
          </div>
        )}
      </StandardModal>

      <CustomerFormModal
        mode={formMode}
        initial={formInitial}
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={afterSave}
      />

      <DeleteCustomerModal
        target={delTarget}
        isOpen={delOpen}
        onClose={() => setDelOpen(false)}
        onDeleted={afterDelete}
      />

      <ProvisioningWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onDone={() => { setWizardOpen(false); setFlash("Client provisioned successfully."); reload(); }}
      />

      <ModuleManagerModal
        customer={modTarget}
        isOpen={modOpen}
        onClose={() => setModOpen(false)}
        onFlash={(m) => setFlash(m)}
      />
    </Page>
  );
}

const sectionStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6,
  color: "rgb(var(--color-primary))", display: "flex", alignItems: "center", gap: 6,
  margin: "4px 0 10px",
};
