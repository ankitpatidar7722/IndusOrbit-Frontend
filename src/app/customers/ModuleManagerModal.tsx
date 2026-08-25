"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StandardModal, Input, Button, Tabs, Badge, Dropdown } from "indas-ui";
import { DataGrid } from "@/components/datagrid";
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, Layers, Search, Save, Plus, Trash2, ShieldCheck, ChevronDown, RotateCcw, Info, AlertTriangle, CheckCircle2, Pencil, PackagePlus } from "lucide-react";
import { customersApi, type CustomerCard } from "@/lib/customers";
import { modulesApi, type ModuleSettingsRow, type ModuleGroupModuleRow, type ClientDropdownItem, type ClientModuleDto, type IndusToolModuleDto } from "@/lib/modules";

const APP_OPTIONS = ["estimoprime", "multiunit", "PrintudeERP"];
const APP_LBL: Record<string, string> = { estimoprime: "Estimoprime", multiunit: "MultiUnit", printudeerp: "PrintudeERP" };
const appLbl = (a: string) => APP_LBL[a.toLowerCase()] ?? a;

export default function ModuleManagerModal({
  customer, isOpen, onClose, onFlash,
}: {
  customer: CustomerCard | null;
  isOpen: boolean;
  onClose: () => void;
  onFlash: (m: string) => void;
}) {
  const [tab, setTab] = useState("settings");
  const [connStr, setConnStr] = useState("");
  const [app, setApp] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // resolve connection string from the customer's detail
  useEffect(() => {
    if (!isOpen || !customer) return;
    setTab("settings"); setErr(null); setConnStr(""); setApp(customer.applicationName ?? "");
    customersApi.detail(customer.companyUserID)
      .then((d) => { setConnStr(d.conn_String ?? ""); setApp(d.applicationName ?? customer.applicationName ?? ""); })
      .catch((e) => setErr(String(e)));
  }, [isOpen, customer]);

  const tabs = useMemo(() => ([
    { id: "settings", label: "Module Settings" },
    { id: "copy", label: "Copy Modules" },
    { id: "groups", label: "Module Group Authority" },
    { id: "newmodule", label: "New Module" },
    { id: "toolauth", label: "Indus Tool Authority" },
  ]), []);

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Modules — ${customer?.companyName ?? ""}`}
      subtitle={customer ? `${customer.companyUniqueCode ?? ""} · ${app}` : undefined}
      size="xl"
      showFooter={false}
    >
      {err && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <Tabs tabs={tabs} activeTab={tab} onTabChange={setTab} variant="pill" size="sm" />
      <div style={{ marginTop: 16 }}>
        {tab === "settings" && <ModuleSettingsTab app={app} connStr={connStr} onFlash={onFlash} />}
        {tab === "copy" && <CopyModulesTab source={customer} connStr={connStr} onFlash={onFlash} />}
        {tab === "groups" && <ModuleGroupsTab app={app} connStr={connStr} onFlash={onFlash} />}
        {tab === "newmodule" && <NewModuleTab app={app} connStr={connStr} onFlash={onFlash} />}
        {tab === "toolauth" && <ToolAuthorityTab customer={customer} onFlash={onFlash} />}
      </div>
    </StandardModal>
  );
}

/* ── Tab 1: Module Settings ─────────────────────────────── */
export function ModuleSettingsTab({ app, connStr, onFlash, source }: { app: string; connStr: string; onFlash: (m: string) => void; source?: CustomerCard | null }) {
  const [rows, setRows] = useState<ModuleSettingsRow[]>([]);
  const [orig, setOrig] = useState<ModuleSettingsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false); // "Copy As" — copy this client's modules to another

  const load = useCallback(async () => {
    if (!app || !connStr) return;
    setLoading(true); setMsg(null);
    try {
      const r = await modulesApi.getSettings(app, connStr);
      if (r.success) { setRows(r.data); setOrig(r.data.map((x) => ({ ...x }))); }
      else setMsg(r.message);
    } catch (e) { setMsg(String(e)); } finally { setLoading(false); }
  }, [app, connStr]);
  useEffect(() => { load(); }, [load]);

  const toggle = useCallback((name: string) => setRows((p) => p.map((r) => r.moduleName === name ? { ...r, status: !r.status } : r)), []);
  const enabled = rows.filter((r) => r.status).length;

  const columns = useMemo<ColumnDef<ModuleSettingsRow>[]>(() => [
    {
      id: "status", header: "Enabled", size: 80,
      cell: ({ row }) => (
        <input type="checkbox" style={{ width: 16, height: 16, cursor: "pointer" }}
          checked={row.original.status} onChange={() => toggle(row.original.moduleName)} />
      ),
    },
    { accessorKey: "moduleHeadName", header: "Module Head" },
    { accessorKey: "moduleDisplayName", header: "Module Display Name" },
    { accessorKey: "moduleName", header: "Module Name" },
  ], [toggle]);

  async function save() {
    const changes = rows.filter((r) => { const o = orig.find((x) => x.moduleName === r.moduleName); return !o || o.status !== r.status; })
      .map((r) => ({ moduleName: r.moduleName, status: r.status }));
    if (changes.length === 0) { setMsg("No changes to save."); return; }
    setSaving(true);
    try {
      const r = await modulesApi.saveSettings(app, connStr, changes);
      if (r.success) { onFlash(r.message || `Saved (${r.inserted} added, ${r.deleted} removed).`); await load(); }
      else setMsg(r.message);
    } catch (e) { setMsg(String(e)); } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Badge variant="info">{enabled}/{rows.length} enabled</Badge>
        {source && (
          <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)} disabled={!connStr} style={{ marginLeft: "auto" }}>
            <Copy size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Copy As
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={saving} style={{ marginLeft: source ? undefined : "auto" }}>
          <Save size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{saving ? "Saving…" : "Save Modules"}
        </Button>
      </div>
      {msg && <div style={{ color: "#8a6d1a", fontSize: 12.5, marginBottom: 8 }}>{msg}</div>}
      {loading ? <div style={{ padding: 30, textAlign: "center", opacity: 0.6 }}>Loading modules…</div> : (
        <DataGrid<ModuleSettingsRow>
          data={rows}
          columns={columns}
          getRowId={(r) => r.moduleName}
          title="Modules"
          enableSearch
          enableSorting
          enablePagination
          pageSize={15}
        />
      )}
      {source && (
        <StandardModal
          isOpen={copyOpen}
          onClose={() => setCopyOpen(false)}
          title={`Copy As — ${source.companyName}`}
          subtitle="Copy this client's module configuration to another client"
          size="lg"
          showFooter={false}
        >
          <CopyModulesTab source={source} connStr={connStr} onFlash={(m) => { onFlash(m); setCopyOpen(false); }} />
        </StandardModal>
      )}
    </div>
  );
}

/* ── Tab 2: Copy Modules ────────────────────────────────── */
export function CopyModulesTab({ source, connStr, onFlash }: { source: CustomerCard | null; connStr: string; onFlash: (m: string) => void }) {
  const [clients, setClients] = useState<ClientDropdownItem[]>([]);
  const [target, setTarget] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<{ a: number; b: number } | null>(null);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    modulesApi.clientDropdown().then((r) => setClients((r.data || []).filter((c) => c.companyUserID !== source?.companyUserID))).catch(() => {});
  }, [source]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? clients.filter((c) => (c.companyName + c.companyUserID).toLowerCase().includes(t)) : clients;
  }, [clients, q]);

  async function doCopy() {
    if (captcha && parseInt(answer) !== captcha.a - captcha.b) { setMsg("Wrong verification answer."); return; }
    setBusy(true); setMsg(null); setCaptcha(null);
    try {
      const r = await modulesApi.copy(connStr, target);
      if (r.success) onFlash(r.message || `Copied ${r.copiedCount} modules.`);
      else setMsg(r.message);
    } catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  }

  async function start() {
    if (!target) { setMsg("Select a target client."); return; }
    // gate destructive overwrite with a subtraction captcha (a-b, deterministic from ids)
    const a = 30 + (target.length % 20), b = 5 + (target.length % 8);
    setCaptcha({ a, b }); setAnswer("");
  }

  return (
    <div>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>Copy all modules from <b>{source?.companyName}</b> to another client (overwrites the target&apos;s modules).</div>
      {msg && <div style={{ color: "#8a6d1a", fontSize: 12.5, marginBottom: 8 }}>{msg}</div>}
      <div style={{ position: "relative", maxWidth: 360, marginBottom: 10 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: 10, opacity: 0.5 }} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search target client…" style={{ paddingLeft: 28 }} />
      </div>
      <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--bd-subtle,#eef1f6)", borderRadius: 10 }}>
        {filtered.map((c) => (
          <label key={c.companyUserID} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--bd-subtle,#f2f4f8)", cursor: "pointer" }}>
            <input type="radio" name="copytarget" checked={target === c.companyUserID} onChange={() => setTarget(c.companyUserID)} />
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{c.companyName}</div><div style={{ fontSize: 11, opacity: 0.55 }}>{c.companyUserID} · {c.applicationName}</div></div>
          </label>
        ))}
        {filtered.length === 0 && <div style={{ padding: 20, textAlign: "center", opacity: 0.6 }}>No clients.</div>}
      </div>

      {captcha ? (
        <div style={{ marginTop: 12, background: "#fdf3f3", border: "1px solid #f0c9c9", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#a12c2c", marginBottom: 8 }}>⚠ This overwrites the target&apos;s modules. Solve to confirm: {captcha.a} − {captcha.b} = ?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input value={answer} onChange={(e) => setAnswer(e.target.value)} style={{ width: 100 }} />
            <Button size="sm" onClick={doCopy} disabled={busy}>{busy ? "Copying…" : "Confirm Copy"}</Button>
            <Button size="sm" variant="outline" onClick={() => setCaptcha(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={start} disabled={busy} style={{ marginTop: 12 }}><Copy size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Copy to Selected</Button>
      )}
    </div>
  );
}

/* ── Tab 3: Module Group Authority ──────────────────────── */
export function ModuleGroupsTab({ app, connStr, onFlash }: { app: string; connStr: string; onFlash: (m: string) => void }) {
  const [groupApp, setGroupApp] = useState(app || "estimoprime");
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState("");
  const [mods, setMods] = useState<ModuleGroupModuleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setGroupApp(app || "estimoprime"); }, [app]);
  useEffect(() => {
    if (!groupApp) return;
    modulesApi.groups(groupApp).then((r) => setGroups(r.success ? r.data : [])).catch(() => setGroups([]));
    setGroup(""); setMods([]);
  }, [groupApp]);

  async function loadModules() {
    if (!group) return;
    setBusy(true); setMsg(null);
    try { const r = await modulesApi.groupModules(groupApp, group); setMods(r.success ? r.data : []); }
    catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  }
  async function apply() {
    if (!group || !connStr) { setMsg("Select a group; client connection required."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await modulesApi.applyGroup(groupApp, group, connStr);
      if (r.success) onFlash(r.message || `Applied ${r.totalModules} modules.`);
      else setMsg(r.message);
    } catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  }

  const grpLbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, opacity: 0.6, display: "block", marginBottom: 5 };
  const columns = useMemo<ColumnDef<ModuleGroupModuleRow>[]>(() => [
    { accessorKey: "moduleHeadName", header: "Module Head" },
    { accessorKey: "moduleDisplayName", header: "Display Name" },
    { accessorKey: "moduleName", header: "Module Name" },
  ], []);
  return (
    <div>
      {msg && <div style={{ color: "#8a6d1a", fontSize: 12.5, marginBottom: 8 }}>{msg}</div>}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ width: 220 }}>
          <label style={grpLbl}>Application</label>
          <Dropdown value={groupApp} onValueChange={(v) => setGroupApp(String(v))}
            options={APP_OPTIONS.map((a) => ({ value: a, label: appLbl(a) }))} size="md" />
        </div>
        <div style={{ width: 260 }}>
          <label style={grpLbl}>Module Group</label>
          <Dropdown value={group} onValueChange={(v) => setGroup(String(v))}
            options={groups.map((g) => ({ value: g, label: g }))}
            placeholder="— select —" searchable size="md" />
        </div>
        <Button size="sm" variant="outline" onClick={loadModules} disabled={!group || busy}>Load Modules</Button>
        <Button size="sm" onClick={apply} disabled={!group || busy} style={{ marginLeft: "auto" }}><Layers size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Apply to Client</Button>
      </div>
      {mods.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", opacity: 0.6, border: "1px solid var(--bd-subtle,#eef1f6)", borderRadius: 10 }}>Select a group and click “Load Modules”.</div>
      ) : (
        <DataGrid<ModuleGroupModuleRow> data={mods} columns={columns} getRowId={(r) => r.moduleName} title={`${group} — modules`} enableSearch enableSorting enablePagination pageSize={15} />
      )}
    </div>
  );
}

/* ── Tab 4: New Module Addition ─────────────────────────── */
const nmLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", marginBottom: 5 };
const nmInput: React.CSSProperties = { width: "100%", height: 38, padding: "0 12px", fontSize: 13, border: "1px solid #d8dee9", borderRadius: 9, background: "rgb(var(--bg-surface))", outline: "none", boxSizing: "border-box", color: "rgb(var(--fg-default))" };
const nmRO: React.CSSProperties = { background: "rgb(var(--bg-subtle))", color: "rgb(var(--fg-muted))", cursor: "not-allowed" };
function Req() { return <span style={{ color: "#e5484d" }}> *</span>; }
function NmErr({ text }: { text: string }) { return <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#e5484d" }}><AlertTriangle size={12} /> {text}</div>; }

/** Searchable text field with a filtered catalog dropdown (type freely or pick a suggestion). */
function SearchSelect({ label, required, value, placeholder, options, disabled, loading, icon, onType, onPick }: {
  label: string; required?: boolean; value: string; placeholder?: string; options: string[];
  disabled?: boolean; loading?: boolean; icon?: React.ReactNode; onType: (v: string) => void; onPick: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const filtered = options.filter((o) => o.toLowerCase().includes((value || "").toLowerCase())).slice(0, 60);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={nmLabel}>{label}{required && <Req />}</label>
      <div style={{ position: "relative" }}>
        {icon && <span style={{ position: "absolute", left: 10, top: 11, color: "rgb(var(--fg-subtle))" }}>{icon}</span>}
        <input value={value} placeholder={placeholder} disabled={disabled}
          onChange={(e) => { onType(e.target.value); setOpen(true); }} onFocus={() => !disabled && setOpen(true)}
          style={{ ...nmInput, paddingLeft: icon ? 32 : 12, paddingRight: 30, ...(disabled ? nmRO : {}) }} />
        {!disabled && <ChevronDown size={15} style={{ position: "absolute", right: 9, top: 11, color: "rgb(var(--fg-subtle))", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />}
      </div>
      {open && !disabled && (
        <div style={{ position: "absolute", zIndex: 30, top: "100%", left: 0, right: 0, marginTop: 4, background: "rgb(var(--bg-surface))", border: "1px solid #e3e8ef", borderRadius: 10, boxShadow: "0 12px 28px -12px rgba(16,24,40,.28)", maxHeight: 220, overflowY: "auto" }}>
          {loading ? <div style={{ padding: 12, textAlign: "center", color: "rgb(var(--fg-subtle))", fontSize: 12.5 }}>Loading…</div>
            : filtered.length === 0 ? <div style={{ padding: 12, textAlign: "center", color: "rgb(var(--fg-subtle))", fontSize: 12.5 }}>{value ? "New — will be created" : "No matches"}</div>
            : filtered.map((o) => (
              <button key={o} type="button" onMouseDown={(e) => { e.preventDefault(); onPick(o); setOpen(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12.5, background: "none", border: "none", cursor: "pointer", color: "rgb(var(--fg-default))" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#eef4fb")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                {o}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

type NmForm = {
  moduleName: string; moduleDisplayName: string; moduleHeadName: string; moduleHeadDisplayName: string;
  setGroupIndex: string; moduleHeadDisplayOrder: string; moduleDisplayOrder: string;
  printWebPage: string; printDocName: string; fYear: string;
};
const NM_EMPTY: NmForm = { moduleName: "", moduleDisplayName: "", moduleHeadName: "", moduleHeadDisplayName: "", setGroupIndex: "", moduleHeadDisplayOrder: "", moduleDisplayOrder: "", printWebPage: "", printDocName: "", fYear: "" };

export function NewModuleTab({ app, connStr, onFlash }: { app: string; connStr: string; onFlash: (m: string) => void }) {
  const [rows, setRows] = useState<ClientModuleDto[]>([]);
  const [catalog, setCatalog] = useState<ClientModuleDto[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [locked, setLocked] = useState(false); // Set Group Index locked (head already exists in client)
  const [f, setF] = useState<NmForm>(NM_EMPTY);

  const load = useCallback(async () => {
    if (!connStr) return;
    setLoading(true); setMsg(null);
    try { const r = await modulesApi.clientModules(connStr); setRows(r.success ? r.data : []); if (!r.success) setMsg((r as { message?: string }).message ?? "Load failed"); }
    catch (e) { setMsg(String(e)); } finally { setLoading(false); }
  }, [connStr]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!app) return;
    setCatLoading(true);
    modulesApi.catalogRich(app).then((r) => setCatalog(r.success ? r.data : [])).catch(() => {}).finally(() => setCatLoading(false));
  }, [app]);

  // Financial year (Apr–Mar), same rule as BulkImport's GetSystemDefaults.
  const fyDefault = () => { const n = new Date(); return n.getMonth() >= 3 ? `${n.getFullYear()}-${n.getFullYear() + 1}` : `${n.getFullYear() - 1}-${n.getFullYear()}`; };
  const upd = (patch: Partial<NmForm>) => setF((p) => ({ ...p, ...patch }));

  // dropdown option lists
  const catalogHeads = useMemo(() => (Array.from(new Set(catalog.map((m) => m.moduleHeadName).filter(Boolean))) as string[]).sort(), [catalog]);
  const clientHeads = useMemo(() => (Array.from(new Set(rows.map((m) => m.moduleHeadName).filter(Boolean))) as string[]).sort(), [rows]);
  const catalogNames = useMemo(() => Array.from(new Set(catalog.filter((m) => !f.moduleHeadName || m.moduleHeadName === f.moduleHeadName).map((m) => m.moduleName).filter(Boolean))) as string[], [catalog, f.moduleHeadName]);
  const catalogDisplays = useMemo(() => Array.from(new Set(catalog.filter((m) => !f.moduleHeadName || m.moduleHeadName === f.moduleHeadName).map((m) => m.moduleDisplayName).filter(Boolean))) as string[], [catalog, f.moduleHeadName]);

  function openCreate() { setEditId(null); setCustomMode(false); setLocked(false); setF({ ...NM_EMPTY, fYear: fyDefault() }); setMsg(null); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditId(null); setLocked(false); setF(NM_EMPTY); }

  // ── auto-fill handlers (client-side port of GetIndusModuleInfoForClient) ──
  function onHeadSelect(head: string) {
    const inClient = rows.find((m) => m.moduleHeadName === head);
    const inCat = catalog.find((m) => m.moduleHeadName === head);
    upd({
      moduleHeadName: head,
      moduleHeadDisplayName: inClient?.moduleHeadDisplayName || inCat?.moduleHeadDisplayName || head,
      setGroupIndex: inClient?.setGroupIndex != null ? String(inClient.setGroupIndex) : (inCat?.setGroupIndex != null ? String(inCat.setGroupIndex) : ""),
      moduleName: "", moduleDisplayName: "",
    });
    setLocked(!!inClient);
  }
  function onNameSelect(name: string) {
    const c = catalog.find((m) => m.moduleName === name);
    if (!c) { upd({ moduleName: name }); return; }
    const head = c.moduleHeadName || "";
    const inClient = rows.find((m) => m.moduleHeadName === head);
    let order = c.moduleHeadDisplayOrder != null ? c.moduleHeadDisplayOrder : 1;
    if (inClient) {
      const sgi = inClient.setGroupIndex;
      order = rows.filter((m) => m.setGroupIndex === sgi).reduce((mx, m) => Math.max(mx, m.moduleHeadDisplayOrder ?? 0), 0) + 1;
    }
    upd({
      moduleName: c.moduleName,
      moduleDisplayName: c.moduleDisplayName || "",
      moduleHeadName: head,
      moduleHeadDisplayName: inClient?.moduleHeadDisplayName || c.moduleHeadDisplayName || head,
      setGroupIndex: inClient?.setGroupIndex != null ? String(inClient.setGroupIndex) : (c.setGroupIndex != null ? String(c.setGroupIndex) : ""),
      moduleHeadDisplayOrder: String(order), moduleDisplayOrder: String(order),
    });
    setLocked(!!inClient);
  }
  function onDisplaySelect(display: string) {
    const c = catalog.find((m) => m.moduleDisplayName === display);
    if (c) onNameSelect(c.moduleName || ""); else upd({ moduleDisplayName: display });
  }
  function onCustomHeadSelect(head: string) {
    const group = rows.filter((m) => m.moduleHeadName === head);
    const first = group[0];
    if (!first) { upd({ moduleHeadName: head }); setLocked(false); return; }
    const sgi = first.setGroupIndex;
    const next = rows.filter((m) => m.setGroupIndex === sgi).reduce((mx, m) => Math.max(mx, m.moduleHeadDisplayOrder ?? 0), 0) + 1;
    upd({ moduleHeadName: head, moduleHeadDisplayName: first.moduleHeadDisplayName || head, setGroupIndex: sgi != null ? String(sgi) : "", moduleHeadDisplayOrder: String(next), moduleDisplayOrder: String(next) });
    setLocked(sgi != null);
  }
  function onHeadType(v: string) {
    const inClient = rows.find((m) => (m.moduleHeadName || "").toLowerCase() === v.toLowerCase());
    upd({ moduleHeadName: v, ...(inClient ? { setGroupIndex: String(inClient.setGroupIndex), moduleHeadDisplayName: inClient.moduleHeadDisplayName || v } : {}) });
    setLocked(!!inClient);
  }
  function onOrderChange(v: string) { upd({ moduleHeadDisplayOrder: v, moduleDisplayOrder: v }); } // Module Display Order mirrors Head Display Order

  // ── live validation (client-side, from the loaded client modules) ──
  const sgiNum = parseInt(f.setGroupIndex), ordNum = parseInt(f.moduleHeadDisplayOrder);
  const nameExists = !editId && !!f.moduleName.trim() && rows.some((m) => (m.moduleName || "").toLowerCase() === f.moduleName.trim().toLowerCase());
  const orderShift = !isNaN(ordNum) && !isNaN(sgiNum) && rows.some((m) => m.moduleHeadDisplayOrder === ordNum && m.setGroupIndex === sgiNum && m.moduleId !== editId);
  const groupIndexClash = !isNaN(sgiNum) && rows.some((m) => m.setGroupIndex === sgiNum && (m.moduleHeadName || "") !== f.moduleHeadName && m.moduleId !== editId);

  async function save() {
    if (!f.moduleName.trim() || !f.setGroupIndex || !f.moduleHeadDisplayOrder) { setMsg("Module Name, Set Group Index and Head Display Order are required."); return; }
    if (groupIndexClash) { setMsg("This Set Group Index is already assigned to another Module Head."); return; }
    setBusy(true); setMsg(null);
    const payload: Partial<ClientModuleDto> = {
      moduleId: editId ?? 0,
      moduleName: f.moduleName.trim(),
      moduleDisplayName: f.moduleDisplayName.trim() || f.moduleName.trim(),
      moduleHeadName: f.moduleHeadName.trim() || null,
      moduleHeadDisplayName: f.moduleHeadDisplayName.trim() || null,
      moduleHeadDisplayOrder: parseInt(f.moduleHeadDisplayOrder),
      moduleDisplayOrder: parseInt(f.moduleDisplayOrder || f.moduleHeadDisplayOrder),
      setGroupIndex: parseInt(f.setGroupIndex),
    };
    try {
      const r = editId ? await modulesApi.updateClientModule(connStr, payload) : await modulesApi.createClientModule(connStr, payload);
      if (r.success) { onFlash(r.message || (editId ? "Module updated." : "Module created.")); closeForm(); await load(); }
      else setMsg(r.message);
    } catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  }
  function editRow(row: ClientModuleDto) {
    setEditId(row.moduleId); setCustomMode(false); setLocked(false);
    setF({
      moduleName: row.moduleName || "", moduleDisplayName: row.moduleDisplayName || "",
      moduleHeadName: row.moduleHeadName || "", moduleHeadDisplayName: row.moduleHeadDisplayName || "",
      setGroupIndex: row.setGroupIndex != null ? String(row.setGroupIndex) : "",
      moduleHeadDisplayOrder: row.moduleHeadDisplayOrder != null ? String(row.moduleHeadDisplayOrder) : "",
      moduleDisplayOrder: row.moduleDisplayOrder != null ? String(row.moduleDisplayOrder) : "",
      printWebPage: "", printDocName: "", fYear: fyDefault(),
    });
    setMsg(null); setShowForm(true);
  }
  async function remove(id: number) {
    setBusy(true);
    try { const r = await modulesApi.deleteClientModule(connStr, id); if (r.success) { onFlash("Module removed."); await load(); } else setMsg(r.message); }
    catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  }

  const columns = useMemo<ColumnDef<ClientModuleDto>[]>(() => [
    { accessorKey: "moduleHeadName", header: "Module Head" },
    { accessorKey: "moduleDisplayName", header: "Display Name" },
    { accessorKey: "moduleName", header: "Module Name" },
    { accessorKey: "setGroupIndex", header: "Group Index", size: 90 },
    { accessorKey: "moduleHeadDisplayOrder", header: "Order", size: 70 },
    {
      id: "actions", header: "", size: 96,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: 4 }}>
          <Button size="sm" variant="ghost" title="Edit" onClick={() => editRow(row.original)}><Pencil size={13} /></Button>
          <Button size="sm" variant="ghost" title="Remove" onClick={() => remove(row.original.moduleId)}><Trash2 size={13} /></Button>
        </div>
      ),
    },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, opacity: 0.65 }}>{rows.length} module(s) in client DB</span>
        <Button size="sm" onClick={() => (showForm ? closeForm() : openCreate())} style={{ marginLeft: "auto" }}>
          {showForm ? "Close" : <><Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Create Module</>}
        </Button>
      </div>
      {msg && <div style={{ color: "#8a6d1a", fontSize: 12.5, marginBottom: 8 }}>{msg}</div>}

      {showForm && (
        <div style={{ border: "1px solid #e6ebf2", borderRadius: 14, padding: 16, marginBottom: 14, background: "rgb(var(--bg-subtle))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(var(--fg-default))" }}>{editId ? "Edit Module" : "Add New Module"}</div>
            {!editId && (
              <div style={{ display: "inline-flex", gap: 4, background: "rgb(var(--bg-subtle))", borderRadius: 10, padding: 3 }}>
                <button type="button" onClick={() => { setCustomMode(false); setLocked(false); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: !customMode ? "rgb(var(--color-primary))" : "transparent", color: !customMode ? "#fff" : "#5b6b7f" }}>
                  <Layers size={12} /> From Catalog
                </button>
                <button type="button" onClick={() => { setCustomMode(true); setLocked(false); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: customMode ? "rgb(var(--color-primary))" : "transparent", color: customMode ? "#fff" : "#5b6b7f" }}>
                  <Plus size={12} /> New / Custom
                </button>
              </div>
            )}
            <button type="button" onClick={() => { setF({ ...NM_EMPTY, fYear: fyDefault() }); setLocked(false); }} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "rgb(var(--fg-muted))", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <RotateCcw size={13} /> Reset
            </button>
          </div>

          {customMode && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 12px", fontSize: 11.5, color: "rgb(var(--fg-muted))", background: "#eaf3fb", border: "1px solid #d3e6f6", borderRadius: 9 }}>
              <Info size={14} /> New module added to this client only. Pick an existing head to auto-fill its group, or type a new one.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Module Identity */}
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              {customMode
                ? <SearchSelect label="Module Head Name" value={f.moduleHeadName} options={clientHeads} placeholder="Pick existing or type new…" icon={<Search size={14} />} onType={onHeadType} onPick={onCustomHeadSelect} />
                : <SearchSelect label="Module Head Name" value={f.moduleHeadName} options={catalogHeads} loading={catLoading} placeholder="Search categories…" icon={<Search size={14} />} onType={onHeadType} onPick={onHeadSelect} />}

              {customMode
                ? <div><label style={nmLabel}>Module Display Name</label><input value={f.moduleDisplayName} placeholder="How it appears in menus…" style={nmInput} onChange={(e) => upd({ moduleDisplayName: e.target.value })} /></div>
                : <SearchSelect label="Module Display Name" value={f.moduleDisplayName} options={catalogDisplays} placeholder="How it appears in menus…" onType={(v) => upd({ moduleDisplayName: v })} onPick={onDisplaySelect} />}

              {editId
                ? <div><label style={nmLabel}>Module Name (Filename)<Req /></label><input value={f.moduleName} readOnly style={{ ...nmInput, ...nmRO }} /></div>
                : customMode
                  ? <div><label style={nmLabel}>Module Name (Filename)<Req /></label><input value={f.moduleName} placeholder="e.g. SalesReport.aspx" style={{ ...nmInput, borderColor: nameExists ? "#e5484d" : "#d8dee9" }} onChange={(e) => upd({ moduleName: e.target.value })} />{nameExists && <NmErr text="Module already exists in this database." />}</div>
                  : <div><SearchSelect label="Module Name (Filename)" required value={f.moduleName} options={catalogNames} placeholder="e.g. LedgerMaster.aspx" icon={<PackagePlus size={14} />} onType={(v) => upd({ moduleName: v })} onPick={onNameSelect} />{nameExists && <NmErr text="Module already exists in this database." />}</div>}
            </div>

            {/* Head / Order / Print */}
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={nmLabel}>Head Display Name</label><input value={f.moduleHeadDisplayName} readOnly={!customMode} onChange={(e) => upd({ moduleHeadDisplayName: e.target.value })} style={{ ...nmInput, ...(!customMode ? nmRO : {}) }} /></div>
                <div><label style={nmLabel}>Set Group Index<Req /></label>
                  <div style={{ position: "relative" }}>
                    <input type="number" value={f.setGroupIndex} readOnly={locked} onChange={(e) => upd({ setGroupIndex: e.target.value })} style={{ ...nmInput, borderColor: groupIndexClash ? "#e5484d" : "#d8dee9", ...(locked ? nmRO : {}) }} />
                    {locked && <CheckCircle2 size={15} style={{ position: "absolute", right: 9, top: 11, color: "#12a150" }} />}
                  </div>
                  {groupIndexClash && <NmErr text="Index already used by another Module Head." />}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={nmLabel}>Head Display Order<Req /></label><input type="number" value={f.moduleHeadDisplayOrder} onChange={(e) => onOrderChange(e.target.value)} style={{ ...nmInput, borderColor: orderShift ? "#e0a83a" : "#d8dee9" }} />{orderShift && <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#b7791f" }}><Info size={12} /> In use — existing will shift by +1.</div>}</div>
                <div><label style={nmLabel}>Module Display Order</label><input type="number" value={f.moduleDisplayOrder} readOnly style={{ ...nmInput, ...nmRO }} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}><label style={nmLabel}>Print Web Page (optional)</label><input value={f.printWebPage} placeholder="Enter URL…" style={nmInput} onChange={(e) => upd({ printWebPage: e.target.value })} /></div>
                <div><label style={nmLabel}>Document Name</label><input value={f.printDocName} placeholder="Common name…" style={nmInput} onChange={(e) => upd({ printDocName: e.target.value })} /></div>
                <div><label style={nmLabel}>F-Year</label><input value={f.fYear} style={nmInput} onChange={(e) => upd({ fYear: e.target.value })} /></div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            <Button size="sm" variant="outline" onClick={closeForm}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={busy}><Save size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{busy ? "Saving…" : editId ? "Update Module" : "Save Module"}</Button>
          </div>
        </div>
      )}

      {loading ? <div style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>Loading…</div> : (
        <DataGrid<ClientModuleDto>
          data={rows}
          columns={columns}
          getRowId={(r) => String(r.moduleId)}
          title="Client Modules"
          enableSearch
          enableSorting
          enablePagination
          pageSize={15}
        />
      )}
    </div>
  );
}

/* ── Tab 5: Indus Tool Authority ────────────────────────── */
export function ToolAuthorityTab({ customer, onFlash }: { customer: CustomerCard | null; onFlash: (m: string) => void }) {
  const [rows, setRows] = useState<IndusToolModuleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!customer) return;
    setLoading(true); setMsg(null);
    try { const r = await modulesApi.toolAuthority(customer.companyUserID); setRows(r.success ? r.data : []); if (!r.success) setMsg(r.message ?? "Load failed"); }
    catch (e) { setMsg(String(e)); } finally { setLoading(false); }
  }, [customer]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id: number) => setRows((p) => p.map((r) => r.moduleID === id ? { ...r, isEnabled: !r.isEnabled } : r));
  async function save() {
    if (!customer) return;
    setSaving(true); setMsg(null);
    try {
      const ids = rows.filter((r) => r.isEnabled).map((r) => r.moduleID);
      const r = await modulesApi.saveToolAuthority(customer.companyUserID, ids);
      if (r.success) onFlash(r.message || "Authority saved."); else setMsg(r.message);
    } catch (e) { setMsg(String(e)); } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, opacity: 0.65 }}>Which Indus-tool modules {customer?.companyName} can access.</span>
        <Button size="sm" onClick={save} disabled={saving || rows.length === 0} style={{ marginLeft: "auto" }}><ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{saving ? "Saving…" : "Save Authority"}</Button>
      </div>
      {msg && <div style={{ color: "#8a6d1a", fontSize: 12.5, marginBottom: 8 }}>{msg}</div>}
      {loading ? <div style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>Loading…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {rows.map((r) => (
            <label key={r.moduleID} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--bd-subtle,#eef1f6)", borderRadius: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={r.isEnabled} onChange={() => toggle(r.moduleID)} />
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>{r.moduleName}</div>{r.modulePath && <div style={{ fontSize: 11, opacity: 0.55, fontFamily: "monospace" }}>{r.modulePath}</div>}</div>
            </label>
          ))}
          {rows.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 20, textAlign: "center", opacity: 0.6 }}>No Indus-tool modules found (IndusToolModuleMaster is populated in the production Indus DB).</div>}
        </div>
      )}
    </div>
  );
}
