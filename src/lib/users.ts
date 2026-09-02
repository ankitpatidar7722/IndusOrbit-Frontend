import { userIdHeader } from "@/lib/currentUser";
// API client for Admin → User Management (Indus360App.dbo.Users + module authority).
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface UserListRow {
  userId: number;
  fullName: string;
  email?: string | null;
  mobile?: string | null;
  role?: string | null;
  reportingManagerId?: number | null;
  reportingManagerName?: string | null;
  isActive: boolean;
  companyId: number;
  employeeCode?: string | null;
}

export interface UserDetail {
  userId: number;
  fullName: string;
  email?: string | null;
  mobile?: string | null;
  role?: string | null;
  reportingManagerId?: number | null;
  isActive: boolean;
  companyId: number;
  productionUnitId?: number | null;
  fYear?: string | null;
  employeeCode?: string | null;
  // Emails tab (SmtpPassword is never returned)
  emailProvider?: string | null;
  smtpUsername?: string | null;
  smtpServer?: string | null;
  smtpPort?: string | null;
  smtpAuthenticate?: boolean | null;
  smtpUseSSL?: boolean | null;
  hasSmtpPassword?: boolean | null;   // true if a SMTP password is stored (value never returned)
  emailSignature?: string | null;
  photoPath?: string | null;          // stored profile-photo filename (served via photoUrl())
}

/** URL to a user's profile photo. Pass `v` (any changing token) to bust the browser cache after an upload. */
export const photoUrl = (userId: number, v?: string | number) =>
  `${BASE}/api/users/${userId}/photo${v != null ? `?v=${encodeURIComponent(String(v))}` : ""}`;

/** Privacy-safe profile card for the "view profile" popup (no SMTP/password). */
export interface UserCard {
  userId: number;
  fullName: string;
  email?: string | null;
  mobile?: string | null;
  role?: string | null;
  employeeCode?: string | null;
  hasPhoto: boolean;
}

export interface UserSave {
  userId: number; // 0 = create
  fullName: string;
  email: string;
  password?: string;
  mobile?: string | null;
  role?: string | null;
  reportingManagerId?: number | null;
  isActive: boolean;
  companyId: number;
  // Emails tab
  emailProvider?: string | null;
  smtpUsername?: string | null;
  smtpPassword?: string | null;   // blank on edit = keep current
  smtpServer?: string | null;
  smtpPort?: string | null;
  smtpAuthenticate?: boolean | null;
  smtpUseSSL?: boolean | null;
  emailSignature?: string | null;
}

export interface ManagerOption { userId: number; fullName: string; }
export interface UserLookups { roles: string[]; managers: ManagerOption[]; }

export interface ModuleAuthRow {
  moduleID: number;
  moduleName: string;
  moduleDisplayName?: string | null;
  moduleHeadName?: string | null;
  moduleHeadDisplayName?: string | null;
  setGroupIndex?: number | null;
  moduleDisplayOrder?: number | null;
  canView: boolean; canSave: boolean; canEdit: boolean; canDelete: boolean;
  canPrint: boolean; canExport: boolean; canCancel: boolean;
}

export type ModuleAuthToggle = Pick<ModuleAuthRow,
  "moduleID" | "canView" | "canSave" | "canEdit" | "canDelete" | "canPrint" | "canExport" | "canCancel">;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  return res.json();
}
async function send<T>(method: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { "Content-Type": "application/json", ...userIdHeader() }, body: JSON.stringify(body), cache: "no-store",
  });
  return res.json().catch(() => ({ success: false, message: `${res.status} ${res.statusText}` }));
}

export const usersApi = {
  list: () => get<{ success: boolean; data: UserListRow[]; message?: string }>("/api/users"),
  lookups: () => get<{ success: boolean; data: UserLookups }>("/api/users/lookups"),
  get: (id: number) => get<{ success: boolean; data: UserDetail; message?: string }>(`/api/users/${id}`),
  card: (id: number) => get<{ success: boolean; data: UserCard; message?: string }>(`/api/users/${id}/card`),
  create: (body: UserSave) => send<{ success: boolean; message: string; userId?: number }>("POST", "/api/users", body),
  update: (id: number, body: UserSave) => send<{ success: boolean; message: string }>("PUT", `/api/users/${id}`, body),
  remove: (id: number) => send<{ success: boolean; message: string }>("DELETE", `/api/users/${id}`, {}),

  // self-service (Settings page)
  selfProfile: (id: number, body: { fullName: string; email: string }) =>
    send<{ success: boolean; message: string }>("POST", `/api/users/${id}/self-profile`, body),
  selfPassword: (id: number, body: { currentPassword: string; newPassword: string }) =>
    send<{ success: boolean; message: string }>("POST", `/api/users/${id}/self-password`, body),
  selfSmtp: (id: number, body: Partial<UserSave>) =>
    send<{ success: boolean; message: string }>("POST", `/api/users/${id}/self-smtp`, body),
  getModules: (id: number) => get<{ success: boolean; data: ModuleAuthRow[]; message?: string }>(`/api/users/${id}/modules`),
  saveModules: (id: number, modules: ModuleAuthToggle[]) =>
    send<{ success: boolean; message: string; savedCount?: number }>("POST", `/api/users/${id}/modules`, { userId: id, modules }),

  // Feature permissions (opt-in list of granted keys) — see lib/featurePermissions.ts for the catalog.
  getPermissions: (id: number) => get<{ success: boolean; data: string[]; message?: string }>(`/api/users/${id}/permissions`),
  savePermissions: (id: number, keys: string[]) =>
    send<{ success: boolean; message: string; savedCount?: number }>("POST", `/api/users/${id}/permissions`, { keys }),

  // profile photo (disk-stored on the backend; served via photoUrl())
  uploadPhoto: (id: number, imageBase64: string) =>
    send<{ success: boolean; message?: string; photoUrl?: string; version?: string }>("POST", `/api/users/${id}/photo`, { imageBase64 }),
  deletePhoto: (id: number) => send<{ success: boolean; message?: string }>("DELETE", `/api/users/${id}/photo`, {}),
};
