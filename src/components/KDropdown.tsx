"use client";
import { useRef, type ComponentProps, type KeyboardEvent } from "react";
import { Dropdown } from "indas-ui";

type Props = ComponentProps<typeof Dropdown>;

/**
 * indas-ui Dropdown + native-<select>-style keyboard navigation.
 *
 * Tab focuses the field as usual. When the (CLOSED) dropdown is focused, ArrowDown / ArrowUp move the
 * value directly to the next / previous option — like a native <select> — without having to open the
 * list. When the list IS open, indas-ui's own option navigation handles the arrows. Uses a
 * display:contents wrapper (zero layout impact) and a capture-phase handler so it runs before (and
 * suppresses) indas-ui's default "open on arrow" for the closed state. Skipped for multi-select.
 */
export default function KDropdown(props: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (props.disabled) return;
    // If the list is open, let indas-ui navigate the options (single or multi).
    const trigger = ref.current?.querySelector<HTMLElement>("[aria-expanded]");
    if (trigger?.getAttribute("aria-expanded") === "true") return;

    // Multi-select: "cycling" a single value makes no sense — open the list so the user can
    // arrow-navigate and Space/Enter to toggle options.
    if (props.multiSelect) {
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); trigger?.click(); }
      return;
    }

    const opts = (props.options ?? []).filter((o) => !(o as { disabled?: boolean }).disabled);
    if (opts.length === 0) return;

    e.preventDefault();
    e.stopPropagation(); // don't let indas-ui also open the list on this key

    const cur = opts.findIndex((o) => String(o.value) === String(props.value));
    let next: number;
    if (e.key === "ArrowDown") next = cur < 0 ? 0 : Math.min(opts.length - 1, cur + 1);
    else next = cur < 0 ? opts.length - 1 : Math.max(0, cur - 1);

    if (cur < 0 || next !== cur) props.onValueChange(opts[next].value);
  };

  return (
    <div ref={ref} style={{ display: "contents" }} onKeyDownCapture={onKeyDownCapture}>
      <Dropdown {...props} />
    </div>
  );
}
