// Employee portal auth — authenticates against IndusAppDB.dbo.Employees via the
// backend (/api/employee-auth/login). Lightweight client-side session in localStorage,
// separate from the Indus360 admin next-auth session.

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";
const KEY = "indus_employee";

export interface Employee {
  employeeID: number;
  employeeCode?: string | null;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  personalEmail?: string | null;
  workLocation?: string | null;
  employeeType?: string | null;
  status?: string | null;
  photoPath?: string | null;
  dateOfJoining?: string | null;
  designationID?: number | null;
  departmentID?: number | null;
}

export interface LoginResult {
  success: boolean;
  message?: string;
  employee?: Employee;
}

export async function employeeLogin(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${BASE}/api/employee-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return await res.json().catch(() => ({ success: false, message: `${res.status} ${res.statusText}` }));
  } catch {
    return { success: false, message: "Could not reach the server. Is the API running on :5080?" };
  }
}

export function saveEmployee(e: Employee) { try { localStorage.setItem(KEY, JSON.stringify(e)); } catch {} }
export function getEmployee(): Employee | null {
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as Employee) : null; } catch { return null; }
}
export function clearEmployee() { try { localStorage.removeItem(KEY); } catch {} }
