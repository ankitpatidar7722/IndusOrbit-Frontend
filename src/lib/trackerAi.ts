// Tracker AI (Gemini) — generate a short summary of a tracker row from its filled fields.
// Sends the acting user's UserID so the backend uses THAT user's own Gemini key (Settings → AI).
import { userIdHeader } from "@/lib/currentUser";
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface SummarizeResult {
  success: boolean;
  summary?: string;
  message?: string;
}

export interface RewriteResult {
  success: boolean;
  text?: string;
  message?: string;
}

export const trackerAiApi = {
  /** Quick AI overview of an email (a few short bullet points). Uses the acting user's Gemini key. */
  summarizeEmail: async (email: { subject?: string; from?: string; body: string }): Promise<SummarizeResult> => {
    try {
      const res = await fetch(`${BASE}/api/tracker-ai/summarize-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...userIdHeader() },
        body: JSON.stringify(email),
        cache: "no-store",
      });
      return (await res.json()) as SummarizeResult;
    } catch (e) {
      return { success: false, message: `Could not reach the AI service: ${e}` };
    }
  },

  /** Ask Gemini to summarize a row. `fields` is a human-readable label → value map. */
  summarize: async (entity: string, fields: Record<string, string>): Promise<SummarizeResult> => {
    try {
      const res = await fetch(`${BASE}/api/tracker-ai/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...userIdHeader() },
        body: JSON.stringify({ entity, fields }),
        cache: "no-store",
      });
      return (await res.json()) as SummarizeResult;
    } catch (e) {
      return { success: false, message: `Could not reach the AI service: ${e}` };
    }
  },

  /** Rewrite free text into clear, professional English. Uses the acting user's Gemini key. */
  rewriteEnglish: async (text: string): Promise<RewriteResult> => {
    try {
      const res = await fetch(`${BASE}/api/tracker-ai/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...userIdHeader() },
        body: JSON.stringify({ text }),
        cache: "no-store",
      });
      return (await res.json()) as RewriteResult;
    } catch (e) {
      return { success: false, message: `Could not reach the AI service: ${e}` };
    }
  },
};
