"use client";
import { useRef } from "react";
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
 *
 * Native-<input type=date>-style keyboard: when the field is focused (calendar CLOSED),
 * ArrowUp moves the date +1 day and ArrowDown -1 day (empty → today on first press) — so
 * Tab-then-arrow works like every other field. When the calendar IS open, indas-ui's own
 * grid navigation handles the arrows. Uses a display:contents wrapper (zero layout impact)
 * + a capture-phase handler so it runs before indas-ui's default arrow behaviour.
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
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDownCapture = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    // Act only when the focus is on the trigger input (a real DOM descendant). The calendar grid
    // is portaled to <body> — its keydowns still bubble here through the React tree, but it is NOT
    // DOM-contained, so we skip those and let indas-ui's own day-grid navigation handle them.
    if (!(e.target instanceof Node) || !ref.current?.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation(); // the trigger input ignores arrows — take them over for day stepping

    const cur = parse(value);
    let next: Date;
    if (!cur) {
      next = new Date(); // empty field → today on the first arrow press
    } else {
      next = new Date(cur);
      next.setDate(next.getDate() + (e.key === "ArrowUp" ? 1 : -1));
    }
    onChange(toYmd(next));
  };

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
  return (
    <div ref={ref} style={{ display: "contents" }} onKeyDownCapture={onKeyDownCapture}>
      {style ? <div style={style}>{picker}</div> : picker}
    </div>
  );
}
