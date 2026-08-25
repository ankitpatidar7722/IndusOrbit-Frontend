import { userIdHeader } from "@/lib/currentUser";
// API client for finalized Kick-Off / Sign-Off documents (app.ClientDocuments).
// The template is edited in the browser; the finalized HTML is saved here so it can
// be viewed and downloaded later (after emailing the client).
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export type ClientDocType = "KickOff" | "SignOff";

/** Status row (no HTML) — drives the tab's "Saved on … by …" badge. */
export interface ClientDocMeta {
  docType: ClientDocType;
  savedByUserId?: number | null;
  savedByName?: string | null;
  savedAt: string;
  updatedAt?: string | null;
}

/** Full saved document (with HTML) for view / download / re-edit. */
export interface ClientDoc extends ClientDocMeta {
  docId: number;
  clientCode: string;
  htmlContent: string;
}

export interface SaveClientDocReq {
  clientCode: string;
  docType: ClientDocType;
  htmlContent: string;
  savedByUserId?: number | null;
  savedByName?: string | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  return res.json();
}

/** Uint8Array/ArrayBuffer → base64 (chunked so large PDFs don't blow the call stack). */
function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

export const clientDocsApi = {
  /** All saved-document status rows for a client. */
  meta: (clientCode: string) =>
    get<{ success: boolean; data: ClientDocMeta[] }>(`/api/client-documents/${encodeURIComponent(clientCode)}`),

  /** Full saved document (with HTML), or data:null if none saved. */
  get: (clientCode: string, docType: ClientDocType) =>
    get<{ success: boolean; message?: string; data: ClientDoc | null }>(
      `/api/client-documents/${encodeURIComponent(clientCode)}/${docType}`,
    ),

  /** The saved document rendered to a PDF (server headless-browser print), base64-encoded.
   *  Returns null if none saved / the server can't render (caller falls back to HTML). */
  pdf: async (clientCode: string, docType: ClientDocType): Promise<{ base64: string; size: number } | null> => {
    try {
      const res = await fetch(`${BASE}/api/client-documents/${encodeURIComponent(clientCode)}/${docType}/pdf`, { cache: "no-store" });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      if (!buf.byteLength) return null;
      return { base64: bufToBase64(buf), size: buf.byteLength };
    } catch { return null; }
  },

  /** Save (upsert) the finalized document. */
  save: async (req: SaveClientDocReq) => {
    const res = await fetch(`${BASE}/api/client-documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...userIdHeader() },
      body: JSON.stringify(req),
      cache: "no-store",
    });
    return res.json().catch(() => ({ success: false, message: `${res.status} ${res.statusText}` })) as Promise<{
      success: boolean;
      message: string;
      docId?: number;
      savedAt?: string;
    }>;
  },
};
