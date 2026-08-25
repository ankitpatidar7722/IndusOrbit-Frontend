"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StandardModal, PageLoading, Badge, Textarea } from "indas-ui";
import { pmApi, statusVariant, priorityVariant, fmtMins, fmtDateTime, type PointDetail, type PointHistoryRow, type AttachmentRow } from "@/lib/tms";
import type { BadgeVariant } from "@/lib/ui";

/** State + data-loading for the point action drawer, shared by role dashboards. */
export function usePointDrawer(onDone: () => void) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PointDetail | null>(null);
  const [history, setHistory] = useState<PointHistoryRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const open = useCallback(async (id: number) => {
    setOpenId(id); setDetail(null); setHistory([]); setAttachments([]); setRemark("");
    try {
      const [d, h, a] = await Promise.all([pmApi.pointDetail(id), pmApi.pointHistory(id), pmApi.listAttachments(id)]);
      setDetail(d); setHistory(h); setAttachments(a);
    } catch (e) { setErr(String(e)); }
  }, []);

  const close = useCallback(() => setOpenId(null), []);

  const refreshAttachments = useCallback(async () => {
    if (openId != null) { try { setAttachments(await pmApi.listAttachments(openId)); } catch { /* ignore */ } }
  }, [openId]);

  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); if (openId != null) await open(openId); onDone(); }
    catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }, [openId, open, onDone]);

  return { openId, detail, history, attachments, remark, setRemark, busy, err, open, close, act, refreshAttachments };
}

export type Drawer = ReturnType<typeof usePointDrawer>;

/**
 * Auto-opens the point drawer when a board is reached with ?pointId=N in the URL
 * (e.g. clicking a Point Management notification). Fires once per distinct id.
 */
export function usePointIdFromUrl(open: (id: number) => void) {
  const params = useSearchParams();
  const pid = params.get("pointId");
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!pid || opened.current === pid) return;
    const id = Number(pid);
    if (!Number.isFinite(id) || id <= 0) return;
    opened.current = pid;
    open(id);
  }, [pid, open]);
}

/** The drawer UI: point info + time summary + remark + role actions + attachments + QC-cycle history. */
export function PointDrawer({ drawer, actions, uploaderId }: { drawer: Drawer; actions: React.ReactNode; uploaderId: number }) {
  const { openId, detail, history, attachments, remark, setRemark, close } = drawer;
  const extra = detail ? (detail.totalTimeSpent ?? 0) - (detail.expectedMinutes ?? 0) : 0;

  return (
    <StandardModal
      isOpen={openId !== null}
      onClose={close}
      title={detail ? `Ticket #${detail.pointID}` : "Loading…"}
      subtitle={detail ? `${detail.customerName ?? ""}${detail.productName ? ` · ${detail.productName}` : ""}` : ""}
      size="lg"
      className="pm-modal-center"
    >
      {!detail ? <PageLoading size="md" text="Loading…" /> : (
        <div>
          {/* Ticket + status */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Cap>Ticket</Cap>
              <div style={{ fontSize: 17, fontWeight: 800, color: "rgb(var(--fg-default))", lineHeight: 1.35 }}>#{detail.pointID}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
              <Badge variant={statusVariant(detail.status)}>{detail.status}</Badge>
              {detail.isDeveloperPaused && <Badge variant="amber">Paused</Badge>}
            </div>
          </div>

          {/* Priority | Complexity */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 0", borderTop: "1px solid #eef1f5", borderBottom: "1px solid #eef1f5", marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Cap inline>Priority</Cap> {detail.priority ? <Badge variant={priorityVariant(detail.priority)}>{detail.priority}</Badge> : <span style={{ fontSize: 13 }}>—</span>}</span>
            <span style={{ opacity: 0.25 }}>|</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Cap inline>Complexity</Cap> {detail.complexity ? <Badge variant={complexityVariant(detail.complexity)}>{detail.complexity}</Badge> : <span style={{ fontSize: 13 }}>—</span>}</span>
          </div>

          {/* Description */}
          {detail.description && (
            <div style={{ background: "rgb(var(--bg-subtle))", borderLeft: "3px solid rgb(var(--color-primary))", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
              <Cap>Description</Cap>
              <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", lineHeight: 1.6, color: "rgb(var(--fg-default))" }}>{detail.description}</div>
            </div>
          )}

          {/* Detail cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <InfoCard label="Customer" value={detail.customerName} />
            <InfoCard label="Product" value={detail.productName} />
            <InfoCard label="Module" value={detail.module} />
            <InfoCard label="Sub Module" value={detail.subModule} />
            <InfoCard label="Category" value={detail.category} />
            <InfoCard label="Reported By" value={detail.reportedByName} />
            <InfoCard label="Assigned To" value={detail.assignedToName} />
            <InfoCard label="Created On" value={fmtDateTime(detail.dateCreated)} />
            <InfoCard label="Expected Date" value={fmtDateTime(detail.expectedDate)} />
          </div>

          {/* Time metrics (work tracker) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
            <Metric label="Estimate" value={fmtMins(detail.expectedMinutes)} />
            <Metric label="Time spent" value={fmtMins(detail.totalTimeSpent)} />
            <Metric label="Paused" value={fmtMins(detail.pauseTimeMinutes)} />
            <Metric label="Over" value={extra > 0 ? fmtMins(extra) : "—"} danger={extra > 0} />
          </div>

          {(detail.developerRemark || detail.supportRemark || detail.testerRemark || detail.adminRemark) && (
            <div style={{ marginBottom: 14, display: "grid", gap: 4, fontSize: 12.5 }}>
              {detail.developerRemark && <div><b>Dev:</b> {detail.developerRemark}</div>}
              {detail.supportRemark && <div><b>Support:</b> {detail.supportRemark}</div>}
              {detail.testerRemark && <div><b>Tester:</b> {detail.testerRemark}</div>}
              {detail.adminRemark && <div><b>Admin:</b> {detail.adminRemark}</div>}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <Lbl>Remark</Lbl>
            <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} placeholder="Optional remark sent with your action…" />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>{actions}</div>

          <Lbl>Attachments</Lbl>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 2, marginBottom: 16 }}>
            {attachments.length === 0 && <span style={{ fontSize: 12.5, opacity: 0.5 }}>None</span>}
            {attachments.map((a) => (
              <span key={a.attachmentID} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--bd-subtle,#eef1f6)", borderRadius: 8, padding: "5px 9px", fontSize: 12.5 }}>
                <a href={pmApi.attachmentDownloadUrl(a.attachmentID)} target="_blank" rel="noreferrer" style={{ color: "rgb(var(--color-primary))", textDecoration: "none", fontWeight: 600 }}>{a.originalFileName || a.fileName}</a>
                <button onClick={async () => { await pmApi.deleteAttachment(a.attachmentID); drawer.refreshAttachments(); }} title="Delete"
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "#c0392b", fontSize: 15, lineHeight: 1 }}>×</button>
              </span>
            ))}
            <label style={{ cursor: "pointer" }}>
              <input type="file" style={{ display: "none" }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f && detail) { try { await pmApi.uploadAttachment(detail.pointID, f, uploaderId); await drawer.refreshAttachments(); } finally { e.target.value = ""; } }
                }} />
              <span style={{ border: "1px dashed #b9c2d0", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600 }}>+ Upload file</span>
            </label>
          </div>

          <Lbl>QC cycle history</Lbl>
          {history.length === 0 ? <div style={{ fontSize: 12.5, opacity: 0.5 }}>No cycles yet.</div> : (
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {history.map((h) => (
                <div key={h.historyID} style={{ border: "1px solid var(--bd-subtle,#eef1f6)", borderRadius: 9, padding: "8px 12px", fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b>{h.cycleStatus}</b>
                    <span style={{ opacity: 0.6 }}>{fmtDateTime(h.completeDate ?? h.startDate)}</span>
                  </div>
                  <div style={{ opacity: 0.75, marginTop: 3 }}>
                    Dev: {h.developerName ?? "—"} · {fmtMins(h.timeSpentMinutes)}{h.extraTimeMinutes ? ` (+${fmtMins(h.extraTimeMinutes)} over)` : ""}
                    {h.supportName ? ` · Support: ${h.supportName}` : ""}{h.testerName ? ` · Tester: ${h.testerName}` : ""}
                  </div>
                  {(h.developerRemark || h.testerRemark || h.supportRemark) && (
                    <div style={{ opacity: 0.7, marginTop: 3 }}>“{h.testerRemark || h.supportRemark || h.developerRemark}”</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </StandardModal>
  );
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--bd-subtle,#eef1f6)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color: danger ? "#c0392b" : undefined }}>{value}</div>
    </div>
  );
}
export const Lbl = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 12, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", fontWeight: 600, marginBottom: 5 }}>{children}</div>
);

/** Small uppercase caption label (image-#2 card style). */
function Cap({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return <span style={{ display: inline ? "inline" : "block", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "rgb(var(--fg-subtle))", marginBottom: inline ? 0 : 4 }}>{children}</span>;
}

/** A labelled detail card in the 2-column info grid. */
function InfoCard({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ background: "rgb(var(--bg-subtle))", border: "1px solid #eef1f5", borderRadius: 10, padding: "10px 13px" }}>
      <Cap>{label}</Cap>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgb(var(--fg-default))", wordBreak: "break-word" }}>{value && String(value).trim() ? value : "—"}</div>
    </div>
  );
}

/** Complexity → Badge colour (Simple=green, Medium=amber, Complex=red). */
function complexityVariant(c?: string | null): BadgeVariant {
  switch ((c || "").trim().toLowerCase()) {
    case "simple": return "success";
    case "medium": return "amber";
    case "complex": return "destructive";
    default: return "secondary";
  }
}
export const actionIcon: React.CSSProperties = { marginRight: 5 };
