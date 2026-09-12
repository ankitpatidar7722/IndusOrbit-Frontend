"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useModalAlert } from "indas-ui";
import { FileText, Save, RefreshCw, CheckSquare, Square, Search, AlertCircle, CheckCircle2, Database, Filter, ChevronDown, Zap, Info, X } from "lucide-react";
import type { BulkClientContext } from "@/components/bulk/BulkModuleShell";
import ContentBox3D from "./ContentBox3D";
import {
  getContentAuthorityData, saveContentAuthority, updateContentTechDetails, updateKeylineTechDetails,
  type ContentAuthorityRowDto,
} from "@/bulk/services/api";

// "Content Authority" — Indus360 rebuild of BulkImport's ContentAuthority.tsx, same-to-same: a custom
// CSS-grid selection list (row-click toggles), 2D image thumbnails with a preview modal, DB-status
// badges, a diff-based Save, and the two "Update …Details" re-sync split-buttons. Master content images
// are served from /bulk-assets/ (copied from BulkImport public/). The 3D preview (three.js) is deferred.

type Row = ContentAuthorityRowDto;
type FilterMode = "all" | "synced" | "unsynced" | "inactive";
const IMAGE_BASE = "/bulk-assets/"; // BulkImport public/images copied here
const resolveHref = (src?: string) => { const p = (src || "").replace(/\\/g, "/").replace(/^\/+/, ""); return p ? encodeURI(`${IMAGE_BASE}${p}`) : ""; };

function StatusBadge({ synced, exists }: { synced: boolean; exists: boolean }) {
  const [label, cls, dot] = synced
    ? ["Synced", "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", "bg-emerald-500"]
    : exists
      ? ["Inactive", "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", "bg-amber-500"]
      : ["Not Synced", "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", "bg-gray-400"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {label}
    </span>
  );
}

function ImageCell({ src, alt, onPreview }: { src: string; alt: string; onPreview: (url: string, title: string) => void }) {
  const url = resolveHref(src);
  if (!url) return <span className="text-gray-400 text-[10px] italic px-2">No image</span>;
  return (
    <div className="group relative flex items-center gap-1 hover:z-[100]">
      <div className="relative w-10 h-10 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center transition-all duration-300 hover:scale-[2.5] hover:shadow-2xl hover:border-blue-500 cursor-zoom-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} loading="lazy" className="max-w-full max-h-full object-contain p-0.5"
          onError={(e) => { if (!url.includes("placeholder")) (e.currentTarget as HTMLImageElement).src = "https://via.placeholder.com/40?text=Error"; }} />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onPreview(url, alt); }} title="View Full Screen"
        className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 opacity-70 hover:opacity-100 transition-opacity z-[110] shrink-0">
        <Info className="w-4 h-4" />
      </button>
    </div>
  );
}

function ImagePreviewModal({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/90 backdrop-blur-xl" onClick={onClose}>
      <div className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-1.5 h-10 bg-indigo-600 rounded-full" />
            <div className="min-w-0">
              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Master Blueprint</h3>
              <p className="text-sm font-bold text-gray-900 dark:text-white uppercase truncate">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-xl">
            <button onClick={() => setMode("2d")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === "2d" ? "bg-white dark:bg-gray-700 text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>2D Blueprint</button>
            <button onClick={() => setMode("3d")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 ${mode === "3d" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-gray-600"}`}>
              {mode === "3d" && <Zap className="w-3 h-3 text-yellow-300" />} 3D Interactive
            </button>
          </div>
          <button onClick={onClose} title="Close Preview" className="group p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
          </button>
        </div>
        <div className={`flex-1 overflow-hidden ${mode === "2d" ? "flex items-center justify-center p-12 bg-gray-50 dark:bg-gray-900/40" : "bg-white dark:bg-gray-900"}`}>
          {mode === "2d" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={src} alt={title} className="max-w-full max-h-full w-auto h-auto object-contain rounded-2xl border-2 border-white dark:border-gray-700 bg-white shadow-xl" />
          ) : (
            <ContentBox3D contentName={title.replace(/\s*[-–]\s*(Open|Close)\s*View\s*$/i, "").trim()} />
          )}
        </div>
        <div className="flex items-center justify-between px-8 py-3 border-t border-gray-100 dark:border-gray-700">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> 100% Visibility Guaranteed
          </span>
          <button onClick={onClose} className="px-8 py-2.5 bg-gray-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-[0.15em] rounded-xl transition-all active:scale-95">Close View</button>
        </div>
      </div>
    </div>
  );
}

type SaveResult = { processed: number; inserted: number; updated: number; deactivated: number; childRowsDeleted: number; childRowsInserted: number; message: string };
type Confirm = { title: string; message: string; confirmLabel: string; onConfirm: () => void };

export default function ContentAuthorityModule({ client }: { client: BulkClientContext }) {
  const { showSuccess, showError, AlertComponent } = useModalAlert();
  const [rows, setRows] = useState<Row[]>([]);
  const [original, setOriginal] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyContent, setBusyContent] = useState(false);
  const [busyKeyline, setBusyKeyline] = useState(false);
  const [prog, setProg] = useState<{ active: boolean; pct: number; label: string; accent: string }>({ active: false, pct: 0, label: "", accent: "from-blue-500 to-indigo-600" });

  // The sync endpoints are a single (non-streaming) call, so we animate a percentage bar that eases up
  // to ~92% while the request is in flight, then snaps to 100% on success before the success toast.
  const withProgress = async (label: string, accent: string, fn: () => Promise<void>) => {
    setProg({ active: true, pct: 0, label, accent });
    let pct = 0;
    const timer = window.setInterval(() => {
      pct = Math.min(92, pct + Math.max(0.7, (92 - pct) * 0.07));
      setProg((p) => (p.active ? { ...p, pct } : p));
    }, 120);
    try {
      await fn();
      window.clearInterval(timer);
      setProg((p) => ({ ...p, pct: 100 }));
      await new Promise((r) => setTimeout(r, 500)); // let 100% register visually
      setProg({ active: false, pct: 0, label: "", accent });
    } catch (e) {
      window.clearInterval(timer);
      setProg({ active: false, pct: 0, label: "", accent });
      throw e;
    }
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [openMenu, setOpenMenu] = useState<"" | "content" | "keyline">("");
  const contentRef = useRef<HTMLDivElement>(null);
  const keylineRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true); setSaveResult(null);
    try { const d = await getContentAuthorityData(); const rs = d ?? []; setRows(rs); setOriginal(new Set(rs.filter((r) => r.isSelected).map((r) => r.contentName))); }
    catch (e) { showError("Load Failed", (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to load content."); }
    finally { setIsLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { loadData(); }, [loadData, client.companyUserId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node) && keylineRef.current && !keylineRef.current.contains(e.target as Node)) setOpenMenu("");
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const toggleRow = useCallback((name: string) => setRows((prev) => prev.map((r) => r.contentName === name ? { ...r, isSelected: !r.isSelected } : r)), []);

  const displayRows = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return rows.filter((r) => {
      const matchSearch = r.contentName.toLowerCase().includes(term) || (r.contentCaption || "").toLowerCase().includes(term);
      const matchFilter = filterMode === "synced" ? r.isSelected : filterMode === "unsynced" ? !r.existsInClientDb : filterMode === "inactive" ? (r.existsInClientDb && !r.isSelected) : true;
      return matchSearch && matchFilter;
    });
  }, [rows, searchTerm, filterMode]);

  const totalCount = rows.length;
  const syncedCount = useMemo(() => rows.filter((r) => r.isSelected).length, [rows]);
  const inactiveCount = useMemo(() => rows.filter((r) => r.existsInClientDb && !r.isSelected).length, [rows]);
  const changedCount = useMemo(() => rows.filter((r) => original.has(r.contentName) !== r.isSelected).length, [rows, original]);
  const allFilteredSelected = displayRows.length > 0 && displayRows.every((r) => r.isSelected);

  const toggleAllVisible = () => { const names = new Set(displayRows.map((r) => r.contentName)); setRows((prev) => prev.map((r) => names.has(r.contentName) ? { ...r, isSelected: !allFilteredSelected } : r)); };
  const openPreview = (src: string, title: string) => setPreview({ src, title });

  const handleSaveChanges = () => {
    const selected: string[] = [], deselected: string[] = [];
    rows.forEach((r) => { const was = original.has(r.contentName); if (r.isSelected && !was) selected.push(r.contentName); else if (!r.isSelected && was) deselected.push(r.contentName); });
    if (!selected.length && !deselected.length) { showError("No Changes", "No authority changes to save."); return; }
    const total = selected.length + deselected.length;
    setConfirm({
      title: "Save Changes", message: `Are you sure you want to save ${total} content(s)?`, confirmLabel: "Yes, Save",
      onConfirm: async () => {
        setIsSaving(true);
        try { const res = await saveContentAuthority({ selectedContents: selected, deselectedContents: deselected }); setSaveResult(res as unknown as SaveResult); showSuccess("Changes Saved", "Module access has been updated successfully.", 2800); await loadData(); }
        catch (e) { showError("Error", (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to save changes."); }
        finally { setIsSaving(false); }
      },
    });
  };

  const runTech = (kind: "content" | "keyline", scope: "all" | "visible") => {
    setOpenMenu("");
    const pool = scope === "all" ? rows : displayRows;
    const names = pool.filter((r) => r.isSelected).map((r) => r.contentName);
    const scopeLabel = scope === "all" ? "All Synced" : "Visible / Filtered";
    if (!names.length) { showError("Nothing to Update", "No synced content in the current selection."); return; }
    if (kind === "content") {
      setConfirm({
        title: "Update Content Details", message: `Update physical specs for ${names.length} content(s) [${scopeLabel}]?`, confirmLabel: "Yes, Update",
        onConfirm: async () => {
          setBusyContent(true);
          try {
            await withProgress(`Updating Content Details · ${names.length} content(s)`, "from-blue-500 to-indigo-600", async () => {
              const res = await updateContentTechDetails(names); setSaveResult(res as unknown as SaveResult);
            });
            showSuccess("Details Updated", `Physical specs refreshed for ${names.length} content(s).`, 2800); await loadData();
          }
          catch { showError("Sync Failed", "Failed to update content technical details."); }
          finally { setBusyContent(false); }
        },
      });
    } else {
      setConfirm({
        title: "Update Keyline Details", message: `Update keyline coordinates for ${names.length} content(s) [${scopeLabel}]? ContentMaster will not be changed.`, confirmLabel: "Yes, Update",
        onConfirm: async () => {
          setBusyKeyline(true);
          try {
            await withProgress(`Updating Keyline Details · ${names.length} content(s)`, "from-violet-500 to-fuchsia-600", async () => {
              const res = await updateKeylineTechDetails(names); setSaveResult(res as unknown as SaveResult);
            });
            showSuccess("Keyline Details Updated", `Keyline coordinates refreshed for ${names.length} content(s).`, 2800); await loadData();
          }
          catch { showError("Update Failed", "Failed to update keyline details."); }
          finally { setBusyKeyline(false); }
        },
      });
    }
  };

  const GRID = "grid-cols-[40px_1.4fr_1.2fr_1fr_1fr_130px_70px]";
  const visSynced = displayRows.filter((r) => r.isSelected).length;

  return (
    <div className="space-y-6 text-gray-900 dark:text-white">
      {preview && <ImagePreviewModal src={preview.src} title={preview.title} onClose={() => setPreview(null)} />}

      {/* Actions bar — page title comes from the shell's top-centre header, so no duplicate title here. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={loadData} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={handleSaveChanges} disabled={isSaving || changedCount === 0} className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 border border-green-300 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300 dark:border-green-800 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50">
            <Save className="w-4 h-4" /> Save Content {changedCount > 0 && <span className="px-2 py-0.5 bg-green-600/20 text-green-800 dark:bg-green-400/25 dark:text-green-200 rounded-full text-xs font-bold">{changedCount}</span>}
          </button>
          {/* Update Content Details (amber split) */}
          <div className="relative" ref={contentRef}>
            <div className="flex items-stretch rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <button onClick={() => runTech("content", "all")} disabled={busyContent || syncedCount === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 font-semibold text-sm disabled:opacity-50">
                <Zap className={`w-4 h-4 ${busyContent ? "animate-bounce" : ""}`} /> Update Content Details
              </button>
              <span className="w-px bg-blue-300 dark:bg-blue-700" />
              <button onClick={() => setOpenMenu(openMenu === "content" ? "" : "content")} title="More options" className="px-2.5 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300"><ChevronDown className={`w-4 h-4 transition-transform ${openMenu === "content" ? "rotate-180" : ""}`} /></button>
            </div>
            {openMenu === "content" && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-1">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Content Details Scope</div>
                <button onClick={() => runTech("content", "all")} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700"><Database className="w-4 h-4 text-gray-400" /><span>Update All Synced<span className="block text-[11px] text-gray-400">{syncedCount} content(s)</span></span></button>
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                <button onClick={() => runTech("content", "visible")} disabled={visSynced === 0} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"><Filter className="w-4 h-4 text-gray-400" /><span>Update Visible Only<span className="block text-[11px] text-gray-400">{visSynced} visible synced</span></span></button>
              </div>
            )}
          </div>
          {/* Update Keyline Details (violet split) */}
          <div className="relative" ref={keylineRef}>
            <div className="flex items-stretch rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <button onClick={() => runTech("keyline", "all")} disabled={busyKeyline || syncedCount === 0} className="flex items-center gap-2 px-4 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 dark:text-violet-300 font-semibold text-sm disabled:opacity-50">
                <Zap className={`w-4 h-4 ${busyKeyline ? "animate-bounce" : ""}`} /> Update Keyline Details
              </button>
              <span className="w-px bg-violet-300 dark:bg-violet-700" />
              <button onClick={() => setOpenMenu(openMenu === "keyline" ? "" : "keyline")} title="More options" className="px-2.5 bg-violet-100 hover:bg-violet-200 text-violet-700 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 dark:text-violet-300"><ChevronDown className={`w-4 h-4 transition-transform ${openMenu === "keyline" ? "rotate-180" : ""}`} /></button>
            </div>
            {openMenu === "keyline" && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-1">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Keyline Details Scope</div>
                <button onClick={() => runTech("keyline", "all")} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700"><Database className="w-4 h-4 text-gray-400" /><span>Update All Synced<span className="block text-[11px] text-gray-400">{syncedCount} content(s)</span></span></button>
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                <button onClick={() => runTech("keyline", "visible")} disabled={visSynced === 0} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"><Filter className="w-4 h-4 text-gray-400" /><span>Update Visible Only<span className="block text-[11px] text-gray-400">{visSynced} visible synced</span></span></button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Content", value: totalCount, Icon: Database, bg: "bg-blue-50 dark:bg-blue-900/20", ic: "bg-blue-100 dark:bg-blue-900/40 text-blue-600", tx: "text-blue-700 dark:text-blue-400" },
          { label: "Synced", value: syncedCount, Icon: CheckCircle2, bg: "bg-emerald-50 dark:bg-emerald-900/20", ic: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600", tx: "text-emerald-700 dark:text-emerald-400" },
          { label: "Inactive", value: inactiveCount, Icon: AlertCircle, bg: "bg-amber-50 dark:bg-amber-900/20", ic: "bg-amber-100 dark:bg-amber-900/40 text-amber-600", tx: "text-amber-700 dark:text-amber-400" },
          { label: "Access Changes", value: changedCount, Icon: RefreshCw, bg: "bg-indigo-50 dark:bg-indigo-900/20", ic: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600", tx: "text-indigo-700 dark:text-indigo-400" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-lg p-2.5 border border-transparent dark:border-gray-700 flex items-center gap-2.5`}>
            <span className={`${s.ic} p-1.5 rounded-md`}><s.Icon className="w-4 h-4" /></span>
            <div><div className={`text-xl font-bold ${s.tx} leading-none`}>{s.value}</div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Result banner */}
      {saveResult && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{saveResult.message}</p>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search content name..." className={`w-full pl-9 ${searchTerm ? "pr-8" : "pr-4"} py-2.5 text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none`} />
            {searchTerm && <button onClick={() => setSearchTerm("")} title="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value as FilterMode)} className="appearance-none pl-9 pr-8 py-2.5 text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg outline-none">
              <option value="all">All Content</option><option value="synced">Synced</option><option value="unsynced">Not Synced</option><option value="inactive">Inactive</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button onClick={toggleAllVisible} disabled={displayRows.length === 0} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50">
            {allFilteredSelected ? <><CheckSquare className="w-4 h-4 text-blue-600" /> Deselect All</> : <><Square className="w-4 h-4" /> Select All</>}
          </button>
        </div>

        {/* Table header */}
        <div className={`grid ${GRID} bg-[color-mix(in_srgb,rgb(var(--color-primary))_16%,white)] dark:bg-[color-mix(in_srgb,rgb(var(--color-primary))_16%,rgb(var(--bg-surface)))] border-b border-gray-100 dark:border-gray-700 px-4 py-2.5`}>
          {["#", "Content Name", "Content Display Name", "Open View", "Close View", "DB Status", "Select"].map((h) => (
            <div key={h} className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-muted))]">{h === "Select" ? "" : h}</div>
          ))}
        </div>

        {/* Body */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700/50 overflow-y-auto" style={{ maxHeight: "calc(100vh - 360px)", minHeight: 300 }}>
          {isLoading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-gray-400"><RefreshCw className="w-10 h-10 animate-spin opacity-40" /><p className="text-sm">Loading...</p></div>
          ) : displayRows.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-gray-400"><Search className="w-10 h-10 opacity-20" /><p className="text-sm">No content found matching your search.</p></div>
          ) : displayRows.map((row, idx) => (
            <div key={row.contentName} className={`grid ${GRID} items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors`}>
              <span className="text-xs font-mono text-gray-400">{idx + 1}</span>
              <span className={`text-sm font-medium pr-4 ${row.isSelected ? "text-blue-700 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>{row.contentName}</span>
              <span className="text-sm text-gray-600 dark:text-gray-400 pr-4 truncate" title={row.contentCaption}>{row.contentCaption || "—"}</span>
              <ImageCell src={row.contentOpenHref} alt={`${row.contentName} - Open View`} onPreview={openPreview} />
              <ImageCell src={row.contentClosedHref} alt={`${row.contentName} - Close View`} onPreview={openPreview} />
              <div><StatusBadge synced={row.isSelected} exists={row.existsInClientDb} /></div>
              <div className="flex justify-center">
                <button onClick={() => toggleRow(row.contentName)} aria-label="Toggle select" className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${row.isSelected ? "bg-blue-600 border-blue-600 shadow-sm" : "border-gray-300 dark:border-gray-600 hover:border-blue-400"}`}>
                  {row.isSelected && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} fill="none"><path d="M20 6L9 17l-5-5" /></svg>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/60" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-violet-600" />
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{confirm.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{confirm.message}</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setConfirm(null)} className="px-5 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">No</button>
                <button onClick={() => { const c = confirm; setConfirm(null); c.onConfirm(); }} className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">{confirm.confirmLabel}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Sync progress bar — animates while Update Content/Keyline Details runs, snaps to 100% on success. */}
      {prog.active && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <Zap className="w-5 h-5 text-indigo-600 animate-pulse shrink-0" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">{prog.label}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div className={`h-full rounded-full bg-gradient-to-r ${prog.accent} transition-all duration-150 ease-out`} style={{ width: `${prog.pct}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{prog.pct >= 100 ? "Completed" : "Syncing…"}</span>
              <span className="text-sm font-black tabular-nums text-gray-700 dark:text-gray-200">{Math.round(prog.pct)}%</span>
            </div>
          </div>
        </div>
      )}
      <AlertComponent />
    </div>
  );
}
