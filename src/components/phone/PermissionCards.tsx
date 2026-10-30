"use client";
import { useCallback, useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * A permission matrix a thumb can work (ported from IndusFlexoERP's components/forms/PermissionCards).
 *
 * A Module × 7-flag grid is the right shape on a desktop and the wrong one on a 360px phone (columns run
 * off the edge). Instead: one card per module head (Overview, Clients, Point Management…), closed until
 * opened, saying how much of it is granted. Open, each module shows its flags as tick boxes, three to a
 * row — one tap each — with an All switch on the row and Select all for the whole head. Search and
 * All / Granted / Not granted filters sit above, because these lists run to dozens of modules.
 *
 * Phone only by contract: the caller renders the desktop table on wide screens.
 */
export interface PermissionFlag<T> {
  key: string;
  /** One word, shown beside the tick box. */
  label: string;
  value: (row: T) => boolean;
  onChange: (row: T, next: boolean) => void;
}

type Show = "all" | "granted" | "none";

export function PermissionCards<T>({ rows, getId, getLabel, getGroup, flags, disabled = false, searchPlaceholder = "Search modules" }: {
  rows: T[];
  getId: (row: T) => string;
  getLabel: (row: T) => string;
  getGroup?: (row: T) => string | undefined;
  flags: PermissionFlag<T>[];
  disabled?: boolean;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  // Heads the user opened (a search opens every head it matches, so a hit is never hidden in a closed one).
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const toggleGroup = (key: string) => setOpenGroups((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const grantedOf = useCallback((row: T) => flags.filter((f) => f.value(row)).length, [flags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (show === "granted" && grantedOf(row) === 0) return false;
      if (show === "none" && grantedOf(row) > 0) return false;
      if (!q) return true;
      return (getLabel(row) ?? "").toLowerCase().includes(q) || (getGroup?.(row) ?? "").toLowerCase().includes(q);
    });
  }, [rows, query, show, getLabel, getGroup, grantedOf]);

  // One block per head, in the order heads first appear.
  const groups = useMemo(() => {
    const byName = new Map<string, { name: string | undefined; items: T[] }>();
    for (const row of filtered) {
      const name = getGroup?.(row);
      const g = byName.get(name ?? "");
      if (g) g.items.push(row); else byName.set(name ?? "", { name, items: [row] });
    }
    return Array.from(byName.values());
  }, [filtered, getGroup]);

  const searching = query.trim() !== "";
  const totalGranted = rows.filter((r) => grantedOf(r) > 0).length;
  const setRowAll = (row: T, on: boolean) => flags.forEach((f) => { if (f.value(row) !== on) f.onChange(row, on); });

  return (
    <div className="pmc">
      <div className="pmc-search">
        <Search size={18} style={{ flexShrink: 0, opacity: 0.55 }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} enterKeyHint="search" autoComplete="off" />
        {query && <button type="button" className="pl-clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
      </div>

      <div className="pmc-filters">
        <div className="pmc-chips" role="tablist" aria-label="Show">
          {([["all", "All"], ["granted", "Granted"], ["none", "Not granted"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={show === id} className="pmc-chip" data-on={show === id || undefined} onClick={() => setShow(id)}>{label}</button>
          ))}
        </div>
        <span className="pmc-total"><b>{totalGranted}</b> of {rows.length}</span>
      </div>

      {filtered.length === 0 && <div className="pmc-empty">Nothing matches that search.</div>}

      {groups.map((group) => {
        const key = group.name ?? "";
        // A lone head starts open (and still closes on a tap): for it the set records heads the user CLOSED.
        const expanded = searching || (groups.length === 1 ? !openGroups.has(key) : openGroups.has(key));
        const fullRows = group.items.filter((r) => grantedOf(r) === flags.length).length;
        const anyRows = group.items.filter((r) => grantedOf(r) > 0).length;
        const groupAllOn = fullRows === group.items.length;
        return (
          <section key={key} className="pmc-card">
            <button type="button" className="pmc-head" onClick={() => toggleGroup(key)} aria-expanded={expanded}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="pmc-head-name">{group.name || "Other"}</span>
                <span className="pmc-head-sub">{anyRows} of {group.items.length} modules granted</span>
              </span>
              <span aria-hidden className="pmc-dot" data-state={anyRows === 0 ? "none" : groupAllOn ? "all" : "some"} />
              <ChevronDown size={20} className="pmc-chevron" data-open={expanded || undefined} />
            </button>

            {expanded && (
              <div className="pmc-body">
                {/* Everything under this head in one tap. */}
                {!disabled && group.items.length > 1 && (
                  <div className="pmc-every">
                    <span>Every module here</span>
                    <button type="button" onClick={() => group.items.forEach((r) => setRowAll(r, !groupAllOn))}>{groupAllOn ? "Clear all" : "Select all"}</button>
                  </div>
                )}
                {group.items.map((row) => {
                  const granted = grantedOf(row);
                  const allOn = granted === flags.length;
                  return (
                    <div key={getId(row)} className="pmc-row">
                      <div className="pmc-row-head">
                        <span className="pmc-row-name">{getLabel(row)}</span>
                        <span className="pmc-count" data-state={granted === 0 ? "none" : allOn ? "all" : "some"}>{granted}/{flags.length}</span>
                        {flags.length > 1 && (
                          <input type="checkbox" role="switch" className="st-switch" checked={allOn} disabled={disabled}
                            onChange={(e) => setRowAll(row, e.target.checked)} aria-label={`${getLabel(row)} - All`} />
                        )}
                      </div>
                      {/* The flags, always on show: a tick box with its name, three to a row, one tap each. */}
                      <div className="pmc-flags">
                        {flags.map((flag) => {
                          const on = flag.value(row);
                          return (
                            <button key={flag.key} type="button" role="checkbox" aria-checked={on} disabled={disabled}
                              className="pmc-flag" data-on={on || undefined} onClick={() => flag.onChange(row, !on)}>
                              <span aria-hidden className="pmc-box">{on && <Check size={13} strokeWidth={3} />}</span>
                              <span className="pmc-flag-label">{flag.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
