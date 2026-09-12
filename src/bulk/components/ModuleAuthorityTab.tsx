import React, { useState, useEffect } from 'react';
import { Save, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import {
    getModulesForCompany,
    saveCompanyModuleAuthority,
    IndusToolModuleDto,
} from '../services/api';
import { useMessageModal } from './MessageModal';

interface Props {
    companyUserID: string;
}

const ModuleAuthorityTab: React.FC<Props> = ({ companyUserID }) => {
    const { showMessage, ModalRenderer } = useMessageModal();
    const [modules, setModules] = useState<IndusToolModuleDto[]>([]);
    const [enabled, setEnabled] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const load = async () => {
        if (!companyUserID) return;
        setIsLoading(true);
        try {
            const data = await getModulesForCompany(companyUserID);
            setModules(data);
            setEnabled(new Set(data.filter(m => m.isEnabled).map(m => m.moduleID)));
        } catch {
            showMessage('error', 'Load Failed', 'Failed to load module list.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, [companyUserID]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggle = (id: number) => {
        setEnabled(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await saveCompanyModuleAuthority({
                companyUserID,
                enabledModuleIDs: [...enabled],
            });
            if (result.success) {
                showMessage('success', 'Saved Successfully', result.message || 'Module authority saved successfully.');
            } else {
                showMessage('error', 'Save Failed', result.message || 'Failed to save module authority.');
            }
        } catch {
            showMessage('error', 'Save Failed', 'Failed to save module authority.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-3" style={{ minHeight: '420px' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                        Sidebar Modules — {companyUserID}
                    </span>
                </div>
                <button onClick={load} disabled={isLoading}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-1">
                Check the modules this company can see in the sidebar. Unchecked modules are hidden after their next login.
                Leave all unchecked to show all modules.
            </p>

            {/* Module list */}
            {isLoading ? (
                <div className="flex items-center justify-center flex-1 py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modules.map(m => (
                        <label key={m.moduleID}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition-all">
                            <input
                                type="checkbox"
                                checked={enabled.has(m.moduleID)}
                                onChange={() => toggle(m.moduleID)}
                                className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                            />
                            <span className="text-[12px] font-medium text-gray-700 dark:text-gray-200">
                                {m.moduleName}
                            </span>
                            <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                                {m.modulePath}
                            </span>
                        </label>
                    ))}
                </div>
            )}

            {ModalRenderer}

            {/* Save */}
            <div className="mt-auto pt-2 flex justify-end">
                <button onClick={handleSave} disabled={isSaving || isLoading}
                    className="flex items-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-all duration-150 disabled:opacity-50 shadow-sm hover:shadow-md shadow-amber-500/20">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                </button>
            </div>
        </div>
    );
};

export default ModuleAuthorityTab;
