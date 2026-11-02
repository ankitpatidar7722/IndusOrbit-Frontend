"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button, Input, StandardModal } from "indas-ui";
import KDropdown from "@/components/KDropdown";
import { api, type CommunicationSave } from "@/lib/api";
import { customersApi, type CustomerCard } from "@/lib/customers";
import type { MailMessage } from "@/lib/mail";

/**
 * "Add to Communication Log" from the email reader — files an email (typically one the CLIENT sent us,
 * which the app can't see on its own) into that client's Tracker → Communication Log as a manual entry.
 * Keyed by CompanyUserID, same as the rest of the log. The client is pre-picked when the sender's
 * address (or company domain) matches a client's email.
 */
const OUTCOMES = ["Connected", "No Answer", "Busy", "Call Back", "Resolved", "Pending"];
const PUBLIC_DOMAINS = new Set(["gmail.com", "yahoo.com", "yahoo.co.in", "hotmail.com", "outlook.com", "live.com", "rediffmail.com", "icloud.com", "ymail.com"]);

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d.getTime())) return ""; return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const domainOf = (e?: string | null) => (e || "").trim().toLowerCase().split("@")[1] || "";
const stripHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 5 } as const;
const field = { width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1px solid rgb(var(--bd-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", boxSizing: "border-box" } as const;

export default function LogToClientModal({ m, userEmail, onClose, onLogged }: {
  m: MailMessage; userEmail: string; onClose: () => void; onLogged: (clientName: string) => void;
}) {
  const { data: session } = useSession();
  const me = (session?.user as { name?: string } | undefined)?.name ?? "";

  // Mail the user received → Inbound from the sender; mail the user sent → Outbound to the first recipient.
  const inbound = (m.from?.email || "").toLowerCase() !== userEmail.toLowerCase();
  const party = inbound ? m.from : m.to?.[0];
  const body = (m.bodyText && m.bodyText.trim()) || (m.bodyHtml ? stripHtml(m.bodyHtml) : "") || m.snippet || "";

  const [clients, setClients] = useState<CustomerCard[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientId, setClientId] = useState("");
  const [f, setF] = useState<CommunicationSave>({
    commDateTime: toLocalInput(m.receivedAt), mode: "Email", direction: inbound ? "Inbound" : "Outbound",
    contactPerson: party?.name || "", contactInfo: party?.email || "", outcome: "Connected", durationMinutes: null,
    subject: m.subject || "", notes: body.slice(0, 1500), followUpDate: "", handledBy: me,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dupWarn, setDupWarn] = useState(false);

  useEffect(() => { if (me) setF((p) => (p.handledBy ? p : { ...p, handledBy: me })); }, [me]);

  // Same client list the Tracker shows (respects Project Assignment); pre-pick by sender email / company domain.
  useEffect(() => {
    customersApi.list({ assignedOnly: true }).then((list) => {
      setClients(list);
      const addr = (party?.email || "").trim().toLowerCase();
      const dom = domainOf(addr);
      const hit = list.find((c) => (c.email || "").trim().toLowerCase() === addr)
        ?? (dom && !PUBLIC_DOMAINS.has(dom) ? list.find((c) => domainOf(c.email) === dom) : undefined);
      if (hit?.companyUserID) setClientId(hit.companyUserID.trim());
    }).catch(() => setClients([])).finally(() => setLoadingClients(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => clients
    .filter((c) => (c.companyUserID || "").trim())
    .map((c) => ({ value: c.companyUserID.trim(), label: `${c.companyName}${c.companyUniqueCode ? ` (${c.companyUniqueCode})` : ""}` })), [clients]);
  const clientName = clients.find((c) => (c.companyUserID || "").trim() === clientId)?.companyName ?? clientId;

  const save = async (force = false) => {
    if (!clientId) { setErr("Please select a client."); return; }
    setErr(null); setSaving(true);
    try {
      // Guard against filing the same email twice (same subject + contact + minute).
      if (!force) {
        const existing = await api.getCommunications(clientId).catch(() => []);
        const sameMinute = (w?: string | null) => toLocalInput(w) === f.commDateTime;
        const dup = existing.some((r) => (r.subject || "") === (f.subject || "") && (r.contactInfo || "").toLowerCase() === (f.contactInfo || "").toLowerCase() && sameMinute(r.when));
        if (dup) { setDupWarn(true); setSaving(false); return; }
      }
      await api.addCommunication(clientId, { ...f, followUpDate: f.followUpDate || null });
      onLogged(clientName);
    } catch (e) { setErr(`Could not save: ${String(e)}`); } finally { setSaving(false); }
  };

  return (
    <StandardModal isOpen onClose={onClose} title="Add to Communication Log" size="lg" showFooter={false} disableOutsideClose>
      <div style={{ padding: 2 }}>
        <div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))", marginBottom: 12 }}>
          This email will appear in the selected client&apos;s Tracker → Communication Log. &ldquo;Logged by&rdquo; and the log time are recorded automatically.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px 14px" }}>
          <div style={{ gridColumn: "span 2" }}><label style={lbl}>Client</label>
            <KDropdown value={clientId} onValueChange={(v) => { setClientId(String(v ?? "")); setDupWarn(false); }} options={options}
              placeholder={loadingClients ? "Loading clients…" : "Select client"} searchable size="md" /></div>
          <div><label style={lbl}>Direction</label>
            <KDropdown value={f.direction} onValueChange={(v) => setF({ ...f, direction: String(v) })} options={["Inbound", "Outbound"].map((d) => ({ value: d, label: d }))} size="md" /></div>
          <div><label style={lbl}>Outcome</label>
            <KDropdown value={f.outcome} onValueChange={(v) => setF({ ...f, outcome: String(v) })} options={OUTCOMES.map((o) => ({ value: o, label: o }))} size="md" /></div>
          <div><label style={lbl}>Date &amp; Time</label>
            <input type="datetime-local" value={f.commDateTime ?? ""} onChange={(e) => setF({ ...f, commDateTime: e.target.value })} style={field} /></div>
          <div><label style={lbl}>Client Contact Person</label><Input value={f.contactPerson ?? ""} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} /></div>
          <div><label style={lbl}>Contact Email</label><Input value={f.contactInfo ?? ""} onChange={(e) => setF({ ...f, contactInfo: e.target.value })} /></div>
          <div><label style={lbl}>Follow-up Date</label>
            <input type="date" value={f.followUpDate ?? ""} onChange={(e) => setF({ ...f, followUpDate: e.target.value })} style={field} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Subject</label><Input value={f.subject ?? ""} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Notes</label>
            <textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={4}
              style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid rgb(var(--bd-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
        </div>
        {err && <div style={{ marginTop: 10, fontSize: 12.5, color: "#c0392b" }}>{err}</div>}
        {dupWarn && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "rgb(var(--fg-default))", background: "rgb(var(--color-warning) / 0.12)", border: "1px solid rgb(var(--color-warning) / 0.4)", borderRadius: 8, padding: "8px 12px" }}>
            This email already appears in {clientName}&apos;s Communication Log. Click <b>Add Anyway</b> to log it again.
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16, paddingTop: 12, borderTop: "1px solid rgb(var(--bd-default))" }}>
          <Button size="sm" variant="action-cancel" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="action-save" loading={saving} onClick={() => save(dupWarn)}>{dupWarn ? "Add Anyway" : "Add to Log"}</Button>
        </div>
      </div>
    </StandardModal>
  );
}
