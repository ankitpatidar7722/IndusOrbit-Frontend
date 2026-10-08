"use client";
import { AlertTriangle } from "lucide-react";

/**
 * The "Leave anyway / Cancel" confirmation shown by {@link useInProgressNavGuard} when the user tries
 * to navigate away (sidebar / in-app link) while a long operation is running. Tab-close / refresh is
 * handled separately by the guard's native `beforeunload` prompt. The `data-leave-guard` marker tells
 * the guard to ignore clicks inside this dialog (so its own buttons don't re-trigger the popup).
 */
export default function LeaveGuardDialog({
  open, title, message, onConfirm, onCancel,
}: {
  open: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div data-leave-guard onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,14,24,.62)", display: "grid", placeItems: "center", padding: 18 }}>
      <div style={{ width: "min(440px,94vw)", background: "rgb(var(--bg-surface))", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
        <div style={{ padding: "22px 24px 8px", display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: "#fef2f2", color: "#dc2626", display: "grid", placeItems: "center", flexShrink: 0 }}><AlertTriangle size={22} /></span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "rgb(var(--fg-default))" }}>{title ?? "Leave while this is running?"}</div>
            <div style={{ fontSize: 13.5, color: "rgb(var(--fg-muted))", marginTop: 6, lineHeight: 1.5 }}>
              {message ?? "An operation is in progress. If you leave this page you'll lose track of it."}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px 18px" }}>
          <button onClick={onCancel}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(100deg,rgb(var(--color-primary)),color-mix(in srgb, rgb(var(--color-primary)) 60%, white))", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgb(var(--bg-surface))", color: "#dc2626", border: "1px solid #f3c6c6", borderRadius: 10, padding: "10px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            Leave anyway
          </button>
        </div>
      </div>
    </div>
  );
}
