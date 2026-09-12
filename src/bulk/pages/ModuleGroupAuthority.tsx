import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Save, X, Loader2, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import {
    getModuleGroups,
    getModuleGroupModules,
    getAvailableModulesForGroup,
    createModuleGroup,
    updateModuleGroup,
    deleteModuleGroup,
    ModuleGroupModuleRow,
} from '../services/api';
import { useMessageModal } from '../components/MessageModal';
import DataGrid, {
    Column,
    Paging,
    Pager,
    SearchPanel,
    FilterRow,
    HeaderFilter,
    Sorting,
    Selection,
} from 'devextreme-react/data-grid';
import 'devextreme/dist/css/dx.light.css';

const ModuleGroupAuthority: React.FC = () => {
    const { showMessage, ModalRenderer } = useMessageModal();

    // ─── State ───
    const [groupAppName, setGroupAppName] = useState<string>('');
    const [moduleGroups, setModuleGroups] = useState<string[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [groupModules, setGroupModules] = useState<ModuleGroupModuleRow[]>([]);
    const [isLoadingGroupModules, setIsLoadingGroupModules] = useState(false);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupApp, setNewGroupApp] = useState('estimoprime');
    const [availableModules, setAvailableModules] = useState<ModuleGroupModuleRow[]>([]);
    const [selectedModulesForGroup, setSelectedModulesForGroup] = useState<Set<string>>(new Set());
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);
    const [deleteAuthUserName, setDeleteAuthUserName] = useState('');
    const [deleteAuthPassword, setDeleteAuthPassword] = useState('');
    const [deleteAuthReason, setDeleteAuthReason] = useState('');
    const [isDeletingGroup, setIsDeletingGroup] = useState(false);

    // ─── Handlers ───
    const loadModuleGroups = useCallback(async (appName: string) => {
        if (!appName) {
            setModuleGroups([]);
            setSelectedGroup('');
            return;
        }
        try {
            const res = await getModuleGroups(appName);
            if (res.success) {
                setModuleGroups(res.data);
                setSelectedGroup(''); // Reset selection when app changes
                setGroupModules([]); // Clear modules
            }
        } catch {
            showMessage('error', 'Error', 'Failed to load module groups.');
        }
    }, [showMessage]);

    const handleLoadGroupModules = async () => {
        if (!selectedGroup) return;
        setIsLoadingGroupModules(true);
        try {
            const res = await getModuleGroupModules(groupAppName, selectedGroup);
            if (res.success) {
                setGroupModules(res.data);
                if (res.data.length === 0) {
                    showMessage('info', 'No Modules', 'This group has no modules.');
                }
            } else {
                showMessage('error', 'Load Failed', res.message);
            }
        } catch {
            showMessage('error', 'Error', 'Failed to load group modules.');
        } finally {
            setIsLoadingGroupModules(false);
        }
    };

    const handleOpenCreateGroupModal = async () => {
        setIsEditMode(false);
        setShowCreateGroupModal(true);
        setNewGroupName('');
        setNewGroupApp('estimoprime');
        setSelectedModulesForGroup(new Set());
        // Load available modules
        try {
            const res = await getAvailableModulesForGroup('estimoprime');
            if (res.success) {
                console.log('Available modules loaded:', res.data);
                console.log('First module structure:', res.data[0]);
                setAvailableModules(res.data);
            }
        } catch {
            showMessage('error', 'Error', 'Failed to load available modules.');
        }
    };

    const handleOpenEditGroupModal = async () => {
        if (!selectedGroup) {
            showMessage('info', 'Select Group', 'Please select a Module Group to edit.');
            return;
        }

        setIsEditMode(true);
        setShowCreateGroupModal(true);
        setNewGroupName(selectedGroup);
        setNewGroupApp(groupAppName);

        try {
            // Load all available modules
            const availableRes = await getAvailableModulesForGroup(groupAppName);
            if (availableRes.success) {
                setAvailableModules(availableRes.data);

                // Load current group's modules to pre-select
                const currentRes = await getModuleGroupModules(groupAppName, selectedGroup);
                if (currentRes.success) {
                    // Pre-select modules that are already in the group
                    const currentModuleNames = new Set(
                        currentRes.data.map(m => m.moduleName)
                    );
                    setSelectedModulesForGroup(currentModuleNames);
                    console.log('Edit mode - pre-selected modules:', currentModuleNames);
                }
            }
        } catch {
            showMessage('error', 'Error', 'Failed to load modules for editing.');
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) {
            showMessage('info', 'Required', 'Please enter a Module Group Name.');
            return;
        }
        if (selectedModulesForGroup.size === 0 && !isEditMode) {
            showMessage('info', 'Required', 'Please select at least one module.');
            return;
        }
        setIsCreatingGroup(true);
        try {
            if (isEditMode) {
                // Update existing group
                const res = await updateModuleGroup({
                    applicationName: newGroupApp,
                    moduleGroupName: newGroupName.trim(),
                    selectedModuleNames: Array.from(selectedModulesForGroup)
                });
                if (res.success) {
                    showMessage('success', 'Updated', res.message);
                    setShowCreateGroupModal(false);
                    // Reload groups and clear selection
                    await loadModuleGroups(groupAppName);
                    // If editing the currently selected group, reload its modules
                    if (selectedGroup === newGroupName.trim()) {
                        handleLoadGroupModules();
                    }
                } else {
                    showMessage('error', 'Update Failed', res.message);
                }
            } else {
                // Create new group
                const res = await createModuleGroup({
                    applicationName: newGroupApp,
                    moduleGroupName: newGroupName.trim(),
                    selectedModuleNames: Array.from(selectedModulesForGroup)
                });
                if (res.success) {
                    showMessage('success', 'Created', res.message);
                    setShowCreateGroupModal(false);
                    // Reload groups
                    await loadModuleGroups(groupAppName);
                } else {
                    showMessage('error', 'Create Failed', res.message);
                }
            }
        } catch {
            showMessage('error', 'Error', `Failed to ${isEditMode ? 'update' : 'create'} module group.`);
        } finally {
            setIsCreatingGroup(false);
        }
    };

    const handleOpenDeleteModal = () => {
        if (!selectedGroup) {
            showMessage('info', 'Select Group', 'Please select a Module Group to delete.');
            return;
        }
        // Show confirmation first
        const confirmed = window.confirm(
            `⚠️ Warning: Are you sure you want to delete the module group "${selectedGroup}"?\n\n` +
            `This action will remove all modules from this group and cannot be undone.`
        );
        if (confirmed) {
            setShowDeleteAuthModal(true);
            setDeleteAuthUserName('');
            setDeleteAuthPassword('');
            setDeleteAuthReason('');
        }
    };

    const handleDeleteGroup = async () => {
        if (!deleteAuthUserName.trim()) {
            showMessage('info', 'Required', 'Please enter User Name.');
            return;
        }
        if (!deleteAuthPassword.trim()) {
            showMessage('info', 'Required', 'Please enter Password.');
            return;
        }
        if (!deleteAuthReason.trim()) {
            showMessage('info', 'Required', 'Please enter Reason for deletion.');
            return;
        }

        setIsDeletingGroup(true);
        try {
            const res = await deleteModuleGroup({
                applicationName: groupAppName,
                moduleGroupName: selectedGroup,
                userName: deleteAuthUserName.trim(),
                password: deleteAuthPassword.trim(),
                reason: deleteAuthReason.trim()
            });

            console.log('Delete response:', res);

            if (res.success) {
                showMessage('success', 'Deleted', res.message);
                setShowDeleteAuthModal(false);
                // Clear selection and reload groups
                setSelectedGroup('');
                setGroupModules([]);
                await loadModuleGroups(groupAppName);
            } else {
                showMessage('error', 'Delete Failed', res.message);
            }
        } catch (err: any) {
            console.error('Delete error:', err);
            console.error('Error response:', err?.response);
            console.error('Error data:', err?.response?.data);
            const errorMessage = err?.response?.data?.message || err?.response?.data || err?.message || 'Failed to delete module group.';
            showMessage('error', 'Error', errorMessage);
        } finally {
            setIsDeletingGroup(false);
        }
    };

    // Load module groups when application changes
    useEffect(() => {
        loadModuleGroups(groupAppName);
    }, [groupAppName, loadModuleGroups]);

    // Load available modules when newGroupApp changes in Create Group modal
    useEffect(() => {
        if (showCreateGroupModal) {
            const loadAvailableModules = async () => {
                try {
                    const res = await getAvailableModulesForGroup(newGroupApp);
                    if (res.success) {
                        console.log('Loading modules for app change:', res.data);
                        setAvailableModules(res.data);
                    }
                } catch {
                    // Silent fail
                }
            };
            loadAvailableModules();
        }
    }, [newGroupApp, showCreateGroupModal]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#020617]">
            {ModalRenderer}

            {/* Header - Sticky */}
            <div className="sticky top-0 z-20 bg-white/80 dark:bg-[#020617]/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 mb-6">
                <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-md">
                            <Layers className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Module Group Authority</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Manage module groups by application</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenCreateGroupModal}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow-md transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Create Group
                        </button>
                        <button
                            onClick={handleOpenEditGroupModal}
                            disabled={!selectedGroup}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Edit Group
                        </button>
                        <button
                            onClick={handleOpenDeleteModal}
                            disabled={!selectedGroup}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Group
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-6 pb-6 max-w-7xl mx-auto">
                <div className="mt-0 bg-white dark:bg-[#0f172a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                    {/* Top Controls */}
                    <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-end gap-4">
                            {/* Application Name Dropdown */}
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                    Application Name
                                </label>
                                <select
                                    value={groupAppName}
                                    onChange={(e) => setGroupAppName(e.target.value)}
                                    className="w-full h-9 px-2.5 py-1.5 text-[13px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                >
                                    <option value="" hidden disabled>Select Application Name</option>
                                    <option value="estimoprime">Estimoprime</option>
                                    <option value="PrintudeERP">PrintudeERP</option>
                                    <option value="MultiUnit">MultiUnit</option>
                                </select>
                            </div>

                            {/* Module Group Dropdown */}
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                    Module Group
                                </label>
                                <select
                                    value={selectedGroup}
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                    className="w-full h-9 px-2.5 py-1.5 text-[13px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                    disabled={!groupAppName || moduleGroups.length === 0}
                                >
                                    <option value="" hidden disabled>Select Module Group</option>
                                    {moduleGroups.map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Load Module Button */}
                            <button
                                onClick={handleLoadGroupModules}
                                disabled={!selectedGroup || isLoadingGroupModules}
                                className="h-9 px-4 text-[13px] font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all duration-150 disabled:opacity-50 shadow-sm hover:shadow-md"
                            >
                                {isLoadingGroupModules ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                                ) : (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                                        Load Module
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Grid Section */}
                    <div className="p-5">
                        {isLoadingGroupModules ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                <span className="ml-2.5 text-[13px] text-gray-400">Loading modules...</span>
                            </div>
                        ) : groupModules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <Layers className="w-12 h-12 text-gray-200 dark:text-gray-700 mb-3" />
                                <p className="text-[14px] font-medium text-gray-600 dark:text-gray-400 mb-1">No Modules Loaded</p>
                                <p className="text-[13px] text-gray-400 dark:text-gray-500">Select a Module Group and click "Load Module" to view modules.</p>
                            </div>
                        ) : (
                            <DataGrid
                                dataSource={groupModules}
                                keyExpr="moduleName"
                                showBorders={true}
                                showRowLines={true}
                                showColumnLines={true}
                                rowAlternationEnabled={true}
                                hoverStateEnabled={true}
                                columnAutoWidth={true}
                                wordWrapEnabled={false}
                                allowColumnResizing={true}
                                columnResizingMode="widget"
                                height={600}
                            >
                                <Sorting mode="multiple" />
                                <Paging defaultPageSize={1000} />
                                <Pager showPageSizeSelector={true} allowedPageSizes={[1000, 2000, 5000]} showInfo={true} />
                                <SearchPanel visible={true} width={240} placeholder="Search..." />
                                <FilterRow visible={true} />
                                <HeaderFilter visible={true} />

                                <Column dataField="moduleHeadName" caption="Module Head Name" />
                                <Column dataField="moduleDisplayName" caption="Module Display Name" />
                            </DataGrid>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Module Group Modal */}
            {showCreateGroupModal && (
                <>
                    <style>{`@keyframes groupModalIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowCreateGroupModal(false)}>
                        <div className="w-full max-w-3xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800"
                            onClick={e => e.stopPropagation()}
                            style={{ animation: 'groupModalIn 0.2s ease-out', maxHeight: '90vh' }}>

                            {/* Header */}
                            <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${isEditMode ? 'from-blue-600 to-cyan-600' : 'from-emerald-600 to-teal-600'} rounded-t-2xl`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                        <Layers className="w-4 h-4 text-white" />
                                    </div>
                                    <h3 className="text-base font-bold text-white tracking-tight">
                                        {isEditMode ? 'Edit Module Group' : 'Create Module Group'}
                                    </h3>
                                </div>
                                <button onClick={() => setShowCreateGroupModal(false)}
                                    className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all backdrop-blur-sm">
                                    <X className="w-4 h-4 text-white" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 160px)' }}>
                                {/* Form Fields */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    {/* Application Name */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                            Application Name <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={newGroupApp}
                                            onChange={(e) => setNewGroupApp(e.target.value)}
                                            disabled={isEditMode}
                                            className={`w-full h-9 px-2.5 py-1.5 text-[13px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all ${isEditMode ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                        >
                                            <option value="estimoprime">Estimoprime</option>
                                            <option value="PrintudeERP">PrintudeERP</option>
                                            <option value="MultiUnit">MultiUnit</option>
                                        </select>
                                    </div>

                                    {/* Module Group Name */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                            Module Group Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            placeholder="Enter group name"
                                            className="w-full h-9 px-2.5 py-1.5 text-[13px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Module Selection Grid */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                        Select Modules <span className="text-red-500">*</span>
                                    </label>
                                    {availableModules.length === 0 ? (
                                        <div className="flex items-center justify-center py-12 border border-gray-200 dark:border-gray-700 rounded-lg">
                                            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                                            <span className="ml-2 text-[13px] text-gray-400">Loading modules...</span>
                                        </div>
                                    ) : (
                                        <DataGrid
                                            dataSource={availableModules}
                                            keyExpr="moduleName"
                                            showBorders={true}
                                            showRowLines={true}
                                            showColumnLines={true}
                                            rowAlternationEnabled={true}
                                            hoverStateEnabled={true}
                                            columnAutoWidth={true}
                                            height={400}
                                            selectedRowKeys={Array.from(selectedModulesForGroup)}
                                            onSelectionChanged={(e: any) => {
                                                console.log('Selection changed:', e.selectedRowKeys);
                                                console.log('Current selected modules:', selectedModulesForGroup);
                                                const selected = new Set(e.selectedRowKeys as string[]);
                                                console.log('New selected modules:', selected);
                                                setSelectedModulesForGroup(selected);
                                            }}
                                        >
                                            <Sorting mode="multiple" />
                                            <Paging defaultPageSize={1000} />
                                            <SearchPanel visible={true} width={240} placeholder="Search modules..." />
                                            <FilterRow visible={true} />
                                            <HeaderFilter visible={true} />

                                            <Selection
                                                mode="multiple"
                                                showCheckBoxesMode="always"
                                                selectAllMode="page"
                                                deferred={false}
                                            />
                                            <Column dataField="moduleHeadName" caption="Module Head Name" />
                                            <Column dataField="moduleDisplayName" caption="Module Display Name" />
                                        </DataGrid>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/30 rounded-b-2xl">
                                <button onClick={() => setShowCreateGroupModal(false)}
                                    disabled={isCreatingGroup}
                                    className="h-9 px-4 text-[13px] font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150 disabled:opacity-50">
                                    <X className="w-3.5 h-3.5 inline mr-1" /> Cancel
                                </button>
                                <button
                                    onClick={handleCreateGroup}
                                    disabled={!newGroupName.trim() || (selectedModulesForGroup.size === 0 && !isEditMode) || isCreatingGroup}
                                    className={`h-9 px-4 text-[13px] font-semibold text-white ${isEditMode ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'} rounded-lg transition-all duration-150 disabled:opacity-50 shadow-sm hover:shadow-md`}>
                                    {isCreatingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : <Save className="w-3.5 h-3.5 inline mr-1" />}
                                    {isCreatingGroup ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save' : 'Create Group')}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Delete Authentication Modal */}
            {showDeleteAuthModal && (
                <>
                    <style>{`@keyframes deleteModalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowDeleteAuthModal(false)}>
                        <div className="w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800"
                            onClick={e => e.stopPropagation()}
                            style={{ animation: 'deleteModalIn 0.2s ease-out' }}>

                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 rounded-t-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                        <AlertTriangle className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white tracking-tight">Authentication Required</h3>
                                        <p className="text-xs text-white/80 mt-0.5">Verify your identity to delete module group</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowDeleteAuthModal(false)}
                                    className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all backdrop-blur-sm">
                                    <X className="w-4 h-4 text-white" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-4">
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg p-3 mb-4">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                        <div className="text-xs text-red-700 dark:text-red-300">
                                            <p className="font-semibold mb-1">You are about to delete:</p>
                                            <p className="font-bold">"{selectedGroup}" from {groupAppName}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* User Name */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        User Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteAuthUserName}
                                        onChange={(e) => setDeleteAuthUserName(e.target.value)}
                                        placeholder="Enter your username"
                                        className="w-full h-9 px-3 py-2 text-[13px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500/40 focus:border-red-500 outline-none transition-all"
                                        autoComplete="username"
                                    />
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        Password <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={deleteAuthPassword}
                                        onChange={(e) => setDeleteAuthPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full h-9 px-3 py-2 text-[13px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500/40 focus:border-red-500 outline-none transition-all"
                                        autoComplete="current-password"
                                    />
                                </div>

                                {/* Reason */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        Reason for Deletion <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={deleteAuthReason}
                                        onChange={(e) => setDeleteAuthReason(e.target.value)}
                                        placeholder="Please provide a reason for deleting this module group..."
                                        rows={3}
                                        className="w-full px-3 py-2 text-[13px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500/40 focus:border-red-500 outline-none transition-all resize-none"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/30 rounded-b-2xl">
                                <button onClick={() => setShowDeleteAuthModal(false)}
                                    disabled={isDeletingGroup}
                                    className="h-9 px-4 text-[13px] font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150 disabled:opacity-50">
                                    <X className="w-3.5 h-3.5 inline mr-1" /> Cancel
                                </button>
                                <button
                                    onClick={handleDeleteGroup}
                                    disabled={!deleteAuthUserName.trim() || !deleteAuthPassword.trim() || !deleteAuthReason.trim() || isDeletingGroup}
                                    className="h-9 px-4 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all duration-150 disabled:opacity-50 shadow-sm hover:shadow-md shadow-red-600/20">
                                    {isDeletingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : <Trash2 className="w-3.5 h-3.5 inline mr-1" />}
                                    {isDeletingGroup ? 'Deleting...' : 'Delete Group'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ModuleGroupAuthority;
