import { userIdHeader } from "@/lib/currentUser";
// API client for the Customers (client subscriptions) module — cloned from
// BulkImport's Company Subscription, reading the central Indus control DB.

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface CustomerCard {
  companyUserID: string;
  companyUniqueCode?: string | null;
  companyName: string;
  companyCode?: string | null;
  applicationName?: string | null;
  applicationVersion?: string | null;
  subscriptionStatus?: string | null;
  statusDescription?: string | null;
  subscriptionStatusMessage?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  gstin?: string | null;
  email?: string | null;
  mobile?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  paymentDueDate?: string | null;
  loginAllowed?: number | null;
  userLimit?: number | null;
  lastLoginDateTime?: string | null;
  cloudSubscriptionStatus?: string | null;
}

export interface CustomerDetail extends CustomerCard {
  password?: string | null;
  conn_String?: string | null;
  dataBaseLocation?: string | null;
  isActive?: boolean | null;
  applicationBaseURL?: string | null;
  maxCompanyUniqueCode?: number | null;
  fYear?: string | null;
  latestVersion?: string | null;
  isMessageActive?: boolean | null;
  messageDurationValue?: number | null;
  messageDurationType?: string | null;
  cloudSubscriptionStatus?: string | null;
  cloudFromDate?: string | null;
  cloudToDate?: string | null;
  cloudPaymentDueDate?: string | null;
  erpSubscriptionPeriod?: string | null;
  cloudSubscriptionPeriod?: string | null;
}

export interface MessageFormatDto {
  messageID: number;
  messageTitle: string;
  messageContent: string;
  isActive: boolean;
}

export interface MessageFormatSaveRequest {
  messageID?: number;
  messageTitle: string;
  messageContent: string;
  isActive?: boolean;
}

export interface CustomerStats {
  total: number;
  active: number;
  expired: number;
}

// Subscription "Exceed Days" — an extension on top of Payment Due, stored in OUR local app DB
// (never the shared control DB). Payment Due is untouched; the UI shows Exceed Date = Payment Due + days.
export interface ExceedEntry {
  active: boolean;
  days: number;
}
export interface ExceedHistoryRow {
  kind: string;              // 'ERP' | 'Cloud'
  oldDays: number;
  newDays: number;
  changedBy?: number | null;
  changedByName?: string | null;
  changedDate: string;
}
export interface ClientExceed {
  erp: ExceedEntry;
  cloud: ExceedEntry;
  history: ExceedHistoryRow[];
}

export type SubscriptionSave = Partial<CustomerDetail> & { originalCompanyUserID?: string };

export interface DeleteRequest {
  companyUserID: string;
  companyName?: string;
  companyUniqueCode?: string;
  userName: string;
  password: string;
  reason: string;
}

export interface ApiResult {
  success: boolean;
  message: string;
}

/** Live auto-fill values for the client Sign-Off document (backend gathers from control DB,
 *  the client's product DB and the app DB). Any unavailable field comes back as "". */
export interface SignoffData {
  documentCode: string; version: string; documentDate: string; erpProduct: string;
  companyName: string; address: string; city: string;
  projectStartDate: string; projectStartDateIso: string; goLiveDate: string; projectCompletionDate: string;
  contactPerson: string; implementationEngineer: string; implementationEngineerMobile: string;
  implementationHead: string; supportEmail: string; supportEmails?: string[];
  userMobiles?: Record<string, string>; inScopeModules: string[];
}

async function get<T>(path: string): Promise<T> {
  // Send UserID so the backend can scope the client list by Project Assignment (non-admins
  // see only their assigned projects; admins see all).
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", headers: { ...userIdHeader() } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function send<T>(method: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...userIdHeader() },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ success: false, message: `${res.status} ${res.statusText}` }));
  return data as T;
}

export const customersApi = {
  // `assignedOnly` → strict Project-Assignment scope (Implementation module): a non-admin sees only
  // their assigned clients (zero assignments → empty). Default (no flag) keeps /clients' "0 = all".
  list: (opts?: { assignedOnly?: boolean }) =>
    get<CustomerCard[]>(`/api/customers${opts?.assignedOnly ? "?scope=assigned" : ""}`),
  stats: () => get<CustomerStats>("/api/customers/stats"),
  detail: (id: string) => get<CustomerDetail>(`/api/customers/${encodeURIComponent(id)}`),
  nextCode: () => get<{ companyUniqueCode: string; maxCompanyUniqueCode: number }>("/api/customers/next-code"),
  appUrls: () => get<string[]>("/api/customers/app-urls"),
  getExceed: (code: string) => get<ClientExceed>(`/api/customers/${encodeURIComponent(code)}/exceed`),
  saveExceed: (code: string, body: { erp?: ExceedEntry; cloud?: ExceedEntry }) =>
    send<ClientExceed>("POST", `/api/customers/${encodeURIComponent(code)}/exceed`, body),
  create: (body: SubscriptionSave) => send<ApiResult>("POST", "/api/customers", body),
  update: (body: SubscriptionSave) => send<ApiResult>("PUT", "/api/customers", body),
  remove: (body: DeleteRequest) => send<ApiResult>("POST", "/api/customers/delete-with-auth", body),
  /** Live Sign-Off auto-fill data for a client (keyed by control-DB CompanyUserID). */
  signoffData: (companyUserId: string) =>
    get<{ success: boolean; data: SignoffData }>(`/api/signoff-data/${encodeURIComponent(companyUserId)}`),
};

interface MessageFormatListResponse { success: boolean; message: string; data: MessageFormatDto[]; }
interface MessageFormatResponse { success: boolean; message: string; data?: { messageID: number } }

export const messageFormatApi = {
  list: () => get<MessageFormatListResponse>("/api/messageformat"),
  create: (body: MessageFormatSaveRequest) => send<MessageFormatResponse>("POST", "/api/messageformat", body),
  update: (body: MessageFormatSaveRequest) => send<MessageFormatResponse>("PUT", "/api/messageformat", body),
  remove: (id: number) => send<MessageFormatResponse>("DELETE", `/api/messageformat/${id}`, {}),
};

/** Format a backend ISO date as dd-MMM-yyyy (blank when null). */
export function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
