"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Page, StatsGrid, StatsCard, Badge, Progress } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import type { ColumnDef } from "@tanstack/react-table";
import { api, type ClientListItem, type Stats } from "@/lib/api";
import { statusVariant } from "@/lib/ui";

const columns: ColumnDef<ClientListItem>[] = [
  {
    accessorKey: "name", header: "Client",
    cell: ({ row }) => (
      <div>
        <div style={{ fontWeight: 600 }}>{row.original.name}</div>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{row.original.clientCode} · {row.original.city}</div>
      </div>
    ),
  },
  { accessorKey: "application", header: "Application" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
  { accessorKey: "consultant", header: "Implementation Engineer" },
  {
    accessorKey: "progress", header: "Progress",
    cell: ({ row }) => (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Progress value={row.original.progress} className="h-2 w-24" />
        <span>{row.original.progress}%</span>
      </div>
    ),
  },
  { accessorKey: "openCrCount", header: "Open CR" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getClients()])
      .then(([s, c]) => { setStats(s); setClients(c); })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <BrandedLoader size="lg" text="Loading dashboard…" />;

  return (
    <Page title="Dashboard" description="Company-wide overview">
      {err && (
        <div style={{ color: "#c0392b", marginBottom: 16 }}>
          Backend se connect nahi hua — API chal raha hai? (http://localhost:5080)<br />
          <small style={{ opacity: 0.7 }}>{err}</small>
        </div>
      )}
      <StatsGrid columns={4}>
        <StatsCard title="Total Clients" value={stats?.total ?? 0} />
        <StatsCard title="In Implementation" value={stats?.inImplementation ?? 0} />
        <StatsCard title="Go-Live Stage" value={stats?.goLive ?? 0} variant="accent" />
        <StatsCard title="Open Change Requests" value={stats?.openChangeRequests ?? 0} variant="warning" />
      </StatsGrid>

      <div style={{ marginTop: 24 }}>
        <DataGrid<ClientListItem>
          data={clients}
          columns={columns}
          getRowId={(r) => r.clientCode}
          title="All Projects"
          enableSorting
          enableSearch
          enablePagination
          onRowClick={(r) => router.push(`/clients/${r.clientCode}`)}
        />
      </div>
    </Page>
  );
}
