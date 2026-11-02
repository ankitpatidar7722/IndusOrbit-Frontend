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

export interface ServerDrive {
  drive: string;
  label: string | null;
  /** Null when only the free space is known (drive holds no database files). */
  totalMB: number | null;
  freeMB: number;
  dbCount: number;
}

export interface ServerDbDetail {
  name: string;
  state: string;
  recovery: string;
  created: string;
  dataMB: number;
  logMB: number;
  drives: string;
  lastBackup: string | null;
}

export interface ServerInfo {
  serverName: string | null;
  version: string;
  productVersion: string | null;
  productLevel: string | null;
  edition: string | null;
  cpuCount: number | null;
  ramMB: number | null;
  ramFreeMB: number | null;
  sqlMemoryMB: number | null;
  startTime: string | null;
  drives: ServerDrive[];
  databases: ServerDbDetail[];
  warnings: string[];
}

/** Result of an uploaded .bak check (RESTORE HEADERONLY). */
export interface UploadedBackupInfo {
  filePath: string;
  fileName: string;
  databaseName: string | null;
  sourceServer: string | null;
  backupDate: string | null;
  backupSizeMB: number;
  restoredSizeMB: number;
  compressed: boolean;
  server: string;
}

export interface UploadOpStatus<T = unknown> {
  stage: string;
  percent: number;
  isComplete: boolean;
  success: boolean;
  error?: string | null;
  result?: T | null;
}

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || fallback);
  }
  return res.json();
}

const postJson = (path: string, body: unknown) =>
  fetch(`${BASE}/api/database-backup/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...userIdHeader() },
    body: JSON.stringify(body),
  });

/** "By Server → Upload .bak": put a local .bak in the server's backup folder, then optionally restore it. */
export const backupUploadApi = {
  target: async (creds: ServerCredentials) =>
    jsonOrThrow<{ folder: string; freeMB: number | null; chunkBytes: number }>(
      await postJson("upload/target", creds), "Could not read the server's backup folder."),

  start: async (creds: ServerCredentials, fileName: string, size: number) =>
    jsonOrThrow<{ uploadId: string; fileName: string; folder: string; parts: number; chunkBytes: number }>(
      await postJson("upload/start", { ...creds, fileName, size }), "Could not start the upload."),

  /** One chunk; `gz` = the body is gzip-compressed. */
  chunk: async (uploadId: string, seq: number, body: Blob, gz: boolean, signal?: AbortSignal) => {
    const res = await fetch(`${BASE}/api/database-backup/upload-chunk/${encodeURIComponent(uploadId)}?seq=${seq}&gz=${gz ? 1 : 0}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", ...userIdHeader() },
      body,
      signal,
    });
    await jsonOrThrow(res, `Chunk ${seq + 1} failed.`);
  },

  complete: async (uploadId: string) =>
    jsonOrThrow<{ operationId: string }>(await postJson(`upload/${encodeURIComponent(uploadId)}/complete`, {}), "Could not finish the upload."),

  cancel: async (uploadId: string) => {
    await fetch(`${BASE}/api/database-backup/upload/${encodeURIComponent(uploadId)}`, {
      method: "DELETE", headers: { ...userIdHeader() },
    }).catch(() => {});
  },

  /** replace = overwrite the existing database of that name; safetyBackup = back it up first (replace only). */
  restore: async (uploadId: string, databaseName: string, replace = false, safetyBackup = true) =>
    jsonOrThrow<{ operationId: string }>(
      await postJson(`upload/${encodeURIComponent(uploadId)}/restore`, { databaseName, replace, safetyBackup }), "Could not start the restore."),

  op: async <T,>(operationId: string) =>
    jsonOrThrow<UploadOpStatus<T>>(
      await fetch(`${BASE}/api/database-backup/upload/op/${encodeURIComponent(operationId)}`, { cache: "no-store", headers: { ...userIdHeader() } }),
      "Could not read the progress."),
};

export const databaseBackupApi = {
  /** "By Server": read-only health snapshot (drives, CPU/RAM, version, database sizes). */
  serverInfo: async (creds: ServerCredentials): Promise<ServerInfo> => {
    const res = await fetch(`${BASE}/api/database-backup/server-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...userIdHeader() },
      body: JSON.stringify(creds),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Could not load server details.");
    }
    return res.json();
  },

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
