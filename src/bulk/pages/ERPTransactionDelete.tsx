import React, { useState, useEffect } from 'react';
import { Trash2, Database, AlertTriangle, Loader2, ShieldAlert, Lock, CheckCircle, XCircle, Info } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLoader } from '../context/LoaderContext';
import { getModules, ModuleDto, checkMasterUsage, deleteMasterData, deleteUnusedMasterData, MasterUsageResult } from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import ClearSuccessPopup from '../components/ClearSuccessPopup';

const ERPTransactionDelete: React.FC = () => {
    const { isDark } = useTheme();
    const { showLoader, hideLoader } = useLoader();

    // State
    const [activeTab, setActiveTab] = useState<'master' | 'transaction'>('master');
    const [modules, setModules] = useState<ModuleDto[]>([]);
    const [subModules, setSubModules] = useState<ModuleDto[]>([]);
    const [selectedModule, setSelectedModule] = useState('');
    const [selectedSubModule, setSelectedSubModule] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Master Delete States
    const [isChecking, setIsChecking] = useState(false);
    const [usageResult, setUsageResult] = useState<MasterUsageResult | null>(null);
    const [showUsageWarning, setShowUsageWarning] = useState(false);
    const [showMasterDeleteAuth, setShowMasterDeleteAuth] = useState(false);
    const [showUnusedDeleteAuth, setShowUnusedDeleteAuth] = useState(false);

    const [masterCredentials, setMasterCredentials] = useState({ username: '', password: '', reason: '' });

    // Success Popup State
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [successCount, setSuccessCount] = useState(0);
    const [successGroupName, setSuccessGroupName] = useState('');

    // Confirmation Flow State for Transaction Delete
    const [confirmFlowStep, setConfirmFlowStep] = useState<0 | 1 | 2 | 3 | 4>(0);
    const [credentials, setCredentials] = useState({ username: '', password: '', reason: '' });
    const [captchaQuestion, setCaptchaQuestion] = useState({ num1: 0, num2: 0, answer: 0 });
    const [captchaInput, setCaptchaInput] = useState('');
    const [captchaError, setCaptchaError] = useState(false);

    // Progress State
    const [showProgress, setShowProgress] = useState(false);
    const [authError, setAuthError] = useState('');
    const [progressData, setProgressData] = useState({
        current: 0,
        total: 0,
        percentage: 0,
        currentTable: '',
        message: ''
    });

    // Modules that have sub-modules (by module display name)
    const modulesWithSubModules = ['Item Master', 'Item Masters', 'Ledger Master', 'Ledger Masters', 'Tool Master', 'Tool Masters'];

    // Load modules on mount
    useEffect(() => {
        loadModules();
    }, []);

    const loadModules = async () => {
        try {
            showLoader();
            const data = await getModules('Masters_All');
            setModules(data);
        } catch (error) {
            console.error('Failed to load modules:', error);
            alert('Failed to load modules. Please try refreshing the page.');
        } finally {
            hideLoader();
        }
    };

    const handleModuleChange = async (moduleId: string) => {
        setSelectedModule(moduleId);
        setSelectedSubModule('');
        setSubModules([]);

        if (!moduleId) return;

        const module = modules.find(m => m.moduleId.toString() === moduleId);
        if (!module) return;

        try {
            const lookupName = module.moduleDisplayName || module.moduleName;
            let subs = await getModules(lookupName);
            
            // Fallback for names that might be singular/plural in database heads
            if (subs.length === 0) {
                if (lookupName === 'Item Master') subs = await getModules('Item Masters');
                else if (lookupName === 'Item Masters') subs = await getModules('Item Master');
                else if (lookupName === 'Ledger Master') subs = await getModules('Ledger Masters');
                else if (lookupName === 'Ledger Masters') subs = await getModules('Ledger Master');
                else if (lookupName === 'Tool Master') subs = await getModules('Tool Masters');
                else if (lookupName === 'Tool Masters') subs = await getModules('Tool Master');
            }
            
            setSubModules(subs);
        } catch (error) {
            console.error('Failed to load sub-modules:', error);
        }
    };

    const selectedModuleData = modules.find(m => m.moduleId.toString() === selectedModule);
    const selectedModuleName = selectedModuleData?.moduleDisplayName || selectedModuleData?.moduleName || '';
    const selectedModuleInternalName = selectedModuleData?.moduleName || selectedModuleName;

    const showSubModuleDropdown = modulesWithSubModules.includes(selectedModuleName) && subModules.length > 0;

    const selectedSubModuleName = subModules.find(s => s.moduleId.toString() === selectedSubModule)?.moduleDisplayName ||
                                   subModules.find(s => s.moduleId.toString() === selectedSubModule)?.moduleName || '';

    // Generate CAPTCHA
    const generateCaptcha = () => {
        const num1 = Math.floor(Math.random() * 50) + 20;
        const num2 = Math.floor(Math.random() * 30) + 10;
        const answer = num1 - num2;
        setCaptchaQuestion({ num1, num2, answer });
        setCaptchaInput('');
        setCaptchaError(false);
    };

    // ========================
    // MASTER DELETE FLOW
    // ========================

    const handleMasterDeleteClick = async () => {
        setIsChecking(true);

        try {
            const moduleName = selectedModuleInternalName;
            const subModuleId = showSubModuleDropdown
                ? parseInt(selectedSubModule)
                : 0; // No sub-module dropdown = no filter, backend will scan entire table

            const result = await checkMasterUsage(moduleName, subModuleId);
            setUsageResult(result);

            if (result.isUsed) {
                // Items are used in transactions — show warning
                setShowUsageWarning(true);
            } else if (result.totalItemsInGroup === 0) {
                // No active items in this group
                alert('No active items found in this group to delete.');
            } else {
                // Items are NOT used — show auth modal to proceed with delete
                setAuthError('');
                setShowMasterDeleteAuth(true);
            }
        } catch (error: any) {
            console.error('Check master usage failed:', error);
            const msg = error?.response?.data?.message || error.message || 'Unknown error';
            alert('Usage check failed: ' + msg);
        } finally {
            setIsChecking(false);
        }
    };

    const handleMasterDeleteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsDeleting(true);
        showLoader();

        try {
            const moduleName = selectedModuleInternalName;
            const subModuleId = showSubModuleDropdown
                ? parseInt(selectedSubModule)
                : 0; 

            const result = await deleteMasterData(
                moduleName,
                subModuleId,
                masterCredentials.username,
                masterCredentials.password,
                masterCredentials.reason
            );

            if (result.success) {
                setShowMasterDeleteAuth(false);
                setSuccessCount(result.deletedCount);
                setSuccessGroupName(`${selectedModuleName}${selectedSubModuleName ? ` - ${selectedSubModuleName}` : ''}`);
                setShowSuccessPopup(true);
                setMasterCredentials({ username: '', password: '', reason: '' });
                setAuthError('');
            } else {
                setAuthError(result.message || 'Delete operation failed');
            }
        } catch (error: any) {
            console.error('Master delete failed:', error);
            if (error?.response?.status === 401) {
                setAuthError('Invalid username or password. Please try again.');
            } else {
                const msg = error?.response?.data?.message || error.message || 'Unknown error';
                setAuthError(msg);
            }
        } finally {
            setIsDeleting(false);
            hideLoader();
        }
    };

    // ========================
    // DELETE UNUSED ITEMS FLOW
    // ========================

    const handleDeleteUnusedClick = () => {
        setShowUsageWarning(false);
        setAuthError('');
        setShowUnusedDeleteAuth(true);
        setMasterCredentials({ username: '', password: '', reason: '' });
    };

    const handleUnusedDeleteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsDeleting(true);
        showLoader();

        try {
            const moduleName = selectedModuleInternalName;
            const subModuleId = showSubModuleDropdown
                ? parseInt(selectedSubModule)
                : 0;

            const result = await deleteUnusedMasterData(
                moduleName,
                subModuleId,
                masterCredentials.username,
                masterCredentials.password,
                masterCredentials.reason
            );

            if (result.success) {
                setShowUnusedDeleteAuth(false);
                setSuccessCount(result.deletedCount);
                setSuccessGroupName(`${selectedModuleName}${selectedSubModuleName ? ` - ${selectedSubModuleName}` : ''} (Unused)`);
                setShowSuccessPopup(true);
                setMasterCredentials({ username: '', password: '', reason: '' });
                setAuthError('');
            } else {
                setAuthError(result.message || 'Unused items deletion failed');
            }
        } catch (error: any) {
            console.error('Unused delete failed:', error);
            if (error?.response?.status === 401) {
                setAuthError('Invalid username or password. Please try again.');
            } else {
                const msg = error?.response?.data?.message || error.message || 'Unknown error';
                setAuthError(msg);
            }
        } finally {
            setIsDeleting(false);
            hideLoader();
        }
    };

    // ========================
    // TRANSACTION DELETE FLOW
    // ========================

    const handleTransactionDeleteClick = () => {
        setConfirmFlowStep(1);
        generateCaptcha();
    };

    const handleConfirmNext = () => {
        const userAnswer = parseInt(captchaInput);
        if (isNaN(userAnswer) || userAnswer !== captchaQuestion.answer) {
            setCaptchaError(true);
            alert('Incorrect CAPTCHA answer. Please try again.');
            return;
        }

        if (confirmFlowStep < 3) {
            setConfirmFlowStep((prev) => (prev + 1) as any);
            generateCaptcha();
        } else {
            setConfirmFlowStep(4);
        }
    };

    const handleConfirmCancel = () => {
        setConfirmFlowStep(0);
        setCredentials({ username: '', password: '', reason: '' });
        setCaptchaInput('');
        setCaptchaError(false);
        setAuthError('');
    };

    const handleSecurityVerificationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setIsDeleting(true);
        
        try {
            const token = localStorage.getItem('authToken');
            const companyToken = localStorage.getItem('companyToken');
            const activeToken = token || companyToken;

            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5080') + '/bulk/api';
            const response = await fetch(`${baseUrl}/transactiondelete/clear-all-transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeToken}`
                },
                body: JSON.stringify({
                    Username: credentials.username,
                    Password: credentials.password,
                    Reason: credentials.reason
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    setAuthError('Invalid username or password. Please try again.');
                } else {
                    const errorText = await response.text();
                    setAuthError(errorText || `Execution failed with status ${response.status}`);
                }
                setIsDeleting(false);
                return;
            }

            // If we are here, auth succeeded or at least started.
            setConfirmFlowStep(0);
            setShowProgress(true);
            setProgressData({ current: 0, total: 0, percentage: 0, currentTable: '', message: 'Initializing...' });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const data = JSON.parse(line);

                                if (data.type === 'start') {
                                    setProgressData({ current: 0, total: data.total, percentage: 0, currentTable: '', message: data.message });
                                } else if (data.type === 'progress') {
                                    setProgressData({ current: data.current, total: data.total, percentage: data.percentage, currentTable: data.table, message: data.message });
                                } else if (data.type === 'complete') {
                                    setProgressData({ current: data.processed, total: data.total, percentage: 100, currentTable: '', message: data.message });
                                    setTimeout(() => {
                                        setShowProgress(false);
                                        setSuccessCount(data.processed);
                                        setSuccessGroupName("All Transactions");
                                        setShowSuccessPopup(true);
                                        setCredentials({ username: '', password: '', reason: '' });
                                    }, 500);
                                } else if (data.type === 'error') {
                                    // Check if this is an auth error sent in the stream
                                    const isAuthError = data.message.toLowerCase().includes('username') || 
                                                       data.message.toLowerCase().includes('password');

                                    if (isAuthError) {
                                        setAuthError(data.message);
                                        setConfirmFlowStep(4); // Go back to Security Verification
                                        setShowProgress(false); // Hide progress modal
                                    } else {
                                        alert('Error during deletion: ' + data.message);
                                        setShowProgress(false);
                                    }
                                    
                                    setIsDeleting(false);
                                    return;
                                }
                            } catch (parseError) {
                                console.error('Error parsing progress:', parseError);
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('Delete failed:', error);
            setAuthError('Error while communicating with server: ' + (error.message || 'Unknown error'));
            setIsDeleting(false);
        }
    };

    const canDeleteMaster = selectedModule && (!showSubModuleDropdown || selectedSubModule);

    return (
        <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-200`}>
            <div className="container mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                            <Trash2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                ERP Transaction Delete
                            </h1>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Delete master data or transactions from the system
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className={`rounded-xl shadow-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                    <div className={`flex border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-t-xl overflow-hidden`}>
                        <button
                            onClick={() => setActiveTab('master')}
                            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                                activeTab === 'master'
                                    ? `${isDark ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600'} border-b-2 border-red-600`
                                    : `${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`
                            }`}
                        >
                            <Database className="w-4 h-4 inline-block mr-2" />
                            Master Wise Data
                        </button>
                        <button
                            onClick={() => setActiveTab('transaction')}
                            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                                activeTab === 'transaction'
                                    ? `${isDark ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600'} border-b-2 border-red-600`
                                    : `${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`
                            }`}
                        >
                            <Trash2 className="w-4 h-4 inline-block mr-2" />
                            All Transaction without Master
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'master' ? (
                            // TAB 1: Master Wise Data
                            <div className="space-y-6">
                                <div className={`p-4 rounded-lg ${isDark ? 'bg-yellow-900/20 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className={`text-sm font-medium ${isDark ? 'text-yellow-200' : 'text-yellow-800'}`}>
                                                Warning: This action will permanently delete the selected master data
                                            </p>
                                            <p className={`text-xs mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                                                Please ensure you have a backup before proceeding
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Dropdowns - Side by Side */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SearchableSelect
                                        label="Module Name"
                                        value={selectedModule}
                                        onChange={(value) => handleModuleChange(value.toString())}
                                        options={modules.map(m => ({
                                            value: m.moduleId.toString(),
                                            label: m.moduleDisplayName || m.moduleName
                                        }))}
                                        placeholder="Select Module Name"
                                        required
                                    />

                                    {showSubModuleDropdown && (
                                        <SearchableSelect
                                            label="Sub Module Name"
                                            value={selectedSubModule}
                                            onChange={(value) => { setSelectedSubModule(value.toString()); }}
                                            options={subModules.map(s => ({
                                                value: s.moduleId.toString(),
                                                label: s.moduleDisplayName || s.moduleName
                                            }))}
                                            placeholder="Select Sub-module"
                                            required
                                        />
                                    )}
                                </div>

                                {/* Delete Button */}
                                <div className="flex justify-center pt-4">
                                    <button
                                        onClick={handleMasterDeleteClick}
                                        disabled={!canDeleteMaster || isDeleting || isChecking}
                                        className={`px-8 py-3 rounded-lg font-semibold text-white shadow-lg transition-all flex items-center gap-2 ${
                                            canDeleteMaster && !isDeleting && !isChecking
                                                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 hover:shadow-xl transform hover:-translate-y-0.5'
                                                : 'bg-gray-400 cursor-not-allowed opacity-50'
                                        }`}
                                    >
                                        {isChecking ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Checking...
                                            </>
                                        ) : isDeleting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Deleting...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 className="w-5 h-5" />
                                                Delete Master Data
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // TAB 2: All Transaction without Master
                            <div className="space-y-6">
                                <div className={`p-4 rounded-lg ${isDark ? 'bg-red-900/20 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className={`text-sm font-medium ${isDark ? 'text-red-200' : 'text-red-800'}`}>
                                                Danger: This action will delete ALL transactional data (excluding master tables)
                                            </p>
                                            <p className={`text-xs mt-1 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                                                This includes Stock Transactions, Tool Transactions, Ledger Transactions, etc.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'} text-center`}>
                                    <Database className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        Delete All Transactions
                                    </h3>
                                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        This will remove all transactional records while preserving master data
                                    </p>

                                    <button
                                        onClick={handleTransactionDeleteClick}
                                        disabled={isDeleting}
                                        className={`px-8 py-3 rounded-lg font-semibold text-white shadow-lg transition-all flex items-center gap-2 mx-auto ${
                                            !isDeleting
                                                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 hover:shadow-xl transform hover:-translate-y-0.5'
                                                : 'bg-gray-400 cursor-not-allowed opacity-50'
                                        }`}
                                    >
                                        {isDeleting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Deleting...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 className="w-5 h-5" />
                                                Delete All Transactions
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ======================== */}
            {/* USAGE WARNING MODAL */}
            {/* ======================== */}
            {showUsageWarning && usageResult && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-5 rounded-xl shadow-2xl max-w-md w-full border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Cannot Delete Master Data
                                </h3>
                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {selectedModuleName} {selectedSubModuleName ? `- ${selectedSubModuleName}` : ''} ({usageResult.totalItemsInGroup} items)
                                </p>
                            </div>
                        </div>

                        {/* Warning Message */}
                        <div className={`p-2.5 rounded-lg mb-3 ${isDark ? 'bg-red-900/20 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                            <p className={`text-xs font-medium ${isDark ? 'text-red-300' : 'text-red-800'} leading-relaxed`}>
                                Items in this group are currently being used in transactions. Please clear the transactions listed below before deleting the master data.
                            </p>
                        </div>

                        {/* Usage Details */}
                        <div className="space-y-2 mb-4 max-h-52 overflow-y-auto pr-1">
                            {usageResult.usages.filter(u => u.count > 0).map((usage, index) => (
                                <div key={index} className={`p-2.5 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-start gap-2.5">
                                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {usage.area}
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isDark ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700'}`}>
                                                    {usage.count} items
                                                </span>
                                            </div>
                                            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {usage.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Action Steps */}
                        <div className={`p-2.5 rounded-lg mb-3 ${isDark ? 'bg-blue-900/20 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
                            <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className={`text-xs font-medium ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                                        Required Steps:
                                    </p>
                                    <ol className={`text-[10px] mt-1 space-y-0.5 list-decimal list-inside ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>
                                        {usageResult.usages.filter(u => u.count > 0).map((usage, index) => (
                                            <li key={index}>Clear <strong>{usage.area}</strong> records first</li>
                                        ))}
                                        <li>Return here and delete the master data</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        {/* Unused Items Section */}
                        {usageResult.unusedItemsCount > 0 && (
                            <div className={`p-2.5 rounded-lg mb-3 ${isDark ? 'bg-green-900/20 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        <div>
                                            <p className={`text-xs font-medium ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                                                {usageResult.unusedItemsCount} unused item(s) found
                                            </p>
                                            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                                Safe to delete
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleDeleteUnusedClick}
                                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all flex items-center gap-1 whitespace-nowrap shadow-sm"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Delete ({usageResult.unusedItemsCount})
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Close Button */}
                        <button
                            onClick={() => setShowUsageWarning(false)}
                            className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isDark
                                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Understood, Close
                        </button>
                    </div>
                </div>
            )}

            {/* ======================== */}
            {/* MASTER DELETE AUTH MODAL */}
            {/* ======================== */}
            {showMasterDeleteAuth && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <form onSubmit={handleMasterDeleteSubmit} className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-2xl max-w-md w-full border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Safe to Delete
                                </h3>
                            </div>
                        </div>

                        {authError && (
                            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                <p className="text-xs font-semibold text-red-700 dark:text-red-400">{authError}</p>
                            </div>
                        )}

                        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {usageResult?.totalItemsInGroup || 0} item(s) in {selectedModuleName} {selectedSubModuleName ? `- ${selectedSubModuleName}` : ''} are not used in any transactions. Please enter your username and reason to proceed with deletion.
                        </p>

                        <div className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-green-900/20 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <p className={`text-xs font-medium ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                                    Not used in any transactions, job cards, QC inspections, or purchase records
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Username *</label>
                                <input
                                    type="text"
                                    value={masterCredentials.username}
                                    onChange={(e) => setMasterCredentials({ ...masterCredentials, username: e.target.value })}
                                    required
                                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${
                                        isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Password <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(Optional)</span>
                                </label>
                                <input
                                    type="password"
                                    value={masterCredentials.password}
                                    onChange={(e) => setMasterCredentials({ ...masterCredentials, password: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${
                                        isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Reason for Deletion *</label>
                                <textarea
                                    value={masterCredentials.reason}
                                    onChange={(e) => setMasterCredentials({ ...masterCredentials, reason: e.target.value })}
                                    required
                                    rows={3}
                                    placeholder="Please provide the reason for deletion..."
                                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                                        isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                    }`}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => { setShowMasterDeleteAuth(false); setMasterCredentials({ username: '', password: '', reason: '' }); }}
                                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                                    isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                Confirm Delete
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ======================== */}
            {/* DELETE UNUSED AUTH MODAL */}
            {/* ======================== */}
            {showUnusedDeleteAuth && usageResult && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <form onSubmit={handleUnusedDeleteSubmit} className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-2xl max-w-md w-full border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Delete Unused Items
                                </h3>
                            </div>
                        </div>

                        {authError && (
                            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                <p className="text-xs font-semibold text-red-700 dark:text-red-400">{authError}</p>
                            </div>
                        )}

                        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {usageResult.unusedItemsCount} item(s) in {selectedModuleName} {selectedSubModuleName ? `- ${selectedSubModuleName}` : ''} are not used in any transactions and will be permanently deleted. Please enter your credentials to proceed.
                        </p>

                        <div className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-green-900/20 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <p className={`text-xs font-medium ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                                    Only items not used in any transactions, job cards, QC inspections, or purchases will be deleted
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Username *</label>
                                <input
                                    type="text"
                                    value={masterCredentials.username}
                                    onChange={(e) => setMasterCredentials({ ...masterCredentials, username: e.target.value })}
                                    required
                                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${
                                        isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Password <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(Optional)</span>
                                </label>
                                <input
                                    type="password"
                                    value={masterCredentials.password}
                                    onChange={(e) => setMasterCredentials({ ...masterCredentials, password: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${
                                        isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Reason for Deletion *</label>
                                <textarea
                                    value={masterCredentials.reason}
                                    onChange={(e) => setMasterCredentials({ ...masterCredentials, reason: e.target.value })}
                                    required
                                    rows={3}
                                    placeholder="Please provide the reason for deletion..."
                                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                                        isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                    }`}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => { setShowUnusedDeleteAuth(false); setMasterCredentials({ username: '', password: '', reason: '' }); }}
                                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                                    isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete {usageResult.unusedItemsCount} Unused
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ======================== */}
            {/* TRANSACTION CONFIRMATION FLOW (Steps 1-3) */}
            {/* ======================== */}
            {confirmFlowStep > 0 && confirmFlowStep < 4 && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-xl max-w-md w-full border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                            <ShieldAlert className="w-8 h-8" />
                            <h3 className="text-lg font-bold">Confirmation Required ({confirmFlowStep}/3)</h3>
                        </div>

                        <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'} text-lg`}>
                            {confirmFlowStep === 1 && "Are you sure you want to clear all the Clients data?"}
                            {confirmFlowStep === 2 && "Discussed with the client that the data needs to be cleared?"}
                            {confirmFlowStep === 3 && "Have you received an email from your client asking to clear the data?"}
                        </p>

                        <div className={`mb-6 p-4 rounded-lg border-2 ${isDark ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-300'}`}>
                            <label className={`block text-sm font-bold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Security Verification - Solve this:
                            </label>
                            <div className={`text-2xl font-mono font-bold text-center mb-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                {captchaQuestion.num1} - {captchaQuestion.num2} = ?
                            </div>
                            <input
                                type="number"
                                value={captchaInput}
                                onChange={(e) => setCaptchaInput(e.target.value)}
                                placeholder="Enter answer"
                                className={`w-full px-3 py-2 border-2 rounded-lg outline-none text-center text-lg ${
                                    captchaError
                                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                        : isDark
                                        ? 'border-gray-600 bg-gray-700 text-white'
                                        : 'border-gray-300 bg-white text-gray-900'
                                }`}
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleConfirmCancel}
                                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                                    isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                No, Cancel
                            </button>
                            <button
                                onClick={handleConfirmNext}
                                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all"
                            >
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================== */}
            {/* TRANSACTION SECURITY VERIFICATION (Step 4) */}
            {/* ======================== */}
            {confirmFlowStep === 4 && !showProgress && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <form onSubmit={handleSecurityVerificationSubmit} className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-xl max-w-md w-full border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className={`flex items-center gap-3 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            <Lock className="w-6 h-6" />
                            <h3 className="text-xl font-bold">Security Verification</h3>
                        </div>

                        {authError && (
                            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                <p className="text-xs font-semibold text-red-700 dark:text-red-400">{authError}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Username</label>
                                <input
                                    type="text"
                                    value={credentials.username}
                                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                                    required
                                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${
                                        isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Password <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(Optional)</span>
                                </label>
                                <input
                                    type="password"
                                    value={credentials.password}
                                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${
                                        isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Reason for Deletion</label>
                                <textarea
                                    value={credentials.reason}
                                    onChange={(e) => setCredentials({ ...credentials, reason: e.target.value })}
                                    required
                                    rows={3}
                                    placeholder="Please explicitly state why data is being cleared..."
                                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                                        isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                    }`}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={handleConfirmCancel}
                                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                                    isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                Authorize & Clear Data
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ======================== */}
            {/* PROGRESS MODAL */}
            {/* ======================== */}
            {showProgress && (
                <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4">
                    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-8 rounded-xl shadow-2xl max-w-lg w-full border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                                <Database className="w-8 h-8 text-white animate-pulse" />
                            </div>
                            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Deleting Transactions
                            </h3>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {progressData.message}
                            </p>
                        </div>

                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Progress</span>
                                <span className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{progressData.percentage}%</span>
                            </div>
                            <div className={`w-full h-3 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out rounded-full"
                                    style={{ width: `${progressData.percentage}%` }}
                                >
                                    <div className="w-full h-full bg-white/20 animate-pulse"></div>
                                </div>
                            </div>
                            <div className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'} text-center`}>
                                {progressData.current} / {progressData.total} tables processed
                            </div>
                        </div>

                        {progressData.currentTable && (
                            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                                <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Currently Processing:</div>
                                <div className={`text-sm font-mono font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'} truncate`}>{progressData.currentTable}</div>
                            </div>
                        )}

                        {progressData.percentage === 100 && (
                            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                    <CheckCircle className="w-5 h-5" />
                                    <span className="font-semibold">Completed Successfully!</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Success Popup */}
            {showSuccessPopup && (
                <ClearSuccessPopup
                    rowCount={successCount}
                    groupName={successGroupName}
                    onClose={() => setShowSuccessPopup(false)}
                />
            )}
        </div>
    );
};

export default ERPTransactionDelete;
