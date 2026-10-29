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

export interface ServerCredentials {
  server: string;
  userId: string;
  password: string;
  /** Save the password (encrypted on the server) for next time. */
  remember?: boolean;
  /** Password left blank: use the one saved for this server. */
  useSaved?: boolean;
}

/** A server this user connected to before (passwords are never sent back). */
export interface SavedServer {
  server: string;
  userId: string | null;
  hasPassword: boolean;
}

export interface ServerDatabase {
  name: string;
  sizeMB: number;
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

  /** "By Server": list the user databases on a server using typed credentials (never stored). */
  serverDatabases: async (creds: ServerCredentials): Promise<ServerDatabase[]> => {
    const res = await fetch(`${BASE}/api/database-backup/server-databases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...userIdHeader() },
      body: JSON.stringify(creds),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Could not load databases from this server.");
    }
    return res.json();
  },

  /** "By Server": back up one database from the typed server. Same status/download flow as start(). */
  startServer: async (creds: ServerCredentials, database: string): Promise<{ operationId: string; databaseName: string }> => {
    const res = await fetch(`${BASE}/api/database-backup/start-server`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...userIdHeader() },
      body: JSON.stringify({ ...creds, database }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Failed to start backup.");
    }
    return res.json();
  },

  /** This user's previously used servers, newest first. */
  savedServers: async (): Promise<SavedServer[]> => {
    const res = await fetch(`${BASE}/api/database-backup/saved-servers`, { cache: "no-store", headers: { ...userIdHeader() } });
    if (!res.ok) return [];
    return res.json();
  },

  /** Remove a server (and its saved password) from this user's history. */
  forgetServer: async (server: string): Promise<void> => {
    const res = await fetch(`${BASE}/api/database-backup/saved-servers?server=${encodeURIComponent(server)}`, {
      method: "DELETE",
      headers: { ...userIdHeader() },
    });
    if (!res.ok) throw new Error("Could not remove the saved server.");
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
