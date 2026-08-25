"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, Button } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import { Play, Square, CheckCircle2, RotateCcw } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { pointColumns, gridFeatures, PmHeader } from "../shared";
import { usePointDrawer, usePointIdFromUrl, PointDrawer, actionIcon as ic } from "../PointDrawer";
import { pmApi, type PointGridRow } from "@/lib/tms";

function TesterDashboard({ uid }: { uid: number }) {
  const [rows, setRows] = useState<PointGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    pmApi.testerQueue().then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);

  const drawer = usePointDrawer(reload);
  usePointIdFromUrl(drawer.open);
  const columns = useMemo(() => pointColumns(), []);
  if (loading) return <BrandedLoader size="lg" text="Loading QC queue…" />;

  const d = drawer.detail; const s = d?.status ?? ""; const rk = drawer.remark; const dis = drawer.busy;
  const actions = d && (
    <>
      {s === "PendingQC" && <Button onClick={() => drawer.act(() => pmApi.startTester(d.pointID, uid))} disabled={dis}><Play size={15} style={ic} /> Start Testing</Button>}
      {s === "In-Testing" && <Button onClick={() => drawer.act(() => pmApi.completeTesting(d.pointID, uid))} disabled={dis}><Square size={15} style={ic} /> Complete Testing</Button>}
      {s === "Testing-Completed" && <Button onClick={() => drawer.act(() => pmApi.verifyClose(d.pointID, uid, rk))} disabled={dis}><CheckCircle2 size={15} style={ic} /> Verify &amp; Close</Button>}
      {(s === "PendingQC" || s === "In-Testing" || s === "Testing-Completed") &&
        <Button variant="destructive" onClick={() => drawer.act(() => pmApi.testerReopen(d.pointID, uid, rk))} disabled={dis}><RotateCcw size={15} style={ic} /> Reopen for Dev</Button>}
    </>
  );

  return (
    <Page>
      <PmHeader page="tester" />
      {(err || drawer.err) && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err || drawer.err}</small></div>}
      <DataGrid title={`${rows.length} in QC`} data={rows} columns={columns} getRowId={(r) => String(r.pointID)}
        onRowClick={(r) => drawer.open(r.pointID)} mainColumns="customerName" {...gridFeatures} />
      <PointDrawer drawer={drawer} actions={actions} uploaderId={uid} />
    </Page>
  );
}

export default function Page_() {
  const { ctx } = usePmContext();
  return <PmGuard module="/point-management/tester">{ctx ? <TesterDashboard uid={ctx.tmsUserId} /> : null}</PmGuard>;
}
