"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StandardModal, PageLoading, Textarea, Button } from "indas-ui";
import { Upload, Paperclip, Trash2 } from "lucide-react";
import { pmApi, fmtMins, type PointDetail, type AttachmentRow } from "@/lib/tms";

/** State + data-loading for the point action drawer, shared by role dashboards. */
export function usePointDrawer(onDone: () => void) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PointDetail | null>(null);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const open = useCallback(async (id: number) => {
    setOpenId(id); setDetail(null); setAttachments([]); setRemark("");
    try {
      const [d, a] = await Promise.all([pmApi.pointDetail(id), pmApi.listAttachments(id)]);
      setDetail(d); setAttachments(a);
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

  return { openId, detail, attachments, remark, setRemark, busy, err, open, close, act, refreshAttachments };
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

/** The drawer UI: point info + time summary + remark + attachments + role actions. */
export function PointDrawer({ drawer, actions, uploaderId }: { drawer: Drawer; actions: React.ReactNode; uploaderId: number }) {
  const { openId, detail, attachments, remark, setRemark, close } = drawer;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extra = detail ? (detail.totalTimeSpent ?? 0) - (detail.expectedMinutes ?? 0) : 0;

  return (
    <StandardModal
      isOpen={openId !== null}
      onClose={close}
      title={detail ? `Ticket #${detail.pointID}` : "Loading…"}
      subtitle=""
      badge={detail ? { label: detail.isDeveloperPaused ? `${detail.status} · Paused` : detail.status, variant: headerBadgeVariant(detail.status) } : undefined}
      size="lg"
      className="pm-modal-center"
    >
      {!detail ? <PageLoading size="md" text="Loading…" /> : (
        <div>
          {/* Title — the ticket's headline (restored; sits where Priority/Complexity were, which
              now show in the header). */}
          <div style={{ padding: "2px 0 11px", borderBottom: "1px solid #eef1f5", marginBottom: 12 }}>
            <Cap>Title</Cap>
            <div style={{ fontSize: 15, fontWeight: 700, color: "rgb(var(--fg-default))", lineHeight: 1.4, wordBreak: "break-word" }}>{detail.title?.trim() ? detail.title : "—"}</div>
          </div>

          {/* Detail cards — 4 per row; Description spans full width on the third row. */}
          <div className="pd-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
            <InfoCard label="Customer" value={detail.customerName} />
            <InfoCard label="Product" value={detail.productName} />
            <InfoCard label="Module" value={detail.module} />
            <InfoCard label="Sub Module" value={detail.subModule} />
            <InfoCard label="Category" value={detail.category} />
            <InfoCard label="Reported By" value={detail.reportedByName} />
            <InfoCard label="Assigned To" value={detail.assignedToName} />
            {detail.description && (
              <div style={{ gridColumn: "1 / -1", background: "rgb(var(--bg-subtle))", borderLeft: "3px solid rgb(var(--color-primary))", borderRadius: 10, padding: "13px 16px" }}>
                <Cap>Description</Cap>
                <div style={{ fontSize: 14.5, whiteSpace: "pre-wrap", lineHeight: 1.7, color: "rgb(var(--fg-default))" }}>{detail.description}</div>
              </div>
            )}
          </div>

          {/* Time metrics (work tracker) */}
          <div className="pd-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
            <Metric label="Estimate" value={fmtMins(detail.expectedMinutes)} />
            <Metric label="Time spent" value={fmtMins(detail.totalTimeSpent)} />
            <Metric label="Paused" value={fmtMins(detail.pauseTimeMinutes)} />
            <Metric label="Over" value={extra > 0 ? fmtMins(extra) : "—"} danger={extra > 0} />
          </div>

          {(detail.developerRemark || detail.supportRemark || detail.testerRemark || detail.adminRemark) && (
            <div style={{ marginBottom: 10, display: "grid", gap: 4, fontSize: 12.5 }}>
              {detail.developerRemark && <div><b>Dev:</b> {detail.developerRemark}</div>}
              {detail.supportRemark && <div><b>Support:</b> {detail.supportRemark}</div>}
              {detail.testerRemark && <div><b>Tester:</b> {detail.testerRemark}</div>}
              {detail.adminRemark && <div><b>Admin:</b> {detail.adminRemark}</div>}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <Lbl>Remark</Lbl>
            <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} placeholder="Optional remark sent with your action…" />
          </div>

          {/* Attachments — sits ABOVE the action buttons */}
          <div style={{ marginBottom: 12 }}>
            <Lbl>Attachments</Lbl>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 2 }}>
              {attachments.length === 0 && <span style={{ fontSize: 12.5, color: "rgb(var(--fg-subtle))" }}>No files attached yet.</span>}
              {attachments.map((a) => (
                <span key={a.attachmentID} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgb(var(--bg-subtle))", border: "1px solid #e6ebf2", borderRadius: 8, padding: "6px 10px", fontSize: 12.5 }}>
                  <Paperclip size={13} style={{ opacity: 0.55, flexShrink: 0 }} />
                  <a href={pmApi.attachmentDownloadUrl(a.attachmentID)} target="_blank" rel="noreferrer" style={{ color: "rgb(var(--color-primary))", textDecoration: "none", fontWeight: 600 }}>{a.originalFileName || a.fileName}</a>
                  <button onClick={async () => { await pmApi.deleteAttachment(a.attachmentID); drawer.refreshAttachments(); }} title="Delete"
                    style={{ display: "inline-flex", alignItems: "center", border: "none", background: "transparent", cursor: "pointer", color: "#c0392b", padding: 0, lineHeight: 0 }}><Trash2 size={13} /></button>
                </span>
              ))}
              <input ref={fileInputRef} type="file" style={{ display: "none" }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f && detail) { try { await pmApi.uploadAttachment(detail.pointID, f, uploaderId); await drawer.refreshAttachments(); } finally { e.target.value = ""; } }
                }} />
              <Button variant="outline" size="sm" icon={Upload} onClick={() => fileInputRef.current?.click()}>Upload file</Button>
            </div>
          </div>

          {/* Action buttons — one clean row, separated at the bottom */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", paddingTop: 12, borderTop: "1px solid #eef1f5" }}>{actions}</div>
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

/** Status → StandardModal header-badge variant (only default/outline/destructive are supported). */
function headerBadgeVariant(s?: string | null): "default" | "outline" | "destructive" {
  const x = (s || "").toLowerCase();
  if (x.includes("reject")) return "destructive";
  if (x.includes("hold")) return "outline";
  return "default";
}

export const actionIcon: React.CSSProperties = { marginRight: 5 };
