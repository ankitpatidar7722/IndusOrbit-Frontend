import React, { useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { getItemGroups, getToolGroups, ItemGroupDto, ToolGroupDto } from '../services/api';
import ItemStockUpload from '../components/ItemStockUpload';
import SparePartMasterStockUpload from '../components/SparePartMasterStockUpload';
import ToolStockUpload from '../components/ToolStockUpload';
import { useMessageModal } from '../components/MessageModal';

const StockUpload: React.FC = () => {
    const [selectedModule, setSelectedModule] = useState<string>('');
    const [selectedSubModule, setSelectedSubModule] = useState<string>('');
    const [itemGroups, setItemGroups] = useState<ItemGroupDto[]>([]);
    const [toolGroups, setToolGroups] = useState<ToolGroupDto[]>([]);
    // Modals
    const { showMessage, ModalRenderer: MessageModalRenderer } = useMessageModal();
    const [isLoading, setIsLoading] = useState(false);

    // Track whether the child component has data loaded
    const [childHasData, setChildHasData] = useState(false);

    const onChildHasDataChange = useCallback((hasData: boolean) => {
        setChildHasData(hasData);
    }, []);

    const handleModuleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const moduleValue = e.target.value;

        // If child has data, show confirmation before switching module
        if (childHasData) {
            showMessage('warning', 'Switch Confirmation', 
                `You have data loaded in the current window. Switching the module will close this window and clear all data. Do you want to continue?`,
                {
                    onConfirm: () => applyModuleChange(moduleValue),
                    confirmLabel: 'OK, Continue',
                    cancelLabel: 'Cancel'
                }
            );
            return;
        }

        await applyModuleChange(moduleValue);
    };

    const applyModuleChange = async (moduleValue: string) => {
        setSelectedModule(moduleValue);
        setSelectedSubModule('');
        setItemGroups([]);
        setToolGroups([]);
        setChildHasData(false);

        if (moduleValue === 'ItemMasters') {
            setIsLoading(true);
            try {
                const groups = await getItemGroups();
                setItemGroups(groups);
            } catch (error) {
                console.error('Failed to fetch item groups', error);
            } finally {
                setIsLoading(false);
            }
        } else if (moduleValue === 'ToolMaster') {
            setIsLoading(true);
            try {
                const groups = await getToolGroups();
                setToolGroups(groups);
            } catch (error) {
                console.error('Failed to fetch tool groups', error);
            } finally {
                setIsLoading(false);
            }
        } else if (moduleValue === 'SparePartMaster') {
            setSelectedSubModule('SparePartMaster');
        }
    };

    const handleSubModuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newValue = e.target.value;

        // If child has data, show confirmation before switching sub module
        if (childHasData) {
            showMessage('warning', 'Switch Confirmation',
                `You have data loaded in the current window. Switching the Sub Module will close this window and clear all data. Do you want to continue?`,
                {
                    onConfirm: () => setSelectedSubModule(newValue),
                    confirmLabel: 'OK, Continue',
                    cancelLabel: 'Cancel'
                }
            );
            return;
        }

        setSelectedSubModule(newValue);
    };

    const handleRefresh = () => {
        // If child has data, show confirmation before refreshing
        if (childHasData) {
            showMessage('warning', 'Switch Confirmation',
                `You have data loaded in the current window. Refreshing will close this window and clear all data. Do you want to continue?`,
                {
                    onConfirm: () => applyRefresh(),
                    confirmLabel: 'OK, Continue',
                    cancelLabel: 'Cancel'
                }
            );
            return;
        }

        applyRefresh();
    };

    const applyRefresh = () => {
        setSelectedModule('');
        setSelectedSubModule('');
        setItemGroups([]);
        setToolGroups([]);
        setChildHasData(false);
    };



    // Get selected item group name for display
    const getSelectedItemGroupName = (): string => {
        if (selectedModule !== 'ItemMasters' || !selectedSubModule) return '';
        const group = itemGroups.find(g => g.itemGroupID === Number(selectedSubModule));
        return group?.itemGroupName || '';
    };

    // Get selected tool group name for display
    const getSelectedToolGroupName = (): string => {
        if (selectedModule !== 'ToolMaster' || !selectedSubModule) return '';
        const group = toolGroups.find(g => g.toolGroupID === Number(selectedSubModule));
        return group?.toolGroupName || '';
    };

    const renderSubModuleDropdown = () => {
        if (!selectedModule) {
            return (
                <div className="invisible">
                    {/* Hidden placeholder to maintain grid layout */}
                </div>
            );
        }

        if (selectedModule === 'ItemMasters') {
            return (
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Sub Module Name
                    </label>
                    <select
                        className="w-full px-3 py-1.5 bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 dark:text-white"
                        value={selectedSubModule}
                        onChange={handleSubModuleChange}
                        disabled={isLoading || itemGroups.length === 0}
                    >
                        <option value="" disabled hidden>Select Sub Module</option>
                        {itemGroups.map((group) => (
                            <option key={group.itemGroupID} value={group.itemGroupID}>
                                {group.itemGroupName}
                            </option>
                        ))}
                    </select>
                </div>
            );
        }

        if (selectedModule === 'ToolMaster') {
            return (
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Sub Module Name
                    </label>
                    <select
                        className="w-full px-3 py-1.5 bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 dark:text-white"
                        value={selectedSubModule}
                        onChange={handleSubModuleChange}
                        disabled={isLoading || toolGroups.length === 0}
                    >
                        <option value="" disabled hidden>Select Sub Module</option>
                        {toolGroups.map((group) => (
                            <option key={group.toolGroupID} value={group.toolGroupID}>
                                {group.toolGroupName}
                            </option>
                        ))}
                    </select>
                </div>
            );
        }

        if (selectedModule === 'SparePartMaster') {
            return (
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Sub Module Name
                    </label>
                    <select
                        className="w-full px-3 py-1.5 bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 dark:text-white"
                        value={selectedSubModule}
                        disabled
                    >
                        <option value="SparePartMaster">Spare Part Master</option>
                    </select>
                </div>
            );
        }

        return (
            <div className="invisible">
                {/* Hidden placeholder to maintain grid layout */}
            </div>
        );
    };

    return (
        <div className="p-3 md:p-4 bg-gray-50 dark:bg-[#020617] min-h-screen transition-colors duration-200">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Stock Upload</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Upload stock data into the system.</p>
            </div>

            {/* Main Control Card */}
            <div className="bg-white dark:bg-[#0f172a] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    {/* Module Name Dropdown */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Module Name
                        </label>
                        <select
                            className="w-full px-3 py-1.5 bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 dark:text-white"
                            value={selectedModule}
                            onChange={handleModuleChange}
                        >
                            <option value="" disabled hidden>Select Module Name</option>
                            <option value="ItemMasters">Item Masters</option>
                            <option value="ToolMaster">Tool Master</option>
                            <option value="SparePartMaster">Spare Part Master</option>
                        </select>
                    </div>

                    {/* Sub Module Name Dropdown */}
                    {renderSubModuleDropdown()}

                    {/* Refresh Button */}
                    <div className="flex items-end">
                        <button
                            onClick={handleRefresh}
                            className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-transparent rounded-lg transition-all shadow-sm hover:shadow-indigo-200 dark:hover:shadow-indigo-900/30 flex items-center justify-center gap-2 h-[38px] mt-6 md:mt-0 active:scale-95 transform font-medium"
                            title="Reset Module"
                        >
                            <RefreshCw className="w-4 h-4 animate-in spin-in-180 duration-300" />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Item Stock Upload Component */}
            {selectedModule === 'ItemMasters' && selectedSubModule && (
                <ItemStockUpload
                    key={selectedSubModule}
                    itemGroupId={Number(selectedSubModule)}
                    itemGroupName={getSelectedItemGroupName()}
                    onHasDataChange={onChildHasDataChange}
                />
            )}

            {/* Spare Part Master Stock Upload Component */}
            {selectedModule === 'SparePartMaster' && selectedSubModule === 'SparePartMaster' && (
                <SparePartMasterStockUpload
                    key="SparePartMaster"
                    onHasDataChange={onChildHasDataChange}
                />
            )}

            {/* Tool Master Stock Upload Component */}
            {selectedModule === 'ToolMaster' && selectedSubModule && (
                <ToolStockUpload
                    key={selectedSubModule}
                    toolGroupId={Number(selectedSubModule)}
                    toolGroupName={getSelectedToolGroupName()}
                    onHasDataChange={onChildHasDataChange}
                />
            )}

            {/* Message Modal Renderer */}
            {MessageModalRenderer}
        </div>
    );
};

export default StockUpload;
