"use client";
import { useEffect, useMemo, useState } from "react";
import { Page, Input, Button, Card, CardContent, Dropdown } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { DataGrid } from "@/components/datagrid";
import DateField from "@/components/DateField";
import { Send, Check, Eye } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { pointColumns, lblStyle, gridFeatures, PmHeader } from "../shared";
import { usePointDrawer, PointDrawer } from "../PointDrawer";
import { pmApi, type PointGridRow, type PmUser } from "@/lib/tms";

function AssignPage({ createdById }: { createdById: number }) {
  const [queue, setQueue] = useState<PointGridRow[]>([]);
  const [devs, setDevs] = useState<PmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PointGridRow[]>([]);
  const [devId, setDevId] = useState<number | "">("");
  const [expDate, setExpDate] = useState("");
  const [expMin, setExpMin] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function load() {
    setLoading(true);
    Promise.all([pmApi.queue(), pmApi.users("Developer")])
      .then(([q, d]) => { setQueue(q); setDevs(d); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function assign() {
    setMsg(null);
    if (!devId || selected.length === 0) { setMsg({ text: "Select at least one point and a developer.", ok: false }); return; }
    setSaving(true);
    try {
      // capture the ticket ids + developer name for the success message (state is cleared below)
      const devName = devs.find((d) => d.userID === Number(devId))?.fullName ?? "the developer";
      const tickets = selected.map((s) => `#${s.pointID}`).join(", ");
      await pmApi.assign({
        devId: Number(devId), createdById,
        expectedDate: expDate || undefined,
        expectedMinutes: expMin ? Number(expMin) : undefined,
        pointIds: selected.map((s) => s.pointID),
      });
      setMsg({ text: `Ticket ${tickets} ${selected.length > 1 ? "have" : "has"} been assigned to ${devName}.`, ok: true });
      setSelected([]); setDevId(""); setExpDate(""); setExpMin(""); load();
    } catch (e) { setMsg({ text: String(e), ok: false }); }
    finally { setSaving(false); }
  }

  const drawer = usePointDrawer(load);
  const columns = useMemo(() => {
    const cols = pointColumns();
    cols.push({
      id: "view", header: "", enableSorting: false, enableHiding: false, size: 84,
      cell: ({ row }) => <Button size="sm" variant="outline" icon={Eye} onClick={() => drawer.open(row.original.pointID)}>View</Button>,
    });
    return cols;
  }, [drawer]);
  if (loading) return <BrandedLoader size="lg" text="Loading queue…" />;

  return (
    <Page>
      <PmHeader page="assign" />
      <Card>
        <CardContent>
          {msg && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "10px 14px", borderRadius: 9, fontSize: 13.5,
              background: msg.ok ? "#eaf7ee" : "#fdecec", color: msg.ok ? "#1e7e46" : "#c0392b" }}>
              {msg.ok && <Check size={16} />} {msg.text}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ width: 240 }}>
              <Dropdown value={devId ? String(devId) : ""} onValueChange={(v) => setDevId(v ? Number(v) : "")}
                options={devs.map((d) => ({ value: String(d.userID), label: d.fullName }))}
                placeholder="— Assign to developer —" searchable size="md" />
            </div>
            <label style={lblStyle}>Expected date <DateField value={expDate} onChange={setExpDate} style={{ width: 150 }} /></label>
            <label style={lblStyle}>Est. minutes <Input type="number" value={expMin} onChange={(e) => setExpMin(e.target.value)} style={{ width: 110 }} placeholder="e.g. 60" /></label>
            <Button onClick={assign} disabled={saving || !devId || selected.length === 0}>
              <Send size={15} style={{ marginRight: 6 }} /> {saving ? "Assigning…" : `Assign ${selected.length || ""}`.trim()}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div style={{ marginTop: 18 }}>
        <DataGrid
          title={`${queue.length} verified queue point(s) — select to assign`}
          data={queue} columns={columns}
          getRowId={(r) => String(r.pointID)}
          onRowSelect={setSelected}
          mainColumns="customerName"
          rightFrozenColumns={["view"]}
          {...gridFeatures}
        />
      </div>
      <PointDrawer drawer={drawer} actions={null} uploaderId={createdById} />
    </Page>
  );
}

export default function Page_() {
  const { ctx } = usePmContext();
  return <PmGuard module="/point-management/assign">{ctx ? <AssignPage createdById={ctx.tmsUserId} /> : null}</PmGuard>;
}
