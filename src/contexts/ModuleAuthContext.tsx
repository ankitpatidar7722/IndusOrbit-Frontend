"use client";

/**
 * Per-module action authority for the migrated DataGrid and any page that gates its own controls.
 *
 * The shared grid calls `usePageAccess()` to gate its built-in actions (edit / save / delete /
 * export / print / cancel) whenever the caller hasn't passed explicit `config.permissions`. This
 * provider resolves the CURRENT page's module (by matching the pathname to the user's module routes
 * in User Management → Module Authentication) and returns that module's real permission flags, so
 * unchecking e.g. "Can Delete" for a module actually hides the delete action for that user.
 *
 * Fail-OPEN by design: until the authority map has loaded, or when the path maps to no known module,
 * every flag is `true` — we never flash-hide actions for admins or lock anyone out of a non-module
 * page. Routes/clients where the user genuinely lacks a flag get it hidden once the map resolves.
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  fetchMyModulePerms, getCachedModulePerms, resolveRoutePerm, getModulePerm,
  type ModulePerm, type ModulePermMap,
} from "@/lib/routeAccess";

export interface PageAccess {
  canView: boolean;
  canSave: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canPrint: boolean;
  canCancel: boolean;
}

const FULL_ACCESS: PageAccess = {
  canView: true, canSave: true, canEdit: true, canDelete: true,
  canExport: true, canPrint: true, canCancel: true,
};

// null = not loaded yet (fail open). A map = the user's full per-module authority.
const ModuleAuthContext = createContext<ModulePermMap | null>(null);

/** Fetches the signed-in user's full module authority once and shares it with every `usePageAccess()`. */
export function ModuleAuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const uid = (session?.user as { UserID?: number } | undefined)?.UserID;
  // Seed synchronously from the shared routeAccess cache so grids never flash full→restricted on nav.
  const [perms, setPerms] = useState<ModulePermMap | null>(() => getCachedModulePerms(uid));

  useEffect(() => {
    if (!uid) return;
    const cached = getCachedModulePerms(uid);
    if (cached) { setPerms(cached); return; }
    let cancelled = false;
    fetchMyModulePerms(uid).then((p) => { if (!cancelled) setPerms(p); }).catch(() => { if (!cancelled) setPerms({}); });
    return () => { cancelled = true; };
  }, [uid]);

  return <ModuleAuthContext.Provider value={perms}>{children}</ModuleAuthContext.Provider>;
}

const toAccess = (p: ModulePerm): PageAccess => ({
  canView: p.canView, canSave: p.canSave, canEdit: p.canEdit, canDelete: p.canDelete,
  canExport: p.canExport, canPrint: p.canPrint, canCancel: p.canCancel,
});

/**
 * Page-level permission booleans for the current module.
 * @param moduleKey Optional explicit module key for panels whose module is NOT the page's own route
 *   (e.g. a client-detail tab rendered under /clients/[code] → pass "clienttab-templates").
 *   When omitted, the module is resolved from the current pathname.
 */
export function usePageAccess(moduleKey?: string): PageAccess {
  const perms = useContext(ModuleAuthContext);
  const pathname = usePathname();
  return useMemo(() => {
    if (!perms) return FULL_ACCESS;                        // not loaded → fail open (no flash, no lock-out)
    const p = moduleKey ? getModulePerm(moduleKey, perms) : resolveRoutePerm(pathname, perms);
    return p ? toAccess(p) : FULL_ACCESS;                  // path maps to no known module → fail open
  }, [perms, pathname, moduleKey]);
}
