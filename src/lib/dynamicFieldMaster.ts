// Dynamic Field Master — sync a group's FIELDS from the shared Source DB (IndusEnterpriseKeyline) into
// the picked client's own DB. Thin typed client over the folded-in BulkImport endpoints (/bulk/api/module/…).
// Target client DB is resolved by the backend from the X-Target-Company header (the Bulk Import shell's
// Product+Client picker), so no connection string is sent from here.
import { userIdHeader } from "@/lib/currentUser";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export type FieldMasterType = "Item" | "Ledger" | "Tool";

export const FIELD_MASTER_TYPES: { value: FieldMasterType; label: string }[] = [
  { value: "Item", label: "Item Master" },
  { value: "Ledger", label: "Ledger Master" },
  { value: "Tool", label: "Tool Master" },
];

/** One "Sub Module" = a group of the chosen master (e.g. the Ledger group "Client"). */
export interface FieldSubModule {
  groupId: number;
  groupName: string;
}

/** One field row in the grid (a Source field, flagged by whether it also exists in the client DB). */
export interface FieldComparison {
  fieldId: number;
  fieldName: string;
  fieldDisplayName: string;
  fieldDataType: string;
  fieldType: string;
  existsInSource: boolean;
  existsInClient: boolean;
  isDeletedInClient: boolean;
  status: boolean; // ticked = keep present+active in the client DB
}

// The folded-in BulkImport endpoints are [Authorize]-gated; carrying the target client's CompanyUserID in
// X-Target-Company authenticates the call AND tells the backend which client DB to target. UserID header
// (+ device) is for the audit trail. Without X-Target-Company the endpoints return 401.
const bulkHeaders = (targetCompany: string, extra?: Record<string, string>): Record<string, string> =>
  ({ "X-Target-Company": targetCompany ?? "", ...userIdHeader(), ...(extra || {}) });

// sourceCompany (optional) = another CLIENT's CompanyUserID to read the fields FROM; "" = the Indus
// template (default). Destination stays the X-Target-Company client.
const srcQuery = (sourceCompany?: string) => (sourceCompany ? `&sourceCompany=${encodeURIComponent(sourceCompany)}` : "");

export const dynamicFieldMasterApi = {
  /** Sub Module dropdown values — the chosen master's groups (from the template, or the source client). */
  subModules: async (type: FieldMasterType, targetCompany: string, sourceCompany?: string): Promise<FieldSubModule[]> => {
    const res = await fetch(`${BASE}/bulk/api/module/FieldSubModules?type=${encodeURIComponent(type)}${srcQuery(sourceCompany)}`,
      { cache: "no-store", headers: bulkHeaders(targetCompany) });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  },

  /** The selected group's fields (from the template, or the source client), each flagged by whether it
   *  also exists in the destination client DB. */
  comparison: async (type: FieldMasterType, groupId: number, targetCompany: string, sourceCompany?: string): Promise<FieldComparison[]> => {
    const res = await fetch(`${BASE}/bulk/api/module/FieldComparisonForClient?type=${encodeURIComponent(type)}&groupId=${groupId}${srcQuery(sourceCompany)}`,
      { cache: "no-store", headers: bulkHeaders(targetCompany) });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  },

  /** ADD / REMOVE only — copy the ticked fields from the Source (template or source client) into the
   *  destination client (soft-delete the unticked); existing fields' draw order is NOT changed. */
  sync: async (type: FieldMasterType, groupId: number, syncData: FieldComparison[], targetCompany: string, sourceCompany?: string): Promise<void> => {
    const res = await fetch(`${BASE}/bulk/api/module/SyncFieldsForClient`, {
      method: "POST",
      headers: bulkHeaders(targetCompany, { "Content-Type": "application/json" }),
      body: JSON.stringify({ Type: type, GroupId: groupId, SyncData: syncData, SourceCompany: sourceCompany || null }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  },

  /** The CLIENT's own fields for a group (destination DB), ordered by FieldDrawSequence — for the Change
   *  Sequence screen (includes fields the client has that the Source does not). */
  clientFields: async (type: FieldMasterType, groupId: number, targetCompany: string): Promise<FieldComparison[]> => {
    const res = await fetch(`${BASE}/bulk/api/module/ClientFieldsForClient?type=${encodeURIComponent(type)}&groupId=${groupId}`,
      { cache: "no-store", headers: bulkHeaders(targetCompany) });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  },

  /** REORDER only — persist the given field order as each field's FieldDrawSequence in the client. */
  saveSequence: async (type: FieldMasterType, groupId: number, orderedFields: FieldComparison[], targetCompany: string): Promise<void> => {
    const res = await fetch(`${BASE}/bulk/api/module/SaveFieldSequenceForClient`, {
      method: "POST",
      headers: bulkHeaders(targetCompany, { "Content-Type": "application/json" }),
      body: JSON.stringify({ Type: type, GroupId: groupId, SyncData: orderedFields }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  },
};
