import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    getIndusModules,
    getIndusModuleInfoForClient,
    getSystemDefaultsForClient,
    checkModuleExistsForClient,
    checkDisplayOrderExistsForClient,
    checkGroupIndexInUseForClient,
    createModuleForClient,
    updateModuleForClient,
    deleteModuleForClient,
    getModulesForClient,
    getItemGroupComparisonForClient,
    syncItemGroupsForClient,
    ItemGroupComparisonDto,
    ModuleDto,
} from '../services/api';
import { useMessageModal } from './MessageModal';
import { Popup } from 'devextreme-react/popup';
import DataGrid, {
    Column,
    SearchPanel,
    FilterRow,
    HeaderFilter,
    Paging,
    Pager,
    LoadPanel,
    Editing,
    Button as GridButton,
} from 'devextreme-react/data-grid';
import 'devextreme/dist/css/dx.light.css';
import { 
    PackagePlus, Search, ChevronDown, Loader2, Info, 
    CheckCircle2, AlertTriangle, Save, RotateCcw, 
    Monitor, Layout, Printer, ArrowLeft, Plus
} from 'lucide-react';

interface NewModuleAdditionTabProps {
    connectionString: string;
    companyName: string;
    onSuccess?: () => void;
}

interface FormState {
    moduleId: number;
    moduleName: string;
    moduleDisplayName: string;
    moduleHeadName: string;
    moduleHeadDisplayName: string;
    moduleHeadDisplayOrder: string;
    moduleDisplayOrder: string;
    setGroupIndex: string;
    printDocumentWebPage: string;
    printDocumentName: string;
    printDocumentWebPage1: string;
    printDocumentName1: string;
    companyID: string;
    userID: string;
    fYear: string;
}

interface FieldErrors {
    moduleName?: string;
    moduleHeadDisplayOrder?: string;
    moduleDisplayOrder?: string;
    setGroupIndex?: string;
}

const initialForm: FormState = {
    moduleId: 0,
    moduleName: '',
    moduleDisplayName: '',
    moduleHeadName: '',
    moduleHeadDisplayName: '',
    moduleHeadDisplayOrder: '',
    moduleDisplayOrder: '',
    setGroupIndex: '',
    printDocumentWebPage: '',
    printDocumentName: '',
    printDocumentWebPage1: '',
    printDocumentName1: '',
    companyID: '',
    userID: '',
    fYear: '',
};

const NewModuleAdditionTab: React.FC<NewModuleAdditionTabProps> = ({ connectionString, companyName, onSuccess }) => {
    const { showMessage, ModalRenderer } = useMessageModal();
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [isEditMode, setIsEditMode] = useState(false);
    const [clientModules, setClientModules] = useState<ModuleDto[]>([]);
    const [isListLoading, setIsListLoading] = useState(false);

    // Group Management Popup State
    const [isGroupPopupVisible, setIsGroupPopupVisible] = useState(false);
    const [groupComparisonData, setGroupComparisonData] = useState<ItemGroupComparisonDto[]>([]);
    const [isGroupLoading, setIsGroupLoading] = useState(false);
    const [isGroupSaving, setIsGroupSaving] = useState(false);
    const [activeGroupType, setActiveGroupType] = useState<'Item' | 'Ledger' | 'Tool'>('Item');
    
    const [form, setForm] = useState<FormState>(initialForm);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [isSetGroupLocked, setIsSetGroupLocked] = useState(false);
    const [saving, setSaving] = useState(false);
    const [allIndusModules, setAllIndusModules] = useState<ModuleDto[]>([]);
    const [moduleHeads, setModuleHeads] = useState<string[]>([]);
    const [headSearch, setHeadSearch] = useState('');
    const [nameSearch, setNameSearch] = useState('');
    const [displaySearch, setDisplaySearch] = useState('');
    const [headDropdownOpen, setHeadDropdownOpen] = useState(false);
    const [nameDropdownOpen, setNameDropdownOpen] = useState(false);
    const [displayDropdownOpen, setDisplayDropdownOpen] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [autoFillLoading, setAutoFillLoading] = useState(false);

    // Custom mode: add a brand-new module (not in the Indus catalog) by hand.
    // Head Name becomes a combobox of THIS company's existing heads (auto-fills
    // their group/order) while Module Name is free text. Save still uses
    // createModuleForClient → only this company's DB.
    const [customMode, setCustomMode] = useState(false);
    const [customHeadDropdownOpen, setCustomHeadDropdownOpen] = useState(false);
    const customHeadDropdownRef = useRef<HTMLDivElement>(null);
    
    // State to ensure portal exists
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    const headDropdownRef = useRef<HTMLDivElement>(null);
    const nameDropdownRef = useRef<HTMLDivElement>(null);
    const displayDropdownRef = useRef<HTMLDivElement>(null);

    const moduleNameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const orderCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const groupIndexCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (viewMode === 'list') {
            loadClientModules();
            setPortalTarget(null);
        } else {
            loadIndusData();
            if (!isEditMode) loadSystemDefaults();
            // Try to find the portal after a tick
            setTimeout(() => setPortalTarget(document.getElementById('module-save-portal')), 10);
        }
    }, [connectionString, viewMode]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (headDropdownRef.current && !headDropdownRef.current.contains(target)) setHeadDropdownOpen(false);
            if (nameDropdownRef.current && !nameDropdownRef.current.contains(target)) setNameDropdownOpen(false);
            if (displayDropdownRef.current && !displayDropdownRef.current.contains(target)) setDisplayDropdownOpen(false);
            if (customHeadDropdownRef.current && !customHeadDropdownRef.current.contains(target)) setCustomHeadDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const loadClientModules = async () => {
        setIsListLoading(true);
        try {
            console.log("Fetching modules for:", connectionString);
            const data = await getModulesForClient(connectionString);
            setClientModules(data);
        } catch (err: any) {
            console.error("Failed to load client modules:", err);
            const errMsg = err?.response?.data?.error || err?.message || 'Unknown error occurred.';
            showMessage('error', 'Connection Error', `Failed to connect to ${companyName} database.\n\nError: ${errMsg}`);
            setClientModules([]); 
        } finally { setIsListLoading(false); }
    };

    const handleManageGroupsClick = async (type: 'Item' | 'Ledger' | 'Tool') => {
        console.log("Opening Group Management:", { type, connectionString });
        setActiveGroupType(type);
        setIsGroupPopupVisible(true);
        setIsGroupLoading(true);
        try {
            const data = await getItemGroupComparisonForClient(type, connectionString);
            setGroupComparisonData(data);
        } catch (error) {
            console.error("Group comparison error:", error);
            showMessage('error', 'Error', `Failed to fetch ${type} comparison data.`);
        } finally {
            setIsGroupLoading(false);
        }
    };

    const handleSaveGroupSync = async () => {
        setIsGroupSaving(true);
        try {
            await syncItemGroupsForClient(groupComparisonData, activeGroupType, connectionString);
            // Close the popup first for better UX
            setIsGroupPopupVisible(false);
            showMessage('success', 'Success', `${activeGroupType} groups synchronized successfully!`);
            // Optional: loadClientModules if sync affects the main list, but group sync strictly affects groups
            // loadClientModules(); 
        } catch (error) {
            console.error(error);
            showMessage('error', 'Sync Failed', `Failed to synchronize ${activeGroupType} groups.`);
        } finally {
            setIsGroupSaving(false);
        }
    };

    const loadIndusData = async () => {
        setDataLoading(true);
        try {
            const modules = await getIndusModules();
            setAllIndusModules(modules);
            const uniqueHeads = Array.from(new Set(modules.map(m => m.moduleHeadName).filter(Boolean))) as string[];
            setModuleHeads(uniqueHeads.sort());
        } catch { } finally { setDataLoading(false); }
    };

    const loadSystemDefaults = async () => {
        if (!connectionString) return;
        try {
            const defaults = await getSystemDefaultsForClient(connectionString);
            setForm(prev => ({
                ...prev,
                companyID: String(defaults.companyID || ''),
                userID: String(defaults.userID || ''),
                fYear: defaults.fYear || '',
            }));
        } catch {
            const now = new Date();
            const fYear = now.getMonth() >= 3 ? `${now.getFullYear()}-${now.getFullYear() + 1}` : `${now.getFullYear() - 1}-${now.getFullYear()}`;
            setForm(prev => ({ ...prev, fYear }));
        }
    };

    const handleHeadSelect = (head: string) => {
        setHeadSearch(head);
        setHeadDropdownOpen(false);
        
        // Find if this head already exists in client database to auto-fill and lock Set Group Index
        const existingInClient = clientModules.find(m => m.moduleHeadName === head);
        const firstMatchInIndus = allIndusModules.find(m => m.moduleHeadName === head);
        
        setForm(prev => ({
            ...prev,
            moduleHeadName: head,
            moduleHeadDisplayName: existingInClient?.moduleHeadDisplayName || firstMatchInIndus?.moduleHeadDisplayName || head,
            moduleName: prev.moduleHeadName === head ? prev.moduleName : '',
            moduleDisplayName: prev.moduleHeadName === head ? prev.moduleDisplayName : '',
            setGroupIndex: existingInClient ? String(existingInClient.setGroupIndex) : prev.setGroupIndex,
        }));
        
        setIsSetGroupLocked(!!existingInClient);
        setNameSearch('');
        setDisplaySearch('');
    };

    const handleModuleNameSelect = async (name: string) => {
        setNameSearch(name);
        setNameDropdownOpen(false);
        setErrors(prev => ({ ...prev, moduleName: undefined }));
        setAutoFillLoading(true);
        try {
            const info = await getIndusModuleInfoForClient(name, connectionString);
            const suggestedOrder = info.suggestedHeadDisplayOrder ?? 1;
            setForm(prev => ({
                ...prev,
                moduleName: info.moduleName,
                moduleDisplayName: info.moduleDisplayName ?? '',
                moduleHeadName: info.moduleHeadName ?? '',
                moduleHeadDisplayName: info.moduleHeadDisplayName ?? '',
                setGroupIndex: info.setGroupIndex != null ? String(info.setGroupIndex) : prev.setGroupIndex,
                moduleHeadDisplayOrder: String(suggestedOrder),
                moduleDisplayOrder: String(suggestedOrder),
            }));
            setHeadSearch(info.moduleHeadName ?? '');
            setDisplaySearch(info.moduleDisplayName ?? '');
            setIsSetGroupLocked(info.setGroupIndex != null);
            triggerModuleExistsCheck(name);
        } catch {
            const localMatch = allIndusModules.find(m => m.moduleName === name);
            if (localMatch) {
                setForm(prev => ({
                    ...prev,
                    moduleName: localMatch.moduleName || '',
                    moduleDisplayName: localMatch.moduleDisplayName || '',
                    moduleHeadName: localMatch.moduleHeadName || '',
                    moduleHeadDisplayName: localMatch.moduleHeadDisplayName || '',
                }));
                setHeadSearch(localMatch.moduleHeadName || '');
                setDisplaySearch(localMatch.moduleDisplayName || '');
            }
        } finally { setAutoFillLoading(false); }
    };

    const handleDisplaySelect = (display: string) => {
        setDisplaySearch(display);
        setDisplayDropdownOpen(false);
        const match = allIndusModules.find(m => m.moduleDisplayName === display);
        if (match) handleModuleNameSelect(match.moduleName || '');
        else setForm(prev => ({ ...prev, moduleDisplayName: display }));
    };

    // Custom mode: user picked an EXISTING head → auto-fill its display name,
    // group index and next display order from THIS company's data.
    const handleCustomHeadSelect = (head: string) => {
        setHeadSearch(head);
        setCustomHeadDropdownOpen(false);
        const group = clientModules.filter(m => m.moduleHeadName === head);
        const first = group[0];
        if (!first) { handleChange('moduleHeadName', head); setIsSetGroupLocked(false); return; }
        const sgi = first.setGroupIndex;
        const maxOrder = clientModules
            .filter(m => m.setGroupIndex === sgi)
            .reduce((mx, m) => Math.max(mx, m.moduleHeadDisplayOrder ?? 0), 0);
        const nextOrder = maxOrder + 1;
        setForm(prev => ({
            ...prev,
            moduleHeadName: head,
            moduleHeadDisplayName: first.moduleHeadDisplayName || head,
            setGroupIndex: sgi != null ? String(sgi) : prev.setGroupIndex,
            moduleHeadDisplayOrder: String(nextOrder),
            moduleDisplayOrder: String(nextOrder),
        }));
        setIsSetGroupLocked(sgi != null);
        setErrors(prev => ({ ...prev, setGroupIndex: undefined, moduleHeadDisplayOrder: undefined }));
    };

    const triggerModuleExistsCheck = useCallback((name: string) => {
        if (isEditMode) return;
        if (moduleNameCheckTimer.current) clearTimeout(moduleNameCheckTimer.current);
        moduleNameCheckTimer.current = setTimeout(async () => {
            if (!name.trim()) return;
            try {
                const exists = await checkModuleExistsForClient(name, connectionString);
                if (exists) setErrors(prev => ({ ...prev, moduleName: 'Module already exists in this database.' }));
                else setErrors(prev => ({ ...prev, moduleName: undefined }));
            } catch { }
        }, 600);
    }, [connectionString, isEditMode]);

    const triggerOrderCheck = useCallback((order: string, setGroupIndex: string) => {
        if (orderCheckTimer.current) clearTimeout(orderCheckTimer.current);
        orderCheckTimer.current = setTimeout(async () => {
            const o = parseInt(order);
            const sg = parseInt(setGroupIndex);
            if (isNaN(o) || isNaN(sg)) return;
            try {
                const exists = await checkDisplayOrderExistsForClient(o, sg, connectionString);
                if (exists) setErrors(prev => ({ ...prev, moduleHeadDisplayOrder: 'Warning: Display order used — will shift by +1.' }));
                else setErrors(prev => ({ ...prev, moduleHeadDisplayOrder: undefined }));
            } catch { }
        }, 600);
    }, [connectionString]);

    const triggerGroupIndexCheck = useCallback((index: string, headName: string) => {
        if (groupIndexCheckTimer.current) clearTimeout(groupIndexCheckTimer.current);
        groupIndexCheckTimer.current = setTimeout(async () => {
            const idx = parseInt(index);
            if (isNaN(idx)) return;
            try {
                const inUse = await checkGroupIndexInUseForClient(idx, headName, connectionString);
                if (inUse) setErrors(prev => ({ ...prev, setGroupIndex: 'This Index is already assigned to another Module Head Name.' }));
                else setErrors(prev => ({ ...prev, setGroupIndex: undefined }));
            } catch { }
        }, 600);
    }, [connectionString]);

    const handleChange = (field: keyof FormState, value: string) => {
        setForm(prev => {
            const updated = { ...prev, [field]: value };
            if (field === 'moduleHeadDisplayOrder') updated.moduleDisplayOrder = value;
            if (field === 'moduleHeadDisplayOrder' || field === 'setGroupIndex') {
                triggerOrderCheck(field === 'moduleHeadDisplayOrder' ? value : updated.moduleHeadDisplayOrder, field === 'setGroupIndex' ? value : updated.setGroupIndex);
                if (field === 'setGroupIndex') triggerGroupIndexCheck(value, updated.moduleHeadName);
            }
            if (field === 'moduleName') { setNameSearch(value); triggerModuleExistsCheck(value); }
            if (field === 'moduleHeadName') {
                setHeadSearch(value);
                const existing = clientModules.find(m => m.moduleHeadName?.toLowerCase() === value.toLowerCase());
                if (existing) {
                    updated.setGroupIndex = String(existing.setGroupIndex);
                    setIsSetGroupLocked(true);
                } else {
                    setIsSetGroupLocked(false);
                }
                // Also trigger validation for the current index when head changes
                if (updated.setGroupIndex) {
                    triggerGroupIndexCheck(updated.setGroupIndex, value);
                }
            }
            if (field === 'moduleDisplayName') setDisplaySearch(value);
            return updated;
        });
    };

    const handleSave = async () => {
        if (!form.moduleName.trim() || !form.setGroupIndex || !form.moduleHeadDisplayOrder) {
            showMessage('error', 'Required Fields', 'Please fill all required fields.');
            return;
        }
        if (errors.setGroupIndex) {
            showMessage('error', 'Validation Error', errors.setGroupIndex);
            return;
        }

        setSaving(true);
        try {
            const payload: ModuleDto = {
                moduleId: form.moduleId,
                moduleName: form.moduleName.trim(),
                moduleDisplayName: form.moduleDisplayName.trim() || form.moduleName.trim(),
                moduleHeadName: form.moduleHeadName.trim() || undefined,
                moduleHeadDisplayName: form.moduleHeadDisplayName.trim() || undefined,
                moduleHeadDisplayOrder: parseInt(form.moduleHeadDisplayOrder),
                moduleDisplayOrder: parseInt(form.moduleDisplayOrder),
                setGroupIndex: parseInt(form.setGroupIndex),
                printDocumentWebPage: form.printDocumentWebPage.trim() || undefined,
                printDocumentName: form.printDocumentName.trim() || undefined,
                printDocumentWebPage1: form.printDocumentWebPage1.trim() || undefined,
                printDocumentName1: form.printDocumentName1.trim() || undefined,
                companyID: parseInt(form.companyID),
                userID: parseInt(form.userID),
                fYear: form.fYear.trim() || undefined,
            };

            if (isEditMode) {
                await updateModuleForClient(connectionString, payload);
                showMessage('success', 'Success', `Module "${form.moduleName}" updated successfully.`);
            } else {
                await createModuleForClient(connectionString, payload);
                showMessage('success', 'Success', `Module "${form.moduleName}" created successfully.`);
            }
            
            handleReset();
            setViewMode('list');
            onSuccess?.();
        } catch (err: any) {
            showMessage('error', 'Error', err?.response?.data?.error || 'Failed to save module.');
        } finally { setSaving(false); }
    };

    const handleReset = () => {
        setForm(prev => ({ ...initialForm, companyID: prev.companyID, userID: prev.userID, fYear: prev.fYear }));
        setHeadSearch(''); setNameSearch(''); setDisplaySearch(''); setErrors({}); setIsSetGroupLocked(false);
        setIsEditMode(false);
    };

    const handleEditClick = (row: ModuleDto) => {
        setIsEditMode(true);
        setForm({
            moduleId: row.moduleId,
            moduleName: row.moduleName,
            moduleDisplayName: row.moduleDisplayName || '',
            moduleHeadName: row.moduleHeadName || '',
            moduleHeadDisplayName: row.moduleHeadDisplayName || '',
            moduleHeadDisplayOrder: String(row.moduleHeadDisplayOrder || ''),
            moduleDisplayOrder: String(row.moduleDisplayOrder || ''),
            setGroupIndex: String(row.setGroupIndex || ''),
            printDocumentWebPage: row.printDocumentWebPage || '',
            printDocumentName: row.printDocumentName || '',
            printDocumentWebPage1: row.printDocumentWebPage1 || '',
            printDocumentName1: row.printDocumentName1 || '',
            companyID: String(row.companyID || ''),
            userID: String(row.userID || ''),
            fYear: row.fYear || '',
        });
        setHeadSearch(row.moduleHeadName || '');
        setNameSearch(row.moduleName);
        setDisplaySearch(row.moduleDisplayName || '');
        setViewMode('form');
    };

    const handleDeleteClick = async (row: ModuleDto) => {
        if (!window.confirm(`Are you sure you want to delete module "${row.moduleDisplayName || ''}"?`)) return;
        try {
            await deleteModuleForClient(row.moduleId, connectionString);
            showMessage('success', 'Deleted', 'Module removed from client database.');
            loadClientModules();
        } catch {
            showMessage('error', 'Error', 'Failed to delete module.');
        }
    };

    const filteredHeads = moduleHeads.filter(h => h.toLowerCase().includes(headSearch.toLowerCase())).slice(0, 50);
    const clientHeads = Array.from(new Set(clientModules.map(m => m.moduleHeadName).filter(Boolean))).sort() as string[];
    const filteredClientHeads = clientHeads.filter(h => h.toLowerCase().includes(headSearch.toLowerCase())).slice(0, 50);
    const filteredNames = allIndusModules.filter(m => (!form.moduleHeadName || m.moduleHeadName === form.moduleHeadName) && m.moduleName.toLowerCase().includes(nameSearch.toLowerCase())).map(m => m.moduleName).filter((v, i, a) => a.indexOf(v) === i).slice(0, 50);
    const uniqueFilteredDisplays = Array.from(new Set(allIndusModules.filter(m => (!form.moduleHeadName || m.moduleHeadName === form.moduleHeadName) && (!form.moduleName || m.moduleName === form.moduleName) && (m.moduleDisplayName || '').toLowerCase().includes(displaySearch.toLowerCase())).map(m => m.moduleDisplayName).filter(Boolean))) as string[];    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            {ModalRenderer}

            {viewMode === 'list' ? (
                <>
                    <div className="flex items-center justify-between p-3 bg-gray-50/80 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
                        <div className="flex flex-col">
                            <h3 className="text-[14px] font-bold text-gray-800 dark:text-gray-100">Active Modules</h3>
                            <p className="text-[11px] text-gray-500">View and manage modules in {companyName} database.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={loadClientModules}
                                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all"
                                title="Refresh List"
                            >
                                <RotateCcw className={`w-4 h-4 ${isListLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button 
                                onClick={() => { handleReset(); setViewMode('form'); }}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold rounded-lg shadow-lg shadow-indigo-600/20 transition-all"
                            >
                                <Plus className="w-4 h-4" /> Create Module
                            </button>
                        </div>
                    </div>

                    <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-900/50 shadow-sm">
                        {isListLoading ? (
                            <div className="h-[450px] flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            </div>
                        ) : (
                            <DataGrid
                                dataSource={clientModules}
                                keyExpr="moduleId"
                                showBorders={false}
                                height={450}
                                rowAlternationEnabled={true}
                                hoverStateEnabled={true}
                                columnAutoWidth={true}
                            >
                                <SearchPanel visible={true} width={280} placeholder="Search modules..." />
                                <FilterRow visible={true} />
                                <HeaderFilter visible={true} />
                                <Paging defaultPageSize={100} />
                                <Pager 
                                    showPageSizeSelector={true} 
                                    allowedPageSizes={[100, 500, 1000]} 
                                    showInfo={true} 
                                />
                                <Column dataField="moduleHeadName" caption="Module Head Name" />
                                <Column dataField="moduleName" caption="Module Name" />
                                <Column dataField="moduleDisplayName" caption="Module Display Name" />
                                <Column dataField="setGroupIndex" caption="Group Index" alignment="center" width={100} />
                                <Column type="buttons" width={140}>
                                    <GridButton
                                        icon="group"
                                        hint="Manage Groups"
                                        visible={(e: any) => 
                                            e.row.data.moduleName === 'Masters.aspx' || 
                                            e.row.data.moduleName === 'LedgerMaster.aspx' ||
                                            e.row.data.moduleName === 'ToolMaster.aspx'
                                        }
                                        onClick={(e: any) => {
                                            let type: 'Item' | 'Ledger' | 'Tool' = 'Item';
                                            if (e.row.data.moduleName === 'LedgerMaster.aspx') type = 'Ledger';
                                            else if (e.row.data.moduleName === 'ToolMaster.aspx') type = 'Tool';
                                            handleManageGroupsClick(type);
                                        }}
                                    />
                                    <GridButton 
                                        icon="edit" 
                                        hint="Edit Module" 
                                        onClick={(e: any) => handleEditClick(e.row.data)} 
                                    />
                                    <GridButton 
                                        icon="trash" 
                                        hint="Delete Module" 
                                        onClick={(e: any) => handleDeleteClick(e.row.data)} 
                                    />
                                </Column>
                            </DataGrid>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => { setViewMode('list'); handleReset(); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800/50 text-indigo-600 hover:bg-indigo-50 transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{isEditMode ? 'Editing Module' : 'Adding Module To'}</p>
                                <p className="text-[13px] font-semibold text-indigo-900 dark:text-indigo-200">{companyName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {!isEditMode && (
                                <button onClick={handleReset} className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-gray-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all">
                                    <RotateCcw className="w-3.5 h-3.5" /> Reset Form
                                </button>
                            )}
                            {portalTarget && createPortal(
                                <button onClick={handleSave} disabled={saving || autoFillLoading} className="flex items-center gap-1.5 h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold rounded-lg shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saving ? 'Saving...' : (isEditMode ? 'Update Module' : 'Save Module')}
                                </button>,
                                portalTarget
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                        <Layout className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-gray-800 dark:text-gray-100">Module Identity</h3>
                                </div>

                                {/* Source mode toggle — catalog pick vs brand-new custom module */}
                                {!isEditMode && (
                                    <div className="inline-flex p-1 gap-1 mb-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                                        <button type="button" onClick={() => setCustomMode(false)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${!customMode ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                            <Layout className="w-3.5 h-3.5" /> From Catalog
                                        </button>
                                        <button type="button" onClick={() => { setCustomMode(true); setIsSetGroupLocked(false); }}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${customMode ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                            <Plus className="w-3.5 h-3.5" /> New / Custom
                                        </button>
                                    </div>
                                )}
                                {customMode && (
                                    <div className="flex items-center gap-2 mb-3 px-3 py-2 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                                        <Info className="w-3.5 h-3.5 flex-shrink-0" /> New module added to <strong>{companyName}</strong> only. Pick an existing head to auto-fill its group, or type a new one.
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {customMode ? (
                                    <>
                                        {/* Custom: existing-head combobox (client) + free-text name/display */}
                                        <div className="relative" ref={customHeadDropdownRef}>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Module Head Name</label>
                                            <div className="relative group">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors"><Search className="w-3.5 h-3.5" /></div>
                                                <input type="text" value={headSearch} placeholder="Pick existing or type new..."
                                                    className="w-full h-10 pl-9 pr-10 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                    onChange={e => { setCustomHeadDropdownOpen(true); handleChange('moduleHeadName', e.target.value); }}
                                                    onFocus={() => setCustomHeadDropdownOpen(true)} />
                                                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform duration-200 ${customHeadDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                                            </div>
                                            {customHeadDropdownOpen && (
                                                <div className="absolute z-10 w-full mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                                    {filteredClientHeads.length === 0 ? (
                                                        <div className="p-3 text-center text-gray-400">{headSearch ? 'New head — will be created' : 'No existing heads'}</div>
                                                    ) : filteredClientHeads.map(head => (
                                                        <button key={head} onClick={() => handleCustomHeadSelect(head)} className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors">{head}</button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Module Display Name</label>
                                            <input type="text" value={displaySearch} placeholder="How it appears in menus..."
                                                className="w-full h-10 px-4 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                onChange={e => handleChange('moduleDisplayName', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Module Name (Filename) <span className="text-red-500">*</span></label>
                                            <input type="text" value={nameSearch} placeholder="e.g. SalesReport.aspx"
                                                className={`w-full h-10 px-4 text-[13px] border ${errors.moduleName ? 'border-red-500 ring-2 ring-red-500/10' : 'border-gray-200 dark:border-gray-700'} rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all`}
                                                onChange={e => handleChange('moduleName', e.target.value)} />
                                            {errors.moduleName && <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-500 bg-red-50 dark:bg-red-900/10 p-1.5 rounded-lg border border-red-100 dark:border-red-900/30"><AlertTriangle className="w-3 h-3" /> {errors.moduleName}</p>}
                                        </div>
                                    </>
                                    ) : (
                                    <>
                                    <div className="relative" ref={headDropdownRef}>
                                        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Module Head Name</label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                                <Search className="w-3.5 h-3.5" />
                                            </div>
                                            <input type="text" value={headSearch} placeholder="Search categories..."
                                                className="w-full h-10 pl-9 pr-10 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                onChange={e => { setHeadSearch(e.target.value); setHeadDropdownOpen(true); handleChange('moduleHeadName', e.target.value); }}
                                                onFocus={() => setHeadDropdownOpen(true)} />
                                            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform duration-200 ${headDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                                        </div>
                                        {headDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                                {dataLoading ? (
                                                    <div className="p-3 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>
                                                ) : filteredHeads.length === 0 ? (
                                                    <div className="p-3 text-center text-gray-400">No matches found</div>
                                                ) : filteredHeads.map(head => (
                                                    <button key={head} onClick={() => handleHeadSelect(head)} className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors">
                                                        {head}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative" ref={displayDropdownRef}>
                                        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Module Display Name</label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                                <Monitor className="w-3.5 h-3.5" />
                                            </div>
                                            <input type="text" value={displaySearch} placeholder="How it appears in menus..."
                                                className="w-full h-10 pl-9 pr-10 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                onChange={e => { setDisplaySearch(e.target.value); setDisplayDropdownOpen(true); handleChange('moduleDisplayName', e.target.value); }}
                                                onFocus={() => setDisplayDropdownOpen(true)} />
                                            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform duration-200 ${displayDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                                        </div>
                                        {displayDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                                {uniqueFilteredDisplays.length === 0 ? (
                                                    <div className="p-3 text-center text-gray-400">Search matches...</div>
                                                ) : uniqueFilteredDisplays.map(display => (
                                                    <button key={display} onClick={() => handleDisplaySelect(display || '')} className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors">
                                                        {display}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative" ref={nameDropdownRef}>
                                        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Module Name (Filename) <span className="text-red-500">*</span></label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                                <PackagePlus className="w-3.5 h-3.5" />
                                            </div>
                                            <input type="text" value={nameSearch} placeholder="e.g. LedgerMaster.aspx"
                                                readOnly={isEditMode}
                                                className={`w-full h-10 pl-9 pr-10 text-[13px] border ${errors.moduleName ? 'border-red-500 ring-2 ring-red-500/10' : 'border-gray-200 dark:border-gray-700'} rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${isEditMode ? 'cursor-not-allowed opacity-70' : ''}`}
                                                onChange={e => { setNameSearch(e.target.value); setNameDropdownOpen(true); handleChange('moduleName', e.target.value); }}
                                                onFocus={() => !isEditMode && setNameDropdownOpen(true)} />
                                            {!isEditMode && autoFillLoading && <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-indigo-500" />}
                                            {!isEditMode && <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform duration-200 ${nameDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />}
                                        </div>
                                        {errors.moduleName && <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-500 bg-red-50 dark:bg-red-900/10 p-1.5 rounded-lg border border-red-100 dark:border-red-900/30"><AlertTriangle className="w-3 h-3" /> {errors.moduleName}</p>}
                                        {!isEditMode && nameDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                                {filteredNames.length === 0 ? (
                                                    <div className="p-3 text-center text-gray-400">No matching filenames</div>
                                                ) : filteredNames.map(name => (
                                                    <button key={name} onClick={() => handleModuleNameSelect(name)} className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors">
                                                        {name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    </>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <Monitor className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-gray-800 dark:text-gray-100">Head Information</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Head Display Name</label>
                                        <input type="text" value={form.moduleHeadDisplayName} readOnly={!customMode}
                                            onChange={e => handleChange('moduleHeadDisplayName', e.target.value)}
                                            className={`w-full h-10 px-4 text-[13px] border rounded-xl outline-none transition-all ${customMode ? 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed'}`} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Set Group Index <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input type="number" value={form.setGroupIndex} readOnly={isSetGroupLocked}
                                                className={`w-full h-10 px-4 text-[13px] border ${errors.setGroupIndex ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${isSetGroupLocked ? 'cursor-not-allowed text-gray-400 bg-gray-50' : ''}`}
                                                onChange={e => handleChange('setGroupIndex', e.target.value)} />
                                            {isSetGroupLocked && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />}
                                        </div>
                                        {errors.setGroupIndex && <p className="mt-1 text-[10px] text-red-500">{errors.setGroupIndex}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-gray-800 dark:text-gray-100">Display Order</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Head Display Order <span className="text-red-500">*</span></label>
                                        <input type="number" value={form.moduleHeadDisplayOrder}
                                            className={`w-full h-10 px-4 text-[13px] border ${errors.moduleHeadDisplayOrder ? 'border-amber-400 bg-amber-50/30' : 'border-gray-200 dark:border-gray-700'} rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all`}
                                            onChange={e => handleChange('moduleHeadDisplayOrder', e.target.value)} />
                                        {errors.moduleHeadDisplayOrder && !isEditMode && <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 font-medium"><Info className="w-3 h-3" /> Note: will shift existing</p>}
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Module Display Order</label>
                                        <input type="number" value={form.moduleDisplayOrder} readOnly className="w-full h-10 px-4 text-[13px] border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-500 outline-none cursor-not-allowed" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                        <Printer className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-gray-800 dark:text-gray-100">Print Settings (Optional)</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Print Web Page</label>
                                        <input type="text" value={form.printDocumentWebPage} placeholder="Enter URL..."
                                            className="w-full h-9 px-3 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            onChange={e => handleChange('printDocumentWebPage', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Document Name</label>
                                        <input type="text" value={form.printDocumentName} placeholder="Common Name..."
                                            className="w-full h-9 px-3 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            onChange={e => handleChange('printDocumentName', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">F-Year</label>
                                        <input type="text" value={form.fYear} className="w-full h-9 px-3 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            onChange={e => handleChange('fYear', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-900/30 rounded-xl p-3">
                                <div className="flex gap-2.5">
                                    <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] leading-relaxed text-amber-800/70 dark:text-amber-200/60">
                                        This module modifications will be applied directly to <strong>{companyName}'s</strong> database.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Group Management Popup */}
            <Popup
                visible={isGroupPopupVisible}
                onHiding={() => setIsGroupPopupVisible(false)}
                dragEnabled={false}
                hideOnOutsideClick={false}
                showTitle={true}
                title={`${activeGroupType} Group Sync Status`}
                width={800}
                height={600}
            >
                <div className="p-4 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm text-gray-500">
                            Syncing {activeGroupType} groups from Source to {companyName} database.
                        </p>
                        <button 
                            onClick={() => handleManageGroupsClick(activeGroupType)}
                            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100"
                        >
                            <RotateCcw className={`w-3 h-3 inline mr-1 ${isGroupLoading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                    </div>
                    <div className="flex-grow border rounded-lg overflow-hidden">
                        <DataGrid
                            dataSource={groupComparisonData}
                            keyExpr="itemGroupId"
                            showBorders={false}
                            height="100%"
                        >
                            <LoadPanel enabled={isGroupLoading} />
                            <Editing mode="cell" allowUpdating={true} />
                            
                            <Column dataField="itemGroupId" caption="ID" width={60} allowEditing={false} />
                            <Column dataField="itemGroupName" caption={`${activeGroupType} Group Name`} allowEditing={false} />
                            <Column 
                                dataField="status" 
                                caption="Status" 
                                alignment="center" 
                                width={100}
                            />
                            <Column 
                                caption="Details" 
                                allowEditing={false}
                                cellRender={(data: any) => {
                                    const row = data.data;
                                    if (!row.existsInClient) return <span className="text-xs text-red-500 font-medium italic">Inactive</span>;
                                    if (row.isDeletedInClient) return <span className="text-xs text-orange-500 font-medium italic">Inactive</span>;
                                    return <span className="text-xs text-green-600 font-medium italic">Active</span>;
                                }}
                            />
                        </DataGrid>
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                        <button 
                            onClick={() => setIsGroupPopupVisible(false)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Close
                        </button>
                        <button 
                            onClick={handleSaveGroupSync}
                            disabled={isGroupSaving}
                            className={`px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium flex items-center gap-2 ${isGroupSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isGroupSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" /> Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Popup>
        </div>
    );
};
;

export default NewModuleAdditionTab;
