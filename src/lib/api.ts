import { userIdHeader } from "@/lib/currentUser";
// Typed API client for the Indus 360 backend (ASP.NET Core / Dapper).
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface ClientListItem {
  clientCode: string;
  name: string;
  city?: string;
  application?: string;
  status: string;
  progress: number;
  consultant?: string;
  openCrCount: number;
}

export interface ClientModule { id: number; clientCode: string; moduleName: string; isOn: boolean; }
export interface Milestone {
  id: number; clientCode: string;
  milestoneGroup?: string;         // Roadmap to Success (Milestone-1…)
  name: string;                    // Phases
  taskTimeline?: string;           // Task Timeline
  plannedDate?: string;            // Estimated Start Date
  actualDate?: string;             // Actual Start Date
  endDate?: string;                // End Date
  resPerson?: string;              // Res. Person (Indus)
  status: string;
  startDateVariance?: string;      // Start Date Variance (Days)
  scheduledStartStatus?: string;   // Scheduled Start Status
  remarkStartDelay?: string;       // Remark-1 (Start Delay)
  timelineVariance?: string;       // Timeline Variance (Days)
  timelineVarianceStatus?: string; // Timeline Variance Status
  remarkDuration?: string;         // Remark-2 (Duration)
  sortOrder: number;
  emailed: boolean; tasked: boolean;
}
export interface TrainingUpdate {
  id: number; clientCode: string;
  moduleName?: string;             // Main Module
  subModule?: string;
  timelineDays?: string;           // Timeline in Days
  logDate?: string;                // Schedule Date
  startTime?: string; endTime?: string;
  trainee?: string;                // Trainee Name
  trainer?: string;                // Trainer from Indas
  status: string;
  details?: string;                // Details of Covered Modules
  remark?: string;
  videoUrl?: string;
  emailed: boolean; tasked: boolean;
}
export interface KeylineModule { head: string; name: string; }

export interface ChangeRequest {
  id: number; clientCode: string;
  moduleName?: string;             // Module Name (keyline ModuleHeadDisplayName)
  subModule?: string;              // Sub Module Name (keyline ModuleDisplayName)
  description?: string;            // Point Description
  raisedBy?: string;
  raisedDate?: string;
  reportedBy?: string;
  queryType: string;
  status: string;
  completionDate?: string;
  completionDays?: string;
  remark?: string;
  inBugTool: boolean;
  emailed: boolean; tasked: boolean; pointed: boolean;
  pointID?: number | null;         // Point Management ticket id created from this CR
}
export interface SupportLog { id: number; clientCode: string; logDate?: string; moduleName?: string; subModule?: string; problem?: string; solution?: string; status: string; emailed: boolean; tasked: boolean; }
export interface OnsiteVisit {
  id: number; clientCode: string;
  person: string;                  // Person Name
  age?: string;
  mobileNo?: string;
  location?: string;
  fromDate?: string; toDate?: string; days?: string;
  ticketCharge?: string;           // Tickets
  hotelCharge?: string;
  foodCharge?: string;
  siteCharge?: string;
  status: string;
  emailed?: boolean;
}

export interface ClientDetail {
  clientCode: string; name: string; city?: string; gstin?: string; contact?: string; email?: string; mobile?: string;
  segment?: string; application?: string; product?: string; consultant?: string; status: string; progress: number;
  companyLogin?: string; passwordMasked?: string; userLogin?: string; url?: string;
  kickoffDone: boolean; kickoffDate?: string; mastersSent: boolean; signoffDone: boolean; source?: string;
  modules: ClientModule[]; milestones: Milestone[]; training: TrainingUpdate[];
  changeRequests: ChangeRequest[]; support: SupportLog[]; onsite: OnsiteVisit[];
}

export interface Stats { total: number; inImplementation: number; goLive: number; openChangeRequests: number; }

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...userIdHeader(), ...(init?.headers || {}) },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (res.status === 204 ? (undefined as T) : await res.json());
}

export const api = {
  getStats: () => j<Stats>("/api/dashboard/stats"),
  getClients: () => j<ClientListItem[]>("/api/clients"),
  getClient: (code: string) => j<ClientDetail>(`/api/clients/${code}`),
  getTracker: (code: string) => j<{ milestones: Milestone[]; training: TrainingUpdate[]; changeRequests: ChangeRequest[]; support: SupportLog[]; onsite: OnsiteVisit[] }>(`/api/clients/${encodeURIComponent(code)}/tracker`),
  createClient: (body: unknown) => j<ClientDetail>("/api/clients", { method: "POST", body: JSON.stringify(body) }),

  addMilestone: (code: string, b: unknown) => j<Milestone>(`/api/clients/${code}/milestones`, { method: "POST", body: JSON.stringify(b) }),
  updateMilestone: (code: string, id: number, b: unknown) => j<Milestone>(`/api/clients/${code}/milestones/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteMilestone: (code: string, id: number) => j<void>(`/api/clients/${code}/milestones/${id}`, { method: "DELETE" }),

  addTraining: (code: string, b: unknown) => j<TrainingUpdate>(`/api/clients/${code}/training`, { method: "POST", body: JSON.stringify(b) }),
  updateTraining: (code: string, id: number, b: unknown) => j<TrainingUpdate>(`/api/clients/${code}/training/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteTraining: (code: string, id: number) => j<void>(`/api/clients/${code}/training/${id}`, { method: "DELETE" }),

  // Keyline enterprise catalog — (Module Name, Sub Module Name) pairs for the Change-Request form.
  keylineModules: () => j<{ success: boolean; data: KeylineModule[] }>("/api/keyline/modules"),

  addChangeRequest: (code: string, b: unknown) => j<ChangeRequest>(`/api/clients/${code}/changerequests`, { method: "POST", body: JSON.stringify(b) }),
  updateChangeRequest: (code: string, id: number, b: unknown) => j<ChangeRequest>(`/api/clients/${code}/changerequests/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteChangeRequest: (code: string, id: number) => j<void>(`/api/clients/${code}/changerequests/${id}`, { method: "DELETE" }),
  // Send a Change Request to Point Management as a Point → returns the Ticket (Point) id.
  changeRequestToPoint: (code: string, id: number, body?: { clientName?: string; application?: string }) =>
    j<{ success: boolean; pointId?: number; product?: string; message?: string }>(`/api/clients/${code}/changerequests/${id}/to-point`, { method: "POST", body: JSON.stringify(body ?? {}) }),

  addSupport: (code: string, b: unknown) => j<SupportLog>(`/api/clients/${code}/support`, { method: "POST", body: JSON.stringify(b) }),

  addOnsite: (code: string, b: unknown) => j<OnsiteVisit>(`/api/clients/${code}/onsite`, { method: "POST", body: JSON.stringify(b) }),
  updateOnsite: (code: string, id: number, b: unknown) => j<OnsiteVisit>(`/api/clients/${code}/onsite/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteOnsite: (code: string, id: number) => j<void>(`/api/clients/${code}/onsite/${id}`, { method: "DELETE" }),
};
