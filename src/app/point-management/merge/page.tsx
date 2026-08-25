"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, Button } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import { GitMerge, RotateCcw } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { pointColumns, gridFeatures, PmHeader } from "../shared";
import { usePointDrawer, usePointIdFromUrl, PointDrawer, actionIcon as ic } from "../PointDrawer";
import { pmApi, type PointGridRow } from "@/lib/tms";

function MergeCode({ uid }: { uid: number }) {
  const [rows, setRows] = useState<PointGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    pmApi.mergeQueue().then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);

  const drawer = usePointDrawer(reload);
  usePointIdFromUrl(drawer.open);
  const columns = useMemo(() => pointColumns(), []);
  if (loading) return <BrandedLoader size="lg" text="Loading merge queue…" />;

  const d = drawer.detail; const s = d?.status ?? ""; const rk = drawer.remark; const dis = drawer.busy;
  const actions = d && s === "PendingMerge" && (
    <>
      <Button onClick={() => drawer.act(() => pmApi.mergeApprove(d.pointID, uid, rk))} disabled={dis}><GitMerge size={15} style={ic} /> Approve → QC</Button>
      <Button variant="destructive" onClick={() => drawer.act(() => pmApi.mergeReopen(d.pointID, uid, rk))} disabled={dis}><RotateCcw size={15} style={ic} /> Reopen for Dev</Button>
    </>
  );

  return (
    <Page>
      <PmHeader page="merge" />
      {(err || drawer.err) && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err || drawer.err}</small></div>}
      <DataGrid title={`${rows.length} awaiting merge`} data={rows} columns={columns} getRowId={(r) => String(r.pointID)}
        onRowClick={(r) => drawer.open(r.pointID)} mainColumns="customerName" {...gridFeatures} />
      <PointDrawer drawer={drawer} actions={actions} uploaderId={uid} />
    </Page>
  );
}

export default function Page_() {
  const { ctx } = usePmContext();
  return <PmGuard module="/point-management/merge">{ctx ? <MergeCode uid={ctx.tmsUserId} /> : null}</PmGuard>;
}
