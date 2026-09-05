"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PageLoading, Badge, useModalAlert } from "indas-ui";
import { Search, Save, FolderKanban, Check, Users as UsersIcon, CheckSquare, Square, XCircle, Building2, Package, ChevronDown } from "lucide-react";
import { usersApi, type UserListRow } from "@/lib/users";
import { projectAssignmentApi, type Project } from "@/lib/projectAssignment";

// ── little helpers ───────────────────────────────────────
const AV = ["#1F4576", "#0f6a72", "#553c9a", "#b45309", "#276749", "#9b2c5a"];
function avatarBg(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AV[h % AV.length]; }
function initials(n?: string | null) { const p = (n || "?").trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?"; }
const appVariant = (a?: string | null): "info" | "success" | "warning" | "default" => {
  const x = (a || "").toLowerCase();
  if (x.includes("estimo")) return "info";
  if (x.includes("printude") || x.includes("printtude")) return "success";
  if (x.includes("multi")) return "warning";
  return "default";
};

/** Prod can return the same CompanyUniqueCode more than once — keep one row per code
 *  (assignment is keyed by code, so duplicates are meaningless + break React keys). */
function dedupeByCode(list: Project[]): Project[] {
  const seen = new Set<string>();
  const out: Project[] = [];
  for (const p of list) {
    const code = (p.code || "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(p);
  }
  return out;
}

export default function ProjectAssignmentPage() {
  const { data: session } = useSession();
  const me = (session?.user ?? {}) as { UserID?: number };
  const { showSuccess, showError, AlertComponent } = useModalAlert();

  const [users, setUsers] = useState<UserListRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projErr, setProjErr] = useState<string | null>(null);

  const [selUser, setSelUser] = useState<UserListRow | null>(null);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [userQ, setUserQ] = useState("");
  const [projQ, setProjQ] = useState("");
  const [productFilter, setProductFilter] = useState<Set<string>>(new Set()); // Indus Product multiselect

  // initial load
  useEffect(() => {
    Promise.all([
      // Inactive users can't log in / do work, so they're not assignable — hide them here
      // (the shared /api/users list intentionally includes inactive for the User Management grid).
      usersApi.list().then((r) => setUsers(r.success ? r.data.filter((u) => u.isActive) : [])).catch(() => setUsers([])),
      projectAssignmentApi.projects().then((r) => { if (r.success) setProjects(dedupeByCode(r.data)); else setProjErr(r.error || "Could not load projects from the server."); }).catch(() => setProjErr("Could not reach the server.")),
    ]).finally(() => setLoading(false));
  }, []);

  // when a user is picked, load their assignments
  function pickUser(u: UserListRow) {
    setSelUser(u);
    setProjQ("");
    setAssignedLoading(true);
    projectAssignmentApi.assigned(u.userId)
      .then((r) => { const s = new Set(r.success ? r.data : []); setSelected(new Set(s)); setOriginal(new Set(s)); })
      .catch(() => { setSelected(new Set()); setOriginal(new Set()); })
      .finally(() => setAssignedLoading(false));
  }

  const filteredUsers = useMemo(() => {
    const q = userQ.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.fullName} ${u.email ?? ""} ${u.role ?? ""}`.toLowerCase().includes(q));
  }, [users, userQ]);

  const filteredProjects = useMemo(() => {
    const q = projQ.trim().toLowerCase();
    return projects.filter((p) => {
      if (productFilter.size > 0 && !productFilter.has(productOf(p.application))) return false;
      if (q && !`${p.name} ${p.code} ${p.application ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, projQ, productFilter]);

  const dirty = useMemo(() => {
    if (selected.size !== original.size) return true;
    for (const c of selected) if (!original.has(c)) return true;
    return false;
  }, [selected, original]);

  const toggle = (code: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  const selectAllFiltered = () => setSelected((prev) => { const n = new Set(prev); filteredProjects.forEach((p) => n.add(p.code)); return n; });
  const clearAll = () => setSelected(new Set());

  async function save() {
    if (!selUser) return;
    setSaving(true);
    const r = await projectAssignmentApi.save(selUser.userId, [...selected], me.UserID);
    setSaving(false);
    if (r.success) { setOriginal(new Set(selected)); showSuccess("Assignments saved", `${selected.size} project(s) assigned to ${selUser.fullName}.`, 2500); }
    else showError("Save failed", r.error || "Could not save the assignments.");
  }

  if (loading) return <PageLoading size="lg" text="Loading project assignment…" />;

  return (
    <div style={{ padding: "18px 22px 40px" }}>
      {/* header */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgb(var(--color-primary))", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <FolderKanban size={21} />
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "rgb(var(--color-primary))" }}>Project Assignment</h1>
        </div>
      </div>

      <div className={`pa-wrap${selUser ? " pa-has-user" : ""}`} style={{ display: "flex", gap: 16, marginTop: 16, alignItems: "stretch" }}>
        {/* ── Users panel ── */}
        <div className="pa-users" style={{ ...panel, width: 340, flexShrink: 0 }}>
          <div style={panelHead}>
            <UsersIcon size={16} style={{ color: "rgb(var(--color-primary))" }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Users</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "rgb(var(--fg-subtle))" }}>{filteredUsers.length}</span>
          </div>
          <div style={{ padding: 10, borderBottom: "1px solid #eef1f6" }}>
            <SearchBox value={userQ} onChange={setUserQ} placeholder="Search users…" />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filteredUsers.map((u) => {
              const active = selUser?.userId === u.userId;
              return (
                <button key={u.userId} onClick={() => pickUser(u)}
                  style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", border: "none", borderLeft: `3px solid ${active ? "rgb(var(--color-primary))" : "transparent"}`, background: active ? "color-mix(in srgb, rgb(var(--color-primary)) 8%, white)" : "transparent", cursor: "pointer" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: avatarBg(u.fullName), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>{initials(u.fullName)}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontWeight: 700, fontSize: 13.5, color: "rgb(var(--fg-default))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.fullName}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "rgb(var(--fg-subtle))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.role || u.email || "—"}</span>
                  </span>
                  {active && <Check size={16} style={{ color: "rgb(var(--color-primary))", flexShrink: 0 }} />}
                </button>
              );
            })}
            {filteredUsers.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "rgb(var(--fg-subtle))", fontSize: 13 }}>No users found.</div>}
          </div>
        </div>

        {/* ── Projects panel ── */}
        <div className="pa-projects" style={{ ...panel, flex: 1, minWidth: 0 }}>
          {!selUser ? (
            <div style={{ display: "grid", placeItems: "center", flex: 1, minHeight: 380 }}>
              <div style={{ textAlign: "center", maxWidth: 360 }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: "color-mix(in srgb, rgb(var(--color-primary)) 10%, white)", color: "rgb(var(--color-primary))", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><FolderKanban size={30} /></div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "rgb(var(--fg-default))", marginBottom: 5 }}>Select a user</div>
                <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))", lineHeight: 1.6 }}>Pick a user on the left to assign the client projects they should be able to see.</div>
              </div>
            </div>
          ) : (
            <>
              {/* header */}
              <div style={{ ...panelHead, gap: 12 }}>
                <button className="pa-back" onClick={() => setSelUser(null)} title="Back to users" aria-label="Back to users"
                  style={{ display: "none", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f1", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", cursor: "pointer", flexShrink: 0 }}>
                  <ChevronDown size={18} style={{ transform: "rotate(90deg)" }} />
                </button>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: avatarBg(selUser.fullName), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 11.5, flexShrink: 0 }}>{initials(selUser.fullName)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "rgb(var(--fg-default))", lineHeight: 1.15 }}>{selUser.fullName}</div>
                  <div style={{ fontSize: 11.5, color: "rgb(var(--fg-subtle))" }}>{selUser.role || selUser.email}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="pa-detail-badge"><Badge variant="info">{selected.size} of {projects.length} assigned</Badge></span>
                  <button onClick={save} disabled={!dirty || saving}
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, background: dirty ? "rgb(var(--color-primary))" : "#cbd3df", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: dirty && !saving ? "pointer" : "default" }}>
                    <Save size={15} /> {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              {/* toolbar */}
              <div className="pa-toolbar" style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderBottom: "1px solid #eef1f6" }}>
                <div style={{ flex: 1, minWidth: 0 }}><SearchBox value={projQ} onChange={setProjQ} placeholder="Search projects by name, code, or app…" /></div>
                <ProductFilter selected={productFilter} onChange={setProductFilter} />
                <button onClick={selectAllFiltered} style={linkBtn}><CheckSquare size={14} /> Select all{(projQ || productFilter.size) ? " (filtered)" : ""}</button>
                <button onClick={clearAll} style={linkBtn}><XCircle size={14} /> Clear</button>
              </div>

              {/* project list */}
              <div style={{ overflowY: "auto", flex: 1, minHeight: 300 }}>
                {projErr ? (
                  <div style={{ padding: 30, textAlign: "center", color: "#b4472d", fontSize: 13 }}>{projErr}</div>
                ) : assignedLoading ? (
                  <div style={{ padding: 30, textAlign: "center", color: "rgb(var(--fg-subtle))", fontSize: 13 }}>Loading assignments…</div>
                ) : filteredProjects.length === 0 ? (
                  <div style={{ padding: 30, textAlign: "center", color: "rgb(var(--fg-subtle))", fontSize: 13 }}>No projects found.</div>
                ) : filteredProjects.map((p) => {
                  const on = selected.has(p.code);
                  return (
                    <button key={p.code} onClick={() => toggle(p.code)}
                      style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "none", borderBottom: "1px solid #f1f4f8", background: on ? "color-mix(in srgb, rgb(var(--color-primary)) 5%, white)" : "transparent", cursor: "pointer" }}>
                      {on ? <CheckSquare size={19} style={{ color: "rgb(var(--color-primary))", flexShrink: 0 }} /> : <Square size={19} style={{ color: "rgb(var(--fg-subtle))", flexShrink: 0 }} />}
                      <Building2 size={16} style={{ color: "rgb(var(--fg-subtle))", flexShrink: 0 }} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontWeight: 700, fontSize: 13.5, color: "rgb(var(--fg-default))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name?.trim() || "Unnamed client"}</span>
                        <span style={{ fontSize: 11, color: "rgb(var(--fg-subtle))", fontFamily: "monospace" }}>{p.code}</span>
                      </span>
                      {p.application && <Badge variant={appVariant(p.application)}>{p.application}</Badge>}
                    </button>
                  );
                })}
              </div>

              {/* footer hint */}
              <div style={{ padding: "9px 14px", borderTop: "1px solid #eef1f6", fontSize: 12, color: dirty ? "#b4772d" : "#8b96a5", display: "flex", alignItems: "center", gap: 8 }}>
                {dirty ? <><span style={{ width: 7, height: 7, borderRadius: 999, background: "#e0a63a" }} /> Unsaved changes — click Save to apply.</> : <><Check size={13} /> All changes saved.</>}
              </div>
            </>
          )}
        </div>
      </div>
      <AlertComponent />
    </div>
  );
}

// ── Indus Product multiselect filter ────────────────────
const PRODUCTS = ["Estimoprime", "PrintudeERp", "MultiUnit", "Desktop", "Other"] as const;
/** Map a raw ApplicationName to one of the 5 Indus Product buckets. */
function productOf(app?: string | null): string {
  const x = (app || "").toLowerCase();
  if (x.includes("estimo")) return "Estimoprime";
  if (x.includes("printude") || x.includes("printtude")) return "PrintudeERp";
  if (x.includes("multi")) return "MultiUnit";
  if (x.includes("desktop")) return "Desktop";
  return "Other";
}

function ProductFilter({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (p: string) => { const n = new Set(selected); if (n.has(p)) n.delete(p); else n.add(p); onChange(n); };
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ ...linkBtn, gap: 7, ...(selected.size ? { border: "1px solid rgb(var(--color-primary))", color: "rgb(var(--color-primary))", background: "color-mix(in srgb, rgb(var(--color-primary)) 7%, white)" } : {}) }}>
        <Package size={14} /> Indus Product{selected.size ? ` (${selected.size})` : ""} <ChevronDown size={13} style={{ opacity: 0.7 }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, background: "rgb(var(--bg-surface))", border: "1px solid #dce2ec", borderRadius: 10, boxShadow: "0 12px 32px rgba(15,23,42,.16)", minWidth: 200, padding: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgb(var(--fg-subtle))", textTransform: "uppercase", letterSpacing: 0.4, padding: "4px 8px 6px" }}>Indus Product</div>
          {PRODUCTS.map((pr) => {
            const on = selected.has(pr);
            return (
              <button key={pr} onClick={() => toggle(pr)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 7, fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-default))", textAlign: "left" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f7fb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                {on ? <CheckSquare size={16} style={{ color: "rgb(var(--color-primary))" }} /> : <Square size={16} style={{ color: "rgb(var(--fg-subtle))" }} />}
                {pr}
              </button>
            );
          })}
          {selected.size > 0 && (
            <button onClick={() => onChange(new Set())}
              style={{ width: "100%", padding: "8px 10px", border: "none", borderTop: "1px solid #eef1f6", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))", marginTop: 4, textAlign: "left" }}>
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: "relative" }}>
      <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "rgb(var(--fg-subtle))" }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", height: 34, padding: "0 10px 0 30px", fontSize: 13, border: "1px solid #d8dee9", borderRadius: 8, outline: "none", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", boxSizing: "border-box" }} />
    </div>
  );
}

const panel: React.CSSProperties = { display: "flex", flexDirection: "column", background: "rgb(var(--bg-surface))", border: "1px solid #e6eaf1", borderRadius: 12, boxShadow: "0 1px 3px rgba(15,23,42,.05)", overflow: "hidden", maxHeight: "calc(100vh - 180px)" };
const panelHead: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid #eef1f6", flexShrink: 0 };
const linkBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #dce2ec", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 };
