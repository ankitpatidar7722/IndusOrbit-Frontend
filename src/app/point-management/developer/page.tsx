"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, Button, Tabs } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import { Play, Pause, Square, CheckCircle2, GitMerge, PauseCircle, XCircle } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { developerColumns, gridFeatures, PmHeader } from "../shared";
import { usePointDrawer, usePointIdFromUrl, PointDrawer, actionIcon as ic } from "../PointDrawer";
import { pmApi, type PointGridRow } from "@/lib/tms";

// Matches TMS's dev-status-toggle: "All" is every point ever assigned to the developer
// (any status); the other two are a client-side filter over that same loaded set.
const DEV_TABS = [
  { id: "All", label: "All" },
  { id: "Assigned", label: "Assigned" },
  { id: "In Progress", label: "In Progress" },
];

function DeveloperDashboard({ devId, isAdmin }: { devId: number; isAdmin: boolean }) {
  const [rows, setRows] = useState<PointGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState("All");

  const reload = useCallback(() => {
    setLoading(true);
    pmApi.developerBoard(isAdmin ? undefined : devId).then(setRows).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, [devId, isAdmin]);
  useEffect(reload, [reload]);

  const drawer = usePointDrawer(reload);
  usePointIdFromUrl(drawer.open);
  const columns = useMemo(() => developerColumns((id) => drawer.open(id)), [drawer]);

  const filteredRows = useMemo(
    () => (statusTab === "All" ? rows : rows.filter((r) => r.status === statusTab)),
    [rows, statusTab]
  );

  if (loading) return <BrandedLoader size="lg" text="Loading your board…" />;

  const d = drawer.detail;
  const s = d?.status ?? "";
  const rk = drawer.remark;
  const dis = drawer.busy;
  const actions = d && (
    <>
      {(s === "Assigned" || s === "ReOpened" || s === "Hold") &&
        <Button onClick={() => drawer.act(() => pmApi.startTimer(d.pointID, devId))} disabled={dis}><Play size={15} style={ic} /> Start</Button>}
      {s === "In Progress" && !d.isDeveloperPaused &&
        <Button variant="action-secondary" onClick={() => drawer.act(() => pmApi.pauseTimer(d.pointID, devId))} disabled={dis}><Pause size={15} style={ic} /> Pause</Button>}
      {s === "In Progress" && d.isDeveloperPaused &&
        <Button onClick={() => drawer.act(() => pmApi.resumeTimer(d.pointID, devId))} disabled={dis}><Play size={15} style={ic} /> Resume</Button>}
      {s === "In Progress" &&
        <Button onClick={() => drawer.act(() => pmApi.completeTimer(d.pointID, devId))} disabled={dis}><Square size={15} style={ic} /> Complete</Button>}
      {s === "DevCompleted" &&
        <Button onClick={() => drawer.act(() => pmApi.sendToSupport(d.pointID, devId, rk))} disabled={dis}><CheckCircle2 size={15} style={ic} /> Send to Support</Button>}
      {s === "SupportVerified" &&
        <Button onClick={() => drawer.act(() => pmApi.sendToMerge(d.pointID, devId))} disabled={dis}><GitMerge size={15} style={ic} /> Send for Merge</Button>}
      {(s === "In Progress" || s === "Assigned" || s === "ReOpened") && (
        <>
          <Button variant="action-secondary" onClick={() => drawer.act(() => pmApi.setPointStatus(d.pointID, devId, "Hold", rk))} disabled={dis}><PauseCircle size={15} style={ic} /> Hold</Button>
          <Button variant="destructive" onClick={() => drawer.act(() => pmApi.setPointStatus(d.pointID, devId, "Reject", rk))} disabled={dis}><XCircle size={15} style={ic} /> Reject</Button>
        </>
      )}
    </>
  );

  return (
    <Page>
      <PmHeader page="developer" />
      {(err || drawer.err) && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err || drawer.err}</small></div>}

      <div style={{ marginBottom: 16, maxWidth: 420 }}>
        <Tabs tabs={DEV_TABS} activeTab={statusTab} onTabChange={setStatusTab} variant="pill" size="sm" />
      </div>

      <DataGrid
        title={`${filteredRows.length} point(s)`}
        data={filteredRows} columns={columns}
        getRowId={(r) => String(r.pointID)}
        onRowClick={(r) => drawer.open(r.pointID)}
        mainColumns="description"
        rightFrozenColumns={["actions"]}
        {...gridFeatures}
      />
      <PointDrawer drawer={drawer} actions={actions} uploaderId={devId} />
    </Page>
  );
}

export default function Page_() {
  const { ctx } = usePmContext();
  const isAdmin = (ctx?.tmsRole ?? "").toLowerCase() === "admin";
  return (
    <PmGuard module="/point-management/developer">
      {ctx ? <DeveloperDashboard devId={ctx.tmsUserId} isAdmin={isAdmin} /> : null}
    </PmGuard>
  );
}
