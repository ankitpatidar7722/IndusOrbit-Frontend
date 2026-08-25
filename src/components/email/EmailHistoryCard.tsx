"use client";
import { useCallback, useEffect, useState } from "react";
import { Mail, Paperclip, CheckCircle2, AlertCircle } from "lucide-react";
import { emailApi, type EmailHistoryItem } from "@/lib/email";

/** Sent-email history for a Client (or Point/Issue) — the "related history" surface. */
export default function EmailHistoryCard({ clientCode, pointId, refreshKey = 0 }: { clientCode?: string; pointId?: number; refreshKey?: number }) {
  const [rows, setRows] = useState<EmailHistoryItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try { setRows(await emailApi.history({ clientCode, pointId })); }
    catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
  }, [clientCode, pointId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const attachCount = (json?: string) => { try { return json ? (JSON.parse(json) as unknown[]).length : 0; } catch { return 0; } };
  const fmt = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };

  return (
    <div style={{ background: "rgb(var(--bg-surface))", border: "1px solid #e9edf3", borderRadius: 14, boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.05), 0 24px 48px -22px rgba(16,24,40,0.12)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #eef1f5", background: "linear-gradient(180deg,#fbfcfe,#ffffff)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "rgb(var(--bg-subtle))", color: "rgb(var(--color-primary))" }}><Mail size={15} /></div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(var(--fg-default))" }}>Email History</div>
        {rows && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "rgb(var(--fg-subtle))", fontWeight: 600 }}>{rows.length} sent</span>}
      </div>
      <div style={{ padding: "6px 8px" }}>
        {err && <div style={{ padding: 12, color: "#c0392b", fontSize: 13 }}>{err}</div>}
        {!err && rows === null && <div style={{ padding: 16, textAlign: "center", opacity: 0.6, fontSize: 13 }}>Loading…</div>}
        {!err && rows?.length === 0 && <div style={{ padding: 16, textAlign: "center", opacity: 0.55, fontSize: 13 }}>No emails sent yet for this record.</div>}
        {rows?.map((r) => {
          const ok = r.status === "Sent";
          const n = attachCount(r.attachmentsJson);
          return (
            <div key={r.id} style={{ display: "flex", gap: 10, padding: "9px 10px", borderBottom: "1px solid #f4f6f9", alignItems: "flex-start" }}>
              <div style={{ paddingTop: 2 }}>{ok ? <CheckCircle2 size={15} color="#1c9a54" /> : <AlertCircle size={15} color="#c0392b" />}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-default))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.subject || "(no subject)"}</div>
                <div style={{ fontSize: 11.5, color: "rgb(var(--fg-muted))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>To {r.recipients || "—"}</div>
                {!ok && r.errorMessage && <div style={{ fontSize: 11, color: "#c0392b", marginTop: 2 }}>{r.errorMessage}</div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: "rgb(var(--fg-subtle))", whiteSpace: "nowrap" }}>{fmt(r.sentAt)}</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 2, alignItems: "center" }}>
                  {n > 0 && <span style={{ fontSize: 11, color: "rgb(var(--fg-muted))", display: "inline-flex", alignItems: "center", gap: 2 }}><Paperclip size={11} />{n}</span>}
                  {r.sentByName && <span style={{ fontSize: 11, color: "rgb(var(--fg-subtle))" }}>· {r.sentByName}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
