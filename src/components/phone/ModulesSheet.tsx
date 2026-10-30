"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Search, X } from "lucide-react";
import { AppIcon } from "@/components/phone/AppIcon";
import InstallAppButton from "@/components/InstallAppButton";
import { useBackGuard } from "@/lib/back-stack";
import { fetchPhoneGroups, type PhoneGroup, type PhoneLeaf } from "@/lib/phoneModules";

/**
 * Phone "Modules" bottom sheet (ported from IndusFlexoERP's mobile-menu-sheet): slides up from the bottom-bar
 * button that opens it, so the whole interaction stays inside the thumb arc.
 *   - Header modules (ModuleHeadName groups) as an app-drawer grid of tonal app icons.
 *   - Tap a group → its screens as a second grid (back arrow returns); a one-screen group opens directly.
 *   - Search finds any screen by name or group.
 * Same DB menu as the sidebar (lib/phoneModules), so permissions are identical. Flick down / backdrop / Esc closes.
 * Phone + tablet only (the bottom bar that opens it is hidden ≥ lg).
 */
export default function ModulesSheet({ open, onClose, focusSearch = false }: { open: boolean; onClose: () => void; focusSearch?: boolean }) {
  const reduceMotion = useReducedMotion();
  const userId = (useSession().data?.user as { UserID?: number } | undefined)?.UserID;
  const [groups, setGroups] = useState<PhoneGroup[] | null>(null);

  // Load the menu only once the sheet is actually opened (it is mounted on every page, desktop included).
  useEffect(() => { if (open && userId) fetchPhoneGroups(userId).then(setGroups); }, [open, userId]);

  // Android / browser Back closes the sheet instead of leaving the page.
  useBackGuard(open, onClose);

  // Lock the page behind the sheet; Esc closes (tablets with a keyboard).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  return (
    // Backdrop + sheet are keyed SIBLINGS (not a fragment) so AnimatePresence can play their exit.
    <AnimatePresence>
      {open && (
        <motion.div key="modules-backdrop" className="phone-sheet-backdrop" onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
      )}
      {open && (
        <motion.div
          key="modules-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Modules"
          className="phone-modules-sheet m-glass-sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%", transition: reduceMotion ? { duration: 0.15 } : { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
          transition={reduceMotion ? { duration: 0.2 } : { type: "spring", stiffness: 420, damping: 38 }}
          // Flick down to dismiss; no upward lift off the bottom edge.
          drag={reduceMotion ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose(); }}
        >
          {/* Mounted per open → every open starts from the group grid with an empty search. */}
          <SheetContent groups={groups} onClose={onClose} reduceMotion={!!reduceMotion} focusSearch={focusSearch} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SheetContent({ groups, onClose, reduceMotion, focusSearch }: { groups: PhoneGroup[] | null; onClose: () => void; reduceMotion: boolean; focusSearch: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const isActive = (route: string) => (route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(route + "/"));

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q || !groups) return null;
    return groups.flatMap((g) => g.leaves)
      .filter((l) => l.label.toLowerCase().includes(q) || l.group.toLowerCase().includes(q))
      .slice(0, 40);
  }, [groups, q]);

  const drilled = openGroup ? groups?.find((g) => g.name === openGroup) ?? null : null;

  const go = (href: string) => { onClose(); router.push(href); };
  const pickGroup = (g: PhoneGroup) => {
    if (g.leaves.length === 1) go(g.leaves[0].href);
    else setOpenGroup(g.name);
  };

  return (
    <>
      {/* Grab handle */}
      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px", flexShrink: 0 }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: "rgb(var(--fg-default) / 0.18)" }} />
      </div>

      {/* Title bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 8px 6px 12px", flexShrink: 0 }}>
        {drilled && !results && (
          <button type="button" className="phone-icon-btn" onClick={() => setOpenGroup(null)} aria-label="Back to modules">
            <ChevronLeft size={24} />
          </button>
        )}
        <h2 className="phone-sheet-title" style={{ paddingLeft: drilled && !results ? 0 : 8 }}>
          {drilled && !results ? drilled.name : "Modules"}
        </h2>
        <button type="button" className="phone-icon-btn" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
        <label className="phone-search m-glass-well">
          <Search size={18} style={{ flexShrink: 0, opacity: 0.55 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search modules and screens"
            aria-label="Search modules" enterKeyHint="search" autoComplete="off"
            // Opened from the top bar's Search → type straight away (never on a plain Modules open:
            // the keyboard would cover the grid the user came to see).
            autoFocus={focusSearch} />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="phone-search-clear">
              <X size={16} />
            </button>
          )}
        </label>
      </div>

      <div className="phone-sheet-body">
        {groups === null ? (
          <p className="phone-sheet-empty">Loading modules…</p>
        ) : results ? (
          results.length === 0 ? (
            <p className="phone-sheet-empty">No modules found</p>
          ) : (
            <>
              <p className="phone-sheet-caption">{results.length} result{results.length === 1 ? "" : "s"}</p>
              {results.map((l) => <LeafRow key={l.route} leaf={l} active={isActive(l.route)} onSelect={go} />)}
            </>
          )
        ) : (
          <div className="phone-app-grid">
            {(drilled ? drilled.leaves : groups).map((item, i) => {
              const leaf = drilled ? (item as PhoneLeaf) : null;
              const group = drilled ? null : (item as PhoneGroup);
              const name = leaf ? leaf.label : group!.name;
              const here = leaf ? isActive(leaf.route) : group!.leaves.some((l) => isActive(l.route));
              return (
                <motion.button
                  key={name}
                  type="button"
                  onClick={() => (leaf ? go(leaf.href) : pickGroup(group!))}
                  aria-current={here ? "true" : undefined}
                  className="phone-app-tile"
                  data-here={here || undefined}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32, delay: Math.min(i, 16) * 0.018 }}
                  whileTap={{ scale: 0.92 }}
                >
                  <AppIcon icon={(leaf ?? group)!.icon} tone={(leaf ?? group)!.tone} size={50}>
                    {/* Where the user is now: a dot, the way a launcher marks a running app. */}
                    {here && <span aria-hidden className="phone-here-dot" />}
                  </AppIcon>
                  <span className="phone-app-label">{name}</span>
                </motion.button>
              );
            })}
          </div>
        )}
        {groups !== null && groups.length === 0 && !results && (
          <p className="phone-sheet-empty">No modules assigned to you yet.</p>
        )}
        {/* Install App (was in the old side drawer) — renders nothing unless the app is installable. */}
        {!results && !drilled && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}>
            <InstallAppButton variant="card" />
          </div>
        )}
      </div>
    </>
  );
}

function LeafRow({ leaf, active, onSelect }: { leaf: PhoneLeaf; active: boolean; onSelect: (href: string) => void }) {
  return (
    <button type="button" className="phone-leaf-row" data-active={active || undefined} onClick={() => onSelect(leaf.href)}>
      <AppIcon icon={leaf.icon} tone={leaf.tone} size={40} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="phone-leaf-title">{leaf.label}</span>
        <span className="phone-leaf-sub">{leaf.group}</span>
      </span>
      {active && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: "rgb(var(--color-primary))", flexShrink: 0 }} />}
    </button>
  );
}
