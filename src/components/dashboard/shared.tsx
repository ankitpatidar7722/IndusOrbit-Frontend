// Shared helpers for the Dashboard tabs (Overview / Onboarding / Subscriptions).
// All dashboards run on REAL data — control-DB subscriptions + the internal CRM list.
import React from "react";

export const CHART_H = 300;

// A distinct, readable categorical palette (ECharts needs hex, not CSS vars).
export const PALETTE = ["#3b6fb5", "#22c55e", "#f59e0b", "#8b5cf6", "#14b8a6", "#ef4444", "#06b6d4", "#eab308", "#ec4899", "#64748b"];
export const colorAt = (i: number) => PALETTE[i % PALETTE.length];

export const emptyChart = (h: number, msg: string) => (
  <div style={{ height: h, display: "grid", placeItems: "center", color: "rgb(var(--fg-muted))", fontSize: 13 }}>{msg}</div>
);

export const kpiGridStyle = (isMobile: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))",
  gap: isMobile ? 10 : 14, marginBottom: 18,
});

export const chartGridStyle = (isMobile: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 16, marginBottom: 22,
});

/** Days from today until `d` (negative = already past). null for unparseable/empty. */
export function daysUntil(d?: string | null): number | null {
  if (!d) return null;
  const t = new Date(d);
  if (isNaN(t.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

/** Count occurrences of a key across items → sorted [name,count] pairs (desc), top `limit`. */
export function countBy<T>(items: T[], keyFn: (t: T) => string | null | undefined, limit = 999): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const raw = (keyFn(it) ?? "").toString().trim();
    const k = raw || "Other";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, value]) => ({ name, value }));
}
