// Item / Ledger / Tool "group sync" — compare the master's groups between the shared Source DB and a
// client's own DB, then sync the selected ones into the client DB. Backend already exists in the merged
// BulkImport API (served under /bulk/api/...), so this is a thin typed client over those two endpoints.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

export type GroupSyncType = "Item" | "Ledger" | "Tool";

/** One group row in the sync dialog (shape mirrors the backend ItemGroupComparisonDto). */
export interface ItemGroupComparison {
  itemGroupId: number;
  itemGroupName: string;
  existsInSource: boolean;
  existsInClient: boolean;
  isDeletedInClient: boolean;
  status: boolean;          // ticked = keep active/synced in the client DB
}

// The folded-in BulkImport endpoints are [Authorize]-gated; an Indus360 admin call authenticates by
// carrying the target client's CompanyUserID in X-Target-Company (Program.cs injects an admin identity
// for any request that has it). Without this header the endpoints return 401.
const bulkHeaders = (targetCompany: string, extra?: Record<string, string>): Record<string, string> =>
  ({ "X-Target-Company": targetCompany ?? "", ...(extra || {}) });

export const groupSyncApi = {
  /** Source-vs-client comparison for a master's groups (Item / Ledger / Tool). */
  comparison: async (type: GroupSyncType, connectionString: string, targetCompany: string): Promise<ItemGroupComparison[]> => {
    const url = `${BASE}/bulk/api/module/ItemGroupComparisonForClient?type=${encodeURIComponent(type)}&connectionString=${encodeURIComponent(connectionString)}`;
    const res = await fetch(url, { cache: "no-store", headers: bulkHeaders(targetCompany) });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  },

  /** Push the chosen group states into the client's DB. */
  sync: async (type: GroupSyncType, connectionString: string, syncData: ItemGroupComparison[], targetCompany: string): Promise<void> => {
    const res = await fetch(`${BASE}/bulk/api/module/SyncItemGroupsForClient`, {
      method: "POST",
      headers: bulkHeaders(targetCompany, { "Content-Type": "application/json" }),
      body: JSON.stringify({ Type: type, ConnectionString: connectionString, SyncData: syncData }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  },
};

/** Module names (in the Module Settings grid) that expose a group-sync action, → their group type. */
export const GROUP_SYNC_MODULES: Record<string, GroupSyncType> = {
  "Masters.aspx": "Item",
  "LedgerMaster.aspx": "Ledger",
  "ToolMaster.aspx": "Tool",
};
