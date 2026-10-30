"use client";
import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Phone tab row (IndusFlexoERP's ChipTabs idea): one row of full-label pill chips that scrolls sideways,
 * instead of squeezed / truncated tabs. The selected chip is filled in the theme colour and scrolled
 * into the middle, so it is never half off-screen. An optional count shows how many records a tab holds.
 */
export interface ChipTab { id: string; label: string; icon?: LucideIcon; count?: number }

export default function ChipTabs({ tabs, value, onChange, ariaLabel }: {
  tabs: ChipTab[]; value: string; onChange: (id: string) => void; ariaLabel?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Keep the selected chip in view (centred) whenever it changes.
  useEffect(() => {
    const el = rowRef.current?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(value)}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [value]);

  return (
    <div ref={rowRef} className="chip-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const on = t.id === value;
        const Icon = t.icon;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} data-chip={t.id} data-on={on || undefined}
            className="chip-tab" onClick={() => onChange(t.id)}>
            {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
            <span>{t.label}</span>
            {t.count != null && <span className="chip-tab-count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
