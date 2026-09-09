"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import InstallAppButton from "@/components/InstallAppButton";

/**
 * Mobile sidebar drawer — our own, fully controlled (indas-ui's AppShell drawer can't be opened
 * programmatically, and a second DynamicSidebar renders empty). We fetch the SAME DB-driven menu
 * the desktop sidebar uses (`/api/othermaster/createdynamicmenuwithsubmenu`, keyed by UserID) and
 * render it as grouped links. Opened via the `mobi-nav-open` body class (header toggle / bottom-nav
 * "Menu"); closes on backdrop tap or navigation. Hidden ≥ lg via CSS.
 */
export const MOBILE_NAV_CLASS = "mobi-nav-open";
export function toggleMobileNav() { document.body.classList.toggle(MOBILE_NAV_CLASS); }
export function closeMobileNav() { document.body.classList.remove(MOBILE_NAV_CLASS); }

type NavItem = { route: string; label: string; group: string; groupOrder: number; order: number };

async function fetchNav(userId: number): Promise<NavItem[]> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";
    const res = await fetch(`${base}/api/othermaster/createdynamicmenuwithsubmenu`, {
      headers: { UserID: String(userId) }, cache: "no-store",
    });
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((m: Record<string, unknown>) => typeof m.ModuleName === "string" && (m.ModuleName as string).startsWith("/") && m.CanView)
      .map((m: Record<string, unknown>) => ({
        route: m.ModuleName as string,
        label: (m.ModuleDisplayName as string) || (m.ModuleName as string),
        group: (m.ModuleHeadName as string) || "Menu",
        groupOrder: Number(m.SetGroupIndex ?? 0),
        order: Number(m.ModuleDisplayOrder ?? 0),
      }));
  } catch { return []; }
}

export default function MobileNav({ companyId, userId }: { companyId: number; userId: number }) {
  void companyId;
  const pathname = usePathname();
  const router = useRouter();
  const [items, setItems] = useState<NavItem[]>([]);

  useEffect(() => { if (userId) fetchNav(userId).then(setItems); }, [userId]);
  useEffect(() => { closeMobileNav(); }, [pathname]);

  // Group items by head, preserving group order then item order.
  const groups: { name: string; items: NavItem[] }[] = [];
  for (const it of [...items].sort((a, b) => a.groupOrder - b.groupOrder || a.order - b.order)) {
    let g = groups.find((x) => x.name === it.group);
    if (!g) { g = { name: it.group, items: [] }; groups.push(g); }
    g.items.push(it);
  }

  const go = (route: string) => { closeMobileNav(); router.push(route); };
  const active = (route: string) => (route === "/" ? pathname === "/" : pathname.startsWith(route));

  return (
    <>
      <div className="mobile-nav-backdrop" onClick={closeMobileNav} aria-hidden />
      <aside className="mobile-drawer" aria-label="Menu">
        <div className="mobile-drawer-head">
          <span>Menu</span>
          <button onClick={closeMobileNav} aria-label="Close menu" className="mobile-drawer-close"><X size={20} /></button>
        </div>
        <nav className="mobile-drawer-nav">
          <InstallAppButton variant="drawer" />
          <button className="mobile-nav-link" data-active={pathname === "/"} onClick={() => go("/")}>Home</button>
          {groups.map((g) => (
            <div key={g.name} className="mobile-nav-group">
              <div className="mobile-nav-group-title">{g.name}</div>
              {g.items.map((it) => (
                <button key={it.route} className="mobile-nav-link" data-active={active(it.route)} onClick={() => go(it.route)}>
                  {it.label}
                </button>
              ))}
            </div>
          ))}
          {items.length === 0 && <div className="mobile-nav-empty">Loading menu…</div>}
        </nav>
      </aside>
    </>
  );
}
