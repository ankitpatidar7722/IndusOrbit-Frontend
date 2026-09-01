// Read-only bridge into the internal CRM app (IndusInternalApp)'s Clients list — backs the
// "CRM Client" picker in the /clients "Create Client Project" wizard. See Backend Models/Crm.cs
// for why this is a direct DB read (same IndusAppDB) rather than an HTTP call to the other app.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export interface CrmClient {
  customerID: number;
  companyName: string;
  contactPersonName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  status?: string | null;
  segment?: string | null;
  companySize?: string | null;
  leadType?: string | null;
  indasProduct?: string | null;
  assignedToName?: string | null;
  website?: string | null;
  gst?: string | null;
  companyPAN?: string | null;
  dbStatus?: string | null;   // "Created" once provisioned via the wizard's CRM picker
  proposalId?: number | null;
  proposalDocumentName?: string | null;   // green label — the latest matched proposal document
  proposalDocumentUrl?: string | null;    // opens IndusInternalApp's presigned-redirect → the PDF
}

export const crmApi = {
  // Resilient: a missing endpoint (404 from an un-redeployed backend) or a backend error
  // (which returns {success:false,message} instead of an array) must surface as a clean
  // thrown Error the picker can display — NEVER feed a non-array to the grid (that crashes
  // the whole page/renderer).
  clients: async (): Promise<CrmClient[]> => {
    const res = await fetch(`${BASE}/api/crm/clients`, { cache: "no-store" });
    if (!res.ok) throw new Error(`CRM clients unavailable (${res.status} ${res.statusText}). The API may not have the /api/crm endpoints deployed yet.`);
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) {
      const msg = data && typeof data === "object" && "message" in data ? String((data as { message?: unknown }).message) : "";
      throw new Error(msg || "CRM clients endpoint returned an unexpected response (not a list).");
    }
    return data as CrmClient[];
  },
  markProvisioned: (crmCustomerId: number, clientName?: string, databaseName?: string) =>
    fetch(`${BASE}/api/crm/mark-provisioned`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crmCustomerId, clientName, databaseName }),
    }).then((r) => r.json()).catch(() => ({ success: false })) as Promise<{ success: boolean; message?: string }>,
};
