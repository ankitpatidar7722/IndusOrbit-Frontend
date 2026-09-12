import type { CSSProperties } from "react";

// Soft-tint colour for a bulk toolbar button — light background + darker same-hue text/icon, matching
// the Clear All Data / Save Data look. Same shape/size as the plain button; only the colour changes.
//   base = the saturated hue (used at low alpha for the tint background + border)
//   text = the dark same-hue text/icon colour
// Faded when disabled. Shared by MasterToolbar (Import Master) and StockGrid (Stock Upload).
export const softBtn = (base: string, text: string, disabled: boolean): CSSProperties => ({
  background: `linear-gradient(135deg, ${base}14, ${base}29)`, // ~8% → ~16% tint
  color: text,
  border: `1px solid ${base}40`, // ~25% tint border
  opacity: disabled ? 0.5 : 1,
});

// Shared palette so both toolbars use the same colour per action type.
export const BTN = {
  load:     { base: "#3b82f6", text: "#1d4ed8" }, // blue
  amber:    { base: "#f59e0b", text: "#b45309" }, // amber (delete-excel-row)
  violet:   { base: "#8b5cf6", text: "#6d28d9" }, // violet (fresh upload / check stock)
  cyan:     { base: "#06b6d4", text: "#0e7490" }, // cyan (export)
  pink:     { base: "#ec4899", text: "#be185d" }, // pink (check validation)
  navy:     { base: "#1f4576", text: "#16325a" }, // navy (existing / upload excel)
} as const;
