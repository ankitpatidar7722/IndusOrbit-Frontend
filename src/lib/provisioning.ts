// API client for the client-provisioning wizard (setup-database → masters → complete-setup).
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface SetupDatabaseRequest {
  server: string; applicationName: string; backupType?: string;
  clientName: string; databaseName: string; backupDatabaseName?: string;
}
export interface SetupDatabaseResponse {
  success: boolean; message: string; connectionString: string;
  databaseName: string; server: string; applicationName: string; clientName: string;
}
export interface CompanyMasterRequest {
  connectionString: string; companyID: number; companyName: string;
  address1?: string; address2?: string; address3?: string; city?: string; state?: string; country?: string;
  pincode?: string; contactNO?: string; mobileNO?: string; email?: string; website?: string;
  stateTinNo?: string; cinNo?: string; productionUnitAddress?: string; address?: string;
  gstin?: string; productionUnitName?: string; pan?: string;
}
export interface BranchMasterRequest {
  connectionString: string; branchID: number; branchName: string; mailingName?: string;
  address1?: string; address2?: string; address3?: string; address?: string; city?: string;
  district?: string; state?: string; country?: string; pincode?: string; mobileNo?: string;
  email?: string; stateTinNo?: string; gstin?: string; companyID?: number;
}
export interface ProductionUnitRequest {
  connectionString: string; productionUnitName: string; address?: string; city?: string;
  state?: string; gstNo?: string; pincode?: string; country?: string; pan?: string;
}
export interface CompleteSetupRequest {
  connectionString: string; city?: string; state?: string; country?: string; companyUserID: string;
}
export interface CompleteSetupResponse {
  success: boolean; message: string; companyUserID?: string; password?: string; userName?: string; userPassword?: string;
}
export interface SimpleResult { success: boolean; message: string; }
export interface CompanyMasterResponse { success: boolean; message: string; companyID: number; }

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

export const provisioningApi = {
  servers: () => get<{ success: boolean; servers: string[] }>("/api/provisioning/servers"),
  backupDatabases: (app: string) => get<{ success: boolean; databases: string[] }>(`/api/provisioning/backup-databases/${encodeURIComponent(app)}`),
  setupDatabase: (req: SetupDatabaseRequest) => post<SetupDatabaseResponse>("/api/provisioning/setup-database", req),
  saveCompanyMaster: (req: CompanyMasterRequest) => post<CompanyMasterResponse>("/api/provisioning/company-master", req),
  saveBranchMaster: (req: BranchMasterRequest) => post<SimpleResult>("/api/provisioning/branch-master", req),
  saveProductionUnit: (req: ProductionUnitRequest) => post<SimpleResult>("/api/provisioning/production-unit", req),
  completeSetup: (req: CompleteSetupRequest) => post<CompleteSetupResponse>("/api/provisioning/complete-setup", req),
};

export function generateDatabaseName(app: string, client: string): string {
  const c = client.trim().replace(/\s+/g, "");
  if (!c) return "";
  return app.toLowerCase() === "printudeerp" ? `IndusPrintude${c}` : `IndusEnterprise${c}`;
}
