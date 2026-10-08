"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, Dropdown, Button, StandardModal } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { ScrollText, RefreshCw, Eye, Search, ChevronLeft, ChevronRight, Monitor, Globe, User as UserIcon, Activity, Clock } from "lucide-react";
import { DataGrid } from "@/components/datagrid";
import { auditApi, sessionsApi, fmtIST, fmtDuration, type AuditRow, type AuditFacets, type SessionRow } from "@/lib/auditLogs";

const T = {
  primary: "rgb(var(--color-primary))", fg: "rgb(var(--fg-default))", muted: "rgb(var(--fg-muted))",
  faint: "rgb(var(--fg-muted) / 0.6)", bd: "rgb(var(--bd-default))", surface: "rgb(var(--bg-surface))",
};

/** Colour per action — green create, blue update, red delete, etc. */
const ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
  Create: { bg: "rgba(18,161,80,.12)", fg: "#12a150" },
  Update: { bg: "rgba(37,99,235,.12)", fg: "#2563eb" },
  Delete: { bg: "rgba(217,45,32,.12)", fg: "#d92d20" },
  Login: { bg: "rgba(15,106,114,.12)", fg: "#0f6a72" },
  Logout: { bg: "rgba(107,114,128,.14)", fg: "#6b7280" },
  Export: { bg: "rgba(139,92,246,.14)", fg: "#8b5cf6" },
  Seed: { bg: "rgba(214,145,51,.14)", fg: "#b4791a" },
  Other: { bg: "rgba(107,114,128,.12)", fg: "#6b7280" },
};
function ActionBadge({ action }: { action: string }) {
  const s = ACTION_STYLE[action] ?? ACTION_STYLE.Other;
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: s.bg, color: s.fg }}>{action}</span>;
}

/** Loopback IPs only appear in local dev (frontend+backend same machine) — label them clearly. */
const ipLabel = (ip?: string | null): string => !ip ? "—" : (ip === "127.0.0.1" || ip === "::1") ? "Localhost" : ip;

/** Compact device id for the grid (full value shows in the detail drawer). */
const shortDevice = (id?: string | null): string => !id ? "—" : (id.length > 12 ? "…" + id.slice(-8) : id);

const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 };
const dateInput: React.CSSProperties = { height: 38, padding: "0 10px", fontSize: 13, border: `1px solid ${T.bd}`, borderRadius: 9, background: T.surface, color: T.fg, outline: "none" };

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const [view, setView] = useState<"activity" | "sessions">("activity");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [facets, setFacets] = useState<AuditFacets>({ modules: [], actions: [], users: [] });
  const [detail, setDetail] = useState<AuditRow | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("");
  const [client, setClient] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => { auditApi.facets().then((f) => { if (f.success) setFacets(f); }).catch(() => {}); }, []);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const r = await auditApi.list({
        search: search.trim() || undefined, module: module || undefined, client: client.trim() || undefined, action: action || undefined,
        userId: userId ? Number(userId) : undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
        page: p, pageSize: PAGE_SIZE,
      });
      if (r.success) { setRows(r.rows); setTotal(r.total); setPage(r.page); }
    } catch { setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, search, module, client, action, userId, from, to]);

  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const applyFilters = () => load(1);
  const reset = () => { setSearch(""); setModule(""); setClient(""); setAction(""); setUserId(""); setFrom(""); setTo(""); setTimeout(() => load(1), 0); };

  const columns = useMemo<ColumnDef<AuditRow>[]>(() => [
    { id: "time", header: "Time (IST)", size: 190, accessorFn: (r) => fmtIST(r.createdAt), cell: ({ getValue }) => <span style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{String(getValue() ?? "—")}</span> },
    { accessorKey: "userName", header: "User", size: 150, cell: ({ row }) => row.original.userName || <span style={{ color: T.faint }}>System</span> },
    { accessorKey: "action", header: "Action", size: 100, cell: ({ row }) => <ActionBadge action={row.original.action} /> },
    {
      accessorKey: "module", header: "Module / Tab", size: 185, cell: ({ row }) => (
        <div>
          <div>{row.original.module || "—"}</div>
          {row.original.subModule && <div style={{ fontSize: 11, color: T.muted }}>{row.original.subModule}</div>}
        </div>
      ),
    },
    { accessorKey: "client", header: "Client", size: 190, cell: ({ row }) => row.original.client || <span style={{ color: T.faint }}>—</span> },
    {
      id: "entity", header: "Record", size: 150, cell: ({ row }) => {
        const { entityType, entityId } = row.original;
        if (!entityType && !entityId) return <span style={{ color: T.faint }}>—</span>;
        // Numeric key → "#10"; a named record (module) → "· Sales Order".
        const suffix = entityId ? (/^\d+$/.test(String(entityId)) ? ` #${entityId}` : ` · ${entityId}`) : "";
        return <span>{entityType || ""}{suffix}</span>;
      },
    },
    { accessorKey: "summary", header: "Summary", size: 260, cell: ({ row }) => <span style={{ color: row.original.success === false ? "#d92d20" : T.fg }}>{row.original.summary || "—"}</span> },
    { accessorKey: "ipAddress", header: "IP", size: 120, cell: ({ row }) => <span style={{ fontSize: 12 }}>{ipLabel(row.original.ipAddress)}</span> },
    { id: "ua", header: "Browser / OS", size: 170, cell: ({ row }) => <span style={{ fontSize: 12 }}>{[row.original.browser, row.original.os].filter(Boolean).join(" · ") || "—"}</span> },
    { accessorKey: "deviceId", header: "Device ID", size: 120, cell: ({ row }) => <span title={row.original.deviceId ?? ""} style={{ fontSize: 12, fontFamily: "ui-monospace,monospace" }}>{shortDevice(row.original.deviceId)}</span> },
    {
      id: "detail", header: "", size: 56, enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <button title="Details" onClick={() => setDetail(row.original)}
          style={{ display: "inline-flex", width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", border: `1px solid ${T.bd}`, background: T.surface, color: T.primary, cursor: "pointer" }}>
          <Eye size={14} />
        </button>
      ),
    },
  ], []);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Page>
      {/* Header — centered icon + heading (matches other modules), Activity | Sessions toggle floated top-right */}
      <div style={{ position: "relative", marginBottom: 22, minHeight: 44 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: T.primary, color: "#fff", flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(31,69,118,.45)" }}><ScrollText size={24} /></span>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.fg, margin: 0, letterSpacing: 0.2 }}>Audit Logs</h1>
        </div>
        {/* Activity | Sessions toggle */}
        <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", display: "inline-flex", border: `1px solid ${T.bd}`, borderRadius: 10, overflow: "hidden" }}>
          {([["activity", "Activity", Activity], ["sessions", "Sessions", Clock]] as const).map(([v, label, Icon]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                background: view === v ? T.primary : T.surface, color: view === v ? "#fff" : T.muted }}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
      </div>

      {view === "sessions" ? <SessionsView /> : (<>

      {/* ── Activity view ── */}

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, background: T.surface, border: `1px solid ${T.bd}`, borderRadius: 12, padding: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: "1 1 220px", minWidth: 180 }}>
          <label style={lbl}>Search</label>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: T.faint }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="summary, entity, user, path…" style={{ ...dateInput, width: "100%", paddingLeft: 30 }} />
          </div>
        </div>
        <div style={{ width: 170 }}><label style={lbl}>Module</label>
          <Dropdown value={module} onValueChange={(v) => setModule(String(v))} size="md" searchable placeholder="All modules"
            options={[{ value: "", label: "All modules" }, ...facets.modules.map((m) => ({ value: m, label: m }))]} /></div>
        <div style={{ width: 150 }}><label style={lbl}>Action</label>
          <Dropdown value={action} onValueChange={(v) => setAction(String(v))} size="md" placeholder="All actions"
            options={[{ value: "", label: "All actions" }, ...facets.actions.map((a) => ({ value: a, label: a }))]} /></div>
        <div style={{ width: 180 }}><label style={lbl}>User</label>
          <Dropdown value={userId} onValueChange={(v) => setUserId(String(v))} size="md" searchable placeholder="All users"
            options={[{ value: "", label: "All users" }, ...facets.users.map((u) => ({ value: String(u.id), label: u.name }))]} /></div>
        <div style={{ width: 170 }}><label style={lbl}>Client</label>
          <input value={client} onChange={(e) => setClient(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="code or name…" style={{ ...dateInput, width: "100%" }} /></div>
        <div><label style={lbl}>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateInput} /></div>
        <div><label style={lbl}>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateInput} /></div>
        <Button variant="primary" onClick={applyFilters} loading={loading}>Apply</Button>
        <Button variant="outline" onClick={reset}>Reset</Button>
        <Button variant="outline" icon={RefreshCw} onClick={() => load(page)} title="Refresh" />
      </div>

      {/* Grid */}
      <div style={{ border: `1px solid ${T.bd}`, borderRadius: 12, overflow: "hidden", background: T.surface }}>
        <DataGrid<AuditRow>
          data={rows} columns={columns} getRowId={(r) => String(r.id)}
          title={`${total.toLocaleString("en-IN")} event${total === 1 ? "" : "s"}`}
          loading={loading} mainColumns="summary" enableSearch enableSorting enableExport
        />
      </div>

      {/* Server pager */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: T.muted }}>
        <span>{total === 0 ? "No events" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString("en-IN")}`}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button size="sm" variant="outline" icon={ChevronLeft} disabled={page <= 1 || loading} onClick={() => load(page - 1)}>Prev</Button>
          <span style={{ fontSize: 12.5 }}>Page {page} / {lastPage}</span>
          <Button size="sm" variant="outline" disabled={page >= lastPage || loading} onClick={() => load(page + 1)}>Next <ChevronRight size={14} style={{ verticalAlign: -2 }} /></Button>
        </div>
      </div>

      {/* Detail drawer */}
      {detail && <AuditDetail row={detail} onClose={() => setDetail(null)} />}
      </>)}
    </Page>
  );
}

/** Sessions view — who logged in, when, and how long they used the app. */
function SessionsView() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const SIZE = 50;

  const load = useCallback(async (p = page, act = activeOnly) => {
    setLoading(true);
    try { const r = await sessionsApi.list({ activeOnly: act, page: p, pageSize: SIZE }); if (r.success) { setRows(r.rows); setTotal(r.total); setPage(r.page); } }
    catch { setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, activeOnly]);
  useEffect(() => { load(1, activeOnly); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeOnly]);

  const columns = useMemo<ColumnDef<SessionRow>[]>(() => [
    { accessorKey: "userName", header: "User", size: 160, cell: ({ row }) => row.original.userName || <span style={{ color: T.faint }}>—</span> },
    { id: "loginAt", header: "Login (IST)", size: 190, accessorFn: (r) => fmtIST(r.loginAt), cell: ({ getValue }) => <span style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{String(getValue() ?? "—")}</span> },
    { id: "last", header: "Last Activity (IST)", size: 190, accessorFn: (r) => fmtIST(r.active ? r.lastSeen : r.logoutAt), cell: ({ getValue }) => <span style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{String(getValue() ?? "—")}</span> },
    { accessorKey: "durationMin", header: "Duration", size: 110, cell: ({ row }) => <span style={{ fontWeight: 700, color: T.primary }}>{fmtDuration(row.original.durationMin)}</span> },
    { id: "device", header: "Device", size: 170, cell: ({ row }) => <span style={{ fontSize: 12 }}>{[row.original.browser, row.original.os].filter(Boolean).join(" · ") || "—"}</span> },
    { accessorKey: "deviceId", header: "Device ID", size: 120, cell: ({ row }) => <span title={row.original.deviceId ?? ""} style={{ fontSize: 12, fontFamily: "ui-monospace,monospace" }}>{shortDevice(row.original.deviceId)}</span> },
    { accessorKey: "ipAddress", header: "IP", size: 110, cell: ({ row }) => <span style={{ fontSize: 12 }}>{ipLabel(row.original.ipAddress)}</span> },
    {
      id: "status", header: "Status", size: 120, cell: ({ row }) => {
        const r = row.original;
        const s = r.active ? { bg: "rgba(18,161,80,.12)", fg: "#12a150", t: "Active" }
          : r.endReason === "Timed out" ? { bg: "rgba(214,145,51,.14)", fg: "#b4791a", t: "Timed out" }
          : r.endReason === "Superseded" ? { bg: "rgba(107,114,128,.14)", fg: "#6b7280", t: "Superseded" }
          : { bg: "rgba(37,99,235,.12)", fg: "#2563eb", t: "Logged out" };
        return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: s.bg, color: s.fg }}>{s.t}</span>;
      },
    },
  ], []);

  const lastPage = Math.max(1, Math.ceil(total / SIZE));
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: T.muted, cursor: "pointer" }}>
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} style={{ width: 15, height: 15 }} />
          Active now only
        </label>
        <Button size="sm" variant="outline" icon={RefreshCw} onClick={() => load(page, activeOnly)}>Refresh</Button>
      </div>
      <div style={{ border: `1px solid ${T.bd}`, borderRadius: 12, overflow: "hidden", background: T.surface }}>
        <DataGrid<SessionRow> data={rows} columns={columns} getRowId={(r) => String(r.id)}
          title={`${total.toLocaleString("en-IN")} session${total === 1 ? "" : "s"}`} loading={loading}
          mainColumns="userName" enableSearch enableSorting enableExport />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: T.muted }}>
        <span>{total === 0 ? "No sessions" : `Showing ${(page - 1) * SIZE + 1}–${Math.min(page * SIZE, total)} of ${total.toLocaleString("en-IN")}`}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button size="sm" variant="outline" icon={ChevronLeft} disabled={page <= 1 || loading} onClick={() => load(page - 1, activeOnly)}>Prev</Button>
          <span style={{ fontSize: 12.5 }}>Page {page} / {lastPage}</span>
          <Button size="sm" variant="outline" disabled={page >= lastPage || loading} onClick={() => load(page + 1, activeOnly)}>Next <ChevronRight size={14} style={{ verticalAlign: -2 }} /></Button>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10.5, color: T.faint, textTransform: "uppercase", letterSpacing: .4, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.fg, wordBreak: "break-word", fontFamily: mono ? "ui-monospace,monospace" : undefined }}>{value ?? "—"}</div>
    </div>
  );
}

function pretty(json?: string | null): string {
  if (!json) return "";
  try { return JSON.stringify(JSON.parse(json), null, 2); } catch { return json; }
}

function AuditDetail({ row, onClose }: { row: AuditRow; onClose: () => void }) {
  const payload = pretty(row.payload);
  const changes = pretty(row.changes);
  return (
    <StandardModal isOpen onClose={onClose} title="Audit Detail" subtitle={row.summary ?? undefined} size="lg" showFooter={false}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 24px" }}>
        <div style={{ flex: "1 1 240px" }}>
          <Field label="Time (IST)" value={fmtIST(row.createdAt)} />
          <Field label="User" value={<span><UserIcon size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{row.userName || "System"}{row.userId ? ` (#${row.userId})` : ""}</span>} />
          <Field label="Action" value={<ActionBadge action={row.action} />} />
          <Field label="Client" value={row.client} />
          <Field label="Module / Tab" value={[row.module, row.subModule].filter(Boolean).join(" · ")} />
          <Field label="Record" value={row.entityType ? `${row.entityType}${row.entityId ? (/^\d+$/.test(String(row.entityId)) ? ` #${row.entityId}` : ` · ${row.entityId}`) : ""}` : row.entityId} />
          <Field label="Outcome" value={<span style={{ color: row.success === false ? "#d92d20" : "#12a150" }}>{row.success === false ? "Failed" : "Success"}{row.statusCode ? ` · ${row.statusCode}` : ""}{row.durationMs != null ? ` · ${row.durationMs} ms` : ""}</span>} />
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <Field label="IP Address" value={<span><Globe size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{row.ipAddress}</span>} mono />
          <Field label="Browser" value={row.browser} />
          <Field label="Operating System" value={row.os} />
          <Field label="Device" value={<span><Monitor size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{row.device}</span>} />
          <Field label="Device ID (system)" value={row.deviceId} mono />
          <Field label="Fingerprint" value={row.fingerprint} mono />
          <Field label="Request" value={`${row.httpMethod ?? ""} ${row.path ?? ""}`} mono />
        </div>
      </div>
      {changes && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 10.5, color: T.faint, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>Changes</div>
          <pre style={{ fontSize: 12, background: "rgb(var(--bg-subtle))", border: `1px solid ${T.bd}`, borderRadius: 8, padding: 10, maxHeight: 180, overflow: "auto", margin: 0 }}>{changes}</pre>
        </div>
      )}
      {payload && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10.5, color: T.faint, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>Payload (sanitized)</div>
          <pre style={{ fontSize: 12, background: "rgb(var(--bg-subtle))", border: `1px solid ${T.bd}`, borderRadius: 8, padding: 10, maxHeight: 220, overflow: "auto", margin: 0 }}>{payload}</pre>
        </div>
      )}
      {row.userAgent && (
        <div style={{ marginTop: 10 }}>
          <Field label="Full User-Agent" value={<span style={{ fontWeight: 400, fontSize: 11.5 }}>{row.userAgent}</span>} mono />
        </div>
      )}
    </StandardModal>
  );
}
