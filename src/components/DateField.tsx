"use client";
import { DatePicker } from "indas-ui";

// Format a Date as a local yyyy-mm-dd string (no timezone shift).
const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (v?: string | null) => {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

/**
 * Consistent date input across all Indus 360 forms — wraps the indas-ui `DatePicker`
 * (styled calendar popover) with a plain `string` (yyyy-mm-dd) value/onChange contract,
 * so it drops in wherever a native `<input type="date">` was used.
 */
export default function DateField({
  value, onChange, placeholder = "Select date", disabled, className = "w-full", style,
}: {
  value?: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const picker = (
    <DatePicker
      value={parse(value)}
      returnFormat="date"
      onChange={(d) => onChange(d instanceof Date ? toYmd(d) : "")}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
  return style ? <div style={style}>{picker}</div> : picker;
}
