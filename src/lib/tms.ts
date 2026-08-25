// API client + shared helpers for the Point Management module (migrated TMS).
// Talks to the ASP.NET backend (api/point-management/*) which reads/writes the
// IndusTaskManagement database. Mirrors the lib/customers.ts pattern.

import type { BadgeVariant } from "@/lib/ui";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

// ---------------- Types (camelCase — matches ASP.NET JSON) ----------------
export interface PmContext {
  tmsUserId: number;      // IndusTaskManagement UserID (0 if not a TMS user)
  tmsRole: string;        // admin | developer | tester | Support | Marketing
  fullName: string;
  modules: string[];      // allowed /point-management/* routes
}

export interface PmUser {
  userID: number;
  fullName: string;
  email?: string | null;
  role?: string | null;
  isActive: boolean;
  whatsAppNumber?: string | null;
}
export interface PmCustomer {
  customerID: number;
  customerName: string;
  companyName: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  isActive: boolean;
  dateCreated?: string | null;
}
export interface PmProduct { productID: number; productName: string; productVersion?: string | null; isActive: boolean; }
export interface PmCategory { categoryID: number; categoryName: string; isActive: boolean; }

export interface AdminDashboardStats {
  total: number; queue: number; assigned: number; inProgress: number; devCompleted: number;
  pendingSupport: number; supportVerified: number; pendingMerge: number; pendingQC: number;
  inTesting: number; testingCompleted: number; reOpened: number; hold: number; reject: number;
  closed: number; delayed: number; open: number;
}

export interface PointGridRow {
  pointID: number;
  title: string;
  summary?: string | null;
  module?: string | null;
  subModule?: string | null;
  description?: string | null;
  status: string;
  priority: string;
  category: string;
  complexity?: string | null;
  customerID: number;
  customerName?: string | null;
  productID: number;
  productName?: string | null;
  ticketID?: number | null;
  ticketNo?: string | null;
  assignedByName?: string | null;   // who created the Ticket (TMS "Assigned By")
  reportedByID: number;
  reportedByName?: string | null;
  assignedToID?: number | null;
  assignedToName?: string | null;
  dateCreated?: string | null;
  expectedDate?: string | null;
  startDate?: string | null;
  dateCompleted?: string | null;
  dateClosed?: string | null;
  toDoDate?: string | null;
  expectedMinutes?: number | null;
  totalTimeSpent?: number | null;
  pauseTimeMinutes?: number | null;
  isVerified: boolean;
  verificationStatus: number;
  isDeveloperPaused: boolean;
  sortOrder?: number | null;
  audioFilePath?: string | null;
  trackerChangeRequestId?: number | null;   // set once this point has been sent to a client Tracker
}

export interface PointFilter {
  status?: string; from?: string; to?: string; devId?: number; custId?: number; reportedBy?: number;
}

export interface NewPoint {
  title?: string; summary?: string; description: string;
  module?: string; subModule?: string;    // keyline Module Name / Sub Module Name
  customerID: number; customerName?: string; productID: number; reportedByID: number;
  priority: string; category: string; complexity?: string;
}

export interface AttachmentRow {
  attachmentID: number; pointID: number; fileName: string; originalFileName?: string | null;
  uploadTimestamp: string; uploadedByID: number; uploadedByName?: string | null;
}

export interface NotificationRow {
  notificationID: number; messageText?: string | null; navigateURL?: string | null; isRead: boolean; dateCreated: string;
}

export interface TmsUserSave {
  userID: number; fullName: string; email: string; password?: string; role: string; whatsAppNumber?: string; isActive: boolean;
}
export interface TmsCustomerSave {
  customerID: number; customerName: string; companyName: string; contactPerson?: string; contactEmail?: string; contactPhone?: string; isActive: boolean;
}
export interface AppUserInfo { userId: number; fullName: string; email: string; role?: string | null; }
export interface PmModuleInfo { moduleID: number; moduleName: string; moduleDisplayName: string; }

export interface TimeReportRow {
  pointID: number; customer?: string | null; product?: string | null; module?: string | null;
  reportedBy?: string | null; assignedTo?: string | null; status: string; priority: string;
  expectedMinutes?: number | null; totalTimeSpent?: number | null; pauseTimeMinutes?: number | null;
  delayMinutes: number; supportTimeSpent?: number | null;
  dateCreated?: string | null; expectedDate?: string | null; dateClosed?: string | null;
}

export interface TicketRow {
  ticketID: number; ticketNo: string; assignedToID: number; assignedToName?: string | null;
  createdByName?: string | null; department?: string | null; status: string; dateCreated?: string | null;
  pointCount: number; openCount: number;
}
export interface AssignBody {
  devId: number; createdById: number; expectedDate?: string; expectedMinutes?: number; pointIds: number[];
}

export interface AssignmentRow {
  pointID: number; title: string; ticketID?: number | null;
  assignedToID?: number | null; assignedToName?: string | null;
  assignedByID?: number | null; assignedByName?: string | null; assignDate?: string | null;
  reportedByName?: string | null; status: string; priority: string; description?: string | null;
  customerName?: string | null; productName?: string | null; module?: string | null; subModule?: string | null;
}

export interface PointDetail {
  pointID: number; title: string; summary?: string | null; description?: string | null;
  status: string; priority: string; category: string; complexity?: string | null;
  module?: string | null; subModule?: string | null; dateCreated?: string | null;
  customerName?: string | null; productName?: string | null; ticketNo?: string | null;
  assignedToName?: string | null; reportedByName?: string | null;
  expectedMinutes?: number | null; totalTimeSpent?: number | null; pauseTimeMinutes?: number | null;
  isDeveloperPaused: boolean; startDate?: string | null; dateCompleted?: string | null; expectedDate?: string | null;
  developerRemark?: string | null; testerRemark?: string | null; supportRemark?: string | null; adminRemark?: string | null;
}

export interface PointHistoryRow {
  historyID: number; developerName?: string | null; testerName?: string | null; supportName?: string | null;
  cycleStatus: string; startDate?: string | null; completeDate?: string | null;
  timeSpentMinutes?: number | null; extraTimeMinutes?: number | null;
  developerRemark?: string | null; testerRemark?: string | null; supportRemark?: string | null;
}

// ---------------- fetch helpers ----------------
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

function qs(f: PointFilter): string {
  const p = new URLSearchParams();
  if (f.status && f.status !== "All") p.set("status", f.status);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.devId) p.set("devId", String(f.devId));
  if (f.custId) p.set("custId", String(f.custId));
  if (f.reportedBy) p.set("reportedBy", String(f.reportedBy));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const pmApi = {
  me: (userId: number, email: string) =>
    get<PmContext>(`/api/point-management/me?userId=${userId}&email=${encodeURIComponent(email)}`),

  // lookups
  users: (role?: string) => get<PmUser[]>(`/api/point-management/users${role ? `?role=${encodeURIComponent(role)}` : ""}`),
  customers: () => get<PmCustomer[]>("/api/point-management/customers"),
  products: () => get<PmProduct[]>("/api/point-management/products"),
  categories: () => get<PmCategory[]>("/api/point-management/categories"),

  // admin dashboard
  adminStats: (f: PointFilter = {}) => get<AdminDashboardStats>(`/api/point-management/dashboard/admin/stats${qs(f)}`),
  points: (f: PointFilter = {}) => get<PointGridRow[]>(`/api/point-management/points${qs(f)}`),
  queue: () => get<PointGridRow[]>("/api/point-management/points/queue"),

  // create + triage
  addPoint: (b: NewPoint) => send<{ pointId: number }>("POST", "/api/point-management/points", b),
  verificationQueue: (vs = 0) => get<PointGridRow[]>(`/api/point-management/points/verification?vs=${vs}`),
  markVerified: (id: number) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/verify`),
  markUnActive: (id: number, adminRemark: string) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/unactive`, { adminRemark }),
  closePoint: (id: number) => send<{ ok: boolean; message?: string }>("POST", `/api/point-management/points/${id}/close`, {}),
  sendToTracker: (id: number) => send<{ success: boolean; crId?: number; clientCode?: string; alreadyLinked?: boolean; message?: string }>("POST", `/api/point-management/points/${id}/send-to-tracker`, {}),

  // role boards
  developerBoard: (userId?: number) => get<PointGridRow[]>(`/api/point-management/developer/board${userId ? `?userId=${userId}` : ""}`),
  testerQueue: () => get<PointGridRow[]>("/api/point-management/tester/queue"),
  supportQueue: (userId?: number) => get<PointGridRow[]>(`/api/point-management/support/queue${userId ? `?userId=${userId}` : ""}`),
  mergeQueue: () => get<PointGridRow[]>("/api/point-management/merge/queue"),

  // detail + history
  pointDetail: (id: number) => get<PointDetail>(`/api/point-management/points/${id}/detail`),
  pointHistory: (id: number) => get<PointHistoryRow[]>(`/api/point-management/points/${id}/history`),

  // developer timer + transitions
  startTimer: (id: number, userId: number) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/timer/start`, { userId }),
  pauseTimer: (id: number, userId: number) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/timer/pause`, { userId }),
  resumeTimer: (id: number, userId: number) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/timer/resume`, { userId }),
  completeTimer: (id: number, userId: number) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/timer/complete`, { userId }),
  sendToSupport: (id: number, userId: number, remark: string) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/send-to-support`, { userId, remark }),
  sendToMerge: (id: number, userId: number) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/send-to-merge`, { userId }),
  setPointStatus: (id: number, userId: number, status: string, remark: string) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/status`, { userId, status, remark }),

  // tester
  startTester: (id: number, userId: number) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/tester/start`, { userId }),
  completeTesting: (id: number, userId: number) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/tester/complete`, { userId }),
  verifyClose: (id: number, userId: number, remark: string) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/tester/verify-close`, { userId, remark }),
  testerReopen: (id: number, userId: number, remark: string) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/tester/reopen`, { userId, remark }),

  // support
  startSupport: (id: number, userId: number) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/support/start`, { userId }),
  completeSupport: (id: number, userId: number) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/support/complete`, { userId }),
  supportVerify: (id: number, userId: number, remark: string) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/support/verify`, { userId, remark }),
  supportSendToQc: (id: number, userId: number, remark: string) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/support/send-to-qc`, { userId, remark }),
  supportReopen: (id: number, userId: number, remark: string) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/support/reopen`, { userId, remark }),

  // merge
  mergeApprove: (id: number, userId: number, remark: string) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/merge/approve`, { userId, remark }),
  mergeReopen: (id: number, userId: number, remark: string) => send<{ ok: boolean }>("POST", `/api/point-management/points/${id}/merge/reopen`, { userId, remark }),

  // tickets (assign / manage assignments)
  assign: (b: AssignBody) => send<{ ticketId: number }>("POST", "/api/point-management/tickets/assign", b),
  tickets: () => get<TicketRow[]>("/api/point-management/tickets"),
  assignments: () => get<AssignmentRow[]>("/api/point-management/assignments"),
  reassignTicket: (id: number, newDevId: number, assignedByUserId: number) => send<{ ok: boolean }>("POST", `/api/point-management/tickets/${id}/reassign`, { newDevId, assignedByUserId }),
  closeTicket: (id: number) => send<{ ok: boolean }>("POST", `/api/point-management/tickets/${id}/close`),

  // reports
  timeReport: (f: { custId?: number; devId?: number; from?: string; to?: string } = {}) => {
    const p = new URLSearchParams();
    if (f.custId) p.set("custId", String(f.custId));
    if (f.devId) p.set("devId", String(f.devId));
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    const s = p.toString();
    return get<TimeReportRow[]>(`/api/point-management/reports/time${s ? `?${s}` : ""}`);
  },

  // admin: users
  adminUsers: () => get<PmUser[]>("/api/point-management/admin/users"),
  saveUser: (u: TmsUserSave) => send<{ userId: number }>("POST", "/api/point-management/admin/users", u),
  setUserActive: (id: number, active: boolean) => send<{ ok: boolean }>("POST", `/api/point-management/admin/users/${id}/active`, { active }),

  // admin: customers
  adminCustomers: () => get<PmCustomer[]>("/api/point-management/admin/customers"),
  saveCustomer: (c: TmsCustomerSave) => send<{ customerId: number }>("POST", "/api/point-management/admin/customers", c),
  setCustomerActive: (id: number, active: boolean) => send<{ ok: boolean }>("POST", `/api/point-management/admin/customers/${id}/active`, { active }),

  // admin: permissions
  appUsers: () => get<AppUserInfo[]>("/api/point-management/admin/app-users"),
  pmModules: () => get<PmModuleInfo[]>("/api/point-management/admin/pm-modules"),
  userModules: (userId: number) => get<number[]>(`/api/point-management/admin/user-modules?userId=${userId}`),
  saveUserModules: (userId: number, moduleIds: number[]) => send<{ ok: boolean }>("POST", "/api/point-management/admin/user-modules", { userId, moduleIds }),

  // notifications (bell)
  notifications: (email: string) => get<NotificationRow[]>(`/api/point-management/notifications?email=${encodeURIComponent(email)}`),
  notificationsUnread: (email: string) => get<{ count: number }>(`/api/point-management/notifications/unread?email=${encodeURIComponent(email)}`),
  markNotificationRead: (id: number) => send<{ ok: boolean }>("POST", `/api/point-management/notifications/${id}/read`),
  markAllNotificationsRead: (email: string) => send<{ ok: boolean }>("POST", `/api/point-management/notifications/read-all?email=${encodeURIComponent(email)}`),
  deleteNotification: (id: number) => send<{ ok: boolean }>("DELETE", `/api/point-management/notifications/${id}`),

  // attachments
  listAttachments: (pointId: number) => get<AttachmentRow[]>(`/api/point-management/points/${pointId}/attachments`),
  uploadAttachment: async (pointId: number, file: File, uploadedBy: number) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("uploadedBy", String(uploadedBy));
    const res = await fetch(`${BASE}/api/point-management/points/${pointId}/attachments`, { method: "POST", body: fd, cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<{ attachmentId: number }>;
  },
  attachmentDownloadUrl: (id: number) => `${BASE}/api/point-management/attachments/${id}/download`,
  deleteAttachment: (id: number) => send<{ ok: boolean }>("DELETE", `/api/point-management/attachments/${id}`),
};

export { send as pmSend };

// ---------------- display helpers ----------------
/** TMS point Status → indas-ui Badge variant. */
// Every distinct point status gets its OWN colour (not grouped) so the grid reads at a glance.
export function statusVariant(s?: string | null): BadgeVariant {
  switch ((s || "").trim()) {
    case "Queue": return "warning";
    case "Assigned": return "info";
    case "In Progress": return "indigo";
    case "DevCompleted": return "cyan";
    case "PendingSupport": return "orange";
    case "SupportVerified": return "teal";
    case "PendingMerge": return "purple";
    case "PendingQC": return "violet";
    case "In-Testing": return "sky";
    case "Testing-Completed": return "emerald";
    case "ReOpened": return "rose";
    case "Hold": return "amber";
    case "Reject": return "destructive";
    case "Closed": return "success";
    default: return "secondary";
  }
}

/** TMS point Priority → Badge variant. */
export function priorityVariant(p?: string | null): BadgeVariant {
  switch ((p || "").trim().toLowerCase()) {
    case "high":
    case "urgent":
    case "critical": return "destructive";
    case "medium": return "warning";
    case "low": return "secondary";
    default: return "default";
  }
}

/** Format a backend ISO date as dd-MMM-yyyy (blank when null). */
export function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Format a backend ISO date + time as dd-MMM-yyyy HH:mm. */
export function fmtDateTime(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Minutes → "Xh Ym" (blank when null/0-and-hideZero). */
export function fmtMins(m?: number | null): string {
  if (m === null || m === undefined) return "—";
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

// Submodule catalog (route → label) — used by the hub landing + guard messages.
export const PM_SUBMODULES: { route: string; label: string }[] = [
  { route: "/point-management/admin-dashboard", label: "Admin Dashboard" },
  { route: "/point-management/developer", label: "Developer Dashboard" },
  { route: "/point-management/developer-kpi", label: "Developer KPI" },
  { route: "/point-management/tester", label: "Tester Dashboard" },
  { route: "/point-management/add-point", label: "Add Point" },
  { route: "/point-management/manage-points", label: "Manage Points" },
  { route: "/point-management/assign", label: "Assign / Create Ticket" },
  { route: "/point-management/manage-assignments", label: "Manage Assignments" },
  { route: "/point-management/verify", label: "Verify Tickets" },
  { route: "/point-management/merge", label: "Merge Code" },
  { route: "/point-management/support", label: "Support Action Center" },
  { route: "/point-management/time-report", label: "Time Report" },
  { route: "/point-management/customer-progress", label: "Customer Progress" },
  { route: "/point-management/users", label: "Manage Users" },
  { route: "/point-management/tms-customers", label: "Manage Customers" },
  { route: "/point-management/permissions", label: "User Permissions" },
];
