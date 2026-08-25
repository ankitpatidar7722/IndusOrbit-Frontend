"use client";
import { useEffect, useMemo, useState } from "react";
import { Page, Input, Dropdown } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import DateField from "@/components/DateField";
import { PmGuard } from "../PmGuard";
import { reportColumns, lblStyle, clearBtnStyle, gridFeatures, PmHeader } from "../shared";
import { pmApi, type TimeReportRow, type PmCustomer, type PmUser } from "@/lib/tms";

function TimeReport() {
  const [rows, setRows] = useState<TimeReportRow[]>([]);
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
    pmApi.timeReport(filter).then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, [filter]);

  const columns = useMemo(() => reportColumns(), []);

  return (
    <Page>
      <PmHeader page="time-report" />
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
        <label style={lblStyle}>From <DateField value={from} onChange={setFrom} style={{ width: 150 }} /></label>
        <label style={lblStyle}>To <DateField value={to} onChange={setTo} style={{ width: 150 }} /></label>
        {(custId || devId || from || to) && <button style={clearBtnStyle} onClick={() => { setCustId(undefined); setDevId(undefined); setFrom(""); setTo(""); }}>Clear</button>}
      </div>
      {loading ? <BrandedLoader size="md" text="Loading report…" /> : (
        <DataGrid title={`${rows.length} point(s)`} data={rows} columns={columns} getRowId={(r) => String(r.pointID)}
          mainColumns="customer" {...gridFeatures} />
      )}
    </Page>
  );
}

export default function Page_() {
  return <PmGuard module="/point-management/time-report"><TimeReport /></PmGuard>;
}
