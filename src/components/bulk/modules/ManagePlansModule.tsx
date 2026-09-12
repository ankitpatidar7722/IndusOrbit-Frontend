"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button, Dropdown, useModalAlert, StandardModal } from "indas-ui";
import { Tag, Plus, Pencil, Trash2, Star } from "lucide-react";
import type { BulkClientContext } from "@/components/bulk/BulkModuleShell";
import {
  getCatalogFeatures, upsertFeature, getPlans, upsertPlan, deletePlan,
  type FeatureDto, type PlanDto,
} from "@/bulk/services/api";
import { getCatalogSubFeatures } from "@/bulk/data/subFeatureCatalog";

// "Manage Plans" — Indus360-native rebuild of ManagePlans.tsx. GLOBAL plan catalog (Indus control DB):
// Feature → Plans. The BulkModuleShell client is used only to satisfy /bulk auth (X-Target-Company);
// the catalog itself is client-agnostic.

const INP: CSSProperties = { padding: "8px 10px", borderRadius: 8, fontSize: 13, width: "100%", border: "1px solid rgb(var(--border-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" };
const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 };
const CYCLES = [{ label: "Monthly", value: "MONTHLY" }, { label: "Annual", value: "ANNUAL" }];

const slugCode = (featureCode: string, planName: string) => {
  let s = planName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const fc = (featureCode || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (fc && s && !s.startsWith(fc)) s = `${fc}_${s}`;
  return s;
};
const emptyPlan = (featureID: number, featureCode: string): PlanDto => ({
  planID: 0, featureID, featureCode, planName: "", planDisplayName: null, planCode: null,
  billingCycle: "MONTHLY", unitPrice: 0, annualPrice: null, perUser: false, perUserNote: null,
  blurb: null, highlight: false, badge: null, features: [], subFeatures: [], razorpayPlanId: null, isActive: true,
});

export default function ManagePlansModule({ client }: { client: BulkClientContext }) {
  const { showSuccess, showError, AlertComponent } = useModalAlert();
  const [features, setFeatures] = useState<FeatureDto[]>([]);
  const [featureId, setFeatureId] = useState("");
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [newFeat, setNewFeat] = useState({ code: "", name: "" });
  const [editing, setEditing] = useState<PlanDto | null>(null);
  const [codeTouched, setCodeTouched] = useState(false);
  const [delId, setDelId] = useState<number | null>(null);
  void client;

  const feature = useMemo(() => features.find((f) => String(f.featureID) === featureId), [features, featureId]);

  const loadFeatures = async () => {
    setBusy(true);
    try { const f = await getCatalogFeatures(); setFeatures(f ?? []); if (f?.length && !featureId) setFeatureId(String(f[0].featureID)); }
    catch { showError("Load failed", "Could not load features."); } finally { setBusy(false); }
  };
  useEffect(() => { loadFeatures(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const loadPlans = async (fid: number) => {
    setBusy(true);
    try { const p = await getPlans(fid); setPlans(p ?? []); } catch { showError("Load failed", "Could not load plans."); } finally { setBusy(false); }
  };
  useEffect(() => { if (featureId) loadPlans(Number(featureId)); else setPlans([]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [featureId]);

  const addFeature = async () => {
    if (!newFeat.code.trim() || !newFeat.name.trim()) { showError("Required", "Feature code and name are required."); return; }
    setBusy(true);
    try {
      const res = await upsertFeature({ featureCode: newFeat.code.trim(), featureName: newFeat.name.trim() });
      if (res.success) { showSuccess("Feature added", res.message || "Created.", 2000); setNewFeat({ code: "", name: "" }); await loadFeatures(); if (res.data) setFeatureId(String(res.data.featureID)); }
      else showError("Failed", res.message || "Could not add feature.");
    } catch { showError("Failed", "Could not add feature."); } finally { setBusy(false); }
  };

  const openNew = () => { if (!feature) return; setEditing(emptyPlan(feature.featureID, feature.featureCode)); setCodeTouched(false); };
  const openEdit = (p: PlanDto) => { setEditing({ ...p, features: [...(p.features ?? [])], subFeatures: [...(p.subFeatures ?? [])] }); setCodeTouched(true); };

  const setField = <K extends keyof PlanDto>(k: K, v: PlanDto[K]) => setEditing((e) => e ? { ...e, [k]: v } : e);
  const onName = (v: string) => setEditing((e) => { if (!e) return e; const next = { ...e, planName: v }; if (!codeTouched) next.planCode = slugCode(e.featureCode, v); return next; });

  const subOptions = useMemo(() => {
    if (!editing) return [];
    const cat = getCatalogSubFeatures(editing.featureCode);
    const merged = new Map<string, { key: string; label: string }>();
    cat.forEach((c) => merged.set(c.key, { key: c.key, label: c.label }));
    (editing.subFeatures ?? []).forEach((s) => { if (!merged.has(s.key)) merged.set(s.key, { key: s.key, label: s.label }); });
    return Array.from(merged.values());
  }, [editing]);
  const toggleSub = (key: string, label: string) => setEditing((e) => {
    if (!e) return e;
    const has = (e.subFeatures ?? []).some((s) => s.key === key);
    const subFeatures = has ? e.subFeatures.filter((s) => s.key !== key) : [...(e.subFeatures ?? []), { key, label, enabled: true }];
    return { ...e, subFeatures };
  });

  const savePlan = async () => {
    if (!editing) return;
    if (!editing.planName.trim()) { showError("Required", "Plan Name is required."); return; }
    const code = (editing.planCode || slugCode(editing.featureCode, editing.planName)).trim();
    if (!code) { showError("Required", "Plan Code is required (a plan with no code is unbuyable)."); return; }
    setBusy(true);
    try {
      const payload: Partial<PlanDto> & { featureID: number; planName: string } = {
        ...editing, planCode: code,
        planDisplayName: editing.planDisplayName?.trim() || null, blurb: editing.blurb?.trim() || null,
        badge: editing.badge?.trim() || null, perUserNote: editing.perUserNote?.trim() || null, razorpayPlanId: editing.razorpayPlanId?.trim() || null,
        features: (editing.features ?? []).map((s) => s.trim()).filter(Boolean),
      };
      const res = await upsertPlan(payload);
      if (res.success) { showSuccess("Saved", res.message || "Plan saved.", 2200); setEditing(null); await loadPlans(Number(featureId)); }
      else showError("Failed", res.message || "Could not save the plan.");
    } catch { showError("Failed", "Could not save the plan."); } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (delId == null) return;
    setBusy(true);
    try { const res = await deletePlan(delId); if (res.success) { showSuccess("Deleted", "Plan deleted.", 2000); setDelId(null); await loadPlans(Number(featureId)); } else showError("Failed", res.message || "Could not delete."); }
    catch { showError("Failed", "Could not delete the plan."); } finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 940, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", textAlign: "center", marginBottom: 14 }}>
        🌐 Global plan catalog — applies to all clients (Indus control DB). The selected client above is used only for access.
      </div>

      {/* Feature picker + add */}
      <div style={{ background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-default))", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 240 }}>
            <div style={lbl}>Feature</div>
            <Dropdown value={featureId} onValueChange={(v) => setFeatureId(String(v))} options={features.map((f) => ({ value: String(f.featureID), label: `${f.featureName} (${f.featureCode})` }))} placeholder="— Select feature —" searchable size="md" />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div><div style={lbl}>New Feature Code</div><input value={newFeat.code} onChange={(e) => setNewFeat({ ...newFeat, code: e.target.value })} placeholder="e.g. Sahay" style={{ ...INP, width: 140 }} /></div>
            <div><div style={lbl}>Name</div><input value={newFeat.name} onChange={(e) => setNewFeat({ ...newFeat, name: e.target.value })} placeholder="Display name" style={{ ...INP, width: 180 }} /></div>
            <Button size="sm" icon={Plus} onClick={addFeature} disabled={busy}>Add Feature</Button>
          </div>
        </div>
      </div>

      {/* Plans list */}
      <div style={{ background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-default))", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "rgb(var(--fg-default))" }}>Plans for {feature?.featureName ?? "—"}</div>
          <Button size="sm" icon={Plus} onClick={openNew} disabled={busy || !feature}>New Plan</Button>
        </div>
        {plans.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {plans.map((p) => (
              <div key={p.planID} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid rgb(var(--border-default))", borderRadius: 10, background: p.highlight ? "rgba(31,69,118,0.05)" : undefined }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: "rgb(var(--fg-default))" }}>{p.planDisplayName || p.planName}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, background: "rgba(148,163,184,0.18)", padding: "1px 6px", borderRadius: 5, color: "rgb(var(--fg-muted))" }}>{p.planCode}</span>
                    {p.highlight && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "rgb(var(--color-primary))" }}><Star size={12} /> {p.badge || "Popular"}</span>}
                    {!p.isActive && <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>Inactive</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 3 }}>
                    ₹{p.unitPrice}/mo{p.annualPrice != null ? ` · ₹${p.annualPrice}/yr` : ""}{p.perUser ? " · per user" : ""}
                  </div>
                  {p.features?.length ? <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>{p.features.slice(0, 5).map((f, i) => <span key={i} style={{ fontSize: 11, background: "rgba(148,163,184,0.14)", padding: "2px 7px", borderRadius: 999, color: "rgb(var(--fg-muted))" }}>{f}</span>)}</div> : null}
                </div>
                <Button size="xs" variant="action-secondary" icon={Pencil} onClick={() => openEdit(p)}>Edit</Button>
                <Button size="xs" variant="action-delete" icon={Trash2} onClick={() => setDelId(p.planID)}>Delete</Button>
              </div>
            ))}
          </div>
        ) : <div style={{ padding: "24px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 13 }}>{busy ? "Loading…" : feature ? "No plans yet. Click New Plan." : "Select a feature."}</div>}
      </div>

      {/* Plan editor */}
      {editing && (
        <StandardModal isOpen title={editing.planID ? "Edit Plan" : "New Plan"} onClose={() => setEditing(null)} size="md">
          <div style={{ padding: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><div style={lbl}>Plan Name *</div><input value={editing.planName} onChange={(e) => onName(e.target.value)} style={INP} /></div>
            <div><div style={lbl}>Display Name</div><input value={editing.planDisplayName ?? ""} onChange={(e) => setField("planDisplayName", e.target.value)} style={INP} /></div>
            <div><div style={lbl}>Plan Code *</div><input value={editing.planCode ?? ""} onChange={(e) => { setCodeTouched(true); setField("planCode", e.target.value); }} style={{ ...INP, fontFamily: "monospace" }} /></div>
            <div><div style={lbl}>Billing Cycle</div><Dropdown value={editing.billingCycle} onValueChange={(v) => setField("billingCycle", String(v))} options={CYCLES} size="md" /></div>
            <div><div style={lbl}>Monthly Price (₹)</div><input type="number" value={editing.unitPrice} onChange={(e) => setField("unitPrice", Number(e.target.value))} style={INP} /></div>
            <div><div style={lbl}>Annual Price (₹)</div><input type="number" value={editing.annualPrice ?? ""} onChange={(e) => setField("annualPrice", e.target.value === "" ? null : Number(e.target.value))} style={INP} /></div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 20, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={editing.perUser} onChange={(e) => setField("perUser", e.target.checked)} /> Per user (seat-based)</label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={editing.highlight} onChange={(e) => setField("highlight", e.target.checked)} /> Highlight (popular)</label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={editing.isActive} onChange={(e) => setField("isActive", e.target.checked)} /> Active</label>
            </div>
            {editing.perUser && <div style={{ gridColumn: "1 / -1" }}><div style={lbl}>Per-user Note</div><input value={editing.perUserNote ?? ""} onChange={(e) => setField("perUserNote", e.target.value)} style={INP} /></div>}
            <div><div style={lbl}>Badge Text</div><input value={editing.badge ?? ""} onChange={(e) => setField("badge", e.target.value)} placeholder="Most popular" style={INP} /></div>
            <div><div style={lbl}>Razorpay Plan Id</div><input value={editing.razorpayPlanId ?? ""} onChange={(e) => setField("razorpayPlanId", e.target.value)} style={INP} /></div>
            <div style={{ gridColumn: "1 / -1" }}><div style={lbl}>Blurb (above cards)</div><input value={editing.blurb ?? ""} onChange={(e) => setField("blurb", e.target.value)} style={INP} /></div>
            <div style={{ gridColumn: "1 / -1" }}><div style={lbl}>Card Bullets (one per line)</div><textarea rows={4} value={(editing.features ?? []).join("\n")} onChange={(e) => setField("features", e.target.value.split("\n"))} style={INP} /></div>
            {subOptions.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={lbl}>Sub-features</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {subOptions.map((s) => { const on = (editing.subFeatures ?? []).some((x) => x.key === s.key); return (
                    <label key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "4px 9px", borderRadius: 999, cursor: "pointer", border: "1px solid rgb(var(--border-default))", background: on ? "rgba(31,69,118,0.10)" : "transparent" }}>
                      <input type="checkbox" checked={on} onChange={() => toggleSub(s.key, s.label)} /> {s.label}
                    </label>
                  ); })}
                </div>
              </div>
            )}
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <Button size="sm" variant="action-secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" variant="action-save" onClick={savePlan} disabled={busy}>Save Plan</Button>
            </div>
          </div>
        </StandardModal>
      )}

      {delId != null && (
        <StandardModal isOpen title="Delete Plan?" onClose={() => setDelId(null)} size="sm">
          <div style={{ padding: 8 }}>
            <div style={{ fontSize: 13, color: "rgb(var(--fg-default))", marginBottom: 14 }}>This permanently deletes the plan from the global catalog. Continue?</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button size="sm" variant="action-secondary" onClick={() => setDelId(null)}>Cancel</Button>
              <Button size="sm" variant="action-delete" onClick={doDelete} disabled={busy}>Delete</Button>
            </div>
          </div>
        </StandardModal>
      )}
      <AlertComponent />
    </div>
  );
}
