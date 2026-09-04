"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import { Badge, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "indas-ui";
import {
  Layers, Inbox, UserCheck, Play, CheckCircle2, LifeBuoy, ShieldCheck, GitMerge,
  FlaskConical, TestTube2, ClipboardCheck, RotateCcw, PauseCircle, XCircle, CheckSquare, AlarmClock, FolderOpen,
  LayoutDashboard, Code2, TrendingUp, ClipboardList, PlusCircle, UserPlus, UserCog, BadgeCheck, Clock, Activity, Users, Building2, Edit,
} from "lucide-react";
import { statusVariant, priorityVariant, fmtDate, fmtDateTime, type AdminDashboardStats, type PointGridRow, type TimeReportRow } from "@/lib/tms";

// TMS legacy attachments (recorded before the Indus360 migration) store a web-relative
// path like "/Uploads/xxx.webm" — those physical files still live on the old TMS server,
// not ours, so play them from there. Anything else (a future upload through our own
// AttachmentRepository) is a local disk path we can't turn into a URL here — skip it.
const LEGACY_TMS_ORIGIN = "https://office.indusanalytics.co.in";
function resolveAudioUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("/Uploads/")) return `${LEGACY_TMS_ORIGIN}${path}`;
  if (/^https?:\/\//i.test(path)) return path;
  return null;
}

export type CardDef = {
  key: keyof AdminDashboardStats; label: string; icon: LucideIcon;
  status?: string; variant?: "default" | "accent" | "warning" | "error";
};

/** The 17 status stat cards shared by the admin & developer-KPI dashboards. */
export const STATUS_CARDS: CardDef[] = [
  { key: "total", label: "Total", icon: Layers, status: "All", variant: "accent" },
  { key: "queue", label: "Queue", icon: Inbox, status: "Queue" },
  { key: "assigned", label: "Assigned", icon: UserCheck, status: "Assigned" },
  { key: "inProgress", label: "In Progress", icon: Play, status: "In Progress" },
  { key: "devCompleted", label: "Dev Completed", icon: CheckCircle2, status: "DevCompleted" },
  { key: "pendingSupport", label: "Pending Support", icon: LifeBuoy, status: "PendingSupport" },
  { key: "supportVerified", label: "Support Verified", icon: ShieldCheck, status: "SupportVerified" },
  { key: "pendingMerge", label: "Pending Merge", icon: GitMerge, status: "PendingMerge" },
  { key: "pendingQC", label: "Pending QC", icon: FlaskConical, status: "PendingQC" },
  { key: "inTesting", label: "In Testing", icon: TestTube2, status: "In-Testing" },
  { key: "testingCompleted", label: "Testing Done", icon: ClipboardCheck, status: "Testing-Completed" },
  { key: "reOpened", label: "Reopened", icon: RotateCcw, status: "ReOpened", variant: "warning" },
  { key: "hold", label: "Hold", icon: PauseCircle, status: "Hold", variant: "warning" },
  { key: "reject", label: "Reject", icon: XCircle, status: "Reject", variant: "error" },
  { key: "closed", label: "Closed", icon: CheckSquare, status: "Closed" },
  { key: "delayed", label: "Delayed", icon: AlarmClock, variant: "error" },
  { key: "open", label: "Open", icon: FolderOpen },
];

/** Distinct colour per workflow status — shared by the KPI dashboards' donut/legend. */
export const STATUS_COLORS: Record<string, string> = {
  queue: "#64748b", assigned: "#3b82f6", inProgress: "#6366f1", devCompleted: "#10b981",
  pendingSupport: "#f59e0b", supportVerified: "#14b8a6", pendingMerge: "#8b5cf6",
  pendingQC: "#0ea5e9", inTesting: "#a855f7", testingCompleted: "#22c55e",
  reOpened: "#f97316", hold: "#eab308", reject: "#ef4444", closed: "#334155",
};
/** Delivery pipeline stages in flow order (for the KPI dashboards' bar chart). */
export const PIPELINE: (keyof AdminDashboardStats)[] = [
  "queue", "assigned", "inProgress", "devCompleted", "pendingSupport", "supportVerified", "pendingMerge", "closed",
];

/** Standard point-grid columns used by admin / KPI / manage / reports grids. */
export function pointColumns(extra?: ColumnDef<PointGridRow>[]): ColumnDef<PointGridRow>[] {
  return [
    { accessorKey: "pointID", header: "Ticket ID", size: 90 },
    { accessorKey: "title", header: "Title", size: 200, cell: ({ row }) => row.original.title || "—" },
    { accessorKey: "module", header: "Module", cell: ({ row }) => row.original.module ?? "—" },
    { accessorKey: "subModule", header: "Sub Module", cell: ({ row }) => row.original.subModule ?? "—" },
    { accessorKey: "customerName", header: "Customer", cell: ({ row }) => row.original.customerName ?? "—" },
    { accessorKey: "productName", header: "Product", cell: ({ row }) => row.original.productName ?? "—" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
    { accessorKey: "priority", header: "Priority", cell: ({ row }) => <Badge variant={priorityVariant(row.original.priority)}>{row.original.priority}</Badge> },
    { accessorKey: "assignedToName", header: "Assigned To", cell: ({ row }) => row.original.assignedToName ?? "—" },
    { accessorKey: "expectedMinutes", header: "Est (m)", cell: ({ row }) => row.original.expectedMinutes ?? "—" },
    { accessorKey: "totalTimeSpent", header: "Spent (m)", cell: ({ row }) => row.original.totalTimeSpent ?? "—" },
    { accessorKey: "dateCreated", header: "Created", cell: ({ row }) => fmtDate(row.original.dateCreated) },
    ...(extra ?? []),
  ];
}

/** A right-side "Action" column with a single Edit icon that opens the point drawer — lets a row be
 *  opened with ONE click (no double-click). Same flat icon + hover + Tooltip look as the /users grid. */
export function openDrawerColumn<T extends { pointID: number }>(onOpen: (id: number) => void): ColumnDef<T> {
  return {
    id: "actions", header: "Action", enableSorting: false, enableHiding: false, size: 90,
    cell: ({ row }) => (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <TooltipProvider><Tooltip><TooltipTrigger asChild>
          <button type="button" aria-label="Open"
            onClick={(e) => { e.stopPropagation(); onOpen(row.original.pointID); }}
            className="p-1 rounded transition-colors text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-info))] hover:bg-[rgb(var(--color-info-subtle))]">
            <Edit className="h-4 w-4" />
          </button>
        </TooltipTrigger><TooltipContent>Open</TooltipContent></Tooltip></TooltipProvider>
      </div>
    ),
  };
}

/** Full Manage-Points column set (shared by Manage Points + Verify Tickets). Append a page-specific
 *  actions column after these. */
export function managePointColumns(): ColumnDef<PointGridRow>[] {
  const dash = (v?: string | null) => (v && String(v).trim() ? v : "—");
  return [
    { accessorKey: "pointID", header: "Ticket ID", size: 90 },
    { accessorKey: "title", header: "Title", size: 200, cell: ({ row }) => dash(row.original.title) },
    { accessorKey: "customerName", header: "Customer", size: 160, cell: ({ row }) => dash(row.original.customerName) },
    { accessorKey: "reportedByName", header: "Reported By", size: 150, cell: ({ row }) => dash(row.original.reportedByName) },
    { accessorKey: "assignedToName", header: "Assign To", size: 150, cell: ({ row }) => dash(row.original.assignedToName) },
    { accessorKey: "productName", header: "Product", size: 150, cell: ({ row }) => dash(row.original.productName) },
    { accessorKey: "module", header: "Module", size: 150, cell: ({ row }) => dash(row.original.module) },
    { accessorKey: "subModule", header: "Sub Module", size: 160, cell: ({ row }) => dash(row.original.subModule) },
    { accessorKey: "description", header: "Description", size: 260, cell: ({ row }) => dash(row.original.description) },
    { accessorKey: "category", header: "Category", size: 130, cell: ({ row }) => dash(row.original.category) },
    { accessorKey: "status", header: "Status", size: 130, cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
    { accessorKey: "complexity", header: "Complexity", size: 130, cell: ({ row }) => dash(row.original.complexity) },
    { accessorKey: "expectedDate", header: "Expected Date/Time", size: 170, cell: ({ row }) => fmtDate(row.original.expectedDate) },
    { accessorKey: "dateCreated", header: "Created On", size: 150, cell: ({ row }) => fmtDate(row.original.dateCreated) },
  ];
}

/** Developer Dashboard columns — mirrors the original TMS DashboardDeveloper.aspx grid exactly
 *  (Ticket ID/Title/Module/Description/Customer/Product/Assigned By/Reported By/Category/Priority/
 *  Status/Created On/Expected Date/Est/Total/Pause/Delay/To-Do Date/Audio/Actions), including a
 *  Title column (verified 1:1 against the TMS source). Title is also shown across the other point
 *  grids + the Add Point form again (optional there — auto-filled from the description if blank).
 *  `onEdit` opens the point action drawer. */
export function developerColumns(onEdit: (pointId: number) => void): ColumnDef<PointGridRow>[] {
  const dash = (v?: string | null) => (v && String(v).trim() ? v : "—");
  return [
    { accessorKey: "pointID", header: "Ticket ID", size: 90 },
    { accessorKey: "title", header: "Title", size: 170 },
    { id: "moduleOrSummary", header: "Module", size: 160, accessorFn: (r) => r.module || r.summary || "", cell: ({ row }) => dash(row.original.module || row.original.summary) },
    { accessorKey: "subModule", header: "Sub Module", size: 150, cell: ({ row }) => dash(row.original.subModule) },
    { accessorKey: "description", header: "Description", size: 260, cell: ({ row }) => dash(row.original.description) },
    { accessorKey: "customerName", header: "Customer", size: 150, cell: ({ row }) => dash(row.original.customerName) },
    { accessorKey: "productName", header: "Product", size: 140, cell: ({ row }) => dash(row.original.productName) },
    { accessorKey: "assignedByName", header: "Assigned By", size: 150, cell: ({ row }) => dash(row.original.assignedByName) },
    { accessorKey: "reportedByName", header: "Reported By", size: 150, cell: ({ row }) => dash(row.original.reportedByName) },
    { accessorKey: "category", header: "Category", size: 120, cell: ({ row }) => dash(row.original.category) },
    { accessorKey: "priority", header: "Priority", size: 100, cell: ({ row }) => <Badge variant={priorityVariant(row.original.priority)}>{row.original.priority}</Badge> },
    { accessorKey: "status", header: "Status", size: 130, cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
    { accessorKey: "dateCreated", header: "Created On", size: 130, cell: ({ row }) => fmtDate(row.original.dateCreated) },
    { accessorKey: "expectedDate", header: "Expected Date", size: 160, cell: ({ row }) => fmtDateTime(row.original.expectedDate) },
    { accessorKey: "expectedMinutes", header: "Est (m)", size: 90, cell: ({ row }) => row.original.expectedMinutes ?? "—" },
    { accessorKey: "totalTimeSpent", header: "Total Time (m)", size: 110, cell: ({ row }) => row.original.totalTimeSpent ?? "—" },
    { accessorKey: "pauseTimeMinutes", header: "Pause (m)", size: 100, cell: ({ row }) => row.original.pauseTimeMinutes ?? "—" },
    {
      id: "delay", header: "Delay", size: 100,
      accessorFn: (r) => Math.max(0, (r.totalTimeSpent ?? 0) - (r.expectedMinutes ?? 0)),
      cell: ({ row }) => {
        const delay = Math.max(0, (row.original.totalTimeSpent ?? 0) - (row.original.expectedMinutes ?? 0));
        return delay > 0 ? <span style={{ color: "#c0392b", fontWeight: 700 }}>+{delay} min</span> : <span style={{ color: "#1e7e46" }}>On time</span>;
      },
    },
    { accessorKey: "toDoDate", header: "To-Do Date", size: 120, cell: ({ row }) => fmtDate(row.original.toDoDate) },
    {
      id: "audio", header: "Audio", size: 70, enableSorting: false,
      cell: ({ row }) => {
        const url = resolveAudioUrl(row.original.audioFilePath);
        return url
          ? <a href={url} target="_blank" rel="noreferrer" title="Play audio note" style={{ display: "inline-flex" }}><Play size={16} style={{ color: "rgb(var(--color-primary))" }} /></a>
          : <span style={{ opacity: 0.4 }}>—</span>;
      },
    },
    openDrawerColumn<PointGridRow>(onEdit),
  ];
}

/** Columns for the Time / Customer-Progress report grids. */
export function reportColumns(): ColumnDef<TimeReportRow>[] {
  return [
    { accessorKey: "pointID", header: "Ticket ID", size: 90 },
    { accessorKey: "customer", header: "Customer", cell: ({ row }) => row.original.customer ?? "—" },
    { accessorKey: "product", header: "Product", cell: ({ row }) => row.original.product ?? "—" },
    { accessorKey: "module", header: "Module / Summary", cell: ({ row }) => row.original.module ?? "—" },
    { accessorKey: "assignedTo", header: "Developer", cell: ({ row }) => row.original.assignedTo ?? "—" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
    { accessorKey: "expectedMinutes", header: "Est (m)", cell: ({ row }) => row.original.expectedMinutes ?? "—" },
    { accessorKey: "totalTimeSpent", header: "Spent (m)", cell: ({ row }) => row.original.totalTimeSpent ?? "—" },
    { accessorKey: "pauseTimeMinutes", header: "Pause (m)", cell: ({ row }) => row.original.pauseTimeMinutes ?? "—" },
    { accessorKey: "delayMinutes", header: "Delay (m)", cell: ({ row }) => row.original.delayMinutes > 0 ? <span style={{ color: "#c0392b", fontWeight: 700 }}>{row.original.delayMinutes}</span> : "—" },
    { accessorKey: "dateCreated", header: "Created", cell: ({ row }) => fmtDate(row.original.dateCreated) },
    { accessorKey: "dateClosed", header: "Closed", cell: ({ row }) => fmtDate(row.original.dateClosed) },
  ];
}

/**
 * Full grid feature-set — identical to the /users "User Master" grid.
 * Spread into every Point Management <DataGrid> so all PM sub-module grids
 * behave the same: per-column filter row, column freeze/resize/reorder/hide,
 * sorting, global + Baccha search, export and pagination.
 * Page-specific props (title/data/columns/getRowId/loading/onRowClick/
 * onRowSelect/mainColumns) are passed alongside and win over these.
 */
export const gridFeatures = {
  enableRowSelection: true,
  rowSelectionMode: "multi" as const,
  enableColumnResizing: true,
  enableColumnReordering: true,
  enableColumnFreezing: true,
  enableColumnVisibility: true,
  enableSorting: true,
  enableSearch: true,
  enableBacchaSearch: true,
  enableFilterRow: true,
  enableExport: true,
  enablePagination: true,
};

/**
 * Centered page heading (icon + title, no sub-line) shared by every Point Management page.
 * Pass `page` to pull the title + icon from PM_HEADERS, or override title/icon directly.
 */
export const PM_HEADERS: Record<string, { title: string; icon: LucideIcon }> = {
  "admin-dashboard":    { title: "Admin Dashboard",        icon: LayoutDashboard },
  "developer":          { title: "Developer Task",         icon: Code2 },
  "developer-kpi":      { title: "My KPI Dashboard",       icon: TrendingUp },
  "tester":             { title: "Tester Dashboard",       icon: TestTube2 },
  "manage-points":      { title: "Manage Points",          icon: ClipboardList },
  "add-point":          { title: "Add Point",              icon: PlusCircle },
  "assign":             { title: "Assign / Create Ticket", icon: UserPlus },
  "manage-assignments": { title: "Manage Assignments",     icon: UserCog },
  "verify":             { title: "Verify Tickets",         icon: BadgeCheck },
  "merge":              { title: "Merge Code",             icon: GitMerge },
  "support":            { title: "Support Action Center",  icon: LifeBuoy },
  "time-report":        { title: "Time Report",            icon: Clock },
  "customer-progress":  { title: "Customer Progress",      icon: Activity },
  "users":              { title: "Manage Users",           icon: Users },
  "tms-customers":      { title: "Manage Customers",       icon: Building2 },
  "permissions":        { title: "User Permissions",       icon: ShieldCheck },
};

export function PmHeader({ page, title, icon }: { page?: string; title?: string; icon?: LucideIcon }) {
  const def = page ? PM_HEADERS[page] : undefined;
  const heading = title ?? def?.title ?? "";
  const Icon = icon ?? def?.icon;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 22 }}>
      {Icon && (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "rgb(var(--color-primary))", color: "#fff", flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(31,69,118,.45)" }}>
          <Icon size={24} />
        </span>
      )}
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "rgb(var(--fg-default))", margin: 0, letterSpacing: 0.2 }}>{heading}</h1>
    </div>
  );
}

// Shared filter control styles (navy Indus look).
export const selStyle: React.CSSProperties = { height: 38, borderRadius: 9, border: "1px solid #d8dee9", padding: "0 10px", fontSize: 13, background: "var(--bg-input,#fff)", color: "inherit" };
export const lblStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, opacity: 0.8 };
export const clearBtnStyle: React.CSSProperties = { height: 38, borderRadius: 9, border: "1px solid #d8dee9", padding: "0 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", color: "inherit" };
