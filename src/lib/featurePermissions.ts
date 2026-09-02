import { usersApi } from "@/lib/users";

// ── Feature-permission catalog (opt-in) ──────────────────────────────────────
// Each key gates one specific feature. A user can see/do a feature ONLY when its key
// is explicitly granted to them (default = denied/hidden). Granted per-user in
// /users → User Profile → "User Permissions". Add new features by extending this catalog
// and checking the key at the consumer site.
export interface FeaturePermission { key: string; label: string }
export interface PermissionGroup { category: string; perms: FeaturePermission[] }

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    category: "Clients",
    perms: [
      { key: "clients.createProject", label: "Can Create Project" },
      { key: "clients.deleteProject", label: "Can Delete Project" },
    ],
  },
  {
    category: "CRM",
    perms: [
      { key: "crm.proposalDocumentColumn", label: "Can See Proposal Doc" },
    ],
  },
  {
    category: "Milestone Roadmap",
    perms: [
      { key: "milestone.editRoadmapColumns", label: "Can Edit RoadMap Column" },
    ],
  },
];

/** Every permission key in the catalog (for select-all / validation). */
export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.flatMap((g) => g.perms.map((p) => p.key));

/** The feature-permission keys granted to a user (empty set on error or no user). */
export async function fetchUserPermissions(userId?: number | null): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const r = await usersApi.getPermissions(userId);
    return new Set(r.success ? r.data : []);
  } catch {
    return new Set();
  }
}
