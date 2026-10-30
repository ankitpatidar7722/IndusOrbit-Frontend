import DOMPurify from "dompurify";

/**
 * Clean stored / user-supplied HTML (email signatures, template bodies) before it is put into the live
 * page with innerHTML: keeps formatting, tables, links and images, drops <script>, event handlers
 * (onerror=…), javascript: URLs and similar. Client-only (DOMPurify needs a DOM) — on the server the
 * HTML is returned unchanged because nothing renders it there.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  const s = html ?? "";
  if (typeof window === "undefined") return s;
  return DOMPurify.sanitize(s);
}
