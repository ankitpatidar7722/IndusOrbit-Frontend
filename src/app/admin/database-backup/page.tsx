"use client";
import KDropdown from "@/components/KDropdown";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Page, Button, Input, Tabs } from "indas-ui";
import { Package, Users2, Database, Download, CheckCircle2, AlertCircle, RotateCcw, Server, User, KeyRound, PlugZap, History, X } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import { customersApi, type CustomerCard } from "@/lib/customers";
import { databaseBackupApi, type ServerDatabase, type SavedServer } from "@/lib/databaseBackup";
import { useInProgressNavGuard } from "@/hooks/useInProgressNavGuard";
import LeaveGuardDialog from "@/components/LeaveGuardDialog";

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
type Mode = "client" | "server";

const MODE_TABS = [
  { id: "client", label: "By Client" },
  { id: "server", label: "By Server" },
];

export default function DatabaseBackupPage() {
  const [clients, setClients] = useState<CustomerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<string>(DEFAULT_PRODUCT);
  const [clientId, setClientId] = useState<string>("");

  // "By Server" mode: typed credentials (kept only in page state, never stored) -> that server's databases.
  const [mode, setMode] = useState<Mode>("client");
  const [server, setServer] = useState("");
  const [serverUser, setServerUser] = useState("");
  const [serverPassword, setServerPassword] = useState("");
  const [serverDbs, setServerDbs] = useState<ServerDatabase[] | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState("");
  const [dbName, setDbName] = useState("");
  // Server history (per user, newest first) + "Remember password" (stored encrypted on the server;
  // the password itself never comes back to the browser — usingSaved tells the API to use it).
  const [savedServers, setSavedServers] = useState<SavedServer[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [remember, setRemember] = useState(false);
  const [usingSaved, setUsingSaved] = useState(false);

  const refreshSaved = () => databaseBackupApi.savedServers().then(setSavedServers).catch(() => {});
  useEffect(() => { refreshSaved(); }, []);

  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);       // displayed % (eased toward the backend target)
  const [stage, setStage] = useState("");
  const [message, setMessage] = useState("");
  const targetRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const easeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingDownloadRef = useRef<string>("");   // operationId to download once phase flips to "done"

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

  const serverCreds = () => ({
    server: server.trim(),
    userId: serverUser.trim(),
    password: serverPassword,
    remember,
    useSaved: usingSaved && !serverPassword,
  });
  const canConnect = !!server.trim() && !!serverUser.trim() && (!!serverPassword || usingSaved);

  const suggestions = useMemo(() => {
    const q = server.trim().toLowerCase();
    return savedServers.filter((s) => !q || s.server.toLowerCase().includes(q));
  }, [savedServers, server]);

  // Picking a saved server fills its User ID; a saved password is used without showing it.
  const pickSaved = (s: SavedServer) => {
    setServer(s.server);
    setServerUser(s.userId ?? "");
    setServerPassword("");
    setUsingSaved(s.hasPassword);
    setRemember(s.hasPassword);
    setShowSuggest(false);
    setServerDbs(null);
    setDbName("");
    setDbError("");
    reset();
  };

  const forgetSaved = async (s: SavedServer) => {
    try {
      await databaseBackupApi.forgetServer(s.server);
      setSavedServers((list) => list.filter((x) => x.server !== s.server));
      if (s.server === server.trim()) { setUsingSaved(false); setRemember(false); }
    } catch { /* keep the list as is */ }
  };

  // Any credential edit invalidates the loaded list (it belonged to the previous server/login).
  const editCred = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setUsingSaved(false);
    setServerDbs(null);
    setDbName("");
    setDbError("");
    reset();
  };

  const loadServerDatabases = async () => {
    if (!canConnect || dbLoading) return;
    setDbLoading(true);
    setDbError("");
    setServerDbs(null);
    setDbName("");
    reset();
    try {
      setServerDbs(await databaseBackupApi.serverDatabases(serverCreds()));
      refreshSaved();
    } catch (e) {
      setDbError(e instanceof Error ? e.message : "Could not load databases from this server.");
    } finally {
      setDbLoading(false);
    }
  };

  const dbOptions = useMemo(
    () => (serverDbs ?? []).map((d) => ({
      value: d.name,
      label: `${d.name}${d.sizeMB ? ` (${d.sizeMB >= 1024 ? `${(d.sizeMB / 1024).toFixed(1)} GB` : `${d.sizeMB} MB`})` : ""}`,
    })),
    [serverDbs]
  );

  const selected = mode === "client" ? clientId : dbName;
  const headingLabel = mode === "client" ? selectedLabel : `${dbName} (${server.trim()})`;

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
    if (!selected || phase === "running") return;
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
      const res = mode === "client"
        ? await databaseBackupApi.start(clientId)
        : await databaseBackupApi.startServer(serverCreds(), dbName);
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
            // Defer the actual download to AFTER the page is marked "done" (see the effect below) —
            // so the in-progress nav guard (active only while phase==="running") has released its
            // beforeunload handler first; otherwise the download's brief cross-origin navigation
            // pops a spurious "Leave site?" prompt and the file never downloads.
            pendingDownloadRef.current = operationId;
            setPhase("done");
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

  // While a backup is being prepared + streamed, block leaving the page (sidebar / in-app nav → Leave/Cancel
  // popup; tab close / refresh → native prompt) so the user doesn't abandon the in-flight backup by accident.
  const navGuard = useInProgressNavGuard(busy);

  // Trigger the browser download only once phase === "done" (guard released). A 0ms timeout pushes it
  // to the next macrotask, so the nav guard's beforeunload cleanup has definitely run and the
  // download no longer fires a "Leave site?" prompt.
  useEffect(() => {
    if (phase !== "done" || !pendingDownloadRef.current) return;
    const id = pendingDownloadRef.current;
    pendingDownloadRef.current = "";
    const t = setTimeout(() => triggerDownload(id), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <Page>
      {/* data-navguard-safe: clicks on THIS page's own controls are ignored by the guard — only the
          sidebar / header (outside this subtree) count as "leaving". */}
      <div data-navguard-safe>
      {/* Heading */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 22 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "rgb(var(--color-primary))", color: "#fff", flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(31,69,118,.45)" }}>
          <Database size={24} />
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "rgb(var(--fg-default))", margin: 0, letterSpacing: 0.2 }}>Database Backup</h1>
      </div>

      {/* Mode switch */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <div style={busy ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
          <Tabs tabs={MODE_TABS} activeTab={mode} onTabChange={(id: string) => { setMode(id as Mode); reset(); }} variant="rounded" size="sm" />
        </div>
      </div>

      {mode === "server" && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ width: 240, maxWidth: "100%", position: "relative" }}>
            <label style={fieldLabel}><Server size={15} /> Server Name</label>
            <Input value={server} onChange={(e) => { editCred(setServer)(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)} onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              placeholder="e.g. 13.200.122.70,1433" autoComplete="off" disabled={busy} />
            {showSuggest && suggestions.length > 0 && (
              <div style={suggestBox}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "rgb(var(--fg-muted))", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  <History size={12} /> Recent servers
                </div>
                {suggestions.map((s) => (
                  <div key={s.server} style={suggestRow}
                    onMouseDown={(e) => { e.preventDefault(); pickSaved(s); }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgb(var(--bg-muted, 241 245 249))"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-default))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.server}</div>
                      <div style={{ fontSize: 11, color: "rgb(var(--fg-muted))" }}>
                        {s.userId || "—"}{s.hasPassword ? " · password saved" : ""}
                      </div>
                    </div>
                    <button type="button" title="Remove from recent servers"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); forgetSaved(s); }}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: "rgb(var(--fg-muted))", padding: 4, display: "inline-flex" }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: 170, maxWidth: "100%" }}>
            <label style={fieldLabel}><User size={15} /> User ID</label>
            <Input value={serverUser} onChange={(e) => editCred(setServerUser)(e.target.value)} placeholder="e.g. sa" autoComplete="off" disabled={busy} />
          </div>
          <div style={{ width: 170, maxWidth: "100%" }}>
            <label style={fieldLabel}><KeyRound size={15} /> Password</label>
            <Input type="password" value={serverPassword} onChange={(e) => editCred(setServerPassword)(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") loadServerDatabases(); }} autoComplete="new-password"
              placeholder={usingSaved ? "Saved password" : ""} disabled={busy} />
            <label style={{ position: "absolute", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy}
                style={{ accentColor: "rgb(var(--color-primary))", width: 14, height: 14, cursor: "pointer" }} />
              Remember password
            </label>
          </div>
          <Button onClick={loadServerDatabases} size="md" icon={PlugZap} disabled={!canConnect || dbLoading || busy}>
            {dbLoading ? "Connecting…" : "Show Databases"}
          </Button>
          {serverDbs && (
            <div style={{ width: 340, maxWidth: "100%" }}>
              <label style={fieldLabel}><Database size={15} /> Database ({serverDbs.length})</label>
              <KDropdown
                value={dbName}
                onValueChange={(v) => { setDbName(String(v)); reset(); }}
                options={dbOptions}
                placeholder={dbOptions.length ? "— Select a database —" : "No databases found"}
                searchable
                size="md"
                disabled={busy}
              />
            </div>
          )}
        </div>
      )}

      {/* Product + Client pickers */}
      {mode === "client" && (
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))" }}>
            <Package size={16} /> Indus Product
          </span>
          <div style={{ width: 220 }}>
            <KDropdown
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
            <KDropdown
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

      )}

      {mode === "client" && loading ? (
        <BrandedLoader size="md" text="Loading clients…" />
      ) : mode === "server" && dbError ? (
        <div style={{ maxWidth: 620, margin: "10px auto", display: "flex", alignItems: "center", gap: 10, color: "#dc2626", fontSize: 14, fontWeight: 600, justifyContent: "center" }}>
          <AlertCircle size={18} /> {dbError}
        </div>
      ) : !selected ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          {mode === "client"
            ? "Select a product and client above to download a database backup."
            : serverDbs
              ? "Select a database above to download its backup."
              : "Enter the server name, User ID and Password, then click Show Databases."}
        </div>
      ) : (
        <div style={{ maxWidth: 620, margin: "0 auto", background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-default))", borderRadius: 16, padding: 26, boxShadow: "0 4px 20px -12px rgba(0,0,0,.25)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "rgb(var(--fg-default))", marginBottom: 4 }}>{headingLabel}</div>
          <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))", marginBottom: 20 }}>
            A fresh compressed backup of this {mode === "client" ? "client’s " : ""}database will be prepared and downloaded to your machine as a .zip file.
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
      </div>{/* end data-navguard-safe */}

      {/* Leave / Cancel popup when the user navigates away mid-backup (tab-close handled natively). */}
      <LeaveGuardDialog
        open={navGuard.blocked}
        title="Leave while the backup is running?"
        message="A database backup is being prepared and downloaded right now. If you leave this page it will be cancelled."
        onConfirm={navGuard.confirmLeave}
        onCancel={navGuard.cancelLeave}
      />
    </Page>
  );
}

const suggestBox: CSSProperties = {
  position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 50, maxHeight: 280, overflowY: "auto",
  background: "rgb(var(--bg-surface, 255 255 255))", border: "1px solid rgb(var(--border-default, 226 232 240))",
  borderRadius: 10, boxShadow: "0 10px 28px -10px rgba(0,0,0,.28)", padding: "4px 0",
};
const suggestRow: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 10px", cursor: "pointer",
};

const fieldLabel: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6,
};
