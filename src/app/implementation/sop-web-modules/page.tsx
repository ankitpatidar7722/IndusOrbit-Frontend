"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Page, Dropdown, Button, useModalAlert, Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "indas-ui";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, RefreshCw, Save, SquarePen, Trash2, Eye, Package, Users2 } from "lucide-react";
import { DataGrid } from "@/components/datagrid";
import { api, sopViewUrl, sopSlug, type KeylineSopModule } from "@/lib/api";
import { customersApi, type CustomerCard } from "@/lib/customers";

// Indus Product picker (same logic as /implementation/kickoff): options come from the clients'
// applicationName (normalized); Estimoprime is the default + sorts first.
const PRODUCT_LABEL: Record<string, string> = { estimoprime: "Estimoprime", multiunit: "MultiUnit", desktop: "Desktop", printudeerp: "PrintudeERP" };
const normApp = (a?: string | null) => (a ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const DEFAULT_PRODUCT = "estimoprime";

/**
 * "SOP of Web Modules" (Implementation) — pick a Product + Client, Load, and see the enterprise web
 * modules from IndusEnterpriseKeyline.dbo.ModuleMaster. Per module the grid carries a Youtube Link,
 * an SOP Document (HTML) and a Status checkbox, edited via a per-row Edit → Save → Delete lifecycle.
 * A row's fields are locked until you click Edit; Save locks them again (persistence wired next).
 * The Status + Action columns are frozen to the right.
 */

const T = {
  primary: "rgb(var(--color-primary))",
  fg: "rgb(var(--fg-default))",
  muted: "rgb(var(--fg-muted))",
  faint: "rgb(var(--fg-muted) / 0.6)",
  bd: "rgb(var(--bd-default))",
  surface: "rgb(var(--bg-surface))",
};
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: T.muted, letterSpacing: 0.1, marginBottom: 6 };
const cellInput: React.CSSProperties = { width: "100%", height: 32, padding: "0 9px", fontSize: 12.5, border: `1px solid ${T.bd}`, borderRadius: 7, outline: "none", background: T.surface, color: T.fg, boxSizing: "border-box" };

/** The real (red) YouTube logo — lucide has no Youtube brand icon in this version. */
function YoutubeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M23 12s0-3.2-.41-4.73a2.5 2.5 0 0 0-1.76-1.77C19.28 5 12 5 12 5s-7.28 0-8.83.5A2.5 2.5 0 0 0 1.4 7.27C1 8.8 1 12 1 12s0 3.2.41 4.73a2.5 2.5 0 0 0 1.76 1.77C4.72 19 12 19 12 19s7.28 0 8.83-.5a2.5 2.5 0 0 0 1.76-1.77C23 15.2 23 12 23 12Z" fill="#FF0000" />
      <path d="M9.75 15.5v-7l6 3.5-6 3.5Z" fill="#fff" />
    </svg>
  );
}

/** A grid row = the keyline module + its (editable) SOP fields. */
type SopRow = KeylineSopModule & { youtubeLink: string; sopDocument: string; status: boolean };

/**
 * SOPs are matched by module display name, so a generic name (e.g. "Purchase Invoice") would also
 * light up under the WRONG head (Other Items / Spare Part Inventory / Tool Inventory …). These
 * (Module Head Name, Module Display Name) pairs are the wrong-head matches to hide the View button on.
 */
const SOP_EXCLUDE = new Set<string>(([
  ["Bottle Cap Manufacturing", "Production Work Order"],
  ["Client Inventory", "Item Issue"],
  ["Client Inventory", "Return To Stock"],
  ["Other Items", "Purchase Invoice"],
  ["Other Items", "Purchase Order"],
  ["Other Items", "Purchase Order Approval"],
  ["Other Items", "Purchase Requisition"],
  ["Other Items", "Requisition Approval"],
  ["Spare Part Inventory", "Purchase Invoice"],
  ["Spare Part Inventory", "Purchase Order"],
  ["Spare Part Inventory", "Purchase Order Approval"],
  ["Spare Part Inventory", "Purchase Requisition"],
  ["Spare Part Inventory", "Requisition Approval"],
  ["Spare Part Inventory", "Return To Stock"],
  ["Spare Part Inventory", "Return To Supplier"],
  ["Tool Inventory", "Purchase Invoice"],
  ["Tool Inventory", "Purchase Order"],
  ["Tool Inventory", "Purchase Order Approval"],
  ["Tool Inventory", "Purchase Requisition"],
  ["Tool Inventory", "Requisition Approval"],
  ["Tool Inventory", "Return To Stock"],
] as [string, string][]).map(([h, d]) => `${sopSlug(h)}::${sopSlug(d)}`));

/** A compact icon action button matching the /users grid (p-1 rounded + h-4 w-4 icon + tooltip). */
function IconBtn({ icon: Icon, label, className, onClick }: { icon: typeof SquarePen; label: string; className: string; onClick: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label}
            className={`p-1 rounded transition-colors text-[rgb(var(--fg-default))] ${className}`}>
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent><p>{label}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function SopWebModulesPage() {
  const { showSuccess, showError, showConfirmation, AlertComponent } = useModalAlert();
  const { data: session } = useSession();
  const userId = (session?.user as { UserID?: number } | undefined)?.UserID;

  const [clients, setClients] = useState<CustomerCard[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [product, setProduct] = useState<string>(DEFAULT_PRODUCT);   // normalized applicationName
  const [clientId, setClientId] = useState<string>("");              // = CustomerCard.companyUserID

  const [rows, setRows] = useState<SopRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);                     // grid load
  // Module names currently in edit mode (their fields are unlocked).
  const [editing, setEditing] = useState<Set<string>>(new Set());

  // Slugs that have a SOP document (for the View button).
  const [sopSlugs, setSopSlugs] = useState<Set<string>>(new Set());

  // Load clients (Project-Assignment scoped) + the available SOP list once.
  useEffect(() => {
    customersApi.list({ assignedOnly: true }).then(setClients).catch(() => setClients([])).finally(() => setClientsLoading(false));
    api.sopModulesList().then((r) => { if (r.success) setSopSlugs(new Set(r.slugs)); }).catch(() => {});
  }, []);

  // Indus Product options = distinct products present in the clients (normalized); Estimoprime first.
  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of clients) { const n = normApp(c.applicationName), key = n || "__none__"; if (!seen.has(key)) seen.set(key, c.applicationName || ""); }
    const opts = Array.from(seen.entries()).map(([key, raw]) => ({ value: key, label: key === "__none__" ? "(No product)" : (PRODUCT_LABEL[key] ?? (raw || key)) }));
    opts.sort((a, b) => a.value === DEFAULT_PRODUCT ? -1 : b.value === DEFAULT_PRODUCT ? 1 : a.value === "__none__" ? 1 : b.value === "__none__" ? -1 : a.label.localeCompare(b.label));
    return opts;
  }, [clients]);

  // If the default product has no clients, fall back to the first available one.
  useEffect(() => {
    if (clientsLoading || productOptions.length === 0) return;
    if (!productOptions.some((o) => o.value === product)) setProduct(productOptions[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsLoading, productOptions]);

  // Clients filtered by the selected product.
  const clientOptions = useMemo(
    () => clients
      .filter((c) => c.companyUserID && (product === "__none__" ? normApp(c.applicationName) === "" : normApp(c.applicationName) === product))
      .map((c) => ({ value: c.companyUserID, label: `${c.companyName || c.companyUserID}${c.companyUniqueCode ? ` (${c.companyUniqueCode})` : ""}` })),
    [clients, product]
  );

  // The selected client's stable code (CompanyUniqueCode, e.g. IA00274) — the key SOP data is saved under.
  const clientCode = useMemo(() => clients.find((c) => c.companyUserID === clientId)?.companyUniqueCode ?? "", [clients, clientId]);

  const patch = (moduleName: string, changes: Partial<SopRow>) =>
    setRows((prev) => prev.map((r) => (r.moduleName === moduleName ? { ...r, ...changes } : r)));
  const setEdit = (moduleName: string, on: boolean) =>
    setEditing((prev) => { const n = new Set(prev); on ? n.add(moduleName) : n.delete(moduleName); return n; });

  const loadModules = async () => {
    if (!product || !clientId) { showError("Select Product and Client", "Please choose a Product and a Client, then click Load."); return; }
    setLoading(true);
    try {
      // Load the Keyline modules + this client's saved SOP data together.
      const [r, saved] = await Promise.all([
        api.keylineSopModules(),
        clientCode ? api.sopStatusGet(clientCode).catch(() => ({ success: false, data: [] as import("@/lib/api").SopStatusRow[] })) : Promise.resolve({ success: false, data: [] as import("@/lib/api").SopStatusRow[] }),
      ]);
      if (r.success) {
        const byModule = new Map((saved.success ? saved.data : []).map((s) => [s.moduleName, s]));
        setRows((r.data || []).map((m) => {
          const s = byModule.get(m.moduleName);
          return { ...m, youtubeLink: s?.youtubeLink ?? "", sopDocument: s?.sopDocument ?? "", status: s?.status ?? false };
        }));
        setEditing(new Set());
        setLoaded(true);
      } else { showError("Could not load modules", (r as { message?: string }).message || "Keyline catalog is unreachable."); }
    } catch (e) { showError("Could not load modules", String(e)); }
    finally { setLoading(false); }
  };

  // Row actions — Save persists this client's SOP data (Youtube / Status) for the module.
  const onSave = async (row: SopRow) => {
    if (!clientCode) { showError("Select a client", "Please select a client before saving."); return; }
    try {
      const slug = sopSlug(row.moduleDisplayName);
      const hasSop = sopSlugs.has(slug) && !SOP_EXCLUDE.has(`${sopSlug(row.moduleHeadName)}::${slug}`);
      await api.sopStatusSave({
        clientCode, moduleName: row.moduleName,
        moduleHeadName: row.moduleHeadName, moduleDisplayName: row.moduleDisplayName,
        sopSlug: hasSop ? slug : undefined,
        youtubeLink: row.youtubeLink, sopDocument: row.sopDocument, status: row.status, userId,
      });
      setEdit(row.moduleName, false);
      showSuccess("Saved", `SOP details for "${row.moduleDisplayName}" saved.`, 1800);
    } catch (e) { showError("Save failed", String(e)); }
  };
  const onEdit = (row: SopRow) => setEdit(row.moduleName, true);
  const onDelete = (row: SopRow) => showConfirmation(
    "Delete SOP row",
    `Remove "${row.moduleDisplayName}" from this list? (Its Youtube link, SOP document and status will be cleared.)`,
    () => { setRows((prev) => prev.filter((r) => r.moduleName !== row.moduleName)); setEdit(row.moduleName, false); },
  );

  const columns = useMemo<ColumnDef<SopRow>[]>(() => [
    { accessorKey: "moduleHeadName", header: "Module Head Name", size: 220, cell: ({ row }) => row.original.moduleHeadName || "—" },
    { accessorKey: "moduleDisplayName", header: "Module Display Name", size: 260, cell: ({ row }) => row.original.moduleDisplayName || "—" },
    {
      accessorKey: "youtubeLink", header: "Youtube Link", size: 240, enableSorting: false,
      cell: ({ row }) => {
        const isEditing = editing.has(row.original.moduleName);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <YoutubeIcon size={15} />
            {isEditing ? (
              <input value={row.original.youtubeLink} placeholder="https://youtu.be/…" style={cellInput}
                onChange={(e) => patch(row.original.moduleName, { youtubeLink: e.target.value })} />
            ) : row.original.youtubeLink ? (
              <a href={row.original.youtubeLink} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: T.primary, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.original.youtubeLink}</a>
            ) : <span style={{ fontSize: 12.5, color: T.faint }}>—</span>}
          </div>
        );
      },
    },
    {
      accessorKey: "sopDocument", header: "SOP Document", size: 150, enableSorting: false,
      cell: ({ row }) => {
        const slug = sopSlug(row.original.moduleDisplayName);
        const excluded = SOP_EXCLUDE.has(`${sopSlug(row.original.moduleHeadName)}::${slug}`);
        return sopSlugs.has(slug) && !excluded ? (
          <Button variant="outline" size="sm" icon={Eye} onClick={() => window.open(sopViewUrl(slug), "_blank", "noopener")}>
            View
          </Button>
        ) : <span style={{ fontSize: 12.5, color: T.faint }}>—</span>;
      },
    },
    {
      id: "status", accessorKey: "status", header: "Status", size: 90, enableSorting: false, meta: { title: "Status" },
      cell: ({ row }) => {
        const isEditing = editing.has(row.original.moduleName);
        // NOTE: no `disabled` — a disabled checked box renders faded/light. Instead we lock it with
        // pointer-events when not editing, so the accent-coloured tick stays dark at all times.
        return (
          <input type="checkbox" readOnly={!isEditing}
            style={{ width: 16, height: 16, accentColor: "rgb(var(--color-primary))",
              cursor: isEditing ? "pointer" : "default", pointerEvents: isEditing ? "auto" : "none" }}
            checked={row.original.status} onChange={() => { if (isEditing) patch(row.original.moduleName, { status: !row.original.status }); }} />
        );
      },
    },
    {
      id: "actions", header: "Action", size: 120, enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const isEditing = editing.has(row.original.moduleName);
        return (
          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
            {isEditing
              ? <IconBtn icon={Save} label="Save" className="hover:text-[rgb(var(--color-success))] hover:bg-[rgb(var(--color-success-subtle))]" onClick={() => onSave(row.original)} />
              : <IconBtn icon={SquarePen} label="Edit" className="hover:text-[rgb(var(--color-orange))] hover:bg-[rgb(var(--color-orange-subtle))]" onClick={() => onEdit(row.original)} />}
            <IconBtn icon={Trash2} label="Delete" className="hover:text-[rgb(var(--color-error))] hover:bg-[rgb(var(--color-error-subtle))]" onClick={() => onDelete(row.original)} />
          </div>
        );
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [editing, sopSlugs]);

  return (
    <Page>
      <AlertComponent />

      {/* Header — centered (matches the other Implementation pages) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: T.primary, color: "#fff", flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(31,69,118,.45)" }}>
          <BookOpen size={24} />
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.fg, margin: 0, letterSpacing: 0.2 }}>SOP of Web Modules</h1>
      </div>

      {/* Controls — same Indus Product + Client picker as /implementation/kickoff (Estimoprime default) */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, background: T.surface, border: `1px solid ${T.bd}`, borderRadius: 12, padding: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", minWidth: 200 }}>
          <label style={{ ...lbl, display: "inline-flex", alignItems: "center", gap: 7 }}><Package size={15} /> Indus Product</label>
          <Dropdown value={product} onValueChange={(v) => { setProduct(String(v)); setClientId(""); }}
            options={productOptions} placeholder={clientsLoading ? "Loading…" : "— Select product —"} searchable size="md" />
        </div>
        <div style={{ flex: "1 1 300px", minWidth: 220 }}>
          <label style={{ ...lbl, display: "inline-flex", alignItems: "center", gap: 7 }}><Users2 size={15} /> Client</label>
          <Dropdown value={clientId} onValueChange={(v) => setClientId(String(v))}
            options={clientOptions}
            placeholder={clientsLoading ? "Loading clients…" : clientOptions.length ? "— Select a client —" : "No clients for this product"} searchable size="md" />
        </div>
        <Button variant="primary" icon={RefreshCw} loading={loading} disabled={!product || !clientId || loading} onClick={loadModules}>
          Load Module
        </Button>
      </div>

      {/* Grid */}
      <div style={{ marginTop: 18 }}>
        {loaded && rows.length > 0 ? (
          <div style={{ border: `1px solid ${T.bd}`, borderRadius: 12, overflow: "hidden", background: T.surface }}>
            <DataGrid<SopRow>
              data={rows}
              columns={columns}
              getRowId={(r) => r.moduleName}
              title={`${rows.length} web module${rows.length === 1 ? "" : "s"}`}
              mainColumns="moduleHeadName"
              enableColumnFreezing
              rightFrozenColumns={["status", "actions"]}
              enableSorting enableSearch enableFilterRow enableExport enablePagination
            />
          </div>
        ) : (
          <div style={{ border: `1px dashed ${T.bd}`, borderRadius: 12, padding: "60px 20px", textAlign: "center", color: T.faint, background: "rgb(var(--bg-subtle))" }}>
            <BookOpen size={44} style={{ opacity: 0.4 }} />
            <div style={{ fontWeight: 700, color: T.muted, marginTop: 10 }}>{loaded ? "No modules found" : "No Modules Loaded"}</div>
            <div style={{ fontSize: 13, marginTop: 3 }}>Select a Product and Client, then click &quot;Load Module&quot; to view web modules.</div>
          </div>
        )}
      </div>
    </Page>
  );
}
