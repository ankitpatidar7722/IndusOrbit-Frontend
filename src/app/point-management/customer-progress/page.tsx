"use client";
import { useEffect, useMemo, useState } from "react";
import { Page, DonutChart, Card, CardContent, Dropdown } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import DateField from "@/components/DateField";
import { PmGuard } from "../PmGuard";
import { reportColumns, selStyle, lblStyle, clearBtnStyle, gridFeatures, PmHeader } from "../shared";
import { pmApi, type TimeReportRow, type PmCustomer, type PmUser, type AdminDashboardStats } from "@/lib/tms";

function CustomerProgress() {
  const [rows, setRows] = useState<TimeReportRow[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [customers, setCustomers] = useState<PmCustomer[]>([]);
  const [devs, setDevs] = useState<PmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [custId, setCustId] = useState<number | undefined>();
  const [devId, setDevId] = useState<number | undefined>();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filter = useMemo(() => ({ custId, devId, from: from || undefined, to: to || undefined }), [custId, devId, from, to]);

  useEffect(() => { Promise.all([pmApi.customers(), pmApi.users("Developer")]).then(([c, d]) => { setCustomers(c); setDevs(d); }); }, []);
  useEffect(() => {
    setLoading(true);
    Promise.all([pmApi.timeReport(filter), pmApi.adminStats({ custId, devId, from: from || undefined, to: to || undefined })])
      .then(([r, s]) => { setRows(r); setStats(s); })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [filter, custId, devId, from, to]);

  const donut = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Queue", value: stats.queue, color: "rgb(var(--fg-subtle))" },
      { name: "Active", value: stats.assigned + stats.inProgress + stats.reOpened, color: "#3b82f6" },
      { name: "In Pipeline", value: stats.devCompleted + stats.pendingSupport + stats.supportVerified + stats.pendingMerge + stats.pendingQC + stats.inTesting + stats.testingCompleted, color: "#f59e0b" },
      { name: "Closed", value: stats.closed, color: "#22c55e" },
      { name: "Hold/Reject", value: stats.hold + stats.reject, color: "#ef4444" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const columns = useMemo(() => reportColumns(), []);

  return (
    <Page>
      <PmHeader page="customer-progress" />
      {err && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err}</small></div>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <div style={{ width: 200 }}>
          <Dropdown value={custId != null ? String(custId) : ""} onValueChange={(v) => setCustId(v ? Number(v) : undefined)}
            options={[{ value: "", label: "All customers" }, ...customers.map((c) => ({ value: String(c.customerID), label: c.companyName }))]} searchable size="md" />
        </div>
        <div style={{ width: 200 }}>
          <Dropdown value={devId != null ? String(devId) : ""} onValueChange={(v) => setDevId(v ? Number(v) : undefined)}
            options={[{ value: "", label: "All developers" }, ...devs.map((d) => ({ value: String(d.userID), label: d.fullName }))]} searchable size="md" />
        </div>
        <label style={lblStyle}>From <DateField value={from} onChange={setFrom} style={{ ...selStyle, width: 150 }} /></label>
        <label style={lblStyle}>To <DateField value={to} onChange={setTo} style={{ ...selStyle, width: 150 }} /></label>
        {(custId || devId || from || to) && <button style={clearBtnStyle} onClick={() => { setCustId(undefined); setDevId(undefined); setFrom(""); setTo(""); }}>Clear</button>}
      </div>

      {loading ? <BrandedLoader size="md" text="Loading…" /> : (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
          <Card>
            <CardContent>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Status distribution</div>
              {donut.length === 0 ? <div style={{ opacity: 0.5, fontSize: 12.5 }}>No data.</div> : (
                <DonutChart data={donut} height={240} showLegend centerLabel="Points" centerValue={String(stats?.total ?? 0)} />
              )}
            </CardContent>
          </Card>
          <DataGrid title={`${rows.length} point(s)`} data={rows} columns={columns} getRowId={(r) => String(r.pointID)}
            mainColumns="customer" {...gridFeatures} />
        </div>
      )}
    </Page>
  );
}

export default function Page_() {
  return <PmGuard module="/point-management/customer-progress"><CustomerProgress /></PmGuard>;
}
