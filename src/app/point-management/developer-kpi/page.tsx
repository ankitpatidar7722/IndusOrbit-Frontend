"use client";
import { useEffect, useMemo, useState } from "react";
import { Page, StatsGrid, StatsCard, Input, Dropdown } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import DateField from "@/components/DateField";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { STATUS_CARDS, pointColumns, lblStyle, clearBtnStyle, gridFeatures, PmHeader } from "../shared";
import { pmApi, type AdminDashboardStats, type PointGridRow, type PmCustomer } from "@/lib/tms";

function DeveloperKpi({ devId }: { devId: number }) {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [customers, setCustomers] = useState<PmCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [custId, setCustId] = useState<number | undefined>();

  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [rows, setRows] = useState<PointGridRow[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  const filter = useMemo(() => ({ from: from || undefined, to: to || undefined, custId, devId }), [from, to, custId, devId]);

  useEffect(() => {
    Promise.all([pmApi.adminStats(filter), pmApi.customers()])
      .then(([s, c]) => { setStats(s); setCustomers(c); })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    pmApi.adminStats(filter).then(setStats).catch((e) => setErr(String(e)));
    if (activeStatus) loadGrid(activeStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, custId]);

  function loadGrid(status: string) {
    setActiveStatus(status);
    setGridLoading(true);
    pmApi.points({ status, ...filter }).then(setRows).catch((e) => setErr(String(e))).finally(() => setGridLoading(false));
  }

  const columns = useMemo(() => pointColumns(), []);

  if (loading) return <BrandedLoader size="lg" text="Loading your KPIs…" />;

  return (
    <Page>
      <PmHeader page="developer-kpi" />
      {err && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err}</small></div>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <label style={lblStyle}>From <DateField value={from} onChange={setFrom} style={{ width: 150 }} /></label>
        <label style={lblStyle}>To <DateField value={to} onChange={setTo} style={{ width: 150 }} /></label>
        <div style={{ width: 200 }}>
          <Dropdown value={custId != null ? String(custId) : ""} onValueChange={(v) => setCustId(v ? Number(v) : undefined)}
            options={[{ value: "", label: "All customers" }, ...customers.map((c) => ({ value: String(c.customerID), label: c.companyName }))]} searchable size="md" />
        </div>
        {(from || to || custId) && (
          <button style={clearBtnStyle} onClick={() => { setFrom(""); setTo(""); setCustId(undefined); }}>Clear</button>
        )}
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

      {activeStatus && (
        <div style={{ marginTop: 22 }}>
          <DataGrid
            title={`${activeStatus === "All" ? "All" : activeStatus} points`}
            data={rows} columns={columns} loading={gridLoading}
            getRowId={(r) => String(r.pointID)}
            mainColumns="customerName"
            {...gridFeatures}
          />
        </div>
      )}
    </Page>
  );
}

export default function Page_() {
  const { ctx } = usePmContext();
  return (
    <PmGuard module="/point-management/developer-kpi">
      {ctx ? <DeveloperKpi devId={ctx.tmsUserId} /> : null}
    </PmGuard>
  );
}
