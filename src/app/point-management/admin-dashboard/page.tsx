"use client";
import { useEffect, useMemo, useState } from "react";
import { Page, StatsGrid, StatsCard, Dropdown, Kpi, ChartCard, DonutChart, BarChart, StandardModal, Button } from "indas-ui";
import { Layers, FolderOpen, CheckSquare, AlarmClock, XCircle } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import DateField from "@/components/DateField";
import { PmGuard } from "../PmGuard";
import { STATUS_CARDS, STATUS_COLORS, PIPELINE, pointColumns, lblStyle, clearBtnStyle, gridFeatures, PmHeader } from "../shared";
import { pmApi, type AdminDashboardStats, type PointGridRow, type PmUser, type PmCustomer } from "@/lib/tms";

function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [devs, setDevs] = useState<PmUser[]>([]);
  const [customers, setCustomers] = useState<PmCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [devId, setDevId] = useState<number | undefined>();
  const [custId, setCustId] = useState<number | undefined>();

  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [rows, setRows] = useState<PointGridRow[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  const filter = useMemo(() => ({ from: from || undefined, to: to || undefined, devId, custId }), [from, to, devId, custId]);

  useEffect(() => {
    Promise.all([pmApi.adminStats(filter), pmApi.users("Developer"), pmApi.customers()])
      .then(([s, d, c]) => { setStats(s); setDevs(d); setCustomers(c); })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    pmApi.adminStats(filter).then(setStats).catch((e) => setErr(String(e)));
    if (activeStatus) loadGrid(activeStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, devId, custId]);

  function loadGrid(status: string) {
    setActiveStatus(status);
    setGridLoading(true);
    pmApi.points({ status, ...filter }).then(setRows).catch((e) => setErr(String(e))).finally(() => setGridLoading(false));
  }

  const columns = useMemo(() => pointColumns(), []);

  // ── Chart data derived from the same stats object ──
  const donutData = useMemo(() => {
    if (!stats) return [];
    return STATUS_CARDS
      .filter((c) => STATUS_COLORS[c.key] && (stats[c.key] ?? 0) > 0)
      .map((c) => ({ name: c.label, value: Number(stats[c.key] ?? 0), color: STATUS_COLORS[c.key] }));
  }, [stats]);

  const barData = useMemo(() => {
    if (!stats) return [];
    return PIPELINE.map((k) => ({ stage: STATUS_CARDS.find((c) => c.key === k)?.label ?? k, count: Number(stats[k] ?? 0) }));
  }, [stats]);

  const closedPct = stats && stats.total ? Math.round((Number(stats.closed) / Number(stats.total)) * 100) : 0;

  if (loading) return <BrandedLoader size="lg" text="Loading dashboard…" />;

  return (
    <Page>
      <PmHeader page="admin-dashboard" />
      {err && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err}</small></div>}

      {/* Filters — DatePicker rendered outside a <label> so its calendar popover opens cleanly */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={lblStyle}>From</span>
          <DateField value={from} onChange={setFrom} style={{ width: 160 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={lblStyle}>To</span>
          <DateField value={to} onChange={setTo} style={{ width: 160 }} />
        </div>
        <div style={{ width: 200 }}>
          <Dropdown value={devId != null ? String(devId) : ""} onValueChange={(v) => setDevId(v ? Number(v) : undefined)}
            options={[{ value: "", label: "All developers" }, ...devs.map((d) => ({ value: String(d.userID), label: d.fullName }))]} searchable size="md" />
        </div>
        <div style={{ width: 200 }}>
          <Dropdown value={custId != null ? String(custId) : ""} onValueChange={(v) => setCustId(v ? Number(v) : undefined)}
            options={[{ value: "", label: "All customers" }, ...customers.map((c) => ({ value: String(c.customerID), label: c.companyName }))]} searchable size="md" />
        </div>
        {(from || to || devId || custId) && (
          <button style={clearBtnStyle} onClick={() => { setFrom(""); setTo(""); setDevId(undefined); setCustId(undefined); }}>Clear</button>
        )}
      </div>

      {/* ── Hero KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 18 }}>
        <Kpi title="Total Points" value={stats?.total ?? 0} icon={Layers} accent="primary" subtitle="in this view" />
        <Kpi title="Open" value={stats?.open ?? 0} icon={FolderOpen} accent="info" subtitle="not yet closed" />
        <Kpi title="Closed" value={stats?.closed ?? 0} icon={CheckSquare} accent="success" badge={`${closedPct}%`} badgeLabel="of total" />
        <Kpi title="Delayed" value={stats?.delayed ?? 0} icon={AlarmClock} accent="error" subtitle="past expected date" />
      </div>

      {/* ── Charts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginBottom: 20 }}>
        <ChartCard title="Status Distribution" description="Where the team's points currently sit">
          {donutData.length > 0
            ? <DonutChart data={donutData} height={300} showLegend centerLabel="Total" centerValue={String(stats?.total ?? 0)} />
            : <div style={{ height: 300, display: "grid", placeItems: "center", color: "rgb(var(--fg-muted))" }}>No points in this view</div>}
        </ChartCard>
        <ChartCard title="Workflow Pipeline" description="Points at each stage of the delivery flow">
          <BarChart data={barData} xKey="stage" series={[{ key: "count", name: "Points", color: "#3b6fb5" }]} height={300} horizontal showGrid />
        </ChartCard>
      </div>

      {/* ── Drill-down: click a status to open its points ── */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))", letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 10 }}>
        Breakdown — click a status to view its points
      </div>
      <StatsGrid columns={4}>
        {STATUS_CARDS.map((c) => {
          const clickable = !!c.status;
          const active = activeStatus === c.status;
          return (
            <div key={c.key} onClick={clickable ? () => loadGrid(c.status!) : undefined}
              style={{ cursor: clickable ? "pointer" : "default", outline: active ? "2px solid rgb(var(--color-primary))" : "none", borderRadius: 12 }}>
              <StatsCard title={c.label} value={stats?.[c.key] ?? 0} icon={c.icon} variant={c.variant} />
            </div>
          );
        })}
      </StatsGrid>

      <StandardModal
        isOpen={activeStatus != null}
        onClose={() => setActiveStatus(null)}
        title={`${activeStatus === "All" ? "All" : activeStatus} points`}
        size="xl"
        showFooter
        footerActions={<Button variant="action-cancel" icon={XCircle} onClick={() => setActiveStatus(null)}>Close</Button>}
      >
        <DataGrid
          title={`${rows.length} point${rows.length === 1 ? "" : "s"}`}
          data={rows} columns={columns} loading={gridLoading}
          getRowId={(r) => String(r.pointID)}
          mainColumns="customerName"
          {...gridFeatures}
        />
      </StandardModal>
    </Page>
  );
}

export default function Page_() {
  return <PmGuard module="/point-management/admin-dashboard"><AdminDashboard /></PmGuard>;
}
