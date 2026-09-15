"use client";
import { useMemo } from "react";
import { Kpi, ChartCard, DonutChart, BarChart, Badge, useDevice } from "indas-ui";
import { UserPlus, DatabaseZap, Clock, Users } from "lucide-react";
import { DataGrid } from "@/components/datagrid";
import type { ColumnDef } from "@tanstack/react-table";
import type { CrmClient } from "@/lib/crm";
import { CHART_H, emptyChart, kpiGridStyle, chartGridStyle, countBy, colorAt } from "./shared";

const isProvisioned = (c: CrmClient) => (c.dbStatus || "").toLowerCase() === "created";

const columns: ColumnDef<CrmClient>[] = [
  {
    accessorKey: "companyName", header: "Company",
    cell: ({ row }) => (
      <div>
        <div style={{ fontWeight: 600 }}>{row.original.companyName}</div>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{row.original.city || "—"}{row.original.state ? `, ${row.original.state}` : ""}</div>
      </div>
    ),
  },
  { accessorKey: "indasProduct", header: "Product", cell: ({ row }) => row.original.indasProduct || "—" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => row.original.status || "—" },
  { accessorKey: "segment", header: "Segment", cell: ({ row }) => row.original.segment || "—" },
  { accessorKey: "assignedToName", header: "Owner", cell: ({ row }) => row.original.assignedToName || "—" },
  { accessorKey: "dbStatus", header: "Provisioned", cell: ({ row }) => <Badge variant={isProvisioned(row.original) ? "success" : "secondary"}>{isProvisioned(row.original) ? "Created" : "Pending"}</Badge> },
];

export default function OnboardingTab({ crm }: { crm: CrmClient[] }) {
  const { isMobile } = useDevice();

  const k = useMemo(() => {
    const prov = crm.filter(isProvisioned).length;
    const owners = new Set(crm.map((c) => (c.assignedToName || "").trim()).filter(Boolean)).size;
    return { total: crm.length, prov, pending: crm.length - prov, owners };
  }, [crm]);

  const byStatus = useMemo(() => countBy(crm, (c) => c.status).map((d, i) => ({ ...d, color: colorAt(i) })), [crm]);
  const byProduct = useMemo(() => countBy(crm, (c) => c.indasProduct).map((d) => ({ label: d.name, count: d.value })), [crm]);
  const byOwner = useMemo(() => countBy(crm, (c) => c.assignedToName, 8).map((d) => ({ label: d.name, count: d.value })), [crm]);
  const provData = useMemo(() => [
    { name: "Provisioned", value: k.prov, color: "#22c55e" },
    { name: "Pending", value: k.pending, color: "#f59e0b" },
  ].filter((d) => d.value > 0), [k]);

  return (
    <>
      <div style={kpiGridStyle(isMobile)}>
        <Kpi title="Total Leads" value={k.total} icon={UserPlus} accent="primary" subtitle="in the CRM pipeline" />
        <Kpi title="Provisioned" value={k.prov} icon={DatabaseZap} accent="success" subtitle={k.total ? `${Math.round((k.prov / k.total) * 100)}% of leads` : "DB created"} />
        <Kpi title="Pending" value={k.pending} icon={Clock} accent="warning" subtitle="not yet provisioned" />
        <Kpi title="Owners" value={k.owners} icon={Users} accent="info" subtitle="assigned team members" />
      </div>

      <div style={chartGridStyle(isMobile)}>
        <ChartCard title="Leads by Status" description="Where each lead sits in the CRM lifecycle">
          {byStatus.length ? <DonutChart data={byStatus} height={CHART_H} showLegend centerLabel="Leads" centerValue={String(k.total)} /> : emptyChart(CHART_H, "No CRM data")}
        </ChartCard>
        <ChartCard title="Provisioned vs Pending" description="How many leads have a database created">
          {provData.length ? <DonutChart data={provData} height={CHART_H} showLegend centerLabel="Leads" centerValue={String(k.total)} /> : emptyChart(CHART_H, "No CRM data")}
        </ChartCard>
        <ChartCard title="Leads by Product" description="Interest per Indus product">
          {byProduct.length ? <BarChart data={byProduct} xKey="label" series={[{ key: "count", name: "Leads", color: "#3b6fb5" }]} height={CHART_H} horizontal showGrid /> : emptyChart(CHART_H, "No CRM data")}
        </ChartCard>
        <ChartCard title="Leads by Owner" description="Top 8 team members by assigned leads">
          {byOwner.length ? <BarChart data={byOwner} xKey="label" series={[{ key: "count", name: "Leads", color: "#8b5cf6" }]} height={CHART_H} horizontal showGrid /> : emptyChart(CHART_H, "No owners assigned")}
        </ChartCard>
      </div>

      <DataGrid<CrmClient>
        data={crm}
        columns={columns}
        getRowId={(r) => String(r.customerID)}
        title="CRM Clients"
        enableSorting
        enableSearch
        enablePagination
      />
    </>
  );
}
