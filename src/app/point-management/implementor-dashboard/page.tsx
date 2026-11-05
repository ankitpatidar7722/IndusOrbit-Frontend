"use client";
import KDropdown from "@/components/KDropdown";
import { useEffect, useMemo, useRef, useState } from "react";
import { Page, StatsGrid, StatsCard, Kpi, ChartCard, DonutChart, BarChart, StandardModal, Button, useDevice } from "indas-ui";
import { Layers, FolderOpen, CheckSquare, AlarmClock, XCircle, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import DateField from "@/components/DateField";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { STATUS_CARDS, STATUS_COLORS, PIPELINE, pointColumns, lblStyle, clearBtnStyle, gridFeatures, PmHeader } from "../shared";
import { usePointDrawer, PointDrawer } from "../PointDrawer";
import { pmApi, type ImplementorDashboard, type ImplementorAssigneeRow, type PointGridRow, type PmCustomer, type PmUser } from "@/lib/tms";

// What a click on a card / assignee row lists. `match` narrows what the API can't filter by.
interface Drill {
  title: string;
  status: string;
  devId?: number;
  match?: (r: PointGridRow) => boolean;
}

const isPending = (r: PointGridRow) => r.status !== "Closed" && r.status !== "Reject";
const isDelayed = (r: PointGridRow) => (r.expectedMinutes ?? 0) > 0 && (r.totalTimeSpent ?? 0) > (r.expectedMinutes ?? 0);

function ImplementorBoard({ tmsUserId, isAdmin }: { tmsUserId: number; isAdmin: boolean }) {
  const { isMobile } = useDevice();
  const [data, setData] = useState<ImplementorDashboard | null>(null);
  const [customers, setCustomers] = useState<PmCustomer[]>([]);
  const [implementors, setImplementors] = useState<PmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [custId, setCustId] = useState<number | undefined>();
  // Admin can look at any implementor; everyone else only ever sees the points they added.
  const [reporterId, setReporterId] = useState<number | undefined>();
  const reportedBy = isAdmin ? reporterId : tmsUserId;

  const [drill, setDrill] = useState<Drill | null>(null);
  const [rows, setRows] = useState<PointGridRow[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  const filter = useMemo(() => ({ from: from || undefined, to: to || undefined, custId, reportedBy }), [from, to, custId, reportedBy]);

  // Quick filter changes must not let a slower, older response overwrite the newer one.
  const statsReq = useRef(0);
  const gridReq = useRef(0);

  useEffect(() => {
    Promise.all([pmApi.customers(), isAdmin ? pmApi.users("Support") : Promise.resolve([] as PmUser[])])
      .then(([c, u]) => { setCustomers(c); setImplementors(u); })
      .catch((e) => setErr(String(e)));
  }, [isAdmin]);

  useEffect(() => {
    const id = ++statsReq.current;
    pmApi.implementorDashboard(filter)
      .then((d) => { if (id === statsReq.current) { setData(d); setErr(null); } })
      .catch((e) => { if (id === statsReq.current) setErr(String(e)); })
      .finally(() => { if (id === statsReq.current) setLoading(false); });
    if (drill) loadGrid(drill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function loadGrid(d: Drill) {
    setDrill(d);
    setGridLoading(true);
    const id = ++gridReq.current;
    pmApi.points({ ...filter, status: d.status, devId: d.devId })
      .then((list) => { if (id === gridReq.current) setRows(d.match ? list.filter(d.match) : list); })
      .catch((e) => { if (id === gridReq.current) setErr(String(e)); })
      .finally(() => { if (id === gridReq.current) setGridLoading(false); });
  }

  const drawer = usePointDrawer(() => { if (drill) loadGrid(drill); });
  const columns = useMemo(() => {
    const cols = pointColumns();
    cols.push({
      id: "view", header: "", enableSorting: false, enableHiding: false, size: 84,
      cell: ({ row }) => <Button size="sm" variant="outline" icon={Eye} onClick={() => drawer.open(row.original.pointID)}>View</Button>,
    });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer]);

  const openAssignee = (a: ImplementorAssigneeRow) => loadGrid(a.assignedToID
    ? { title: `Assigned to ${a.assignedToName}`, status: "All", devId: a.assignedToID }
    : { title: "Not assigned", status: "All", match: (r) => !r.assignedToID });

  const assigneeColumns = useMemo<ColumnDef<ImplementorAssigneeRow>[]>(() => [
    { accessorKey: "assignedToName", header: "Assigned To", size: 220 },
    { accessorKey: "total", header: "Total Points", size: 110 },
    { accessorKey: "pending", header: "Pending", size: 100 },
    { accessorKey: "closed", header: "Closed", size: 100 },
    { accessorKey: "rejected", header: "Rejected", size: 100 },
    {
      id: "view", header: "", enableSorting: false, enableHiding: false, size: 84,
      cell: ({ row }) => <Button size="sm" variant="outline" icon={Eye} onClick={() => openAssignee(row.original)}>View</Button>,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [filter]);

  const stats = data?.stats ?? null;

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

  const heroCard = (d: Drill, kpi: React.ReactNode) => (
    <div onClick={() => loadGrid(d)} style={{ cursor: "pointer", borderRadius: 12 }}>{kpi}</div>
  );

  return (
    <Page>
      <PmHeader page="implementor-dashboard" />
      {err && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err}</small></div>}

      <div style={{
        display: isMobile ? "grid" : "flex",
        gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
        gap: 12, flexWrap: isMobile ? undefined : "wrap",
        alignItems: isMobile ? "end" : "center", marginBottom: 18,
      }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 4 : 6 }}>
          <span style={lblStyle}>From</span>
          <DateField value={from} onChange={setFrom} style={{ width: isMobile ? "100%" : 160 }} />
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 4 : 6 }}>
          <span style={lblStyle}>To</span>
          <DateField value={to} onChange={setTo} style={{ width: isMobile ? "100%" : 160 }} />
        </div>
        <div style={{ width: isMobile ? "auto" : 200, ...(isMobile ? { gridColumn: "1 / -1" } : {}) }}>
          <KDropdown value={custId != null ? String(custId) : ""} onValueChange={(v) => setCustId(v ? Number(v) : undefined)}
            options={[{ value: "", label: "All customers" }, ...customers.map((c) => ({ value: String(c.customerID), label: c.companyName }))]} searchable size="md" />
        </div>
        {isAdmin && (
          <div style={{ width: isMobile ? "auto" : 220, ...(isMobile ? { gridColumn: "1 / -1" } : {}) }}>
            <KDropdown value={reporterId != null ? String(reporterId) : ""} onValueChange={(v) => setReporterId(v ? Number(v) : undefined)}
              options={[{ value: "", label: "All users" }, ...implementors.map((u) => ({ value: String(u.userID), label: u.fullName }))]} searchable size="md" />
          </div>
        )}
        {(from || to || custId || reporterId) && (
          <button style={{ ...clearBtnStyle, ...(isMobile ? { gridColumn: "1 / -1", width: "100%" } : {}) }} onClick={() => { setFrom(""); setTo(""); setCustId(undefined); setReporterId(undefined); }}>Clear</button>
        )}
      </div>

      {/* ── Hero KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(210px, 1fr))", gap: isMobile ? 10 : 14, marginBottom: 18 }}>
        {heroCard({ title: "All", status: "All" }, <Kpi title="Total Points" value={stats?.total ?? 0} icon={Layers} accent="primary" subtitle="points added" />)}
        {heroCard({ title: "Pending", status: "All", match: isPending }, <Kpi title="Pending" value={stats?.open ?? 0} icon={FolderOpen} accent="info" subtitle="not yet closed" />)}
        {heroCard({ title: "Closed", status: "Closed" }, <Kpi title="Closed" value={stats?.closed ?? 0} icon={CheckSquare} accent="success" badge={`${closedPct}%`} badgeLabel="of total" />)}
        {heroCard({ title: "Delayed", status: "All", match: isDelayed }, <Kpi title="Delayed" value={stats?.delayed ?? 0} icon={AlarmClock} accent="error" subtitle="over estimated time" />)}
      </div>

      {/* ── Charts ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginBottom: 20 }}>
        <ChartCard title="Status Distribution" description="Where the added points currently sit">
          {donutData.length > 0
            ? <DonutChart data={donutData} height={300} showLegend centerLabel="Total" centerValue={String(stats?.total ?? 0)} />
            : <div style={{ height: 300, display: "grid", placeItems: "center", color: "rgb(var(--fg-muted))" }}>No points in this view</div>}
        </ChartCard>
        <ChartCard title="Workflow Pipeline" description="Points at each stage of the delivery flow">
          <BarChart data={barData} xKey="stage" series={[{ key: "count", name: "Points", color: "#3b6fb5" }]} height={300} horizontal showGrid />
        </ChartCard>
      </div>

      {/* ── Who the points are assigned to ── */}
      <div style={{ marginBottom: 20 }}>
        <DataGrid
          title="Assigned To"
          data={data?.assignees ?? []} columns={assigneeColumns}
          getRowId={(r) => String(r.assignedToID ?? "none")}
          mainColumns="assignedToName"
          onRowClick={openAssignee}
          rightFrozenColumns={["view"]}
          {...gridFeatures}
        />
      </div>

      {/* ── Drill-down: click a status to open its points ── */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))", letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 10 }}>
        Breakdown — click a status to view its points
      </div>
      <StatsGrid columns={4} className="pm-breakdown">
        {STATUS_CARDS.filter((c) => c.status).map((c) => {
          const active = drill != null && drill.status === c.status && !drill.match && !drill.devId;
          return (
            <div key={c.key} onClick={() => loadGrid({ title: c.label, status: c.status! })}
              style={{ cursor: "pointer", outline: active ? "2px solid rgb(var(--color-primary))" : "none", borderRadius: 12 }}>
              <StatsCard title={c.label} value={stats?.[c.key] ?? 0} icon={c.icon} variant={c.variant} />
            </div>
          );
        })}
      </StatsGrid>

      <StandardModal
        isOpen={drill != null}
        onClose={() => setDrill(null)}
        title={`${drill?.title ?? ""} points`}
        size="xl"
        showFooter
        footerActions={<Button variant="action-cancel" icon={XCircle} onClick={() => setDrill(null)}>Close</Button>}
      >
        <DataGrid
          title={`${rows.length} point${rows.length === 1 ? "" : "s"}`}
          data={rows} columns={columns} loading={gridLoading}
          getRowId={(r) => String(r.pointID)}
          mainColumns="customerName"
          onRowClick={(r) => drawer.open(r.pointID)}
          rightFrozenColumns={["view"]}
          {...gridFeatures}
        />
      </StandardModal>

      {/* View a single point (with its attachments) — opens on top of the drill-down list */}
      <PointDrawer drawer={drawer} actions={null} uploaderId={tmsUserId} />
    </Page>
  );
}

export default function Page_() {
  const { ctx } = usePmContext();
  const isAdmin = (ctx?.tmsRole ?? "").toLowerCase() === "admin";
  return (
    <PmGuard module="/point-management/implementor-dashboard">
      {ctx ? <ImplementorBoard tmsUserId={ctx.tmsUserId} isAdmin={isAdmin} /> : null}
    </PmGuard>
  );
}
