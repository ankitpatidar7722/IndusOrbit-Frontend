"use client";
import { useContext, useEffect, useState } from "react";
import { Dropdown } from "indas-ui";
import { Boxes, Layers } from "lucide-react";
import { type BulkClientContext, BulkCompactContext } from "@/components/bulk/BulkModuleShell";
import { getItemGroups, getToolGroups, getLedgerGroups } from "@/bulk/services/api";
import HsnMasterModule from "@/components/bulk/modules/HsnMasterModule";
import SparePartMasterModule from "@/components/bulk/modules/SparePartMasterModule";
import ItemMasterModule from "@/components/bulk/modules/ItemMasterModule";
import ToolMasterModule from "@/components/bulk/modules/ToolMasterModule";
import LedgerMasterModule from "@/components/bulk/modules/LedgerMasterModule";

// "Import Master" — Indus360-native shell around BulkImport's master-import feature. After the
// Product+Client picker (BulkModuleShell), the admin picks the Master (Module Name) + its Group
// (Sub Module Name). Groups load from the SELECTED client's DB (proving X-Target-Company). The
// download/upload/validate/import grid is wired next.

const MASTER_TYPES = [
  { value: "ledger", label: "Ledger Master" },
  { value: "item", label: "Item Master" },
  { value: "tool", label: "Tool Master" },
  { value: "hsn", label: "HSN / Product Group Master" },
  { value: "sparepart", label: "Spare Part Master" },
];
const HAS_GROUP = new Set(["ledger", "item", "tool"]); // HSN / Spare Part have no sub-group

const labelStyle = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))", marginBottom: 6 } as const;

export default function ImportMasterModule({ client }: { client: BulkClientContext }) {
  const [master, setMaster] = useState("");
  const [group, setGroup] = useState("");
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupErr, setGroupErr] = useState("");
  const { compact } = useContext(BulkCompactContext); // collapse the Master/Group pickers once data is on screen

  // Load the sub-groups for the chosen master, FROM the selected client's DB (X-Target-Company header).
  useEffect(() => {
    setGroup(""); setGroupOptions([]); setGroupErr("");
    if (!master || !HAS_GROUP.has(master)) return;
    setLoadingGroups(true);
    const loader =
      master === "item" ? getItemGroups() :
      master === "tool" ? getToolGroups() :
      getLedgerGroups();
    loader
      .then((rows: unknown) => {
        const arr = Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
        setGroupOptions(arr.map((r) => ({
          value: String(
            r.itemGroupID ?? r.itemGroupId ?? r.toolGroupID ?? r.toolGroupId ??
            r.ledgerGroupID ?? r.ledgerGroupId ?? r.id ?? ""),
          label: String(
            // Ledger flags (supplier/employee/consignee/vendors/transporters) + standard columns key
            // off the DISPLAY name ("Suppliers"), NOT the raw ledgerGroupName ("Sundry Creditors").
            r.ledgerGroupNameDisplay ?? r.itemGroupName ?? r.toolGroupName ?? r.ledgerGroupName ?? r.groupName ?? r.name ?? "(unnamed)"),
        })).filter((o) => o.value));
      })
      .catch((e) => setGroupErr(e instanceof Error ? e.message : "Failed to load groups for this client."))
      .finally(() => setLoadingGroups(false));
  }, [master, client.companyUserId]);

  const needsGroup = HAS_GROUP.has(master);
  const ready = !!master && (!needsGroup || !!group);

  return (
    <div style={{ width: "100%" }}>
      {/* Master/Group pickers collapse once the module has data on screen (compact) — the grid title +
          the shell's summary bar already show what's selected; "Change" (shell) reopens everything. */}
      {!compact && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 18, justifyContent: "center" }}>
          <div style={{ minWidth: 260 }}>
            <div style={labelStyle}><Boxes size={16} /> Module Name (Master)</div>
            <Dropdown value={master} onValueChange={(v) => setMaster(String(v))} options={MASTER_TYPES} placeholder="— Select master —" searchable size="md" />
          </div>
          {needsGroup && (
            <div style={{ minWidth: 300 }}>
              <div style={labelStyle}><Layers size={16} /> Sub Module Name (Group)</div>
              <Dropdown
                value={group}
                onValueChange={(v) => setGroup(String(v))}
                options={groupOptions}
                placeholder={loadingGroups ? "Loading groups…" : groupOptions.length ? "— Select group —" : "No groups"}
                searchable
                size="md"
              />
            </div>
          )}
        </div>
      )}

      {groupErr && (
        <div style={{ textAlign: "center", color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{groupErr}</div>
      )}

      {ready ? (
        master === "hsn" ? (
          <HsnMasterModule client={client} />
        ) : master === "sparepart" ? (
          <SparePartMasterModule client={client} />
        ) : master === "item" ? (
          <ItemMasterModule client={client} groupId={Number(group)} groupName={groupOptions.find((o) => o.value === group)?.label ?? ""} />
        ) : master === "tool" ? (
          <ToolMasterModule client={client} groupId={Number(group)} groupName={groupOptions.find((o) => o.value === group)?.label ?? ""} />
        ) : master === "ledger" ? (
          <LedgerMasterModule client={client} groupId={Number(group)} groupName={groupOptions.find((o) => o.value === group)?.label ?? ""} />
        ) : (
          <div style={{ background: "rgb(var(--bg-surface))", border: "1px dashed rgb(var(--border-default))", borderRadius: 14, padding: 30, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "rgb(var(--fg-default))", marginBottom: 6 }}>
              {MASTER_TYPES.find((m) => m.value === master)?.label}
              {needsGroup ? ` · ${groupOptions.find((o) => o.value === group)?.label ?? ""}` : ""}
            </div>
            <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))" }}>
              ✅ Targeting <b>{client.companyName}</b>. This master's grid is being built next (same pattern as HSN Master, which is live — try Item Master → any group vs HSN to compare).
            </div>
          </div>
        )
      ) : (
        <div style={{ padding: "24px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          Select a master{needsGroup ? " and its group" : ""} to continue.
        </div>
      )}
    </div>
  );
}
