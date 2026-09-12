// DEV-ONLY console noise filter.
//
// indas-ui's searchable Dropdown/Popover is Radix-based: its content passes Radix Popper/Content props
// (onOpenAutoFocus, onCloseAutoFocus, avoidCollisions, collisionPadding, sticky, sideOffset, …). Under
// React 19's dev build these surface as "Unknown event handler property …" / "React does not recognize
// the … prop on a DOM element" warnings — the props are simply IGNORED (no functional impact), but with
// several searchable dropdowns on a page they flood the dev console + the Next.js error overlay counter.
//
// This is an indas-ui-level issue (shared design-system package), not a Bulk Import / app bug. We filter
// ONLY these exact benign patterns so the console stays useful — every other error/warning passes through
// untouched. No-op in production (React strips these warnings there anyway).
let installed = false;

export function suppressBenignIndasUiWarnings(): void {
  if (installed) return;
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "production") return;
  installed = true;

  const RADIX_EVENT = /on(Open|Close)AutoFocus|onEscapeKeyDown|onPointerDownOutside|onFocusOutside|onInteractOutside/;
  const RADIX_PROP = /avoidCollisions|collisionPadding|collisionBoundary|sticky|sideOffset|alignOffset|arrowPadding|hideWhenDetached|updatePositionStrategy/;

  const isBenign = (args: unknown[]): boolean => {
    const joined = args.map((a) => (typeof a === "string" ? a : "")).join(" ");
    return (
      (joined.includes("Unknown event handler property") && RADIX_EVENT.test(joined)) ||
      (joined.includes("does not recognize the") && RADIX_PROP.test(joined))
    );
  };

  const wrap = (orig: (...a: unknown[]) => void) => (...args: unknown[]) => {
    if (isBenign(args)) return;
    orig(...args);
  };

  // Patch after Next's dev runtime has patched console.error (so ours is outermost and can stop the
  // suppressed warnings before they reach the overlay collector).
  console.error = wrap(console.error.bind(console)) as typeof console.error;
  console.warn = wrap(console.warn.bind(console)) as typeof console.warn;
}
