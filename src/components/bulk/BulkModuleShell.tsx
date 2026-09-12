"use client";
import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Page, Dropdown } from "indas-ui";
import { Package, Users2, Pencil, ChevronUp, type LucideIcon } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import { customersApi, type CustomerCard } from "@/lib/customers";
import { setBulkTargetCompany } from "@/bulk/services/api";

// Reusable wrapper for every Indus360-hosted Bulk Import module: shows the Indus Product + Client
// picker (indas-ui), and once a client is chosen it sets X-Target-Company so all /bulk API calls
// from the wrapped module operate on THAT client's database. Feature logic stays untouched; only
// the surrounding chrome is Indus360-native.

const PRODUCT_LABEL: Record<string, string> = {
  estimoprime: "Estimoprime",
  multiunit: "MultiUnit",
  desktop: "Desktop",
  printudeerp: "PrintudeERP",
};
const normApp = (a?: string | null) => (a ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const DEFAULT_PRODUCT = "estimoprime";

export interface BulkClientContext {
  companyUserId: string;
  companyName: string;
  companyUniqueCode?: string | null;
  applicationName?: string | null;
  databaseName?: string | null;
}

// Lets a wrapped module collapse the shell's Product/Client picker (and its own selectors) into a thin
// summary bar once data is on screen — so the grid gets the full height. Modules opt in: they report
// `hasData` (mode !== idle); the shell auto-collapses on the false→true edge, and the user can toggle
// back and forth ("Change" to expand, "Collapse selectors" to re-collapse).
export const BulkCompactContext = createContext<{
  compact: boolean;
  setCompact: (v: boolean) => void;
  hasData: boolean;
  setHasData: (v: boolean) => void;
}>({
  compact: false,
  setCompact: () => {},
  hasData: false,
  setHasData: () => {},
});

export default function BulkModuleShell({
  title,
  icon: Icon = Package,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** Render prop — receives the selected client once picked, so the module knows its target. */
  children: (client: BulkClientContext) => ReactNode;
}) {
  const [clients, setClients] = useState<CustomerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<string>(DEFAULT_PRODUCT); // default to Estimoprime; user then picks a Client
  const [clientId, setClientId] = useState<string>("");
  const [compact, setCompact] = useState(false); // is the picker currently collapsed?
  const [hasData, setHasData] = useState(false); // does the wrapped module have data on screen (mode !== idle)?
  const prevHasData = useRef(false);
  // Auto-collapse on the moment data first loads; auto-expand when it's cleared. Between those edges the
  // user is free to toggle manually (Change ↔ Collapse selectors) without the module fighting them.
  useEffect(() => {
    if (hasData && !prevHasData.current) setCompact(true);
    else if (!hasData && prevHasData.current) setCompact(false);
    prevHasData.current = hasData;
  }, [hasData]);

  useEffect(() => {
    customersApi.list({ assignedOnly: true })
      .then(setClients).catch(() => setClients([])).finally(() => setLoading(false));
  }, []);

  // Point every /bulk API call at the picked client's DB (cleared on unmount / deselect).
  useEffect(() => {
    setBulkTargetCompany(clientId || null);
    return () => setBulkTargetCompany(null);
  }, [clientId]);

  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of clients) {
      const key = normApp(c.applicationName) || "__none__";
      if (!seen.has(key)) seen.set(key, c.applicationName || "");
    }
    const opts = Array.from(seen.entries()).map(([key, raw]) => ({
      value: key,
      label: key === "__none__" ? "(No product)" : (PRODUCT_LABEL[key] ?? (raw || key)),
    }));
    opts.sort((a, b) =>
      a.value === DEFAULT_PRODUCT ? -1 : b.value === DEFAULT_PRODUCT ? 1
        : a.value === "__none__" ? 1 : b.value === "__none__" ? -1
          : a.label.localeCompare(b.label));
    return opts;
  }, [clients]);

  // Product defaults to Estimoprime (DEFAULT_PRODUCT); the user then picks a Client, and only after that
  // does any module UI render (see the gate below). Product is NOT force-corrected to a valid option —
  // if the user clears it, the Client picker disables until they choose a product again.

  const clientOptions = useMemo(
    () => clients
      .filter((c) => c.companyUserID && (product === "__none__" ? normApp(c.applicationName) === "" : normApp(c.applicationName) === product))
      .map((c) => ({ value: c.companyUserID, label: `${c.companyName || c.companyUserID}${c.companyUniqueCode ? ` (${c.companyUniqueCode})` : ""}` })),
    [clients, product]
  );

  // Clear a stale client that doesn't belong to the current product (after a product change or a hot-
  // reload) so the module UI never stays open for a client the dropdown can no longer display.
  useEffect(() => {
    if (clients.length && clientId && !clientOptions.some((o) => o.value === clientId)) setClientId("");
  }, [clients.length, clientId, clientOptions]);

  const selected = useMemo<BulkClientContext | null>(() => {
    // A client is "selected" only if clientId matches a client IN THE CURRENT PRODUCT's options — so a
    // stale clientId from another product (or before a product change) never leaks the module UI open
    // while the dropdown still shows "— Select a client —".
    if (!clientId || !clientOptions.some((o) => o.value === clientId)) return null;
    const c = clients.find((x) => x.companyUserID === clientId);
    return c ? {
      companyUserId: c.companyUserID,
      companyName: c.companyName,
      companyUniqueCode: c.companyUniqueCode,
      applicationName: c.applicationName,
      databaseName: c.databaseName,
    } : null;
  }, [clients, clientId, clientOptions]);

  return (
    <Page>
      {compact && selected && !loading ? (
        /* Collapsed picker — one thin bar so the module's grid gets the full height. "Change" reopens it. */
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "8px 14px", background: "rgb(var(--bg-subtle))", border: "1px solid rgb(var(--bd-default))", borderRadius: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "rgb(var(--color-primary))", color: "#fff", flexShrink: 0 }}><Icon size={17} /></span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "rgb(var(--fg-default))" }}>{title}</span>
          <span style={{ fontSize: 13, color: "rgb(var(--fg-muted))" }}>{PRODUCT_LABEL[product] ?? product} · <b style={{ color: "rgb(var(--fg-default))" }}>{selected.companyName}</b>{selected.companyUniqueCode ? ` (${selected.companyUniqueCode})` : ""}{selected.databaseName ? ` · ${selected.databaseName}` : ""}</span>
          <button onClick={() => setCompact(false)} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "rgb(var(--color-primary))", background: "transparent", border: "1px solid rgb(var(--color-primary))", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}><Pencil size={13} /> Change</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 22 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "rgb(var(--color-primary))", color: "#fff", flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(31,69,118,.45)" }}>
              <Icon size={24} />
            </span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "rgb(var(--fg-default))", margin: 0, letterSpacing: 0.2 }}>{title}</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))" }}>
                <Package size={16} /> Indus Product
              </span>
              <div style={{ width: 220 }}>
                <Dropdown value={product} onValueChange={(v) => { setProduct(String(v)); setClientId(""); setCompact(false); }} options={productOptions} placeholder={loading ? "Loading…" : "— Select product —"} searchable size="md" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))" }}>
                <Users2 size={16} /> Client Name
              </span>
              <div style={{ width: 360, maxWidth: "100%" }}>
                <Dropdown value={clientId} onValueChange={(v) => { setClientId(String(v)); setCompact(false); }} options={clientOptions} disabled={!product || loading} placeholder={!product ? "Select a product first" : loading ? "Loading clients…" : clientOptions.length ? "— Select a client —" : "No clients for this product"} searchable size="md" />
              </div>
            </div>
          </div>

          {/* Data is on screen but the picker is expanded (e.g. the user hit "Change") — offer a way back
              to the collapsed bar so the grid can reclaim the full height. */}
          {selected && hasData && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <button onClick={() => setCompact(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "rgb(var(--color-primary))", background: "rgba(31,69,118,0.06)", border: "1px solid rgb(var(--color-primary))", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>
                <ChevronUp size={14} /> Collapse selectors
              </button>
            </div>
          )}
        </>
      )}

      {/* GATE: the module's own UI (children) renders ONLY after BOTH an Indus Product AND a Client are
          picked. Until then nothing of the module loads — not even an empty shell — just a step hint. */}
      {loading ? (
        <BrandedLoader size="md" text="Loading clients…" />
      ) : (!product || !selected) ? (
        <div style={{ padding: "52px 0", textAlign: "center" }}>
          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 440 }}>
            <span style={{ display: "inline-flex", width: 54, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", background: "rgba(31,69,118,0.08)", color: "rgb(var(--color-primary))" }}>
              {!product ? <Package size={26} /> : <Users2 size={26} />}
            </span>
            <div style={{ fontSize: 16, fontWeight: 800, color: "rgb(var(--fg-default))" }}>
              {!product ? "Select an Indus Product" : "Select a Client Name"}
            </div>
            <div style={{ fontSize: 13.5, color: "rgb(var(--fg-muted))", lineHeight: 1.5 }}>
              {!product
                ? `Choose a product above, then a client, to open ${title}.`
                : `Choose a client above to open ${title}.`}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 12, fontWeight: 700 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: product ? "rgb(var(--color-primary))" : "rgb(var(--fg-muted))" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", background: product ? "rgb(var(--color-primary))" : "rgb(var(--border-default))" }}>{product ? "✓" : "1"}</span>
                Product
              </span>
              <span style={{ width: 24, height: 2, background: "rgb(var(--border-default))" }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: selected ? "rgb(var(--color-primary))" : "rgb(var(--fg-muted))" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", background: selected ? "rgb(var(--color-primary))" : "rgb(var(--border-default))" }}>{selected ? "✓" : "2"}</span>
                Client
              </span>
            </div>
          </div>
        </div>
      ) : (
        <BulkCompactContext.Provider value={{ compact, setCompact, hasData, setHasData }}>
          <div>
            {!compact && (
              <div style={{ maxWidth: 900, margin: "0 auto 14px", fontSize: 13, color: "rgb(var(--fg-muted))", textAlign: "center" }}>
                Working on: <b style={{ color: "rgb(var(--fg-default))" }}>{selected.companyName}</b>
                {selected.companyUniqueCode ? ` (${selected.companyUniqueCode})` : ""}
                {selected.databaseName ? ` · ${selected.databaseName}` : ""}
              </div>
            )}
            {children(selected)}
          </div>
        </BulkCompactContext.Provider>
      )}
    </Page>
  );
}
