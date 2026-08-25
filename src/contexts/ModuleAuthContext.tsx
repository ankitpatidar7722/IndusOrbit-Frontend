"use client";

/**
 * Minimal shim of the legacy Parkson ModuleAuthContext for the migrated DataGrid.
 *
 * The grid calls `usePageAccess()` only to *optionally* gate its built-in actions
 * (edit/save/delete/export/print/cancel) when the caller hasn't passed explicit
 * `config.permissions`. Indus 360 has its own permission model (UserModuleAuthentication),
 * so here we return full access — every grid feature stays enabled, and callers that
 * want per-module gating pass `permissions` to `createActionsColumn` explicitly.
 *
 * The grid reads these as booleans: `config.permissions?.canEdit ?? pageAccess.canEdit`.
 */
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
  canView: true,
  canSave: true,
  canEdit: true,
  canDelete: true,
  canExport: true,
  canPrint: true,
  canCancel: true,
};

/** Returns page-level permission booleans. Shim: full access. */
export function usePageAccess(): PageAccess {
  return FULL_ACCESS;
}
