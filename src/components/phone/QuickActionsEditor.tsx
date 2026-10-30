"use client";
import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { AppIcon } from "@/components/phone/AppIcon";
import { useBackGuard } from "@/lib/back-stack";
import { MAX_QUICK_ACTIONS, quickActionCandidates, type PhoneGroup } from "@/lib/phoneModules";

/**
 * Bottom sheet to choose the phone Home's Quick actions: every screen the user can open, grouped by
 * module head, tap to tick (max 8, in the order ticked — a number shows the position). Save keeps the
 * choice for this user on this device; Reset goes back to the automatic default.
 */
export default function QuickActionsEditor({ groups, initial, onSave, onReset, onClose }: {
  groups: PhoneGroup[];
  initial: string[];
  onSave: (routes: string[]) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  useBackGuard(true, onClose);   // Android / browser Back closes the sheet

  const candidates = new Set(quickActionCandidates(groups).map((l) => l.route));
  const full = picked.length >= MAX_QUICK_ACTIONS;
  const toggle = (route: string) =>
    setPicked((p) => (p.includes(route) ? p.filter((r) => r !== route) : p.length >= MAX_QUICK_ACTIONS ? p : [...p, route]));

  return (
    <div className="rc-sheet-backdrop" onClick={onClose}>
      <div className="rc-sheet qa-sheet" role="dialog" aria-modal="true" aria-label="Edit quick actions" onClick={(e) => e.stopPropagation()}>
        <div className="rc-sheet-handle" aria-hidden />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <div className="rc-sheet-title" style={{ flex: 1, padding: "0 4px" }}>Quick actions</div>
          <button type="button" className="phone-icon-btn" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>
        <div className="qa-hint">Tap to choose up to {MAX_QUICK_ACTIONS} screens · <b>{picked.length}/{MAX_QUICK_ACTIONS}</b> selected</div>

        <div className="qa-list">
          {groups.map((g) => {
            const leaves = g.leaves.filter((l) => candidates.has(l.route));
            if (!leaves.length) return null;
            return (
              <section key={g.name}>
                <div className="st-group-title" style={{ margin: "14px 0 6px", padding: "0 4px" }}>{g.name}</div>
                <div className="pf-card">
                  {leaves.map((l, i) => {
                    const pos = picked.indexOf(l.route);
                    const on = pos >= 0;
                    return (
                      <button key={l.route} type="button" className="qa-row" data-on={on || undefined}
                        disabled={!on && full} onClick={() => toggle(l.route)}
                        style={{ borderTop: i ? "1px solid rgb(var(--fg-default) / 0.08)" : undefined }}>
                        <AppIcon icon={l.icon} tone={l.tone} size={36} />
                        <span className="pf-row-label">{l.label}</span>
                        <span className="qa-check" aria-hidden>{on ? pos + 1 : <Check size={14} strokeWidth={3} style={{ opacity: 0 }} />}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="qa-actions">
          <button type="button" className="pc-btn" onClick={() => { onReset(); onClose(); }}><RotateCcw size={17} /> Reset</button>
          <button type="button" className="pc-btn qa-save" disabled={picked.length === 0} onClick={() => { onSave(picked); onClose(); }}><Check size={17} /> Save</button>
        </div>
      </div>
    </div>
  );
}
