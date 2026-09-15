"use client";
import { useMemo } from "react";
import { Kpi, ChartCard, DonutChart, BarChart, Badge, useDevice } from "indas-ui";
import { Building2, CircleCheck, CalendarX2, CalendarClock, Wallet } from "lucide-react";
import { DataGrid } from "@/components/datagrid";
import type { ColumnDef } from "@tanstack/react-table";
import { fmtDate, type CustomerCard } from "@/lib/customers";
import { subscriptionVariant } from "@/lib/ui";
import { CHART_H, emptyChart, kpiGridStyle, chartGridStyle, daysUntil } from "./shared";

const STATUS_COLOR: Record<string, string> = { active: "#22c55e", expired: "#ef4444" };

const columns: ColumnDef<CustomerCard>[] = [
  {
    accessorKey: "companyName", header: "Company",
    cell: ({ row }) => (
      <div>
        <div style={{ fontWeight: 600 }}>{row.original.companyName}</div>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{row.original.companyUniqueCode || row.original.companyUserID} · {row.original.city || "—"}</div>
      </div>
    ),
  },
  { accessorKey: "applicationName", header: "Product", cell: ({ row }) => row.original.applicationName || "—" },
  { accessorKey: "subscriptionStatus", header: "Status", cell: ({ row }) => <Badge variant={subscriptionVariant(row.original.subscriptionStatus)}>{row.original.subscriptionStatus || "—"}</Badge> },
  {
    accessorKey: "toDate", header: "Renewal Date",
    cell: ({ row }) => {
      const d = daysUntil(row.original.toDate);
      const txt = fmtDate(row.original.toDate);
      const color = d == null ? undefined : d < 0 ? "#ef4444" : d <= 30 ? "#f59e0b" : undefined;
      return <span style={{ color, fontWeight: color ? 600 : 400 }}>{txt}{d != null && d < 0 ? " (overdue)" : d != null && d <= 30 ? ` (${d}d)` : ""}</span>;
    },
  },
  { accessorKey: "paymentDueDate", header: "Payment Due", cell: ({ row }) => fmtDate(row.original.paymentDueDate) },
];

export default function SubscriptionsTab({ rows }: { rows: CustomerCard[] }) {
  const { isMobile } = useDevice();

  const k = useMemo(() => {
    const isActive = (c: CustomerCard) => (c.subscriptionStatus || "").toLowerCase() === "active";
    const active = rows.filter(isActive).length;
    const expired = rows.filter((c) => (c.subscriptionStatus || "").toLowerCase() === "expired").length;
    const expiring = rows.filter((c) => { const d = daysUntil(c.toDate); return isActive(c) && d != null && d >= 0 && d <= 30; }).length;
    const dueSoon = rows.filter((c) => { const d = daysUntil(c.paymentDueDate); return d != null && d >= 0 && d <= 30; }).length;
    return { total: rows.length, active, expired, expiring, dueSoon };
  }, [rows]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of rows) { const s = c.subscriptionStatus || "Unknown"; counts.set(s, (counts.get(s) ?? 0) + 1); }
    return [...counts.entries()].map(([name, value]) => ({ name, value, color: STATUS_COLOR[name.toLowerCase()] ?? "#94a3b8" }));
  }, [rows]);

  const productData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of rows) { const p = c.applicationName || "Other"; counts.set(p, (counts.get(p) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([product, count]) => ({ product, count }));
  }, [rows]);

  const renewalWindow = useMemo(() => {
    const b = [
      { window: "Overdue", count: 0 }, { window: "≤ 30 days", count: 0 },
      { window: "31–60 days", count: 0 }, { window: "61–90 days", count: 0 }, { window: "90+ days", count: 0 },
    ];
    for (const c of rows) {
      const d = daysUntil(c.toDate);
      if (d == null) continue;
      const i = d < 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4;
      b[i].count++;
    }
    return b;
  }, [rows]);

  const stateData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of rows) { const s = (c.state || "").trim() || "—"; counts.set(s, (counts.get(s) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([state, count]) => ({ state, count }));
  }, [rows]);

  // Grid: renewals due within 60 days or already overdue/expired — sorted soonest-first.
  const renewals = useMemo(
    () => rows
      .filter((c) => { const d = daysUntil(c.toDate); return (c.subscriptionStatus || "").toLowerCase() === "expired" || (d != null && d <= 60); })
      .sort((a, b) => (daysUntil(a.toDate) ?? 1e9) - (daysUntil(b.toDate) ?? 1e9)),
    [rows]);

  return (
    <>
      <div style={kpiGridStyle(isMobile)}>
        <Kpi title="Total Clients" value={k.total} icon={Building2} accent="primary" subtitle="all subscriptions" />
        <Kpi title="Active" value={k.active} icon={CircleCheck} accent="success" subtitle="currently licensed" />
        <Kpi title="Expired" value={k.expired} icon={CalendarX2} accent="error" subtitle="need renewal" />
        <Kpi title="Expiring ≤ 30 days" value={k.expiring} icon={CalendarClock} accent="warning" subtitle="renew soon" />
        <Kpi title="Payment Due ≤ 30 days" value={k.dueSoon} icon={Wallet} accent="warning" subtitle="follow up" />
      </div>

      <div style={chartGridStyle(isMobile)}>
        <ChartCard title="Subscriptions by Status" description="Active vs expired licences">
          {statusData.length ? <DonutChart data={statusData} height={CHART_H} showLegend centerLabel="Clients" centerValue={String(k.total)} /> : emptyChart(CHART_H, "No subscriptions")}
        </ChartCard>
        <ChartCard title="Subscriptions by Product" description="Clients per Indus product">
          {productData.length ? <BarChart data={productData} xKey="product" series={[{ key: "count", name: "Clients", color: "#3b6fb5" }]} height={CHART_H} horizontal showGrid /> : emptyChart(CHART_H, "No subscriptions")}
        </ChartCard>
        <ChartCard title="Renewal Window" description="When ERP subscriptions come up for renewal">
          <BarChart data={renewalWindow} xKey="window" series={[{ key: "count", name: "Clients", color: "#f59e0b" }]} height={CHART_H} showGrid />
        </ChartCard>
        <ChartCard title="Clients by State" description="Top 8 states by client count">
          {stateData.length ? <BarChart data={stateData} xKey="state" series={[{ key: "count", name: "Clients", color: "#14b8a6" }]} height={CHART_H} horizontal showGrid /> : emptyChart(CHART_H, "No location data")}
        </ChartCard>
      </div>

      <DataGrid<CustomerCard>
        data={renewals}
        columns={columns}
        getRowId={(r) => r.companyUserID}
        title="Renewals & Overdue (next 60 days)"
        enableSorting
        enableSearch
        enablePagination
      />
    </>
  );
}
