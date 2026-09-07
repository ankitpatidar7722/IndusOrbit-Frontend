"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Page, StandardModal, Badge, Button, Dropdown, useModalAlert, useDevice } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import type { ColumnDef } from "@tanstack/react-table";
import { ShieldCheck, Save, UserPlus, Mail, Eye, EyeOff, User, Users, Bold, Italic, Underline, List, ListOrdered, Link2, FileSignature, Image as ImageIcon, Trash2, Copy, XCircle, CheckCircle2, Circle, KeyRound } from "lucide-react";
import { PERMISSION_CATALOG } from "@/lib/featurePermissions";
import { insertImageFile } from "@/lib/imageEmbed";
// Full-featured grid migrated from the legacy Parkson project (owned source).
import { DataGrid, createActionsColumn } from "@/components/datagrid";
import {
  usersApi, type UserListRow, type UserLookups, type ModuleAuthRow, type UserSave,
} from "@/lib/users";

// ── shared bits ──────────────────────────────────────────
const AVATARS = ["rgb(var(--color-primary))", "#0f6a72", "#553c9a", "#b45309", "#276749", "#9b2c5a"];
function avatarBg(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVATARS[h % AVATARS.length]; }
function initials(n?: string | null) { const p = (n || "?").trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?"; }
const roleVariant = (r?: string | null): "info" | "success" | "warning" | "default" => {
  const x = (r || "").toLowerCase();
  if (x.includes("admin")) return "warning";
  if (x.includes("manager")) return "success";
  if (x.includes("develop") || x.includes("test")) return "info";
  return "default";
};

const fldLabel: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "rgb(var(--fg-muted))", marginBottom: 5 };
const fldInput: React.CSSProperties = { width: "100%", height: 40, padding: "0 12px", fontSize: 13.5, border: "1px solid #9fabbd", borderRadius: 9, background: "rgb(var(--bg-surface))", outline: "none", boxSizing: "border-box", color: "rgb(var(--fg-default))" };

/** Status pill — Active = green, Inactive = red (same style as the Clients grid's ERP/Cloud status). */
function statusPill(active: boolean) {
  const c = active
    ? { bg: "#e6f6ec", fg: "#1c8a4a", bd: "#b7e2c6" }
    : { bg: "#fdecec", fg: "#c0392b", bd: "#f4c9c9" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 700, padding: "3px 12px", borderRadius: 999, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, whiteSpace: "nowrap" }}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

const PERMS = [
  { key: "canView", label: "Can View" }, { key: "canSave", label: "Can Save" }, { key: "canEdit", label: "Can Edit" },
  { key: "canDelete", label: "Can Delete" }, { key: "canExport", label: "Can Export" }, { key: "canPrint", label: "Can Print" },
  { key: "canCancel", label: "Can Cancel" },
] as const;
type PermKey = typeof PERMS[number]["key"];

// ── Module Authentication matrix ─────────────────────────
// Imperative handle so the modal's single footer "Update" can persist the matrix along with the
// profile — the matrix no longer owns a Save button (all saving happens from the shared footer).
type ModuleMatrixHandle = { save: (overrideUserId?: number) => Promise<{ success: boolean; message?: string }>; hasRows: boolean };

// `blankPerms` (Create flow) → show the FULL module list but with every checkbox unchecked.
const ModuleMatrix = forwardRef<ModuleMatrixHandle, { userId: number; blankPerms?: boolean }>(function ModuleMatrix({ userId, blankPerms }, ref) {
  const { isMobile } = useDevice();
  const [rows, setRows] = useState<ModuleAuthRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    usersApi.getModules(userId)
      .then((r) => {
        const data = r.success ? r.data : [];
        setRows(blankPerms
          ? data.map((m) => ({ ...m, canView: false, canSave: false, canEdit: false, canDelete: false, canPrint: false, canExport: false, canCancel: false }))
          : data);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [userId, blankPerms]);

  const setCell = (i: number, k: PermKey, v: boolean) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const setRowAll = (i: number, v: boolean) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, canView: v, canSave: v, canEdit: v, canDelete: v, canPrint: v, canExport: v, canCancel: v } : r));
  const setColAll = (k: PermKey, v: boolean) => setRows((p) => p.map((r) => ({ ...r, [k]: v })));
  const setAll = (v: boolean) => setRows((p) => p.map((r) => ({ ...r, canView: v, canSave: v, canEdit: v, canDelete: v, canPrint: v, canExport: v, canCancel: v })));

  const rowAllOn = (r: ModuleAuthRow) => PERMS.every((p) => r[p.key]);
  const colAllOn = (k: PermKey) => rows.length > 0 && rows.every((r) => r[k]);
  const allOn = rows.length > 0 && rows.every(rowAllOn);
  const grantedCount = rows.filter((r) => PERMS.some((p) => r[p.key])).length;

  async function save(overrideUserId?: number): Promise<{ success: boolean; message?: string }> {
    const r = await usersApi.saveModules(overrideUserId ?? userId, rows.map((m) => ({
      moduleID: m.moduleID, canView: m.canView, canSave: m.canSave, canEdit: m.canEdit,
      canDelete: m.canDelete, canPrint: m.canPrint, canExport: m.canExport, canCancel: m.canCancel,
    })));
    return { success: r.success, message: r.message };
  }
  // Expose save() + whether there's anything to save, for the modal's shared footer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({ save, hasRows: rows.length > 0 }), [rows, userId]);

  const th: React.CSSProperties = { padding: "9px 8px", fontSize: 11, fontWeight: 700, color: "rgb(var(--fg-muted))", background: "rgb(var(--bg-subtle))", position: "sticky", top: 0, textAlign: "center", whiteSpace: "nowrap" };
  const cbx: React.CSSProperties = { width: 16, height: 16, cursor: "pointer", accentColor: "rgb(var(--color-primary))" };

  if (loading) return <div style={{ padding: 34, textAlign: "center", opacity: 0.6 }}>Loading modules…</div>;

  // ── Mobile: a 760px-wide checkbox matrix is unusable on a phone. Render each module as a card
  //    with a row "All" toggle + the 7 permissions as wrapped, labelled chips (2 per row). ──
  if (isMobile) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap", rowGap: 8 }}>
          <Badge variant="info">{grantedCount}/{rows.length} modules granted</Badge>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "rgb(var(--fg-muted))", cursor: "pointer" }}>
            <input type="checkbox" style={cbx} checked={allOn} onChange={(e) => setAll(e.target.checked)} /> Select everything
          </label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "56vh", overflowY: "auto", paddingRight: 2 }}>
          {rows.map((r, i) => (
            <div key={r.moduleID} style={{ border: "1px solid #e6ebf2", borderRadius: 11, padding: 12, background: "rgb(var(--bg-surface))" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  {r.moduleHeadName && <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgb(var(--fg-subtle))", letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 2 }}>{r.moduleHeadName}</div>}
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(var(--fg-default))" }}>{r.moduleDisplayName || r.moduleName}</div>
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: rowAllOn(r) ? "rgb(var(--color-primary))" : "rgb(var(--fg-muted))", cursor: "pointer", flexShrink: 0 }}>
                  <input type="checkbox" style={cbx} checked={rowAllOn(r)} onChange={(e) => setRowAll(i, e.target.checked)} /> All
                </label>
              </div>
              {/* flex-wrap (not grid) so the [role=dialog] "1fr 1fr" stacking catch-all can't collapse
                  this to one column — we want 2 perm chips per row here. */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {PERMS.map((p) => {
                  const on = r[p.key];
                  return (
                    <label key={p.key} style={{ flex: "1 1 42%", minWidth: 0, display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      border: `1px solid ${on ? "rgb(var(--color-primary))" : "#dce3ec"}`,
                      background: on ? "color-mix(in srgb, rgb(var(--color-primary)) 10%, transparent)" : "transparent",
                      color: on ? "rgb(var(--color-primary))" : "rgb(var(--fg-muted))" }}>
                      <input type="checkbox" style={cbx} checked={on} onChange={(e) => setCell(i, p.key, e.target.checked)} /> {p.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: "rgb(var(--fg-subtle))", marginTop: 8 }}>Tip: “Can View” controls whether the module appears in the user’s sidebar.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <Badge variant="info">{grantedCount}/{rows.length} modules granted</Badge>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "rgb(var(--fg-muted))", cursor: "pointer" }}>
          <input type="checkbox" style={cbx} checked={allOn} onChange={(e) => setAll(e.target.checked)} /> Select everything
        </label>
      </div>

      <div style={{ border: "1px solid #e6ebf2", borderRadius: 12, overflow: "auto", maxHeight: "52vh" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", left: 0, zIndex: 2 }}>Module Head</th>
              <th style={{ ...th, textAlign: "left" }}>Module Name</th>
              <th style={th}>Select All</th>
              {PERMS.map((p) => (
                <th key={p.key} style={th}>
                  <div>{p.label}</div>
                  <input type="checkbox" style={{ ...cbx, marginTop: 3 }} checked={colAllOn(p.key)} onChange={(e) => setColAll(p.key, e.target.checked)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const newHead = i === 0 || rows[i - 1].moduleHeadName !== r.moduleHeadName;
              return (
                <tr key={r.moduleID} style={{ borderTop: newHead ? "2px solid #e6ebf2" : "1px solid #f1f4f8" }}>
                  <td style={{ padding: "8px 8px", fontSize: 12, fontWeight: 700, color: "rgb(var(--fg-muted))" }}>{newHead ? (r.moduleHeadName || "—") : ""}</td>
                  <td style={{ padding: "8px 8px", fontSize: 12.5, color: "rgb(var(--fg-default))" }}>{r.moduleDisplayName || r.moduleName}</td>
                  <td style={{ textAlign: "center" }}><input type="checkbox" style={cbx} checked={rowAllOn(r)} onChange={(e) => setRowAll(i, e.target.checked)} /></td>
                  {PERMS.map((p) => (
                    <td key={p.key} style={{ textAlign: "center", padding: "6px 4px" }}>
                      <input type="checkbox" style={cbx} checked={r[p.key]} onChange={(e) => setCell(i, p.key, e.target.checked)} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "rgb(var(--fg-subtle))", marginTop: 8 }}>Tip: “Can View” controls whether the module appears in the user’s sidebar.</div>
    </div>
  );
});

// ── Create / Edit modal ──────────────────────────────────
const BLANK_USER: UserSave & { employeeCode?: string } = {
  userId: 0, fullName: "", email: "", password: "", role: "", reportingManagerId: null, isActive: true, companyId: 1,
  emailProvider: "SMTP", smtpUsername: "", smtpPassword: "", smtpServer: "smtp.gmail.com", smtpPort: "587", smtpAuthenticate: true, smtpUseSSL: true,
  emailSignature: "",
};

function UserFormModal({ userId, isOpen, lookups, onClose, onSaved, onFlash }: {
  userId: number | null; isOpen: boolean; lookups: UserLookups | null;
  onClose: () => void; onSaved: () => void; onFlash: (m: string) => void;
}) {
  const { isMobile } = useDevice();
  const [curId, setCurId] = useState<number | null>(userId);
  const [tab, setTab] = useState("profile");
  const [f, setF] = useState<UserSave & { employeeCode?: string }>({ ...BLANK_USER });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasSmtpPwd, setHasSmtpPwd] = useState(false);
  const [showSmtpPwd, setShowSmtpPwd] = useState(false);
  const sigRef = useRef<HTMLDivElement>(null);
  const sigExec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); sigRef.current?.focus(); };
  const [origEmail, setOrigEmail] = useState("");           // for the Save-As uniqueness guard
  const moduleRef = useRef<ModuleMatrixHandle>(null);        // lets the footer save the authority matrix too
  const { showConfirmation, showSuccess, showError, AlertComponent: DeleteAlert } = useModalAlert();
  const [permKeys, setPermKeys] = useState<string[]>([]);    // granted feature-permission keys (opt-in)
  const togglePerm = (k: string) => setPermKeys((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  useEffect(() => {
    if (!isOpen) return;
    setTab("profile"); setMsg(null); setCurId(userId); setShowSmtpPwd(false); setHasSmtpPwd(false); setPermKeys([]);
    if (userId) {
      usersApi.getPermissions(userId).then((r) => setPermKeys(r.success ? r.data : [])).catch(() => {});
      usersApi.get(userId).then((r) => {
        if (!r.success) return;
        setHasSmtpPwd(!!r.data.hasSmtpPassword);
        setOrigEmail(r.data.email ?? "");
        setF({
          userId: r.data.userId, fullName: r.data.fullName, email: r.data.email ?? "", password: "",
          role: r.data.role ?? "", reportingManagerId: r.data.reportingManagerId ?? null, isActive: r.data.isActive, companyId: r.data.companyId,
          mobile: r.data.mobile ?? "", employeeCode: r.data.employeeCode ?? "",
          emailProvider: r.data.emailProvider || "SMTP",
          smtpUsername: r.data.smtpUsername ?? "", smtpPassword: "",
          smtpServer: r.data.smtpServer ?? "", smtpPort: r.data.smtpPort ?? "587",
          smtpAuthenticate: r.data.smtpAuthenticate ?? true, smtpUseSSL: r.data.smtpUseSSL ?? true,
          emailSignature: r.data.emailSignature ?? "",
        });
      });
    } else {
      setF({ ...BLANK_USER });
      setOrigEmail("");
    }
  }, [isOpen, userId]);

  const set = (k: keyof (UserSave & { employeeCode?: string }), v: unknown) => setF((p) => ({ ...p, [k]: v }));

  // fill the contentEditable signature editor from state whenever the Emails tab mounts
  // (edits are synced back to f.emailSignature on input, so switching tabs is lossless)
  useEffect(() => {
    if (tab === "emails" && sigRef.current && sigRef.current.innerHTML !== (f.emailSignature ?? "")) {
      sigRef.current.innerHTML = f.emailSignature ?? "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Build the save payload from the current form (asNew → a brand-new record, ignoring curId).
  const buildBody = (asNew: boolean): UserSave => ({
    userId: asNew ? 0 : (curId ?? 0),
    fullName: f.fullName.trim(), email: f.email.trim(), password: f.password?.trim() || undefined,
    mobile: f.mobile?.trim() || null,
    role: f.role || null, reportingManagerId: f.reportingManagerId ?? null, isActive: f.isActive, companyId: f.companyId,
    emailProvider: f.emailProvider || "SMTP",
    smtpUsername: f.smtpUsername?.trim() || null, smtpPassword: f.smtpPassword?.trim() || undefined,
    smtpServer: f.smtpServer?.trim() || null, smtpPort: f.smtpPort?.trim() || null,
    smtpAuthenticate: f.smtpAuthenticate ?? true, smtpUseSSL: f.smtpUseSSL ?? true,
    emailSignature: (sigRef.current?.innerHTML ?? f.emailSignature ?? "").trim() || null,
  });

  // Persist the user entity (profile + email settings). Returns the user id (new or existing), or null on failure.
  async function saveUser(): Promise<number | null> {
    if (!f.fullName.trim() || !f.email.trim()) { setTab("profile"); setMsg("Full name and email are required."); return null; }
    if (!curId && !f.password?.trim()) { setTab("profile"); setMsg("Password is required for a new user."); return null; }
    setMsg(null);
    const r = curId ? await usersApi.update(curId, buildBody(false)) : await usersApi.create(buildBody(true));
    if (!r.success) { setMsg(r.message); return null; }
    const newId = (r as { userId?: number }).userId;
    const effectiveId = curId ?? newId ?? null;
    // Success feedback is shown by handleSave() via the modal's showSuccess component (not a
    // page-root toast that would sit behind this modal). Just refresh the grid here.
    onSaved();
    if (f.smtpPassword?.trim()) setHasSmtpPwd(true); // password just set → reflect it
    if (!curId && newId) { setCurId(newId); setTab("modules"); } // new user → continue to authority
    return effectiveId;
  }

  // Footer "Update"/"Save": persist the user, then the module-authority matrix under the same id
  // (for a brand-new user, `id` is the just-created one, so ticked modules are saved immediately).
  async function handleSave() {
    setBusy(true);
    const wasUpdate = curId != null;   // capture before saveUser() assigns curId for a brand-new user
    try {
      const id = await saveUser();
      if (id == null) return;
      if (moduleRef.current?.hasRows) {
        const mr = await moduleRef.current.save(id);
        if (!mr.success) { showError("Save failed", mr.message || "Module authority save failed."); return; }
      }
      await usersApi.savePermissions(id, permKeys); // opt-in feature permissions
      if (wasUpdate) {
        // Update → close the modal and land back on the grid, with a success toast on the page.
        onFlash("User updated successfully.");
        onClose();
      } else {
        // New user → keep the modal open on the Module Authentication tab so authority can be set.
        showSuccess("User Created", "New user created successfully. Set module authority, then click Update.", 3500);
      }
    } finally { setBusy(false); }
  }

  // Footer "Save As": clone the current form into a NEW user (email must differ; needs a password) —
  // the module authority is copied to the clone too.
  async function handleSaveAs() {
    if (!curId) return;
    if (!f.email.trim() || f.email.trim().toLowerCase() === origEmail.trim().toLowerCase()) {
      setTab("profile"); setMsg("Change the Email before Save As — it must be unique for the new user."); return;
    }
    if (!f.password?.trim()) { setTab("profile"); setMsg("Set a Password to save this as a new user."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await usersApi.create(buildBody(true));
      if (!r.success) { setMsg(r.message); return; }
      const newId = (r as { userId?: number }).userId;
      if (newId && moduleRef.current?.hasRows) await moduleRef.current.save(newId); // clone the authority too
      if (newId) await usersApi.savePermissions(newId, permKeys);                    // and the feature permissions
      onFlash("Saved as a new user."); onSaved(); onClose();
    } finally { setBusy(false); }
  }

  // Footer "Delete": confirm, then remove the user.
  function handleDelete() {
    if (!curId) return;
    showConfirmation(
      "Delete User",
      `Delete "${f.fullName || "this user"}"${f.email ? ` (${f.email})` : ""}? This permanently removes their login and module authority. This cannot be undone.`,
      async () => {
        const r = await usersApi.remove(curId);
        if (r.success) { onFlash(`Employee "${f.fullName}" has been deleted.`); onSaved(); onClose(); }
        else setMsg(r.message || "Delete failed.");
      },
    );
  }

  const tabDefs = useMemo(() => [
    { id: "profile", label: "User Profile", short: "Profile", icon: User },
    { id: "modules", label: "Module Authentication", short: "Modules", icon: ShieldCheck },
    { id: "emails", label: "Emails", short: "Emails", icon: Mail },
  ], []);
  const provider = f.emailProvider || "SMTP";

  return (
    <StandardModal isOpen={isOpen} onClose={onClose} title={userId ? `Edit User — ${f.fullName || ""}` : "Create User"}
      subtitle={f.employeeCode ? `Employee ${f.employeeCode}` : "Indus Command Center user + module authority"} size="xl"
      showFooter
      footerActions={
        <>
          {curId != null && <Button variant="action-delete" icon={Trash2} onClick={handleDelete} disabled={busy}>Delete</Button>}
          <Button variant="action-save" icon={Save} onClick={handleSave} loading={busy}>{curId ? "Update" : "Save"}</Button>
          {curId != null && <Button variant="action-save-as" icon={Copy} onClick={handleSaveAs} disabled={busy}>Save As</Button>}
          <Button variant="action-cancel" icon={XCircle} onClick={onClose} disabled={busy}>Cancel</Button>
        </>
      }>
      <div style={{ display: "flex", gap: 6, background: "rgb(var(--bg-subtle))", border: "1px solid #e2e8f1", borderRadius: 12, padding: 5 }}>
        {tabDefs.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: isMobile ? 5 : 8,
                padding: isMobile ? "9px 6px" : "11px 12px", borderRadius: 9, border: "none", cursor: "pointer",
                fontSize: isMobile ? 12 : 13.5, fontWeight: 700, whiteSpace: "nowrap",
                background: active ? "#fff" : "transparent",
                color: active ? "rgb(var(--color-primary))" : "#67758a",
                boxShadow: active ? "0 2px 8px -3px rgba(31,69,118,.3), inset 0 0 0 1px #d6e3f4" : "none",
                transition: "background .15s, color .15s",
              }}>
              <Icon size={isMobile ? 14 : 16} /> {isMobile ? t.short : t.label}
            </button>
          );
        })}
      </div>
      {msg && <div style={{ color: "#c0392b", fontSize: 12.5, marginTop: 10 }}>{msg}</div>}

      <div style={{ marginTop: 16 }}>
        {tab === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px", maxWidth: 640 }}>
            <div><label style={fldLabel}>Full Name *</label><input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} style={fldInput} placeholder="Employee name" /></div>
            <div><label style={fldLabel}>Email *</label><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={f.email} onChange={(e) => set("email", e.target.value)} style={fldInput} placeholder="you@indusanalytics.in" /></div>
            <div><label style={fldLabel}>Mobile No</label><input type="tel" inputMode="tel" value={f.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} style={fldInput} placeholder="Enter mobile number" /></div>
            <div><label style={fldLabel}>Role</label>
              <Dropdown value={f.role ?? ""} onValueChange={(v) => set("role", String(v))}
                options={[...(lookups?.roles ?? []), ...(f.role && !(lookups?.roles ?? []).includes(f.role) ? [f.role] : [])].map((r) => ({ value: r, label: r }))}
                placeholder="Select role…" searchable size="md" />
            </div>
            <div><label style={fldLabel}>Team Lead</label>
              <Dropdown value={f.reportingManagerId != null ? String(f.reportingManagerId) : ""} onValueChange={(v) => set("reportingManagerId", v ? Number(v) : null)}
                options={[{ value: "", label: "— none —" }, ...(lookups?.managers ?? []).filter((m) => m.userId !== curId).map((m) => ({ value: String(m.userId), label: m.fullName }))]}
                placeholder="— none —" searchable size="md" />
            </div>
            <div><label style={fldLabel}>Password {curId ? "" : "*"}</label><input type="password" value={f.password ?? ""} onChange={(e) => set("password", e.target.value)} style={fldInput} placeholder={curId ? "Leave blank to keep current" : "Set a password"} autoComplete="new-password" /></div>
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 20, marginTop: 2 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-muted))", cursor: "pointer" }}>
                <input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} style={{ width: 16, height: 16, accentColor: "rgb(var(--color-primary))" }} /> Active (can log in)
              </label>
            </div>
            </div>

            {/* ── User Permissions — opt-in feature toggles (off by default; granted per user) ── */}
            <div style={{ border: "1px solid #e2e8f1", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgb(var(--bg-subtle))", borderBottom: "1px solid #e6eaf0" }}>
                <KeyRound size={14} style={{ color: "rgb(var(--color-primary))" }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgb(var(--fg-default))", letterSpacing: 0.4, textTransform: "uppercase" }}>User Permissions</span>
                <span style={{ fontSize: 11, color: "rgb(var(--fg-muted))", marginLeft: 4 }}>Off by default — turn on to grant this user the feature.</span>
              </div>
              <div style={{ padding: 14 }}>
                <div className="perm-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 9 }}>
                  {PERMISSION_CATALOG.flatMap((g) => g.perms).map((p) => {
                    const on = permKeys.includes(p.key);
                    return (
                      <button key={p.key} type="button" onClick={() => togglePerm(p.key)} title={p.label}
                        style={{ width: "100%", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, textAlign: "left", lineHeight: 1.25, transition: "all .12s",
                          border: `1px solid ${on ? "rgb(var(--color-primary))" : "#d2dae7"}`,
                          background: on ? "color-mix(in srgb, rgb(var(--color-primary)) 12%, transparent)" : "rgb(var(--bg-surface))",
                          color: on ? "rgb(var(--color-primary))" : "rgb(var(--fg-muted))" }}>
                        <span style={{ flexShrink: 0, display: "inline-flex" }}>{on ? <CheckCircle2 size={15} /> : <Circle size={15} style={{ opacity: 0.45 }} />}</span>
                        <span style={{ minWidth: 0 }}>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Module Authentication — ALWAYS shows the full module list (fresh user → every box unchecked;
            existing user → their granted boxes ticked). Kept mounted so edits survive tab switches; the
            footer "Update" persists it with the profile (new user → under the just-created id). */}
        <div style={{ display: tab === "modules" ? "block" : "none" }}>
          <ModuleMatrix ref={moduleRef} userId={curId ?? 0} blankPerms={curId == null} />
        </div>

        {tab === "emails" && (
          <div style={{ maxWidth: 960 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "rgb(var(--fg-default))" }}><Mail size={16} /> Email Settings</div>
                <div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))", marginTop: 3 }}>This user&apos;s mailbox — emails they send in Indus 360 go out from here (From = their email).</div>
              </div>
              <div style={{ display: "inline-flex", background: "rgb(var(--bg-subtle))", borderRadius: 9, padding: 3, gap: 3, flexShrink: 0 }}>
                {[["MicrosoftGraph", "Microsoft Graph"], ["SMTP", "SMTP"]].map(([pv, lbl]) => (
                  <button key={pv} onClick={() => set("emailProvider", pv)}
                    style={{ padding: "6px 14px", borderRadius: 7, border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: provider === pv ? "rgb(var(--color-primary))" : "transparent", color: provider === pv ? "#fff" : "#48586b" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {provider === "MicrosoftGraph" && (
              <div style={{ fontSize: 12.5, color: "#8a5a00", background: "#fff8e6", border: "1px solid #f2e2b8", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                Microsoft Graph isn&apos;t wired in Indus 360 yet — sending uses SMTP. Fill the SMTP details below.
              </div>
            )}

            <div className="form-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px 18px" }}>
              <div><label style={fldLabel}>SMTP Username</label><input inputMode="email" autoCapitalize="none" autoCorrect="off" value={f.smtpUsername ?? ""} onChange={(e) => set("smtpUsername", e.target.value)} style={fldInput} placeholder="you@gmail.com" autoComplete="off" /></div>
              <div><label style={fldLabel}>SMTP Password</label>
                <div style={{ position: "relative" }}>
                  <input type={showSmtpPwd ? "text" : "password"} value={f.smtpPassword ?? ""} onChange={(e) => set("smtpPassword", e.target.value)} style={{ ...fldInput, paddingRight: 34 }} placeholder={hasSmtpPwd ? "•••••••• saved — leave blank to keep" : (curId ? "Leave blank to keep current" : "App password")} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowSmtpPwd((s) => !s)} style={{ position: "absolute", right: 8, top: 9, background: "none", border: "none", cursor: "pointer", color: "rgb(var(--fg-subtle))", padding: 2 }}>{showSmtpPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div><label style={fldLabel}>SMTP Server</label><input value={f.smtpServer ?? ""} onChange={(e) => set("smtpServer", e.target.value)} style={fldInput} placeholder="smtp.gmail.com" /></div>
              <div><label style={fldLabel}>Port</label><input inputMode="numeric" value={f.smtpPort ?? ""} onChange={(e) => set("smtpPort", e.target.value)} style={fldInput} placeholder="587" /></div>
              <div><label style={fldLabel}>Authenticate</label>
                <Dropdown value={f.smtpAuthenticate ? "Yes" : "No"} onValueChange={(v) => set("smtpAuthenticate", v === "Yes")} options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]} size="md" />
              </div>
              <div><label style={fldLabel}>Use SSL</label>
                <Dropdown value={f.smtpUseSSL ? "Yes" : "No"} onValueChange={(v) => set("smtpUseSSL", v === "Yes")} options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]} size="md" />
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: "rgb(var(--fg-subtle))", marginTop: 12 }}>
              Tip: for Gmail use an <b>App Password</b> (Google Account → Security → App passwords) — not the normal login password. When configured, mail from this user sends as <b>{f.smtpUsername || f.email || "their address"}</b>.
            </div>

            {/* ── Email Signature (rich HTML, auto-appended when this user composes) ── */}
            <div style={{ marginTop: 22, border: "1px solid #e2e7ef", borderRadius: 11, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "rgb(var(--bg-subtle))", borderBottom: "1px solid #e6eaf0" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "rgb(var(--fg-default))" }}><FileSignature size={15} /> Email Signature</div>
                <div style={{ fontSize: 11.5, color: "rgb(var(--fg-muted))", marginLeft: 4 }}>Added automatically below the message when this user composes an email.</div>
              </div>
              <div style={{ display: "flex", gap: 6, padding: 8, borderBottom: "1px solid #eef1f5", background: "rgb(var(--bg-surface))" }}>
                {([["bold", Bold, "Bold"], ["italic", Italic, "Italic"], ["underline", Underline, "Underline"], ["insertUnorderedList", List, "Bullet list"], ["insertOrderedList", ListOrdered, "Numbered list"]] as const).map(([cmd, Icon, title]) => (
                  <button key={cmd} type="button" title={title} onMouseDown={(e) => { e.preventDefault(); sigExec(cmd); }}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 28, border: "1px solid #e2e7ef", background: "rgb(var(--bg-surface))", borderRadius: 7, cursor: "pointer", color: "#334" }}><Icon size={14} /></button>
                ))}
                <button type="button" title="Insert link" onMouseDown={(e) => { e.preventDefault(); const url = window.prompt("Link URL"); if (url) sigExec("createLink", url); }}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 28, border: "1px solid #e2e7ef", background: "rgb(var(--bg-surface))", borderRadius: 7, cursor: "pointer", color: "#334" }}><Link2 size={14} /></button>
                <label title="Insert logo / image" style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", border: "1px solid #e2e7ef", background: "rgb(var(--bg-surface))", borderRadius: 7, cursor: "pointer", color: "#334", fontSize: 12, fontWeight: 600 }}>
                  <ImageIcon size={14} /> Logo
                  <input type="file" accept="image/*" hidden onChange={async (e) => {
                    const file = e.target.files?.[0]; e.currentTarget.value = "";
                    if (!file) return;
                    try { const html = await insertImageFile(sigRef.current, file, 200); if (html != null) set("emailSignature", html); }
                    catch (err) { window.alert(err instanceof Error ? err.message : String(err)); }
                  }} />
                </label>
                <button type="button" title="Clear signature" onMouseDown={(e) => { e.preventDefault(); if (sigRef.current) sigRef.current.innerHTML = ""; set("emailSignature", ""); }}
                  style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", color: "rgb(var(--fg-subtle))", fontSize: 12, fontWeight: 600 }}>Clear</button>
              </div>
              <style>{`[data-sig-editor]:empty:before{content:attr(data-placeholder);color:#aab4c0;white-space:pre-line;pointer-events:none}`}</style>
              <div
                ref={sigRef}
                contentEditable
                suppressContentEditableWarning
                data-sig-editor
                onInput={(e) => set("emailSignature", e.currentTarget.innerHTML)}
                data-placeholder="e.g. Regards,&#10;Ankit Sharma · Indus Analytics · +91 …"
                style={{ minHeight: 120, maxHeight: 240, overflowY: "auto", padding: "12px 14px", fontSize: 13.5, lineHeight: 1.55, outline: "none", color: "rgb(var(--fg-default))", background: "rgb(var(--bg-surface))" }}
              />
            </div>
          </div>
        )}
      </div>
      <DeleteAlert />
    </StandardModal>
  );
}

// ── Page ─────────────────────────────────────────────────
export default function UsersPage() {
  const [rows, setRows] = useState<UserListRow[]>([]);
  const [lookups, setLookups] = useState<UserLookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [statusTab, setStatusTab] = useState<"Active" | "Inactive">("Active"); // left tabs: Active-only / Inactive-only
  const reload = useCallback(() => usersApi.list().then((r) => setRows(r.success ? r.data : [])).catch(() => setRows([])), []);
  useEffect(() => { reload().finally(() => setLoading(false)); usersApi.lookups().then((r) => r.success && setLookups(r.data)).catch(() => {}); }, [reload]);

  const { showSuccess, showError, AlertComponent } = useModalAlert();
  const openCreate = () => { setEditId(null); setModalOpen(true); };
  const openEdit = (id: number) => { setEditId(id); setModalOpen(true); };
  // The grid's action column shows its own delete-confirm dialog, then calls this.
  const performDelete = async (u: UserListRow) => {
    const r = await usersApi.remove(u.userId);
    if (r.success) { showSuccess("User Deleted", `Employee "${u.fullName}" has been deleted.`, 3000); reload(); }
    else { showError("Delete failed", r.message || `Could not delete "${u.fullName}". Please try again.`); }
  };

  const columns = useMemo<ColumnDef<UserListRow>[]>(() => [
    {
      accessorKey: "fullName", header: "Employee Name", size: 240, meta: { inputType: "text" },
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: avatarBg(u.fullName), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(u.fullName)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "rgb(var(--fg-default))", whiteSpace: "nowrap" }}>{u.fullName}</div>
              {u.employeeCode && <div style={{ fontSize: 11, color: "rgb(var(--fg-subtle))", fontFamily: "monospace" }}>{u.employeeCode}</div>}
            </div>
          </div>
        );
      },
    },
    { accessorKey: "email", header: "Email", size: 240, meta: { inputType: "text" }, cell: ({ row }) => <span style={{ color: "rgb(var(--fg-muted))" }}>{row.original.email || "—"}</span> },
    { accessorKey: "mobile", header: "Mobile No", size: 140, meta: { inputType: "text" }, cell: ({ row }) => row.original.mobile || "—" },
    { accessorKey: "role", header: "Role", size: 140, meta: { inputType: "text" }, cell: ({ row }) => (row.original.role ? <Badge variant={roleVariant(row.original.role)}>{row.original.role}</Badge> : "—") },
    { accessorKey: "reportingManagerName", header: "Team Lead", size: 180, meta: { inputType: "text" }, cell: ({ row }) => row.original.reportingManagerName || "—" },
    { id: "status", accessorFn: (u) => (u.isActive ? "Active" : "Inactive"), header: "Status", size: 130, meta: { inputType: "text" }, cell: ({ row }) => statusPill(row.original.isActive) },
    createActionsColumn<UserListRow>({
      onView: (u) => openEdit(u.userId),
      onEdit: (u) => openEdit(u.userId),
      onDelete: performDelete,
      showView: true, showEdit: true, showDelete: true,
      mode: "buttons",
      primaryActions: ["view", "edit", "delete"],
      confirmDelete: true,
      deleteConfirmation: {
        title: "Delete Employee",
        description: (u) =>
          `Are you sure you want to delete "${u.fullName}"${u.email ? ` (${u.email})` : ""}? This permanently removes their login and module authority. This action cannot be undone.`,
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  // Left Active/Inactive tabs — split the list by isActive (each tab shows only its own; counts on the tab).
  const activeCount = useMemo(() => rows.filter((u) => u.isActive).length, [rows]);
  const inactiveCount = rows.length - activeCount;
  const filteredRows = useMemo(
    () => rows.filter((u) => (statusTab === "Active" ? u.isActive : !u.isActive)),
    [rows, statusTab],
  );

  if (loading) return <BrandedLoader size="lg" text="Loading users…" />;

  return (
    <Page>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 22 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "rgb(var(--color-primary))", color: "#fff", flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(31,69,118,.45)" }}>
          <Users size={24} />
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "rgb(var(--fg-default))", margin: 0, letterSpacing: 0.2 }}>User Master</h1>
      </div>

      {/* ── Active / Inactive tabs (left) + Create User (right) ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "rgb(var(--bg-subtle))", border: "1px solid #e2e8f1", borderRadius: 11, padding: 4, gap: 4 }}>
          {([
            { key: "Active", count: activeCount, dot: "#1c8a4a", fg: "#1c8a4a", badgeBg: "#e6f6ec", badgeBd: "#b7e2c6" },
            { key: "Inactive", count: inactiveCount, dot: "#c0392b", fg: "#c0392b", badgeBg: "#fdecec", badgeBd: "#f4c9c9" },
          ] as const).map((tb) => {
            const on = statusTab === tb.key;
            return (
              <button key={tb.key} type="button" onClick={() => setStatusTab(tb.key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 13.5, fontWeight: 700, transition: "background .15s, color .15s",
                  background: on ? "rgb(var(--bg-surface))" : "transparent",
                  color: on ? tb.fg : "#67758a",
                  boxShadow: on ? "0 2px 8px -3px rgba(0,0,0,.2), inset 0 0 0 1px #e0e7f1" : "none",
                }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: tb.dot, opacity: on ? 1 : 0.45, flexShrink: 0 }} />
                {tb.key}
                <span style={{
                  fontSize: 11.5, fontWeight: 700, minWidth: 22, textAlign: "center", padding: "1px 8px", borderRadius: 999,
                  background: on ? tb.badgeBg : "rgb(var(--bg-surface))", color: on ? tb.fg : "#8b97a8", border: `1px solid ${on ? tb.badgeBd : "#e2e8f1"}`,
                }}>{tb.count}</span>
              </button>
            );
          })}
        </div>

        <button onClick={openCreate} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgb(var(--color-primary))", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          <UserPlus size={15} /> Create User
        </button>
      </div>

      <DataGrid<UserListRow>
        key={statusTab}
        data={filteredRows}
        columns={columns}
        getRowId={(r) => String(r.userId)}
        onRowClick={(u) => openEdit(u.userId)}
        title={statusTab === "Active" ? "Active Users" : "Inactive Users"}
        mainColumns="fullName"
        enableRowSelection
        rowSelectionMode="multi"
        enableColumnResizing
        enableColumnReordering
        enableColumnFreezing
        enableColumnVisibility
        enableSorting
        enableSearch
        enableBacchaSearch
        enableFilterRow
        enableExport
        enablePagination
      />

      <UserFormModal userId={editId} isOpen={modalOpen} lookups={lookups}
        onClose={() => setModalOpen(false)}
        onSaved={() => reload()}
        onFlash={(m) => showSuccess("Success", m, 3000)} />
      <AlertComponent />
    </Page>
  );
}
