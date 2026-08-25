"use client";
import { useEffect, useState } from "react";
import { Page, Card, CardContent, Button, Dropdown } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { Save, Check } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { PmHeader } from "../shared";
import { pmApi, type AppUserInfo, type PmModuleInfo } from "@/lib/tms";

function UserPermissions() {
  const [users, setUsers] = useState<AppUserInfo[]>([]);
  const [modules, setModules] = useState<PmModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<number | "">("");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([pmApi.appUsers(), pmApi.pmModules()])
      .then(([u, m]) => { setUsers(u); setModules(m); })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function pickUser(id: number | "") {
    setUserId(id); setChecked(new Set()); setMsg(null);
    if (!id) return;
    setLoadingPerms(true);
    try { const ids = await pmApi.userModules(Number(id)); setChecked(new Set(ids)); }
    catch (e) { setErr(String(e)); }
    finally { setLoadingPerms(false); }
  }

  function toggle(mid: number) {
    setChecked((prev) => { const n = new Set(prev); n.has(mid) ? n.delete(mid) : n.add(mid); return n; });
  }

  async function save() {
    if (!userId) return;
    setSaving(true); setMsg(null);
    try { await pmApi.saveUserModules(Number(userId), [...checked]); setMsg("Permissions saved. The user's sidebar updates on their next login/refresh."); }
    catch (e) { setErr(String(e)); }
    finally { setSaving(false); }
  }

  if (loading) return <BrandedLoader size="lg" text="Loading…" />;

  return (
    <Page>
      <PmHeader page="permissions" />
      {err && <div style={{ color: "#c0392b", marginBottom: 14 }}>Error: <small>{err}</small></div>}
      <Card>
        <CardContent>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
            <div style={{ minWidth: 300 }}>
              <Dropdown value={userId ? String(userId) : ""} onValueChange={(v) => pickUser(v ? Number(v) : "")}
                options={[{ value: "", label: "— Select a user —" }, ...users.map((u) => ({ value: String(u.userId), label: `${u.fullName} (${u.email})` }))]}
                placeholder="— Select a user —" searchable size="md" />
            </div>
            {userId !== "" && (
              <Button onClick={save} disabled={saving || loadingPerms}><Save size={15} style={{ marginRight: 6 }} /> {saving ? "Saving…" : "Save Permissions"}</Button>
            )}
          </div>

          {msg && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "10px 14px", borderRadius: 9, fontSize: 13.5, background: "#eaf7ee", color: "#1e7e46" }}><Check size={16} /> {msg}</div>}

          {userId === "" ? (
            <div style={{ opacity: 0.55, fontSize: 13.5, padding: "10px 0" }}>Select a user to manage their page access.</div>
          ) : loadingPerms ? <BrandedLoader size="md" text="Loading permissions…" /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {modules.map((m) => (
                <label key={m.moduleID} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--bd-subtle,#eef1f6)", borderRadius: 9, cursor: "pointer" }}>
                  <input type="checkbox" checked={checked.has(m.moduleID)} onChange={() => toggle(m.moduleID)} />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.moduleDisplayName}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

export default function Page_() {
  return <PmGuard module="/point-management/permissions"><UserPermissions /></PmGuard>;
}
