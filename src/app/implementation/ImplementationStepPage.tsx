"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Page, Dropdown } from "indas-ui";
import type { LucideIcon } from "lucide-react";
import { Rocket, Activity, FileSpreadsheet, FileCheck2, HardHat, Users2, Package } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import ClientDetailBody from "@/app/clients/ClientDetailBody";
import { customersApi, type CustomerCard } from "@/lib/customers";
import { fetchMyModulePerms } from "@/lib/myPermissions";

/** One Implementation step = one of the client-detail tabs, surfaced as its own sidebar route.
 *  The page shows an "Indus Product" filter + a client picker at top, then renders that client's
 *  single tab (via ClientDetailBody's lockTab) below — reusing all the existing per-client UI. */
export type StepId = "kickoff" | "tracker" | "templates" | "signoff" | "onsite";

const STEP_META: Record<StepId, { title: string; icon: LucideIcon }> = {
  kickoff:   { title: "Kick-Off",              icon: Rocket },
  tracker:   { title: "Tracker",               icon: Activity },
  templates: { title: "Template Master Excel", icon: FileSpreadsheet },
  signoff:   { title: "Sign-Off",              icon: FileCheck2 },
  onsite:    { title: "Onsite Management",     icon: HardHat },
};

// Friendly labels for the known Indus products (keys are NORMALIZED applicationName).
const PRODUCT_LABEL: Record<string, string> = {
  estimoprime: "Estimoprime",
  multiunit: "MultiUnit",
  desktop: "Desktop",
  printudeerp: "PrintudeERP",
};
// Real /clients data has messy casing/spacing ("Multiunit", "multi unit", "Desktop") — normalize
// (lowercase + strip non-alphanumeric) before grouping/matching so no client is mis-bucketed.
const normApp = (a?: string | null) => (a ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const DEFAULT_PRODUCT = "estimoprime";

export default function ImplementationStepPage({ step }: { step: StepId }) {
  const meta = STEP_META[step];
  const { data: session } = useSession();
  const [clients, setClients] = useState<CustomerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<string>(DEFAULT_PRODUCT);  // normalized applicationName
  const [clientId, setClientId] = useState<string>("");             // = CustomerCard.companyUserID
  // This step's edit permission comes from the /implementation/<step> module's OWN authority
  // (User Management → Module Authority), not the client-detail-tab (clienttab-*) system.
  const [editable, setEditable] = useState(false);

  // Strict Project-Assignment scope: the Client picker shows only the clients assigned to the
  // logged-in user (admin → all). Admin assigns projects via Admin → Project Assignment.
  useEffect(() => {
    customersApi.list({ assignedOnly: true }).then(setClients).catch(() => setClients([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const uid = (session?.user as { UserID?: number } | undefined)?.UserID;
    if (!uid) return;
    fetchMyModulePerms(uid).then((perms) => {
      const p = perms[`/implementation/${step}`];
      setEditable(!!p && (p.canEdit || p.canSave));  // edit OR save authority → editable
    }).catch(() => {});
  }, [session, step]);

  // Distinct products present in the data (normalized) → dropdown options. Empty applicationName
  // is bucketed under "(No product)" so those clients are still reachable.
  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();  // norm → raw label source
    for (const c of clients) {
      const n = normApp(c.applicationName);
      const key = n || "__none__";
      if (!seen.has(key)) seen.set(key, c.applicationName || "");
    }
    const opts = Array.from(seen.entries()).map(([key, raw]) => ({
      value: key,
      label: key === "__none__" ? "(No product)" : (PRODUCT_LABEL[key] ?? (raw || key)),
    }));
    // Estimoprime first, then the rest alphabetically, "(No product)" last.
    opts.sort((a, b) =>
      a.value === DEFAULT_PRODUCT ? -1 : b.value === DEFAULT_PRODUCT ? 1
      : a.value === "__none__" ? 1 : b.value === "__none__" ? -1
      : a.label.localeCompare(b.label));
    return opts;
  }, [clients]);

  // Once loaded, if the default product has no clients, fall back to the first available product.
  useEffect(() => {
    if (loading || productOptions.length === 0) return;
    if (!productOptions.some((o) => o.value === product)) setProduct(productOptions[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, productOptions]);

  // Clients filtered by the selected product.
  const clientOptions = useMemo(
    () => clients
      .filter((c) => c.companyUserID && (product === "__none__" ? normApp(c.applicationName) === "" : normApp(c.applicationName) === product))
      .map((c) => ({ value: c.companyUserID, label: `${c.companyName || c.companyUserID}${c.companyUniqueCode ? ` (${c.companyUniqueCode})` : ""}` })),
    [clients, product]
  );

  const Icon = meta.icon;

  return (
    <Page>
      {/* Centered step heading (matches the app-wide page-header look). */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "rgb(var(--color-primary))", color: "#fff", flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(31,69,118,.45)" }}>
          <Icon size={24} />
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "rgb(var(--fg-default))", margin: 0, letterSpacing: 0.2 }}>{meta.title}</h1>
      </div>

      {/* Indus Product filter + client picker (client list follows the selected product). */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))" }}>
            <Package size={16} /> Indus Product
          </span>
          <div style={{ width: 220 }}>
            <Dropdown
              value={product}
              onValueChange={(v) => { setProduct(String(v)); setClientId(""); }}
              options={productOptions}
              placeholder={loading ? "Loading…" : "— Select product —"}
              searchable
              size="md"
            />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))" }}>
            <Users2 size={16} /> Client
          </span>
          <div style={{ width: 360, maxWidth: "100%" }}>
            <Dropdown
              value={clientId}
              onValueChange={(v) => setClientId(String(v))}
              options={clientOptions}
              placeholder={loading ? "Loading clients…" : clientOptions.length ? "— Select a client —" : "No clients for this product"}
              searchable
              size="md"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <BrandedLoader size="md" text="Loading clients…" />
      ) : clientId ? (
        <ClientDetailBody id={clientId} lockTab={step} lockTabEditable={editable} inModal={false} onClose={() => {}} />
      ) : (
        <div style={{ padding: "40px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          Select a client above to view its {meta.title}.
        </div>
      )}
    </Page>
  );
}
