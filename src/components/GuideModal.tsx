"use client";
import { X } from "lucide-react";

/**
 * In-app popup that shows a self-contained guide page (from /public) inside an iframe — so a
 * "Help" click opens a popup, not a new browser tab. The guide's own English / हिन्दी toggle
 * (top of the page) lets the reader pick a language.
 */
export default function GuideModal({ src, title, onClose }: { src: string | null; title?: string; onClose: () => void }) {
  if (!src) return null;
  return (
    <div
      onClick={onClose}
      className="guide-modal-backdrop"
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: "min(4vw, 40px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="guide-modal-card"
        style={{ width: "min(940px, 100%)", height: "min(90vh, 100%)", background: "rgb(var(--bg-surface))", border: "1px solid rgba(148,163,184,.25)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 90px rgba(0,0,0,.45)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid rgba(148,163,184,.22)", background: "rgb(var(--color-primary))", color: "#fff" }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>{title || "Setup Guide"}</span>
          <button onClick={onClose} aria-label="Close" style={{ marginLeft: "auto", background: "rgba(255,255,255,.14)", border: "none", cursor: "pointer", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8 }}>
            <X size={17} />
          </button>
        </div>
        <iframe src={src} title={title || "Setup Guide"} style={{ flex: 1, border: "none", width: "100%", background: "#fff" }} />
      </div>
    </div>
  );
}
