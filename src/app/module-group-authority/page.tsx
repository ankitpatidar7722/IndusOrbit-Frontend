"use client";
import { useEffect, useMemo, useState } from "react";
import { Page, Dropdown, StandardModal, useModalAlert, Button } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Layers, Plus, Pencil, Trash2, RefreshCw, Save, Search, CheckSquare, Square } from "lucide-react";
import { DataGrid } from "@/components/datagrid";
import { modulesApi, type ModuleGroupModuleRow } from "@/lib/modules";

// Application names are a fixed set (they must match ModuleGroupMaster.ApplicationName +
// the per-app master catalog table on the server). Same three as the source system.
const APP_OPTIONS = [
  { value: "estimoprime", label: "Estimoprime" },
  { value: "PrintudeERP", label: "PrintudeERP" },
  { value: "MultiUnit", label: "MultiUnit" },
];

const T = {
  primary: "rgb(var(--color-primary))",
  fg: "#16202e",
  muted: "#5b6b7f",
  faint: "#9aa7b4",
  bd: "#d6dbe3",
  surface: "#fff",
};
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))", letterSpacing: 0.1, marginBottom: 6 };
const inputCss: React.CSSProperties = { width: "100%", height: 40, padding: "0 12px", fontSize: 13.5, border: `1px solid ${T.bd}`, borderRadius: 9, outline: "none", background: "rgb(var(--bg-surface))", color: T.fg, boxSizing: "border-box" };

export default function ModuleGroupAuthorityPage() {
  const { showSuccess, showError, AlertComponent } = useModalAlert();

  const [app, setApp] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState("");
  const [mods, setMods] = useState<ModuleGroupModuleRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingMods, setLoadingMods] = useState(false);

  // create / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [mApp, setMApp] = useState("estimoprime");
  const [mName, setMName] = useState("");
  const [available, setAvailable] = useState<ModuleGroupModuleRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mSearch, setMSearch] = useState("");
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [saving, setSaving] = useState(false);

  // delete-auth modal
  const [delOpen, setDelOpen] = useState(false);
  const [delUser, setDelUser] = useState("");
  const [delPass, setDelPass] = useState("");
  const [delReason, setDelReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  // load groups when the application changes
  useEffect(() => {
    setGroup(""); setMods([]); setLoaded(false);
    if (!app) { setGroups([]); return; }
    modulesApi.groups(app).then((r) => setGroups(r.success ? r.data : [])).catch(() => setGroups([]));
  }, [app]);

  // (re)load the available-module catalog for the modal's application
  const loadAvailable = (a: string) => {
    setLoadingAvail(true);
    modulesApi.availableModules(a)
      .then((r) => setAvailable(r.success ? r.data : []))
      .catch(() => setAvailable([]))
      .finally(() => setLoadingAvail(false));
  };

  const loadModules = async () => {
    if (!app || !group) return;
    setLoadingMods(true);
    try {
      const r = await modulesApi.groupModules(app, group);
      setMods(r.success ? r.data : []); setLoaded(true);
    } catch { setMods([]); setLoaded(true); }
    finally { setLoadingMods(false); }
  };

  const openCreate = () => {
    setEditMode(false); setMApp(app || "estimoprime"); setMName(""); setSelected(new Set()); setMSearch("");
    loadAvailable(app || "estimoprime");
    setModalOpen(true);
  };

  const openEdit = async () => {
    if (!app || !group) { showError("Select a group", "Pick an application and module group to edit first."); return; }
    setEditMode(true); setMApp(app); setMName(group); setMSearch("");
    loadAvailable(app);
    try {
      const r = await modulesApi.groupModules(app, group);
      setSelected(new Set((r.success ? r.data : []).map((m) => m.moduleName)));
    } catch { setSelected(new Set()); }
    setModalOpen(true);
  };

  // in create mode, changing the modal's application reloads its catalog + clears selection
  useEffect(() => {
    if (modalOpen && !editMode) { loadAvailable(mApp); setSelected(new Set()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mApp]);

  const toggle = (name: string) => setSelected((p) => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const filteredAvail = useMemo(() => {
    const q = mSearch.trim().toLowerCase();
    if (!q) return available;
    return available.filter((m) => `${m.moduleHeadName} ${m.moduleDisplayName} ${m.moduleName}`.toLowerCase().includes(q));
  }, [available, mSearch]);
  const allShownSelected = filteredAvail.length > 0 && filteredAvail.every((m) => selected.has(m.moduleName));
  const toggleAllShown = () => setSelected((p) => {
    const n = new Set(p);
    if (allShownSelected) filteredAvail.forEach((m) => n.delete(m.moduleName));
    else filteredAvail.forEach((m) => n.add(m.moduleName));
    return n;
  });

  const saveGroup = async () => {
    if (!mName.trim()) { showError("Group name required", "Please enter a module group name."); return; }
    if (selected.size === 0) { showError("Select modules", "Pick at least one module for the group."); return; }
    setSaving(true);
    try {
      const names = Array.from(selected);
      const r = editMode
        ? await modulesApi.updateGroup(mApp, mName.trim(), names)
        : await modulesApi.createGroup(mApp, mName.trim(), names);
      if (r.success) {
        showSuccess(editMode ? "Group updated" : "Group created", r.message || "Saved.", 2500);
        setModalOpen(false);
        // refresh the group dropdown for the current app; if we edited the active group, reload its modules
        if (mApp === app) {
          const g = await modulesApi.groups(app);
          setGroups(g.success ? g.data : []);
          if (editMode && mName.trim() === group) await loadModules();
        }
      } else showError("Save failed", r.message || "Unknown error.");
    } catch (e) { showError("Save failed", String(e instanceof Error ? e.message : e)); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!delUser.trim() || !delPass.trim()) { showError("Credentials required", "Enter your username and password."); return; }
    if (!delReason.trim()) { showError("Reason required", "Please enter a reason for deletion."); return; }
    setDeleting(true);
    try {
      const r = await modulesApi.deleteGroup({ applicationName: app, moduleGroupName: group, userName: delUser.trim(), password: delPass, reason: delReason.trim() });
      if (r.success) {
        showSuccess("Group deleted", r.message || "Deleted.", 2500);
        setDelOpen(false); setDelUser(""); setDelPass(""); setDelReason("");
        const g = await modulesApi.groups(app);
        setGroups(g.success ? g.data : []);
        setGroup(""); setMods([]); setLoaded(false);
      } else showError("Delete failed", r.message || "Unknown error.");
    } catch (e) { showError("Delete failed", String(e instanceof Error ? e.message : e)); }
    finally { setDeleting(false); }
  };

  const columns = useMemo<ColumnDef<ModuleGroupModuleRow>[]>(() => [
    { accessorKey: "moduleHeadName", header: "Module Head Name", size: 320 },
    { accessorKey: "moduleDisplayName", header: "Module Display Name", size: 420 },
  ], []);

  return (
    <Page>
      <AlertComponent />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: T.primary, display: "grid", placeItems: "center", flexShrink: 0 }}><Layers size={22} color="#fff" /></div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "rgb(var(--fg-default))", margin: 0 }}>Module Group Authority</h1>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>Manage module groups by application</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="primary" icon={Plus} onClick={openCreate}>Create Group</Button>
          <Button variant="secondary" icon={Pencil} style={{ background: "#86efac", color: "#14532d", border: "none" }} onClick={openEdit}>Edit Group</Button>
          <Button variant="secondary" icon={Trash2} style={{ background: "#f87171", color: "#ffffff", border: "none" }} onClick={() => { if (!group) { showError("Select a group", "Pick an application and module group to delete first."); return; } setDelOpen(true); }}>Delete Group</Button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, background: T.surface, border: `1px solid ${T.bd}`, borderRadius: 12, padding: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label style={lbl}>Application Name</label>
          <Dropdown value={app} onValueChange={(v) => setApp(String(v))} options={APP_OPTIONS} placeholder="Select Application Name" size="md" />
        </div>
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label style={lbl}>Module Group</label>
          <Dropdown value={group} onValueChange={(v) => setGroup(String(v))}
            options={groups.map((g) => ({ value: g, label: g }))}
            placeholder={app ? "Select Module Group" : "Select an application first"} searchable size="md" />
        </div>
        <Button variant="primary" icon={RefreshCw} loading={loadingMods} disabled={!group || loadingMods} onClick={loadModules}>
          Load Module
        </Button>
      </div>

      {/* Loaded modules */}
      <div style={{ marginTop: 18 }}>
        {loaded && mods.length > 0 ? (
          <div style={{ border: `1px solid ${T.bd}`, borderRadius: 12, overflow: "hidden", background: "rgb(var(--bg-surface))" }}>
            <DataGrid<ModuleGroupModuleRow>
              data={mods}
              columns={columns}
              getRowId={(r) => r.moduleName}
              title={`Modules in "${group}"`}
              mainColumns="moduleHeadName"
              enableSorting enableSearch enableFilterRow enableExport enablePagination
            />
          </div>
        ) : (
          <div style={{ border: `1px dashed ${T.bd}`, borderRadius: 12, padding: "60px 20px", textAlign: "center", color: T.faint, background: "rgb(var(--bg-subtle))" }}>
            <Layers size={44} style={{ opacity: 0.4 }} />
            <div style={{ fontWeight: 700, color: T.muted, marginTop: 10 }}>{loaded ? "This group has no modules" : "No Modules Loaded"}</div>
            <div style={{ fontSize: 13, marginTop: 3 }}>Select a Module Group and click &quot;Load Module&quot; to view modules.</div>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <StandardModal
        isOpen={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false); }}
        title={editMode ? "Edit Module Group" : "Create Module Group"}
        subtitle={editMode ? `Editing "${mName}"` : "Define a new group and pick its modules"}
        size="xl"
        showFooter
        onSave={saveGroup}
        onCancel={() => setModalOpen(false)}
        saveLabel={saving ? "Saving…" : (editMode ? "Update Group" : "Create Group")}
        saveIcon={Save}
        saving={saving}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={lbl}>Application Name</label>
              {editMode
                ? <input value={APP_OPTIONS.find((o) => o.value === mApp)?.label ?? mApp} readOnly style={{ ...inputCss, background: "rgb(var(--bg-subtle))", color: "rgb(var(--fg-muted))" }} />
                : <Dropdown value={mApp} onValueChange={(v) => setMApp(String(v))} options={APP_OPTIONS} size="md" />}
            </div>
            <div>
              <label style={lbl}>Module Group Name</label>
              <input value={mName} onChange={(e) => setMName(e.target.value)} readOnly={editMode}
                placeholder="e.g. Sales Package" style={editMode ? { ...inputCss, background: "rgb(var(--bg-subtle))", color: "rgb(var(--fg-muted))" } : inputCss} />
            </div>
          </div>

          {/* Module selector */}
          <div style={{ border: `1px solid ${T.bd}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "rgb(var(--bg-subtle))", borderBottom: `1px solid ${T.bd}` }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: T.fg }}>
                Select Modules <span style={{ color: T.primary }}>({selected.size})</span>
              </div>
              <div style={{ position: "relative", marginLeft: "auto", width: 240 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 9, opacity: 0.5 }} />
                <input value={mSearch} onChange={(e) => setMSearch(e.target.value)} placeholder="Search modules…"
                  style={{ ...inputCss, height: 32, paddingLeft: 30, fontSize: 12.5 }} />
              </div>
              <button type="button" onClick={toggleAllShown}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${T.bd}`, background: "rgb(var(--bg-surface))", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: T.fg }}>
                {allShownSelected ? <CheckSquare size={14} /> : <Square size={14} />} {allShownSelected ? "Unselect all" : "Select all"}
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {loadingAvail ? (
                <div style={{ padding: 30, textAlign: "center", color: T.faint }}>Loading modules…</div>
              ) : filteredAvail.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: T.faint }}>No modules found.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgb(var(--bg-subtle))" }}>
                      <th style={{ width: 44 }}></th>
                      <th style={{ textAlign: "left", padding: "7px 8px", fontSize: 11, fontWeight: 700, color: T.muted }}>Module Head</th>
                      <th style={{ textAlign: "left", padding: "7px 8px", fontSize: 11, fontWeight: 700, color: T.muted }}>Module Display Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAvail.map((m) => {
                      const on = selected.has(m.moduleName);
                      return (
                        <tr key={m.moduleName} onClick={() => toggle(m.moduleName)}
                          style={{ borderTop: `1px solid #f1f4f8`, cursor: "pointer", background: on ? "rgb(var(--color-primary) / 0.06)" : "transparent" }}>
                          <td style={{ textAlign: "center", padding: "6px 8px" }}>
                            <input type="checkbox" checked={on} onChange={() => toggle(m.moduleName)} onClick={(e) => e.stopPropagation()} style={{ cursor: "pointer", accentColor: T.primary, width: 15, height: 15 }} />
                          </td>
                          <td style={{ padding: "6px 8px", fontSize: 12.5, color: T.muted }}>{m.moduleHeadName || "—"}</td>
                          <td style={{ padding: "6px 8px", fontSize: 12.5, color: T.fg }}>{m.moduleDisplayName || m.moduleName}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </StandardModal>

      {/* Delete-auth modal */}
      <StandardModal
        isOpen={delOpen}
        onClose={() => { if (!deleting) setDelOpen(false); }}
        title="Delete Module Group"
        subtitle={group ? `"${group}" — this permanently removes the group` : undefined}
        size="md"
        showFooter
        onSave={confirmDelete}
        onCancel={() => setDelOpen(false)}
        saveLabel={deleting ? "Deleting…" : "Delete Group"}
        saveIcon={Trash2}
        saving={deleting}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 12.5, color: "#8a5a00", background: "#fff8e6", border: "1px solid #f2e2b8", borderRadius: 8, padding: "8px 12px" }}>
            Deleting a group is permanent. Confirm with your <b>Indus Command Center login</b> (email or name) + password and a reason — this is recorded in the audit log.
          </div>
          <div><label style={lbl}>User Name / Email</label><input value={delUser} onChange={(e) => setDelUser(e.target.value)} style={inputCss} placeholder="your login email or name" autoComplete="off" /></div>
          <div><label style={lbl}>Password</label><input type="password" value={delPass} onChange={(e) => setDelPass(e.target.value)} style={inputCss} autoComplete="new-password" /></div>
          <div><label style={lbl}>Reason for Deletion</label><textarea value={delReason} onChange={(e) => setDelReason(e.target.value)} rows={3} style={{ ...inputCss, height: "auto", padding: "10px 12px", resize: "vertical" }} /></div>
        </div>
      </StandardModal>
    </Page>
  );
}
