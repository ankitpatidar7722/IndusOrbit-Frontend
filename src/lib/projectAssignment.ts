// API client for Admin → Project Assignment.
// Projects (client companies) come LIVE from the prod Indus DB; the per-user
// assignment mapping is stored locally (app.UserProjectAssignment).
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface Project {
  code: string;              // CompanyUniqueCode e.g. "IA00206"
  name: string;              // Client / Company name
  application?: string | null;
  status?: string | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  return res.json();
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  return res.json().catch(() => ({ success: false, error: `${res.status} ${res.statusText}` }));
}

export const projectAssignmentApi = {
  /** All assignable projects (client companies) from prod. */
  projects: () => get<{ success: boolean; data: Project[]; error?: string }>("/api/project-assignment/projects"),
  /** Project codes currently assigned to a user. */
  assigned: (userId: number) => get<{ success: boolean; data: string[]; error?: string }>(`/api/project-assignment/user/${userId}`),
  /** Replace a user's assigned projects. */
  save: (userId: number, projectCodes: string[], assignedBy?: number) =>
    post<{ success: boolean; count?: number; error?: string }>(`/api/project-assignment/user/${userId}`, { projectCodes, assignedBy }),
};
