"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, Button } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import { Play, CheckCircle2, RotateCcw } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { pointColumns, openDrawerColumn, gridFeatures, PmHeader } from "../shared";
import { usePointDrawer, usePointIdFromUrl, PointDrawer, actionIcon as ic } from "../PointDrawer";
import { pmApi, type PointGridRow } from "@/lib/tms";

function SupportActionCenter({ uid, isAdmin }: { uid: number; isAdmin: boolean }) {
  const [rows, setRows] = useState<PointGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    pmApi.supportQueue(isAdmin ? undefined : uid).then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, [uid, isAdmin]);
  useEffect(reload, [reload]);

  const drawer = usePointDrawer(reload);
  usePointIdFromUrl(drawer.open);
  const columns = useMemo(() => [...pointColumns(), openDrawerColumn<PointGridRow>((id) => drawer.open(id))], [drawer]);
  if (loading) return <BrandedLoader size="lg" text="Loading support queue…" />;

  const d = drawer.detail; const s = d?.status ?? ""; const rk = drawer.remark; const dis = drawer.busy;
  const actions = d && s === "PendingSupport" && (
    <>
      <Button variant="action-save" onClick={() => drawer.act(() => pmApi.startSupport(d.pointID, uid))} disabled={dis}><Play size={15} style={ic} /> Start</Button>
      <Button variant="action-save" onClick={() => drawer.act(() => pmApi.supportVerify(d.pointID, uid, rk))} disabled={dis}><CheckCircle2 size={15} style={ic} /> Mark Verified</Button>
      <Button variant="action-delete" onClick={() => drawer.act(() => pmApi.supportReopen(d.pointID, uid, rk))} disabled={dis}><RotateCcw size={15} style={ic} /> Reopen for Dev</Button>
    </>
  );

  return (
    <Page>
      <PmHeader page="support" />
      {(err || drawer.err) && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err || drawer.err}</small></div>}
      <DataGrid title={`${rows.length} awaiting support`} data={rows} columns={columns} getRowId={(r) => String(r.pointID)}
        onRowClick={(r) => drawer.open(r.pointID)} mainColumns="customerName" rightFrozenColumns={["actions"]} {...gridFeatures} />
      <PointDrawer drawer={drawer} actions={actions} uploaderId={uid} />
    </Page>
  );
}

export default function Page_() {
  const { ctx } = usePmContext();
  const isAdmin = (ctx?.tmsRole ?? "").toLowerCase() === "admin";
  return <PmGuard module="/point-management/support">{ctx ? <SupportActionCenter uid={ctx.tmsUserId} isAdmin={isAdmin} /> : null}</PmGuard>;
}
