// Turns an unknown thrown value (axios error, TypeError, …) into a human-readable message so the
// bulk modules can surface WHY a call failed instead of a generic "please try again".
export function bulkApiError(e: unknown, fallback = "Something went wrong."): string {
  const ax = e as { response?: { status?: number; data?: unknown }; request?: unknown; message?: string; code?: string };
  if (ax?.response) {
    const d = ax.response.data;
    const msg = typeof d === "string" ? d : (d as { message?: string })?.message || (d as { error?: string })?.error || (d as { title?: string })?.title;
    return `Server error ${ax.response.status ?? ""}${msg ? `: ${msg}` : ""}`.trim();
  }
  if (ax?.code === "ECONNABORTED") return "Request timed out.";
  if (ax?.request) return "No response from the backend (is it running at localhost:5080?).";
  return ax?.message || fallback;
}
