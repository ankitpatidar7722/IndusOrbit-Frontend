"use client";
import { useMemo, type CSSProperties } from "react";
import { AlertCircle } from "lucide-react";

// Shared "Validation Summary" — the 6-card counts row shown after Check Validation, matching
// BulkImport (Total / Valid / Duplicate / Missing / Mismatch / Invalid Content). Each card is
// clickable to filter the grid to those rows. Colors mirror the per-cell coloring.

export type SummaryFilter = "all" | "valid" | "duplicate" | "missing" | "mismatch" | "invalid";
export interface ValidationSummaryData {
  totalRows: number; validRows: number; duplicateCount: number;
  missingDataCount: number; mismatchCount: number; invalidContentCount: number;
}

type Card = { key: SummaryFilter; label: string; value: number; fg: string; bg: string; ring: string };

export default function ValidationSummary({ summary, active, onFilter }: {
  summary: ValidationSummaryData; active: SummaryFilter; onFilter: (f: SummaryFilter) => void;
}) {
  const cards = useMemo<Card[]>(() => [
    { key: "all", label: "TOTAL ROWS", value: summary.totalRows ?? 0, fg: "rgb(var(--fg-default))", bg: "rgba(148,163,184,0.14)", ring: "rgb(var(--color-primary))" },
    { key: "valid", label: "VALID ROWS", value: summary.validRows ?? 0, fg: "#16a34a", bg: "rgba(34,197,94,0.12)", ring: "#22c55e" },
    { key: "duplicate", label: "DUPLICATE", value: summary.duplicateCount ?? 0, fg: "#dc2626", bg: "rgba(239,68,68,0.12)", ring: "#ef4444" },
    { key: "missing", label: "MISSING", value: summary.missingDataCount ?? 0, fg: "#2563eb", bg: "rgba(59,130,246,0.12)", ring: "#3b82f6" },
    { key: "mismatch", label: "MISMATCH", value: summary.mismatchCount ?? 0, fg: "#ca8a04", bg: "rgba(234,179,8,0.16)", ring: "#eab308" },
    { key: "invalid", label: "INVALID CONTENT", value: summary.invalidContentCount ?? 0, fg: "#9333ea", bg: "rgba(168,85,247,0.14)", ring: "#a855f7" },
  ], [summary]);

  const callouts: { color: string; text: string }[] = [];
  if (summary.duplicateCount > 0) callouts.push({ color: "#dc2626", text: `${summary.duplicateCount} duplicate row(s) — remove the red rows before saving.` });
  if (summary.missingDataCount > 0) callouts.push({ color: "#2563eb", text: `${summary.missingDataCount} cell(s) missing required data (blue) — fill them in.` });
  if (summary.mismatchCount > 0) callouts.push({ color: "#ca8a04", text: `${summary.mismatchCount} value(s) don't match the master (yellow) — check the lookup columns.` });
  if (summary.invalidContentCount > 0) callouts.push({ color: "#9333ea", text: `${summary.invalidContentCount} cell(s) have invalid format (purple) — hover for details.` });

  const cardStyle = (c: Card, on: boolean): CSSProperties => ({
    padding: "10px 12px", borderRadius: 12, cursor: "pointer", textAlign: "center", background: c.bg,
    border: `1px solid ${on ? c.ring : "transparent"}`, boxShadow: on ? `0 0 0 2px ${c.ring}` : "none",
    transition: "box-shadow .12s, border-color .12s",
  });

  return (
    <div style={{ background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-default))", borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13, fontWeight: 800, color: "rgb(var(--fg-default))" }}>
        <AlertCircle size={16} color="#3b82f6" /> Validation Summary
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {cards.map((c) => (
          <div key={c.key} onClick={() => onFilter(c.key)} style={cardStyle(c, active === c.key)} role="button" tabIndex={0}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.fg, letterSpacing: 0.4 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.fg, lineHeight: 1.15 }}>{c.value}</div>
          </div>
        ))}
      </div>
      {callouts.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
          {callouts.map((co, i) => (
            <div key={i} style={{ fontSize: 12, fontWeight: 600, color: co.color }}>⚠️ {co.text}</div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11.5, color: "rgb(var(--fg-muted))" }}>
        Edit cells directly in the grid below, or click a summary card to filter the rows.
      </div>
    </div>
  );
}
