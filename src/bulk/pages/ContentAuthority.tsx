import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    FileText, Save, RefreshCw, CheckSquare, Square,
    Search, AlertCircle, CheckCircle2, Database,
    Filter, ChevronDown, Zap, Info, X
} from 'lucide-react';
import {
    getContentAuthorityData,
    saveContentAuthority,
    updateContentTechDetails,
    updateKeylineTechDetails,
    ContentAuthorityRowDto,
    ContentAuthoritySaveResult
} from '../services/api';
import { useMessageModal } from '../components/MessageModal';
import Book3DPreview from '../components/Book3DPreview';


// ─── Constants ─────────────────────────────────────────────────────────────
// Images are served from the frontend's local public/Images folder.
const IMAGE_BASE_URL = '/'; 

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ synced: boolean; exists: boolean }> = ({ synced, exists }) => {
    if (synced) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Synced
            </span>
        );
    }
    if (exists) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Inactive
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Not Synced
        </span>
    );
};

// ─── Image Cell Component ──────────────────────────────────────────────────────
const ImageCell: React.FC<{ src: string; alt: string; onPreview: (src: string, title: string) => void }> = ({ src, alt, onPreview }) => {
    // Database has 'images/...', folder is 'images/...'. Prepend '/' and normalize slashes.
    const normalizedPath = src ? src.replace(/\\/g, '/') : '';
    // Use encodeURI to handle spaces in filenames correctly
    const fullUrl = normalizedPath ? encodeURI(`${IMAGE_BASE_URL}${normalizedPath}`) : '';
    
    if (!src) return <span className="text-gray-400 text-[10px] italic px-2">No image</span>;

    return (
        <div className="flex items-center gap-2 group relative hover:z-[100]">
            <div className="relative w-10 h-10 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center transition-all duration-300 hover:scale-[2.5] hover:shadow-2xl hover:border-blue-500 cursor-zoom-in">
                <img 
                    src={fullUrl} 
                    alt={alt} 
                    className="max-w-full max-h-full object-contain p-0.5"
                    onError={(e) => { 
                        const img = e.target as HTMLImageElement;
                        if (!img.src.includes('placeholder')) {
                            img.src = 'https://via.placeholder.com/40?text=Error'; 
                        }
                    }}
                />
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onPreview(fullUrl, alt); }}
                className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-[110]"
                title="View Full Screen"
            >
                <Info className="w-4 h-4" />
            </button>
        </div>
    );
};

// ─── Image Preview Modal ───────────────────────────────────────────────────────
const ImagePreviewModal: React.FC<{ src: string; title: string; onClose: () => void }> = ({ src, title, onClose }) => {
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300" onClick={onClose}>
            <div 
                className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-white/10"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-10 py-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4 bg-white dark:bg-gray-800 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-1.5 h-10 bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.4)]" />
                        <div>
                            <h3 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em]">Master Blueprint</h3>
                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate uppercase mt-0.5">{title}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <button 
                            onClick={() => setViewMode('2d')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === '2d' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            2D Blueprint
                        </button>
                        <button 
                            onClick={() => setViewMode('3d')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${viewMode === '3d' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Zap className={`w-3 h-3 ${viewMode === '3d' ? 'text-yellow-300' : 'hidden'}`} />
                            3D Interactive
                        </button>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="p-3 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 text-gray-400 rounded-2xl transition-all border border-transparent hover:border-red-100 group shadow-sm bg-gray-50 dark:bg-gray-900/50"
                        title="Close Preview"
                    >
                        <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Sub-Header info bar */}
                <div className="px-10 py-2.5 bg-indigo-50/50 dark:bg-indigo-900/20 border-b border-indigo-100/50 dark:border-indigo-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                            {viewMode === '3d' ? 'Rendering High-Fidelity 3D Environment' : 'Active Containment Scaling'}
                        </span>
                    </div>
                    {viewMode === '3d' && (
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Use Mouse to Rotate & Scroll to Zoom</span>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 relative bg-gray-50/50 dark:bg-gray-900/40 overflow-hidden">
                    {viewMode === '2d' ? (
                        <div className="absolute inset-0 flex items-center justify-center p-12">
                            <img 
                                src={src} 
                                alt={title} 
                                className="max-w-full max-h-full w-auto h-auto object-contain shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl border-2 border-white dark:border-gray-700 bg-white dark:bg-white/5"
                            />
                        </div>
                    ) : (
                        <div className="absolute inset-0">
                            <Book3DPreview src={src} title={title} />
                        </div>
                    )}
                </div>
                
                {/* Visual Footer */}
                <div className="px-10 py-5 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                            {viewMode === '3d' ? 'Real-time 3D Preview Active' : '100% Visibility Guaranteed'}
                        </span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="px-8 py-2.5 bg-gray-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-[0.15em] rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                    >
                        Close View
                    </button>
                </div>
            </div>
        </div>
    );
};


// ─── Page ─────────────────────────────────────────────────────────────────────
const ContentAuthority: React.FC = () => {
    const { showMessage, ModalRenderer } = useMessageModal();

    const [rows, setRows] = useState<ContentAuthorityRowDto[]>([]);
    const [originalSelection, setOriginalSelection] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);
    const [isUpdatingKeyline, setIsUpdatingKeyline] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'synced' | 'unsynced' | 'inactive'>('all');
    const [saveResult, setSaveResult] = useState<ContentAuthoritySaveResult | null>(null);

    // Split-button dropdown state
    const [detailsDropOpen, setDetailsDropOpen] = useState(false);
    const [keylineDropOpen, setKeylineDropOpen] = useState(false);
    const detailsDropRef = useRef<HTMLDivElement>(null);
    const keylineDropRef = useRef<HTMLDivElement>(null);

    // Image Preview State
    const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);

    // ── Load ──────────────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setSaveResult(null);
        try {
            const data = await getContentAuthorityData();
            setRows(data);
            const initial = new Set(data.filter(r => r.isSelected).map(r => r.contentName));
            setOriginalSelection(initial);
        } catch (err: any) {
            showMessage('error', 'Load Failed', err?.response?.data?.error || 'Failed to load content.');
        } finally {
            setIsLoading(false);
        }
    }, [showMessage]);

    useEffect(() => { loadData(); }, [loadData]);

    const displayRows = useMemo(() =>
        rows.filter(r => {
            const matchSearch = r.contentName.toLowerCase().includes(searchTerm.toLowerCase())
                || r.contentCaption.toLowerCase().includes(searchTerm.toLowerCase());
            const matchFilter =
                filterMode === 'synced' ? r.isSelected :
                filterMode === 'unsynced' ? !r.existsInClientDb :
                filterMode === 'inactive' ? (r.existsInClientDb && !r.isSelected) :
                true;
            return matchSearch && matchFilter;
        }),
        [rows, searchTerm, filterMode]
    );

    const totalCount = rows.length;
    const syncedCount = rows.filter(r => r.isSelected).length;
    const inactiveCount = rows.filter(r => r.existsInClientDb && !r.isSelected).length;
    const changedCount = rows.filter(r => originalSelection.has(r.contentName) !== r.isSelected).length;

    const allFilteredSelected = displayRows.length > 0 && displayRows.every(r => r.isSelected);

    const toggleRow = (name: string) => setRows(p => p.map(r => r.contentName === name ? { ...r, isSelected: !r.isSelected } : r));
    const toggleAllVisible = () => {
        const names = new Set(displayRows.map(r => r.contentName));
        setRows(p => p.map(r => names.has(r.contentName) ? { ...r, isSelected: !allFilteredSelected } : r));
    };

    // ── SAVE CHANGES (Authority only) ──────────────────────────────────────────
    const handleSaveChanges = async () => {
        const selected: string[] = [];
        const deselected: string[] = [];

        rows.forEach(r => {
            const wasSelected = originalSelection.has(r.contentName);
            if (r.isSelected && !wasSelected) selected.push(r.contentName);
            else if (!r.isSelected && wasSelected) deselected.push(r.contentName);
        });

        if (selected.length === 0 && deselected.length === 0) {
            showMessage('info', 'No Changes', 'No authority changes to save.');
            return;
        }

        const totalToSave = selected.length + deselected.length;

        // Show Confirmation
        showMessage(
            'confirmation',
            'Save Changes',
            `Are you sure you want to save ${totalToSave} content(s)?`,
            {
                confirmLabel: 'Yes, Save',
                onConfirm: async () => {
                    setIsSaving(true);
                    try {
                        const result = await saveContentAuthority({ selectedContents: selected, deselectedContents: deselected });
                        setSaveResult(result);
                        showMessage('success', 'Changes Saved', 'Module access has been updated successfully.');
                        await loadData();
                    } catch (err: any) {
                        showMessage('error', 'Error', err?.response?.data?.error || 'Failed to save changes.');
                    } finally {
                        setIsSaving(false);
                    }
                }
            }
        );
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (detailsDropRef.current && !detailsDropRef.current.contains(e.target as Node))
                setDetailsDropOpen(false);
            if (keylineDropRef.current && !keylineDropRef.current.contains(e.target as Node))
                setKeylineDropOpen(false);
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    // ── UPDATE DETAILS (Tech specs sync) ───────────────────────────────────────
    const handleUpdateDetails = async (contentNames: string[], scopeLabel: string) => {
        if (contentNames.length === 0) {
            showMessage('warning', 'Nothing to Update', 'No synced content in the current selection.');
            return;
        }
        showMessage(
            'confirmation',
            'Update Content Details',
            `Update physical specs for ${contentNames.length} content(s) [${scopeLabel}]?`,
            {
                confirmLabel: 'Yes, Update',
                onConfirm: async () => {
                    setIsUpdatingDetails(true);
                    try {
                        const result = await updateContentTechDetails(contentNames);
                        setSaveResult(result);
                        showMessage('success', 'Details Updated', `Physical specs refreshed for ${contentNames.length} content(s).`);
                        await loadData();
                    } catch (err: any) {
                        showMessage('error', 'Sync Failed', err?.response?.data?.error || 'Failed to update content technical details.');
                    } finally {
                        setIsUpdatingDetails(false);
                    }
                }
            }
        );
    };

    // ── UPDATE KEYLINE DETAILS (Only Coordinates + SheetPlanning, no ContentMaster) ──
    const handleUpdateKeylineDetails = async (contentNames: string[], scopeLabel: string) => {
        if (contentNames.length === 0) {
            showMessage('warning', 'Nothing to Update', 'No synced content in the current selection.');
            return;
        }
        showMessage(
            'confirmation',
            'Update Keyline Details',
            `Update keyline coordinates for ${contentNames.length} content(s) [${scopeLabel}]? ContentMaster will not be changed.`,
            {
                confirmLabel: 'Yes, Update',
                onConfirm: async () => {
                    setIsUpdatingKeyline(true);
                    try {
                        const result = await updateKeylineTechDetails(contentNames);
                        setSaveResult(result);
                        showMessage('success', 'Keyline Details Updated', `Keyline coordinates refreshed for ${contentNames.length} content(s).`);
                        await loadData();
                    } catch (err: any) {
                        showMessage('error', 'Update Failed', err?.response?.data?.error || 'Failed to update keyline details.');
                    } finally {
                        setIsUpdatingKeyline(false);
                    }
                }
            }
        );
    };

    const openPreview = (src: string, title: string) => setPreviewImage({ src, title });

    return (
        <div className="space-y-6">
            {ModalRenderer}
            {previewImage && (
                <ImagePreviewModal 
                    src={previewImage.src} 
                    title={previewImage.title} 
                    onClose={() => setPreviewImage(null)} 
                />
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/25">
                        <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Authority</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Control access and sync technical data</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={loadData} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>

                    <button
                        onClick={handleSaveChanges}
                        disabled={isSaving || changedCount === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        Save Content
                        {changedCount > 0 && <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">{changedCount}</span>}
                    </button>

                    {/* ── Update Content Details split button ── */}
                    <div className="relative" ref={detailsDropRef}>
                        <div className="flex items-stretch rounded-xl overflow-hidden shadow-md">
                            <button
                                onClick={() => { setDetailsDropOpen(false); handleUpdateDetails(rows.filter(r => r.isSelected).map(r => r.contentName), 'All Synced'); }}
                                disabled={isUpdatingDetails || syncedCount === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Zap className={`w-4 h-4 ${isUpdatingDetails ? 'animate-bounce' : ''}`} />
                                Update Content Details
                            </button>
                            <div className="w-px bg-amber-400/60 self-stretch" />
                            <button
                                onClick={() => { setKeylineDropOpen(false); setDetailsDropOpen(p => !p); }}
                                disabled={isUpdatingDetails || syncedCount === 0}
                                className="px-2.5 bg-amber-500 hover:bg-amber-600 text-white transition-all disabled:opacity-50"
                                title="More options"
                            >
                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${detailsDropOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                        {detailsDropOpen && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                    Content Details Scope
                                </div>
                                <button
                                    onClick={() => { setDetailsDropOpen(false); handleUpdateDetails(rows.filter(r => r.isSelected).map(r => r.contentName), 'All Synced'); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                >
                                    <Database className="w-4 h-4 text-amber-500 shrink-0" />
                                    <div className="text-left">
                                        <div className="font-semibold text-gray-700 dark:text-gray-200">Update All Synced</div>
                                        <div className="text-xs text-gray-400">{syncedCount} content(s)</div>
                                    </div>
                                </button>
                                <div className="border-t border-gray-100 dark:border-gray-700" />
                                <button
                                    onClick={() => { setDetailsDropOpen(false); handleUpdateDetails(displayRows.filter(r => r.isSelected).map(r => r.contentName), 'Visible / Filtered'); }}
                                    disabled={displayRows.filter(r => r.isSelected).length === 0}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Filter className="w-4 h-4 text-amber-500 shrink-0" />
                                    <div className="text-left">
                                        <div className="font-semibold text-gray-700 dark:text-gray-200">Update Visible Only</div>
                                        <div className="text-xs text-gray-400">{displayRows.filter(r => r.isSelected).length} visible synced</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Update Keyline Details split button ── */}
                    <div className="relative" ref={keylineDropRef}>
                        <div className="flex items-stretch rounded-xl overflow-hidden shadow-md">
                            <button
                                onClick={() => { setKeylineDropOpen(false); handleUpdateKeylineDetails(rows.filter(r => r.isSelected).map(r => r.contentName), 'All Synced'); }}
                                disabled={isUpdatingKeyline || syncedCount === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Zap className={`w-4 h-4 ${isUpdatingKeyline ? 'animate-bounce' : ''}`} />
                                Update Keyline Details
                            </button>
                            <div className="w-px bg-violet-400/60 self-stretch" />
                            <button
                                onClick={() => { setDetailsDropOpen(false); setKeylineDropOpen(p => !p); }}
                                disabled={isUpdatingKeyline || syncedCount === 0}
                                className="px-2.5 bg-violet-600 hover:bg-violet-700 text-white transition-all disabled:opacity-50"
                                title="More options"
                            >
                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${keylineDropOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                        {keylineDropOpen && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                    Keyline Details Scope
                                </div>
                                <button
                                    onClick={() => { setKeylineDropOpen(false); handleUpdateKeylineDetails(rows.filter(r => r.isSelected).map(r => r.contentName), 'All Synced'); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                                >
                                    <Database className="w-4 h-4 text-violet-500 shrink-0" />
                                    <div className="text-left">
                                        <div className="font-semibold text-gray-700 dark:text-gray-200">Update All Synced</div>
                                        <div className="text-xs text-gray-400">{syncedCount} content(s)</div>
                                    </div>
                                </button>
                                <div className="border-t border-gray-100 dark:border-gray-700" />
                                <button
                                    onClick={() => { setKeylineDropOpen(false); handleUpdateKeylineDetails(displayRows.filter(r => r.isSelected).map(r => r.contentName), 'Visible / Filtered'); }}
                                    disabled={displayRows.filter(r => r.isSelected).length === 0}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Filter className="w-4 h-4 text-violet-500 shrink-0" />
                                    <div className="text-left">
                                        <div className="font-semibold text-gray-700 dark:text-gray-200">Update Visible Only</div>
                                        <div className="text-xs text-gray-400">{displayRows.filter(r => r.isSelected).length} visible synced</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Row - Compact Height */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {([
                    { label: 'Total Content', value: totalCount, icon: Database, bg: 'bg-blue-50 dark:bg-blue-900/20', ic: 'bg-blue-100 dark:bg-blue-900/40', tx: 'text-blue-700 dark:text-blue-400' },
                    { label: 'Synced', value: syncedCount, icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/20', ic: 'bg-emerald-100 dark:bg-emerald-900/40', tx: 'text-emerald-700 dark:text-emerald-400' },
                    { label: 'Inactive', value: inactiveCount, icon: AlertCircle, bg: 'bg-amber-50 dark:bg-amber-900/20', ic: 'bg-amber-100 dark:bg-amber-900/40', tx: 'text-amber-700 dark:text-amber-400' },
                    { label: 'Access Changes', value: changedCount, icon: RefreshCw, bg: 'bg-indigo-50 dark:bg-indigo-900/20', ic: 'bg-indigo-100 dark:bg-indigo-900/40', tx: 'text-indigo-700 dark:text-indigo-400' },
                ] as const).map(({ label, value, icon: Icon, bg, ic, tx }) => (
                    <div key={label} className={`${bg} rounded-lg p-2.5 border border-transparent dark:border-gray-700`}>
                        <div className="flex items-center gap-2.5">
                            <div className={`${ic} p-1.5 rounded-md`}>
                                <Icon className={`w-4 h-4 ${tx}`} />
                            </div>
                            <div>
                                <div className={`text-xl font-bold ${tx} leading-none`}>{value}</div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter">{label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Result Banner */}
            {saveResult && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                    <div className="flex-1 text-xs text-emerald-800 dark:text-emerald-300">
                        <p className="font-semibold">{saveResult.message}</p>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden text-gray-900 dark:text-white">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search content name..."
                            className={`w-full pl-9 py-2.5 text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${searchTerm ? 'pr-8' : 'pr-4'}`}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                                title="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <select value={filterMode} onChange={e => setFilterMode(e.target.value as any)} className="appearance-none pl-9 pr-8 py-2.5 text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                                <option value="all">All Content</option>
                                <option value="synced">Synced</option>
                                <option value="unsynced">Not Synced</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        {filterMode !== 'all' && (
                            <button
                                onClick={() => setFilterMode('all')}
                                className="p-1.5 rounded-md bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 dark:bg-gray-700 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                                title="Clear filter"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <button onClick={toggleAllVisible} disabled={displayRows.length === 0} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-gray-50 dark:bg-gray-700 border border-gray-200 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-all">
                        {allFilteredSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                        {allFilteredSelected ? 'Deselect All' : 'Select All'}
                    </button>
                </div>

                <div className="grid grid-cols-[40px_1.4fr_1.2fr_1fr_1fr_130px_70px] bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 px-4 py-2.5">
                    {['#', 'Content Name', 'Content Display Name', 'Open View', 'Close View', 'DB Status', 'Select'].map(h => (
                        <div key={h} className="text-xs font-semibold uppercase tracking-wider text-gray-400">{h === 'Select' ? '' : h}</div>
                    ))}
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700/50 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 340px)', minHeight: '300px' }}>
                    {isLoading && <div className="py-20 flex flex-col items-center gap-3 text-gray-400"><RefreshCw className="w-10 h-10 animate-spin opacity-40" /><p className="text-sm">Loading...</p></div>}
                    {!isLoading && displayRows.map((row, idx) => (
                        <div key={row.contentName} onClick={() => toggleRow(row.contentName)} className={`grid grid-cols-[40px_1.4fr_1.2fr_1fr_1fr_130px_70px] items-center px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${row.isSelected ? 'bg-blue-50/70 dark:bg-blue-900/10' : ''}`}>
                            <span className="text-xs font-mono text-gray-400">{idx + 1}</span>
                            <span className={`text-sm font-medium pr-4 ${row.isSelected ? 'text-blue-700' : 'text-gray-800 dark:text-gray-200'}`}>{row.contentName}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400 pr-4 truncate" title={row.contentCaption}>{row.contentCaption || '—'}</span>

                            {/* Images Views */}
                            <ImageCell src={row.contentOpenHref} alt={`${row.contentName} - Open View`} onPreview={openPreview} />
                            <ImageCell src={row.contentClosedHref} alt={`${row.contentName} - Close View`} onPreview={openPreview} />

                            <div><StatusBadge synced={row.isSelected} exists={row.existsInClientDb} /></div>
                            <div className="flex justify-center">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${row.isSelected ? 'bg-blue-600 border-blue-600 shadow-sm' : 'border-gray-300 dark:border-gray-600'}`}>{row.isSelected && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} fill="none"><path d="M20 6L9 17l-5-5" /></svg>}</div>
                            </div>
                        </div>
                    ))}
                    {!isLoading && displayRows.length === 0 && (
                        <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
                            <Search className="w-10 h-10 opacity-20" />
                            <p className="text-sm">No content found matching your search.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContentAuthority;
