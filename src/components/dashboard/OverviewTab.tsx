"use client";
import { useMemo } from "react";
import { Kpi, ChartCard, DonutChart, BarChart, Badge, useDevice } from "indas-ui";
import { Building2, CircleCheck, CalendarX2, CalendarClock, UserPlus, DatabaseZap } from "lucide-react";
import { DataGrid } from "@/components/datagrid";
import type { ColumnDef } from "@tanstack/react-table";
import { fmtDate, type CustomerCard } from "@/lib/customers";
import type { CrmClient } from "@/lib/crm";
import { subscriptionVariant } from "@/lib/ui";
import { CHART_H, emptyChart, kpiGridStyle, chartGridStyle, daysUntil, countBy, colorAt } from "./shared";

const STATUS_COLOR: Record<string, string> = { active: "#22c55e", expired: "#ef4444" };

const columns: ColumnDef<CustomerCard>[] = [
  {
    accessorKey: "companyName", header: "Client",
    cell: ({ row }) => (
      <div>
        <div style={{ fontWeight: 600 }}>{row.original.companyName}</div>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{row.original.companyUniqueCode || row.original.companyUserID} · {row.original.city || "—"}</div>
      </div>
    ),
  },
  { accessorKey: "applicationName", header: "Product", cell: ({ row }) => row.original.applicationName || "—" },
  { accessorKey: "subscriptionStatus", header: "Status", cell: ({ row }) => <Badge variant={subscriptionVariant(row.original.subscriptionStatus)}>{row.original.subscriptionStatus || "—"}</Badge> },
  { accessorKey: "state", header: "State", cell: ({ row }) => row.original.state || "—" },
  { accessorKey: "toDate", header: "Renewal", cell: ({ row }) => fmtDate(row.original.toDate) },
];

const isActive = (c: CustomerCard) => (c.subscriptionStatus || "").toLowerCase() === "active";
const isProvisioned = (c: CrmClient) => (c.dbStatus || "").toLowerCase() === "created";

export default function OverviewTab({ subs, crm }: { subs: CustomerCard[]; crm: CrmClient[] }) {
  const { isMobile } = useDevice();

  const k = useMemo(() => ({
    total: subs.length,
    active: subs.filter(isActive).length,
    expired: subs.filter((c) => (c.subscriptionStatus || "").toLowerCase() === "expired").length,
    expiring: subs.filter((c) => { const d = daysUntil(c.toDate); return isActive(c) && d != null && d >= 0 && d <= 30; }).length,
    leads: crm.length,
    provisioned: crm.filter(isProvisioned).length,
  }), [subs, crm]);

  const byProduct = useMemo(
    () => countBy(subs, (c) => c.applicationName).map((d, i) => ({ ...d, color: colorAt(i) })),
    [subs]);

  const byStatus = useMemo(
    () => countBy(subs, (c) => c.subscriptionStatus).map((d) => ({ ...d, color: STATUS_COLOR[d.name.toLowerCase()] ?? "#94a3b8" })),
    [subs]);

  const byState = useMemo(
    () => countBy(subs, (c) => c.state, 8).map((d) => ({ label: d.name, count: d.value })),
    [subs]);

  // New subscriptions per month over the last 12 months (from `fromDate`).
  const byMonth = useMemo(() => {
    const now = new Date();
    const keys: string[] = [];
    const labelOf: Record<string, string> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      keys.push(key);
      labelOf[key] = d.toLocaleString("en-GB", { month: "short" }) + (d.getMonth() === 0 ? ` '${String(d.getFullYear()).slice(2)}` : "");
    }
    const counts: Record<string, number> = Object.fromEntries(keys.map((k2) => [k2, 0]));
    for (const c of subs) {
      if (!c.fromDate) continue;
      const dt = new Date(c.fromDate);
      if (isNaN(dt.getTime())) continue;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      if (key in counts) counts[key]++;
    }
    return keys.map((key) => ({ month: labelOf[key], count: counts[key] }));
  }, [subs]);

  return (
    <>
      <div style={kpiGridStyle(isMobile)}>
        <Kpi title="Total Clients" value={k.total} icon={Building2} accent="primary" subtitle="licensed subscriptions" />
        <Kpi title="Active" value={k.active} icon={CircleCheck} accent="success" subtitle={k.total ? `${Math.round((k.active / k.total) * 100)}% of total` : "—"} />
        <Kpi title="Expired" value={k.expired} icon={CalendarX2} accent="error" subtitle="need renewal" />
        <Kpi title="Expiring ≤ 30 days" value={k.expiring} icon={CalendarClock} accent="warning" subtitle="renew soon" />
        <Kpi title="CRM Leads" value={k.leads} icon={UserPlus} accent="info" subtitle="in the pipeline" />
        <Kpi title="Provisioned" value={k.provisioned} icon={DatabaseZap} accent="success" subtitle="DB created" />
      </div>

      <div style={chartGridStyle(isMobile)}>
        <ChartCard title="Clients by Product" description="Subscriptions per Indus product">
          {byProduct.length ? <DonutChart data={byProduct} height={CHART_H} showLegend centerLabel="Clients" centerValue={String(k.total)} /> : emptyChart(CHART_H, "No subscriptions")}
        </ChartCard>
        <ChartCard title="Subscription Status" description="Active vs expired licences">
          {byStatus.length ? <DonutChart data={byStatus} height={CHART_H} showLegend centerLabel="Clients" centerValue={String(k.total)} /> : emptyChart(CHART_H, "No subscriptions")}
        </ChartCard>
        <ChartCard title="Clients by State" description="Top 8 states by client count">
          {byState.length ? <BarChart data={byState} xKey="label" series={[{ key: "count", name: "Clients", color: "#14b8a6" }]} height={CHART_H} horizontal showGrid /> : emptyChart(CHART_H, "No location data")}
        </ChartCard>
        <ChartCard title="New Clients (last 12 months)" description="New subscriptions started per month">
          <BarChart data={byMonth} xKey="month" series={[{ key: "count", name: "New Clients", color: "#3b6fb5" }]} height={CHART_H} showGrid />
        </ChartCard>
      </div>

      <DataGrid<CustomerCard>
        data={subs}
        columns={columns}
        getRowId={(r) => r.companyUserID}
        title="All Clients"
        enableSorting
        enableSearch
        enablePagination
      />
    </>
  );
}
