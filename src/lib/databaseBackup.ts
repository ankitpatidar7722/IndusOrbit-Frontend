import { userIdHeader } from "@/lib/currentUser";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

/** Live status of a running "Database Backup" operation (polled). Mirrors the backend
 *  OperationStatusResponse (camelCase). */
export interface BackupStatus {
  operationId: string;
  stage: string;
  percentComplete: number;
  message: string;
  isComplete: boolean;
  success: boolean;
  error?: string | null;
}

export const databaseBackupApi = {
  /** Kick off a backup for a client (by control-DB CompanyUserID). Returns the operationId to poll. */
  start: async (companyUserId: string): Promise<{ operationId: string; databaseName: string }> => {
    const res = await fetch(`${BASE}/api/database-backup/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...userIdHeader() },
      body: JSON.stringify({ companyUserId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Failed to start backup.");
    }
    return res.json();
  },

  /** Poll for progress. */
  status: async (operationId: string): Promise<BackupStatus> => {
    const res = await fetch(`${BASE}/api/database-backup/status/${encodeURIComponent(operationId)}`, {
      cache: "no-store",
      headers: { ...userIdHeader() },
    });
    if (!res.ok) throw new Error("Failed to get backup status.");
    return res.json();
  },

  /** Direct URL to stream the finished .zip (one-time; cleaned up after). */
  downloadUrl: (operationId: string) => `${BASE}/api/database-backup/download/${encodeURIComponent(operationId)}`,
};
