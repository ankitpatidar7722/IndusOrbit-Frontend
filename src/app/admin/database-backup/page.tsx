"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Page, Dropdown, Button } from "indas-ui";
import { Package, Users2, Database, Download, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import { customersApi, type CustomerCard } from "@/lib/customers";
import { databaseBackupApi } from "@/lib/databaseBackup";

// Friendly product labels (keys are NORMALIZED applicationName) — mirrors ImplementationStepPage.
const PRODUCT_LABEL: Record<string, string> = {
  estimoprime: "Estimoprime",
  multiunit: "MultiUnit",
  desktop: "Desktop",
  printudeerp: "PrintudeERP",
};
const normApp = (a?: string | null) => (a ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const DEFAULT_PRODUCT = "estimoprime";

// Database name (parsed by the backend from the connection string) so same-named clients stay
// distinguishable in the picker + card heading.
const dbNameOf = (c: CustomerCard): string => (c.databaseName ?? "").trim();

type Phase = "idle" | "running" | "done" | "error";

export default function DatabaseBackupPage() {
  const [clients, setClients] = useState<CustomerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<string>(DEFAULT_PRODUCT);
  const [clientId, setClientId] = useState<string>("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);       // displayed % (eased toward the backend target)
  const [stage, setStage] = useState("");
  const [message, setMessage] = useState("");
  const targetRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const easeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    customersApi.list({ assignedOnly: true })
      .then(setClients).catch(() => setClients([])).finally(() => setLoading(false));
  }, []);

  // Distinct products present in the data -> dropdown options.
  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of clients) {
      const n = normApp(c.applicationName);
      const key = n || "__none__";
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

  useEffect(() => {
    if (loading || productOptions.length === 0) return;
    if (!productOptions.some((o) => o.value === product)) setProduct(productOptions[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, productOptions]);

  // Dropdown stays clean: Client Name (Code) only — same as before.
  const clientOptions = useMemo(
    () => clients
      .filter((c) => c.companyUserID && (product === "__none__" ? normApp(c.applicationName) === "" : normApp(c.applicationName) === product))
      .map((c) => ({
        value: c.companyUserID,
        label: `${c.companyName || c.companyUserID}${c.companyUniqueCode ? ` (${c.companyUniqueCode})` : ""}`,
      })),
    [clients, product]
  );

  // Card heading also appends the database name (so same-named clients stay distinguishable) — but
  // ONLY in the heading, not in the dropdown list.
  const selectedLabel = useMemo(() => {
    const c = clients.find((x) => x.companyUserID === clientId);
    if (!c) return "";
    const db = dbNameOf(c);
    return `${c.companyName || c.companyUserID}${c.companyUniqueCode ? ` (${c.companyUniqueCode})` : ""}${db ? ` (${db})` : ""}`;
  }, [clients, clientId]);

  const stopTimers = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (easeRef.current) { clearInterval(easeRef.current); easeRef.current = null; }
  };
  useEffect(() => () => stopTimers(), []);

  const triggerDownload = (operationId: string) => {
    const a = document.createElement("a");
    a.href = databaseBackupApi.downloadUrl(operationId);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const startBackup = async () => {
    if (!clientId || phase === "running") return;
    setPhase("running");
    setPercent(0);
    targetRef.current = 3;
    setStage("Starting");
    setMessage("");

    // Smoothly ease the displayed bar toward the backend target (so opaque phases still creep).
    easeRef.current = setInterval(() => {
      setPercent((p) => {
        const t = targetRef.current;
        return p < t ? Math.min(t, p + Math.max(1, Math.round((t - p) / 6))) : p;
      });
    }, 180);

    let operationId = "";
    try {
      const res = await databaseBackupApi.start(clientId);
      operationId = res.operationId;
    } catch (e) {
      stopTimers();
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Failed to start backup.");
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const st = await databaseBackupApi.status(operationId);
        targetRef.current = Math.max(targetRef.current, st.percentComplete || 0);
        if (st.stage) setStage(st.stage);
        if (st.isComplete) {
          stopTimers();
          if (st.success) {
            targetRef.current = 100;
            setPercent(100);
            setStage("Complete");
            setMessage("Backup downloaded successfully.");
            setPhase("done");
            triggerDownload(operationId);
          } else {
            setPhase("error");
            setMessage(st.error || st.message || "Backup failed.");
          }
        }
      } catch { /* transient — keep polling */ }
    }, 900);
  };

  const reset = () => {
    stopTimers();
    setPhase("idle");
    setPercent(0);
    setStage("");
    setMessage("");
  };

  const busy = phase === "running";

  return (
    <Page>
      {/* Heading */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 22 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "rgb(var(--color-primary))", color: "#fff", flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(31,69,118,.45)" }}>
          <Database size={24} />
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "rgb(var(--fg-default))", margin: 0, letterSpacing: 0.2 }}>Database Backup</h1>
      </div>

      {/* Product + Client pickers */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))" }}>
            <Package size={16} /> Indus Product
          </span>
          <div style={{ width: 220 }}>
            <Dropdown
              value={product}
              onValueChange={(v) => { setProduct(String(v)); setClientId(""); reset(); }}
              options={productOptions}
              placeholder={loading ? "Loading…" : "— Select product —"}
              searchable
              size="md"
              disabled={busy}
            />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))" }}>
            <Users2 size={16} /> Client Name
          </span>
          <div style={{ width: 360, maxWidth: "100%" }}>
            <Dropdown
              value={clientId}
              onValueChange={(v) => { setClientId(String(v)); reset(); }}
              options={clientOptions}
              placeholder={loading ? "Loading clients…" : clientOptions.length ? "— Select a client —" : "No clients for this product"}
              searchable
              size="md"
              disabled={busy}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <BrandedLoader size="md" text="Loading clients…" />
      ) : !clientId ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          Select a product and client above to download a database backup.
        </div>
      ) : (
        <div style={{ maxWidth: 620, margin: "0 auto", background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-default))", borderRadius: 16, padding: 26, boxShadow: "0 4px 20px -12px rgba(0,0,0,.25)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "rgb(var(--fg-default))", marginBottom: 4 }}>{selectedLabel}</div>
          <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))", marginBottom: 20 }}>
            A fresh compressed backup of this client&apos;s database will be prepared and downloaded to your machine as a .zip file.
          </div>

          {/* Idle → the action button */}
          {phase === "idle" && (
            <Button onClick={startBackup} size="md" icon={Download}>
              Download Backup
            </Button>
          )}

          {/* Running → progress bar */}
          {phase === "running" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-default))" }}>{stage || "Working…"}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "rgb(var(--color-primary))" }}>{percent}%</span>
              </div>
              <div style={{ height: 12, borderRadius: 999, background: "rgb(var(--bg-muted, 229 231 235))", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${percent}%`, borderRadius: 999, background: "rgb(var(--color-primary))", transition: "width .25s ease" }} />
              </div>
              <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 10 }}>
                Please keep this tab open — the backup is being prepared on the server and streamed to you.
              </div>
            </div>
          )}

          {/* Done → success */}
          {phase === "done" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#16a34a", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                <CheckCircle2 size={22} /> Backup downloaded successfully!
              </div>
              <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))", marginBottom: 16 }}>
                {message} If the download didn&apos;t start, click below.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button onClick={startBackup} size="md" icon={Download}>Download Again</Button>
                <Button onClick={reset} size="md" variant="action-secondary" icon={RotateCcw}>New Backup</Button>
              </div>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#dc2626", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                <AlertCircle size={22} /> Backup failed
              </div>
              <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))", marginBottom: 16 }}>{message}</div>
              <Button onClick={startBackup} size="md" icon={RotateCcw}>Try Again</Button>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
