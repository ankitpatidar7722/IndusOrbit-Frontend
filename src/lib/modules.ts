// API client for the module-authority tabs (module settings, copy, module groups).
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface ModuleSettingsRow {
  moduleHeadName: string;
  moduleDisplayName: string;
  moduleName: string;
  status: boolean;
}
export interface ModuleGroupModuleRow {
  moduleHeadName: string;
  moduleDisplayName: string;
  moduleName: string;
}
export interface ClientDropdownItem {
  companyName: string;
  companyUserID: string;
  applicationName: string;
}
export interface ClientModuleDto {
  moduleId: number;
  moduleName: string;
  moduleHeadName?: string | null;
  moduleDisplayName?: string | null;
  moduleHeadDisplayName?: string | null;
  moduleHeadDisplayOrder?: number | null;
  moduleDisplayOrder?: number | null;
  setGroupIndex?: number | null;
}
export interface IndusToolModuleDto {
  moduleID: number;
  moduleName: string;
  modulePath?: string | null;
  moduleIcon?: string | null;
  displayOrder?: number | null;
  isEnabled: boolean;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  return res.json();
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  return res.json();
}
async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  return res.json();
}
async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", cache: "no-store" });
  return res.json();
}

export const modulesApi = {
  // module settings
  getSettings: (applicationName: string, connectionString: string) =>
    post<{ success: boolean; message: string; data: ModuleSettingsRow[] }>("/api/modules/settings", { applicationName, connectionString }),
  saveSettings: (applicationName: string, connectionString: string, modules: { moduleName: string; status: boolean }[]) =>
    post<{ success: boolean; message: string; inserted: number; deleted: number }>("/api/modules/settings/save", { applicationName, connectionString, modules }),
  checkExist: (connectionString: string) =>
    get<{ success: boolean; hasModules: boolean; moduleCount: number }>(`/api/modules/check?connectionString=${encodeURIComponent(connectionString)}`),

  // copy modules
  clientDropdown: () => get<{ success: boolean; data: ClientDropdownItem[] }>("/api/customers/dropdown"),
  copy: (sourceConnectionString: string, targetCompanyUserID: string) =>
    post<{ success: boolean; message: string; copiedCount: number }>("/api/modules/copy", { sourceConnectionString, targetCompanyUserID }),

  // module groups
  groups: (app: string) => get<{ success: boolean; data: string[] }>(`/api/modules/groups/${encodeURIComponent(app)}`),
  groupModules: (applicationName: string, moduleGroupName: string) =>
    post<{ success: boolean; data: ModuleGroupModuleRow[] }>("/api/modules/group-modules", { applicationName, moduleGroupName }),
  availableModules: (app: string) => get<{ success: boolean; data: ModuleGroupModuleRow[] }>(`/api/modules/available/${encodeURIComponent(app)}`),
  createGroup: (applicationName: string, moduleGroupName: string, selectedModuleNames: string[]) =>
    post<{ success: boolean; message: string }>("/api/modules/group/create", { applicationName, moduleGroupName, selectedModuleNames }),
  updateGroup: (applicationName: string, moduleGroupName: string, selectedModuleNames: string[]) =>
    put<{ success: boolean; message: string; inserted: number; deleted: number }>("/api/modules/group/update", { applicationName, moduleGroupName, selectedModuleNames }),
  deleteGroup: (payload: { applicationName: string; moduleGroupName: string; userName: string; password: string; reason: string }) =>
    post<{ success: boolean; message: string; deletedCount: number }>("/api/modules/group/delete", payload),
  applyGroup: (applicationName: string, moduleGroupName: string, connectionString: string) =>
    post<{ success: boolean; message: string; totalModules: number }>("/api/modules/group/apply", { applicationName, moduleGroupName, connectionString }),

  // new module addition (client DB ModuleMaster)
  clientModules: (connectionString: string) =>
    post<{ success: boolean; data: ClientModuleDto[] }>("/api/modules/client-modules", { connectionString }),
  catalog: (app: string) => get<{ success: boolean; data: ModuleGroupModuleRow[] }>(`/api/modules/catalog/${encodeURIComponent(app)}`),
  catalogRich: (app: string) => get<{ success: boolean; data: ClientModuleDto[] }>(`/api/modules/catalog-rich/${encodeURIComponent(app)}`),
  createClientModule: (connectionString: string, module: Partial<ClientModuleDto>) =>
    post<{ success: boolean; message: string; moduleId: number }>("/api/modules/client-module/create", { connectionString, module }),
  updateClientModule: (connectionString: string, module: Partial<ClientModuleDto>) =>
    put<{ success: boolean; message: string }>("/api/modules/client-module/update", { connectionString, module }),
  deleteClientModule: (connectionString: string, moduleId: number) => del<{ success: boolean; message: string }>(`/api/modules/client-module?connectionString=${encodeURIComponent(connectionString)}&moduleId=${moduleId}`),

  // indus tool authority (IndusToolModuleMaster + CompanyModuleAuthority)
  toolAuthority: (companyUserId: string) =>
    get<{ success: boolean; data: IndusToolModuleDto[]; message?: string }>(`/api/modules/tool-authority/${encodeURIComponent(companyUserId)}`),
  saveToolAuthority: (companyUserID: string, enabledModuleIDs: number[]) =>
    post<{ success: boolean; message: string; savedCount: number }>("/api/modules/tool-authority", { companyUserID, enabledModuleIDs }),
};
