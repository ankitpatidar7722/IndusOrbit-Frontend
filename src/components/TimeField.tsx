"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";

/**
 * Clock-face time picker — the time counterpart of DateField: a field that opens a watch dial
 * (pick the hour, then the minute, toggle AM/PM). Value contract is a plain "HH:mm" (24h) string,
 * "" when empty — the same format the tracker forms already store.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const toLabel = (v: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(v || "");
  if (!m) return "";
  const H = Number(m[1]);
  return `${pad(H % 12 || 12)}:${m[2]} ${H >= 12 ? "PM" : "AM"}`;
};

const DIAL = 232;                 // dial diameter (px)
const R_NUM = DIAL / 2 - 26;      // radius the numbers sit on
const POP_W = 288, POP_H = 410;   // popover size used for placement

export default function TimeField({ value, onChange, placeholder = "Select time", disabled }: {
  value?: string | null; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const [h12, setH12] = useState(10);
  const [min, setMin] = useState(0);
  const [pm, setPm] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const trigRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Open: seed the dial from the current value (or the current time, rounded to 5 min).
  const openPicker = () => {
    if (disabled) return;
    const m = /^(\d{2}):(\d{2})$/.exec(value || "");
    let H: number, M: number;
    if (m) { H = Number(m[1]); M = Number(m[2]); }
    else { const d = new Date(); H = d.getHours(); M = Math.round(d.getMinutes() / 5) * 5 % 60; }
    setH12(H % 12 || 12); setMin(M); setPm(H >= 12); setMode("hour"); setOpen(true);
  };

  // Place under the field (or above when there's no room), clamped to the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom >= POP_H + 8;
      const top = below ? r.bottom + 6 : Math.max(8, r.top - POP_H - 6);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - POP_W - 8);
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || trigRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey, true); };
  }, [open]);

  const commit = (hh = h12, mm = min, isPm = pm) => {
    const H = (hh % 12) + (isPm ? 12 : 0);
    onChange(`${pad(H)}:${pad(mm)}`);
  };

  // Click / drag anywhere on the dial → nearest hour (1–12) or minute (5-min steps).
  const pickFromPoint = (clientX: number, clientY: number, finish: boolean) => {
    const el = popRef.current?.querySelector("[data-dial]") as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2), dy = clientY - (r.top + r.height / 2);
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;  // 0° = 12 o'clock
    if (deg < 0) deg += 360;
    if (mode === "hour") {
      const hh = Math.round(deg / 30) % 12 || 12;
      setH12(hh);
      if (finish) { commit(hh, min, pm); setMode("minute"); }
    } else {
      const mm = (Math.round(deg / 30) % 12) * 5;
      setMin(mm);
      if (finish) { commit(h12, mm, pm); setOpen(false); }
    }
  };
  const dragging = useRef(false);

  const handDeg = mode === "hour" ? (h12 % 12) * 30 : (min / 5) * 30;
  const items = mode === "hour"
    ? Array.from({ length: 12 }, (_, i) => ({ n: i === 0 ? 12 : i, label: String(i === 0 ? 12 : i) }))
    : Array.from({ length: 12 }, (_, i) => ({ n: i * 5, label: pad(i * 5) }));
  const selected = mode === "hour" ? h12 : min;

  const label = toLabel(value || "");
  const primary = "rgb(var(--color-primary))";

  return (
    <>
      <button ref={trigRef} type="button" onClick={() => (open ? setOpen(false) : openPicker())} disabled={disabled}
        style={{ width: "100%", height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 11px", borderRadius: 8,
          border: `1px solid ${open ? primary : "#cbd5e1"}`, background: "rgb(var(--bg-surface))",
          color: label ? "rgb(var(--fg-default))" : "rgb(var(--fg-muted))", fontSize: 13, cursor: disabled ? "default" : "pointer", textAlign: "left" }}>
        <span style={{ flex: 1 }}>{label || placeholder}</span>
        {label && !disabled && (
          <span role="button" aria-label="Clear time" onClick={(e) => { e.stopPropagation(); onChange(""); }}
            style={{ display: "inline-flex", color: "rgb(var(--fg-muted))" }}><X size={14} /></span>
        )}
        <Clock size={16} style={{ color: "rgb(var(--fg-muted))" }} />
      </button>

      {open && pos && createPortal(
        // pointerEvents:auto — an open modal sets pointer-events:none on <body>, so a body-portaled popover
        // must opt back in or the dial can't be clicked.
        <div ref={popRef} style={{ position: "fixed", pointerEvents: "auto", top: pos.top, left: pos.left, width: POP_W, zIndex: 10000,
          background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--bd-default))", borderRadius: 14,
          boxShadow: "0 18px 40px rgba(15,23,42,.22)", overflow: "hidden", userSelect: "none" }}>
          {/* header: HH : MM  AM/PM */}
          <div style={{ background: primary, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 38, fontWeight: 700, letterSpacing: 1 }}>
              <span onClick={() => setMode("hour")} style={{ cursor: "pointer", opacity: mode === "hour" ? 1 : 0.6 }}>{pad(h12)}</span>
              <span style={{ opacity: 0.6, margin: "0 2px" }}>:</span>
              <span onClick={() => setMode("minute")} style={{ cursor: "pointer", opacity: mode === "minute" ? 1 : 0.6 }}>{pad(min)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(["AM", "PM"] as const).map((ap) => {
                const on = (ap === "PM") === pm;
                return (
                  <button key={ap} type="button" onClick={() => { const p = ap === "PM"; setPm(p); commit(h12, min, p); }}
                    style={{ border: "1px solid rgba(255,255,255,.55)", borderRadius: 6, padding: "2px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      background: on ? "#fff" : "transparent", color: on ? primary : "#fff" }}>{ap}</button>
                );
              })}
            </div>
          </div>

          {/* dial */}
          <div style={{ padding: "16px 0 8px", display: "flex", justifyContent: "center" }}>
            <div data-dial
              onMouseDown={(e) => { dragging.current = true; pickFromPoint(e.clientX, e.clientY, false); }}
              onMouseMove={(e) => { if (dragging.current) pickFromPoint(e.clientX, e.clientY, false); }}
              onMouseUp={(e) => { dragging.current = false; pickFromPoint(e.clientX, e.clientY, true); }}
              onMouseLeave={() => { dragging.current = false; }}
              onTouchEnd={(e) => { const t = e.changedTouches[0]; if (t) { e.preventDefault(); pickFromPoint(t.clientX, t.clientY, true); } }}
              style={{ position: "relative", width: DIAL, height: DIAL, borderRadius: "50%", background: "rgb(var(--bg-subtle))", cursor: "pointer" }}>
              {/* hand */}
              <div style={{ position: "absolute", left: DIAL / 2 - 1, top: DIAL / 2 - R_NUM, width: 2, height: R_NUM, background: primary,
                transformOrigin: "bottom center", transform: `rotate(${handDeg}deg)`, transition: dragging.current ? "none" : "transform .18s" }} />
              <div style={{ position: "absolute", left: DIAL / 2 - 4, top: DIAL / 2 - 4, width: 8, height: 8, borderRadius: "50%", background: primary }} />
              {items.map((it, i) => {
                const a = (i * 30 - 90) * (Math.PI / 180);
                const x = DIAL / 2 + R_NUM * Math.cos(a), y = DIAL / 2 + R_NUM * Math.sin(a);
                const on = it.n === selected;
                return (
                  <div key={it.label} style={{ position: "absolute", left: x - 17, top: y - 17, width: 34, height: 34, borderRadius: "50%",
                    display: "grid", placeItems: "center", fontSize: 14, fontWeight: on ? 700 : 500, pointerEvents: "none",
                    background: on ? primary : "transparent", color: on ? "#fff" : "rgb(var(--fg-default))" }}>{it.label}</div>
                );
              })}
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 12, color: "rgb(var(--fg-muted))", paddingBottom: 6 }}>
            {mode === "hour" ? "Pick the hour" : "Pick the minutes"}
          </div>

          {/* footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderTop: "1px solid rgb(var(--bd-default))" }}>
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              style={{ background: "transparent", border: "none", color: "rgb(var(--fg-muted))", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Clear</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => { const d = new Date(); const H = d.getHours(), M = d.getMinutes(); setH12(H % 12 || 12); setMin(M); setPm(H >= 12); onChange(`${pad(H)}:${pad(M)}`); setOpen(false); }}
                style={{ background: "transparent", border: `1px solid ${primary}`, color: primary, borderRadius: 7, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Now</button>
              <button type="button" onClick={() => { commit(); setOpen(false); }}
                style={{ background: primary, border: "none", color: "#fff", borderRadius: 7, padding: "5px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>OK</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
