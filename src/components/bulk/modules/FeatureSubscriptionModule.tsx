"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button, Dropdown, useModalAlert } from "indas-ui";
import { Users, Mail, Play, Pause } from "lucide-react";
import type { BulkClientContext } from "@/components/bulk/BulkModuleShell";
import {
  getCompanyFeatureState, getCompanyClientUsers, assignFeature, setFeatureStatus,
  type FeatureSubscriptionDto, type ClientUserDto,
} from "@/bulk/services/api";

// "Feature Subscription" — Indus360-native rebuild of FeatureSubscription.tsx. Assigns Sahay
// (per-user seats) / Email (company-wide) subscriptions to the picked client's OWN ERP DB. The client
// comes from BulkModuleShell (companyUserId is the only key sent; backend resolves its DB).

const INP: CSSProperties = { padding: "8px 10px", borderRadius: 8, fontSize: 13, width: "100%", border: "1px solid rgb(var(--border-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" };
const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 };
const CYCLES = [{ label: "Monthly", value: "MONTHLY" }, { label: "Annual", value: "ANNUAL" }];
const today = () => new Date().toISOString().split("T")[0];
const addDays = (d: string, n: number) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split("T")[0]; };

function FeaturePanel({ featureCode, current, users, companyUserId, onChanged }: {
  featureCode: "Sahay" | "Email"; current?: FeatureSubscriptionDto; users: ClientUserDto[]; companyUserId: string; onChanged: () => void;
}) {
  const { showSuccess, showError, AlertComponent } = useModalAlert();
  const isSahay = featureCode === "Sahay";
  const [planName, setPlanName] = useState("");
  const [cycle, setCycle] = useState("MONTHLY");
  const [price, setPrice] = useState(0);
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(addDays(today(), 30));
  const [seats, setSeats] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPlanName(current?.planName ?? "");
    setCycle(current?.billingCycle ?? "MONTHLY");
    setPrice(current?.unitPrice ?? 0);
    setStart(current?.startDate?.split("T")[0] ?? today());
    setEnd(current?.endDate?.split("T")[0] ?? addDays(today(), 30));
    if (isSahay) {
      const pre = new Set<number>();
      (current?.seats ?? []).forEach((s) => pre.add(s.userID));
      if (!current?.seats?.length) users.forEach((u) => { if (u.isSahayActive) pre.add(u.userID); });
      setSeats(pre);
    }
  }, [current, users, isSahay]);

  const seatCount = isSahay ? seats.size : 1;
  const total = useMemo(() => (Number(price) || 0) * seatCount, [price, seatCount]);
  const active = (current?.status ?? "").toUpperCase() === "ACTIVE";

  const assign = async () => {
    if (!planName.trim()) { showError("Required", "Plan Name is required."); return; }
    if (!(Number(price) > 0)) { showError("Required", "Price must be greater than 0."); return; }
    if (isSahay && seats.size === 0) { showError("Required", "Select at least one seat for Sahay."); return; }
    setBusy(true);
    try {
      const res = await assignFeature({
        companyUserID: companyUserId, featureCode, planName: planName.trim(), billingCycle: cycle as "MONTHLY" | "ANNUAL",
        unitPrice: Number(price), startDate: start, endDate: end, seatUserIds: isSahay ? Array.from(seats) : [],
      });
      if (res.success) { showSuccess("Saved", res.message || `${featureCode} subscription updated.`, 2500); onChanged(); }
      else showError("Failed", res.message || "Could not assign.");
    } catch { showError("Failed", "Could not assign the subscription."); } finally { setBusy(false); }
  };
  const toggleStatus = async () => {
    setBusy(true);
    try { const res = await setFeatureStatus(companyUserId, featureCode, !active); if (res.success) { showSuccess(active ? "Suspended" : "Resumed", res.message || "Status updated.", 2200); onChanged(); } else showError("Failed", res.message || "Could not update status."); }
    catch { showError("Failed", "Could not update status."); } finally { setBusy(false); }
  };

  return (
    <div style={{ flex: 1, minWidth: 320, background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-default))", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: "rgb(var(--fg-default))" }}>
          {isSahay ? <Users size={18} /> : <Mail size={18} />} {featureCode}
        </div>
        {current && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: active ? "rgba(34,197,94,0.16)" : "rgba(239,68,68,0.14)", color: active ? "#16a34a" : "#dc2626" }}>{current.status || "—"}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}><div style={lbl}>Plan Name</div><input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Premium" style={INP} /></div>
        <div><div style={lbl}>Billing Cycle</div><Dropdown value={cycle} onValueChange={(v) => setCycle(String(v))} options={CYCLES} size="md" /></div>
        <div><div style={lbl}>Price {isSahay ? "(per seat)" : ""} ₹</div><input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} style={INP} /></div>
        <div><div style={lbl}>Start Date</div><input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={INP} /></div>
        <div><div style={lbl}>End Date</div><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={INP} /></div>
      </div>

      {isSahay ? (
        <div style={{ marginTop: 12 }}>
          <div style={lbl}>Seats ({seats.size} selected)</div>
          <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid rgb(var(--border-default))", borderRadius: 8, padding: 8 }}>
            {users.length ? users.map((u) => (
              <label key={u.userID} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={seats.has(u.userID)} onChange={() => setSeats((prev) => { const n = new Set(prev); if (n.has(u.userID)) n.delete(u.userID); else n.add(u.userID); return n; })} />
                {u.userName}
              </label>
            )) : <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", padding: 6 }}>No users found for this company.</div>}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12, color: "rgb(var(--fg-muted))" }}>Company-wide — per-user seat selection not applicable.</div>
      )}

      <div style={{ marginTop: 12, fontSize: 15, fontWeight: 800, color: "rgb(var(--fg-default))" }}>
        Total: ₹{total.toLocaleString("en-IN")} <span style={{ fontSize: 12, fontWeight: 500, color: "rgb(var(--fg-muted))" }}>({isSahay ? `₹${price}/seat × ${seatCount}` : `₹${price} × 1`})</span>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        {current && <Button size="sm" variant="action-secondary" icon={active ? Pause : Play} onClick={toggleStatus} disabled={busy}>{active ? "Suspend" : "Resume"}</Button>}
        <Button size="sm" variant="action-save" onClick={assign} disabled={busy}>{current ? "Update" : "Assign"}</Button>
      </div>
      <AlertComponent />
    </div>
  );
}

export default function FeatureSubscriptionModule({ client }: { client: BulkClientContext }) {
  const { showError } = useModalAlert();
  const [state, setState] = useState<{ sahay?: FeatureSubscriptionDto; email?: FeatureSubscriptionDto }>({});
  const [users, setUsers] = useState<ClientUserDto[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [st, us] = await Promise.all([getCompanyFeatureState(client.companyUserId), getCompanyClientUsers(client.companyUserId)]);
      setState({ sahay: st?.sahay, email: st?.email });
      setUsers(us?.data ?? []);
    } catch { showError("Load failed", "Could not load subscription state for this client."); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [client.companyUserId]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", textAlign: "center", marginBottom: 14 }}>
        Assigning subscriptions to <b style={{ color: "rgb(var(--fg-default))" }}>{client.companyName}</b>{busy ? " · loading…" : ""}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <FeaturePanel featureCode="Sahay" current={state.sahay} users={users} companyUserId={client.companyUserId} onChanged={load} />
        <FeaturePanel featureCode="Email" current={state.email} users={users} companyUserId={client.companyUserId} onChanged={load} />
      </div>
    </div>
  );
}
