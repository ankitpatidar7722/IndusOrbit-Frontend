// API client for the master-data Excel template library (global + GROUP-aware; served from the
// backend <contentRoot>/master-templates/<group> folders). Used by the client "Template Master
// Excel" tab — the same library shows for every client.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface MasterTemplate {
  group: string;     // "" = ungrouped
  name: string;      // file name (unique within its group)
  size: number;
  modifiedAt: string;
}

/** Per-client "Sent to Client" status for a template (set when it's emailed to that client). */
export interface TemplateSentStatus {
  group: string;
  name: string;
  sentAt: string;
  sentBy?: string | null;
}

const q = (group: string, name: string) =>
  `name=${encodeURIComponent(name)}&group=${encodeURIComponent(group || "")}`;

export const masterTemplatesApi = {
  list: () =>
    fetch(`${BASE}/api/master-templates`, { cache: "no-store" }).then((r) => r.json()) as Promise<{
      success: boolean;
      data: MasterTemplate[];
    }>,

  downloadUrl: (group: string, name: string) => `${BASE}/api/master-templates/download?${q(group, name)}`,

  upload: async (file: File, group: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("group", group || "");
    const res = await fetch(`${BASE}/api/master-templates/upload`, { method: "POST", body: fd });
    return res.json().catch(() => ({ success: false, message: `${res.status} ${res.statusText}` })) as Promise<{
      success: boolean;
      message: string;
      name?: string;
    }>;
  },

  remove: (group: string, name: string) =>
    fetch(`${BASE}/api/master-templates?${q(group, name)}`, { method: "DELETE" }).then((r) => r.json()) as Promise<{
      success: boolean;
      message: string;
    }>,

  /** Templates already emailed to a given client (for the "Sent to Client" badge). */
  listStatus: (clientCode: string) =>
    fetch(`${BASE}/api/master-templates/status?clientCode=${encodeURIComponent(clientCode)}`, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => ({ success: false, data: [] })) as Promise<{ success: boolean; data: TemplateSentStatus[] }>,

  /** Record that templates were emailed to a client (call after a successful send). */
  markSent: (clientCode: string, sentBy: number | undefined, items: { group: string; name: string }[]) =>
    fetch(`${BASE}/api/master-templates/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientCode, sentBy, items }),
    }).then((r) => r.json()).catch(() => ({ success: false })) as Promise<{ success: boolean }>,

  /** Fetch a template's bytes as base64 (no data: prefix) — for attaching to an email. */
  fetchBase64: async (group: string, name: string): Promise<string> => {
    const res = await fetch(masterTemplatesApi.downloadUrl(group, name), { cache: "no-store" });
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
    return dataUrl.split(",")[1] ?? "";
  },
};
