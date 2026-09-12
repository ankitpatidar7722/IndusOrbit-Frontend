"use client";
import { useContext, useEffect, useMemo, useState } from "react";
import { Dropdown } from "indas-ui";
import { Boxes, Layers } from "lucide-react";
import { type BulkClientContext, BulkCompactContext } from "@/components/bulk/BulkModuleShell";
import {
  getItemGroups, getToolGroups,
  getStockWarehouses, getStockBins, enrichItemStock, validateItemStock, importItemStock, loadStockData, loadMasterData, resetItemStock, resetFloorStock,
  getToolStockWarehouses, getToolStockBins, enrichToolStock, validateToolStock, importToolStock, loadToolStockData, loadToolMasterData,
  getSparePartStockWarehouses, getSparePartStockBins, enrichSparePartStock, validateSparePartStock, importSparePartStock, loadSparePartStockData, loadSparePartMasterData,
} from "@/bulk/services/api";
import StockGrid, { type StockAdapter, type StockCol, type Row } from "@/components/bulk/modules/stock/StockGrid";

// "Stock Upload" — Indus360-native rebuild of StockUpload.tsx. After the Product+Client picker, the
// admin picks a Module (Item/Tool/Spare Part) + Sub Module (group, for Item/Tool). Each drives a
// StockGrid adapter (load/enrich/validate/import on the picked client's DB via X-Target-Company).

const MODULES = [
  { value: "item", label: "Item Masters" },
  { value: "tool", label: "Tool Master" },
  { value: "sparepart", label: "Spare Part Master" },
];
const HAS_GROUP = new Set(["item", "tool"]);
const SIMPLE = new Set(["INK & ADDITIVES", "VARNISHES & COATINGS", "LAMINATION FILM", "SHIPPER CARTON", "FOIL", "OTHER MATERIAL"]);
const labelStyle = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-muted))", marginBottom: 6 } as const;

const numOr0 = (v: unknown): number => { const n = Number(v); return isNaN(n) ? 0 : n; };
const rate3 = (v: unknown): number => { const n = Number(v); return isNaN(n) ? 0 : parseFloat(n.toFixed(3)); };
// case-insensitive header pick
const ciPick = (r: Record<string, unknown>) => {
  const low: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) low[k.toLowerCase().trim()] = v;
  return (...keys: string[]) => { for (const k of keys) { const v = low[k.toLowerCase()]; if (v !== undefined && v !== null && String(v).trim() !== "") return v; } return undefined; };
};
const str = (v: unknown) => { const s = String(v ?? "").trim(); return s === "" ? undefined : s; };

function itemColumns(groupName: string): StockCol[] {
  const gn = groupName.toUpperCase();
  const base: StockCol[] = [["itemCode", "ItemCode", "ro"], ["itemID", "ItemID", "ro"]];
  const attrs: StockCol[] = SIMPLE.has(gn)
    ? [["itemName", "ItemName", "ro"]]
    : ([["quality", "Quality", "ro"], ["gsm", "GSM", "ro"], ["manufecturer", "Manufacturer", "ro"], ["finish", "Finish", "ro"],
        ...(gn === "REEL" || gn === "ROLL" ? [] : [["sizeL", "SizeL", "ro"] as StockCol]), ["sizeW", "SizeW", "ro"]] as StockCol[]);
  const tail: StockCol[] = [
    ["receiptQuantity", "ReceiptQuantity", "n"], ["landedRate", "LandedRate", "n"], ["batchNo", "BatchNo", "ro"],
    ["supplierBatchNo", "SupplierBatchNo", "t"], ["stockUnit", "StockUnit", "ro"], ["warehouseName", "WarehouseName", "wh"], ["binName", "BinName", "bin"],
  ];
  return [...base, ...attrs, ...tail];
}
const TOOL_COLS: StockCol[] = [
  ["toolCode", "ToolCode", "ro"], ["toolName", "ToolName", "ro"], ["toolID", "ToolID", "ro"],
  ["receiptQuantity", "ReceiptQuantity", "n"], ["landedRate", "LandedRate", "n"], ["batchNo", "BatchNo", "ro"],
  ["stockUnit", "StockUnit", "ro"], ["warehouseName", "WarehouseName", "wh"], ["binName", "BinName", "bin"],
];
const SPARE_COLS: StockCol[] = [
  ["sparePartCode", "SparePartCode", "ro"], ["sparePartName", "SparePartName", "ro"], ["spareID", "SpareID", "ro"],
  ["receiptQuantity", "ReceiptQuantity", "n"], ["landedRate", "LandedRate", "n"], ["batchNo", "BatchNo", "ro"],
  ["stockUnit", "StockUnit", "ro"], ["warehouseName", "WarehouseName", "wh"], ["binName", "BinName", "bin"],
];

export default function StockUploadModule({ client }: { client: BulkClientContext }) {
  const [kind, setKind] = useState("");
  const [group, setGroup] = useState("");
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupErr, setGroupErr] = useState("");
  const { compact } = useContext(BulkCompactContext); // collapse the Module/Group pickers once stock data is on screen

  useEffect(() => {
    setGroup(""); setGroupOptions([]); setGroupErr("");
    if (!kind || !HAS_GROUP.has(kind)) return;
    setLoadingGroups(true);
    (kind === "item" ? getItemGroups() : getToolGroups())
      .then((rows: unknown) => {
        const arr = Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
        setGroupOptions(arr.map((r) => ({
          value: String(r.itemGroupID ?? r.toolGroupID ?? r.id ?? ""),
          label: String(r.itemGroupName ?? r.toolGroupName ?? r.name ?? "(unnamed)"),
        })).filter((o) => o.value));
      })
      .catch((e) => setGroupErr(e instanceof Error ? e.message : "Failed to load groups for this client."))
      .finally(() => setLoadingGroups(false));
  }, [kind, client.companyUserId]);

  const needsGroup = HAS_GROUP.has(kind);
  const groupName = groupOptions.find((o) => o.value === group)?.label ?? "";
  const groupId = Number(group);
  const ready = !!kind && (!needsGroup || !!group);

  const adapter = useMemo<StockAdapter | null>(() => {
    if (!ready) return null;
    if (kind === "item") {
      return {
        kind: "item", filename: `${groupName}Stock`, columns: itemColumns(groupName), idField: "itemID",
        load: () => loadStockData(groupId), loadMaster: () => loadMasterData(groupId),
        enrich: (rows: Row[]) => enrichItemStock(rows as never, groupId).then((r) => ({ rows: r.rows, invalid: r.invalidItemCodes ?? [] })),
        validate: (rows: Row[]) => validateItemStock(rows as never, groupId),
        save: (rows: Row[]) => importItemStock(rows as never, groupId),
        warehouses: getStockWarehouses, bins: getStockBins,
        mapUpload: (r) => {
          const g = ciPick(r); const code = str(g("itemcode"));
          if (!code) return null;
          const qtyRaw = numOr0(g("receiptquantity", "quantity"));
          return {
            __i: 0, itemCode: code,
            receiptQuantity: groupName.toUpperCase() === "PAPER" ? Math.round(qtyRaw) : qtyRaw,
            landedRate: rate3(g("landedrate", "rate")), stockUnit: str(g("stockunit")),
            warehouseName: str(g("warehousename")), binName: str(g("binname")),
            batchNo: str(g("batchno")), supplierBatchNo: str(g("supplierbatchno")),
            quality: str(g("quality")), gsm: g("gsm", "gsmvalue") != null ? numOr0(g("gsm", "gsmvalue")) : undefined,
            manufecturer: str(g("manufecturer", "manufacturer")), finish: str(g("finish")),
            sizeL: g("sizel") != null ? numOr0(g("sizel")) : undefined, sizeW: g("sizew") != null ? numOr0(g("sizew")) : undefined,
          } as Row;
        },
        reset: {
          itemStock: (u, p, reason, ids, from, to) => resetItemStock(groupId, u, p, reason, ids, from, to),
          floorStock: (u, p, reason, from, to) => resetFloorStock(groupId, u, p, reason, from, to),
        },
      };
    }
    if (kind === "tool") {
      return {
        kind: "tool", filename: `${groupName}Stock`, columns: TOOL_COLS, idField: "toolID",
        load: () => loadToolStockData(groupId), loadMaster: () => loadToolMasterData(groupId),
        enrich: (rows: Row[]) => enrichToolStock(rows as never).then((r) => ({ rows: r.rows, invalid: [...(r.invalidToolNames ?? []), ...(r.invalidToolGroupNames ?? [])] })),
        validate: (rows: Row[]) => validateToolStock(rows as never),
        save: (rows: Row[]) => importToolStock(rows as never),
        warehouses: getToolStockWarehouses, bins: getToolStockBins,
        mapUpload: (r) => {
          const g = ciPick(r); const name = str(g("toolname"));
          if (!name) return null;
          return {
            __i: 0, toolGroupName: str(g("toolgroup", "toolgroupname")) ?? groupName,
            toolCode: str(g("toolcode")), toolName: name,
            receiptQuantity: numOr0(g("receiptquantity", "quantity")), landedRate: rate3(g("landedrate", "purchaserate", "rate")),
            stockUnit: str(g("stockunit")), warehouseName: str(g("warehousename", "warehouse")), binName: str(g("binname")),
            batchNo: str(g("batchno")), supplierBatchNo: str(g("supplierbatchno")),
          } as Row;
        },
      };
    }
    // sparepart
    return {
      kind: "sparepart", filename: "SparePartStock", columns: SPARE_COLS, idField: "spareID",
      load: () => loadSparePartStockData(), loadMaster: () => loadSparePartMasterData(),
      enrich: (rows: Row[]) => enrichSparePartStock(rows as never).then((r) => ({ rows: r.rows, invalid: r.invalidSparePartNames ?? [] })),
      validate: (rows: Row[]) => validateSparePartStock(rows as never),
      save: (rows: Row[]) => importSparePartStock(rows as never),
      warehouses: getSparePartStockWarehouses, bins: getSparePartStockBins,
      mapUpload: (r) => {
        const g = ciPick(r); const name = str(g("sparepartname")); const code = str(g("sparepartcode"));
        if (!name && !code) return null;
        return {
          __i: 0, sparePartCode: code, sparePartName: name,
          receiptQuantity: numOr0(g("receiptquantity", "quantity")), landedRate: rate3(g("landedrate", "rate")),
          stockUnit: str(g("stockunit")), warehouseName: str(g("warehousename")), binName: str(g("binname")),
          batchNo: str(g("batchno")), supplierBatchNo: str(g("supplierbatchno")),
        } as Row;
      },
    };
  }, [ready, kind, groupId, groupName]);

  return (
    <div style={{ width: "100%" }}>
      {/* Module/Group pickers collapse once the stock grid has data on screen (compact) — the shell's
          summary bar + grid title already show what's selected; "Change" (shell) reopens everything. */}
      {!compact && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 18, justifyContent: "center" }}>
          <div style={{ minWidth: 260 }}>
            <div style={labelStyle}><Boxes size={16} /> Module Name</div>
            <Dropdown value={kind} onValueChange={(v) => setKind(String(v))} options={MODULES} placeholder="— Select module —" searchable size="md" />
          </div>
          {needsGroup && (
            <div style={{ minWidth: 300 }}>
              <div style={labelStyle}><Layers size={16} /> Sub Module Name (Group)</div>
              <Dropdown value={group} onValueChange={(v) => setGroup(String(v))} options={groupOptions}
                placeholder={loadingGroups ? "Loading groups…" : groupOptions.length ? "— Select group —" : "No groups"} searchable size="md" />
            </div>
          )}
        </div>
      )}

      {groupErr && <div style={{ textAlign: "center", color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{groupErr}</div>}

      {ready && adapter ? (
        <StockGrid adapter={adapter} companyName={client.companyName} companyUserId={client.companyUserId} />
      ) : (
        <div style={{ padding: "24px 0", textAlign: "center", color: "rgb(var(--fg-muted))", fontSize: 14 }}>
          Select a module{needsGroup ? " and its group" : ""} to continue.
        </div>
      )}
    </div>
  );
}
