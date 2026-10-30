"use client";
import type { LucideIcon } from "lucide-react";

/**
 * Phone app icon (ported from IndusFlexoERP) — the ONE icon tile for modules, quick actions, dashboards and
 * status tiles on the phone Home + Modules sheet. Colour = an OKLCH palette per `tone` (.m-app-icon[data-tone]
 * in globals.css): lighter-top gradient, white glyph at 46% of the tile, corner = 30% (iOS / One UI proportion).
 * Fixed palette — like real app icons it does not change with the theme.
 */
export type AppIconTone = "blue" | "teal" | "orange" | "violet" | "green" | "amber" | "red" | "indigo" | "grey";

export function AppIcon({ icon: Icon, tone, size = 52, children }: {
  icon: LucideIcon;
  tone: AppIconTone;
  size?: number;
  /** Overlay, e.g. the "you are here" dot. */
  children?: React.ReactNode;
}) {
  return (
    <span aria-hidden data-tone={tone} className="m-app-icon"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}>
      <Icon style={{ width: Math.round(size * 0.46), height: Math.round(size * 0.46) }} strokeWidth={2} />
      {children}
    </span>
  );
}
