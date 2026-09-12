import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ClearSuccessPopup from './ClearSuccessPopup';
import NoDataPopup from './NoDataPopup';
import { Database, Trash2, Upload, Download, CheckCircle2, AlertCircle, FilePlus2, RefreshCw, XCircle, ShieldAlert, Lock } from 'lucide-react';
import { useMessageModal } from './MessageModal';
import DropdownCellRenderer from './DropdownCellRenderer';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
    getLedgersByGroup,
    softDeleteLedger,
    validateLedgers,
    importLedgers,
    getCountryStates,
    LedgerMasterDto,
    LedgerValidationResultDto,
    LedgerRowValidation,
    CountryStateDto,
    ValidationStatus,
    clearAllLedgerData,
    getLedgerCount,
    SalesRepresentativeDto,
    getSalesRepresentatives,
    DepartmentDto,
    getDepartments,
    ClientDto,
    getClients
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLoader } from '../context/LoaderContext';
import { getLedgerStandardColumns, validateExcelColumns } from '../utils/excelColumnValidator';

// AG Grid Imports
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, GridApi, RowClassRules, IRowNode } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule]);

// SearchableDropdown removed (replaced by AG Grid standard editing for now)

// ---------------------------------------------

interface LedgerMasterEnhancedProps {
    ledgerGroupId: number;
    ledgerGroupName: string;
}

const LedgerMasterEnhanced: React.FC<LedgerMasterEnhancedProps> = ({ ledgerGroupId, ledgerGroupName }) => {
    const { isDark } = useTheme();
    const { showMessage, ModalRenderer } = useMessageModal();
    const { showLoader, hideLoader } = useLoader();

    const [ledgerData, setLedgerData] = useState<LedgerMasterDto[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isLoading) showLoader();
        else hideLoader();
    }, [isLoading]);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [validationResult, setValidationResult] = useState<LedgerValidationResultDto | null>(null);
    const [mode, setMode] = useState<'idle' | 'loaded' | 'preview' | 'validated'>('idle');
    const [filterType, setFilterType] = useState<'all' | 'valid' | 'duplicate' | 'missing' | 'mismatch' | 'invalid'>('all');
    const [countryStates, setCountryStates] = useState<CountryStateDto[]>([]);
    const [salesRepresentatives, setSalesRepresentatives] = useState<SalesRepresentativeDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [clients, setClients] = useState<ClientDto[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingMode, setPendingMode] = useState<{ type: 'load' | 'upload'; action: () => void } | null>(null);
    const [showModeSwitchModal, setShowModeSwitchModal] = useState(false);

    // Clear Data Flow State
    const [clearFlowStep, setClearFlowStep] = useState<0 | 1 | 2 | 3 | 4>(0);
    const [clearCredentials, setClearCredentials] = useState({ username: '', password: '', reason: '' });

    // Re-Upload Confirmation State
    const [showReUploadModal, setShowReUploadModal] = useState(false);

    const showError = (message: string) => {
        showMessage('error', 'Error', message);
    };

    // Import Progress State
    const [importProgress, setImportProgress] = useState<{
        active: boolean;
        step: string;
        pct: number;
        total: number;
    } | null>(null);

    // Success Popup State (Import)
    const [successInfo, setSuccessInfo] = useState<{
        groupName: string;
        totalRows: number;
        insertedRows: number;
        failedRows: number;
        errorMessages: string[];
    } | null>(null);

    // Clear Success Popup State
    const [clearSuccessInfo, setClearSuccessInfo] = useState<{ rowCount: number; groupName: string } | null>(null);

    // No Data Popup State
    const [noDataPopupGroup, setNoDataPopupGroup] = useState<string | null>(null);

    // CAPTCHA State
    const [captchaQuestion, setCaptchaQuestion] = useState({ num1: 0, num2: 0, answer: 0 });
    const [captchaInput, setCaptchaInput] = useState('');
    const [captchaError, setCaptchaError] = useState(false);

    // Generate CAPTCHA
    const generateCaptcha = () => {
        const num1 = Math.floor(Math.random() * 50) + 20; // 20-70
        const num2 = Math.floor(Math.random() * 30) + 10; // 10-40
        const answer = num1 - num2;
        setCaptchaQuestion({ num1, num2, answer });
        setCaptchaInput('');
        setCaptchaError(false);
    };

    // Validation Modal State
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [validationModalContent, setValidationModalContent] = useState<{ title: string; messages: string[] } | null>(null);
    const [clearActionType, setClearActionType] = useState<'clearOnly' | 'freshUpload'>('freshUpload');
    const [noDataMessage, setNoDataMessage] = useState<string | null>(null);

    const handleClearAllDataTrigger = async (type: 'clearOnly' | 'freshUpload') => {
        setClearActionType(type);

        if (type === 'clearOnly') {
            setIsLoading(true);
            const count = await getLedgerCount(ledgerGroupId);
            setIsLoading(false);

            if (count === 0) {
                setNoDataPopupGroup(`${ledgerGroupName} Ledger Group`);
                return;
            }
        }
        setClearFlowStep(1);
        generateCaptcha();
    };

    const handleClearConfirm = () => {
        // Validate CAPTCHA
        const userAnswer = parseInt(captchaInput);
        if (isNaN(userAnswer) || userAnswer !== captchaQuestion.answer) {
            setCaptchaError(true);
            showMessage('error', 'Incorrect Answer', 'The CAPTCHA answer you entered is incorrect. Please try again.');
            return;
        }

        if (clearFlowStep < 3) {
            setClearFlowStep((prev) => (prev + 1) as any);
            generateCaptcha();
        } else {
            setClearFlowStep(4); // Show Credential Popup
        }
    };

    const handleClearCancel = () => {
        setClearFlowStep(0);
        setClearCredentials({ username: '', password: '', reason: '' });
        setCaptchaInput('');
        setCaptchaError(false);
    };

    const handleCredentialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            let deletedCount = 0;
            try {
                const response = await clearAllLedgerData(ledgerGroupId, clearCredentials.username, clearCredentials.password, clearCredentials.reason);
                deletedCount = response.deletedCount || 0;
            } catch (clearError: any) {
                // If clear fails specifically because no data, that's OK for freshUpload
                // But auth errors should still propagate
                if (clearError?.response?.status === 401 || clearError?.response?.status === 403) {
                    throw clearError;
                }
                // Otherwise treat as 0 deleted (DB may have been empty)
                deletedCount = 0;
            }

            if (deletedCount > 0 && clearActionType === 'clearOnly') {
                setClearSuccessInfo({ rowCount: deletedCount, groupName: `${ledgerGroupName} Ledger Group` });
            } else if (deletedCount === 0 && clearActionType === 'clearOnly') {
                showMessage('info', 'No Data Found', `No existing data was found in the database for the ${ledgerGroupName} Ledger Group. Nothing was cleared.`);
            }
            setLedgerData([]);
            setValidationResult(null);
            setMode('idle');

            if (clearActionType === 'freshUpload' && fileInputRef.current) {
                fileInputRef.current.value = '';
                fileInputRef.current.click();
            }

            handleClearCancel();
        } catch (error: any) {
            console.error(error);
            showMessage('error', 'Clear Data Failed', error.response?.data?.message || 'Unable to clear data. Please verify your credentials and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const fetchCountryStates = async () => {
            try {
                const data = await getCountryStates();
                setCountryStates(data);
            } catch (error) {
                console.error('Failed to load country/state data', error);
                showError('Failed to load Country/State master data');
            }
        };

        const fetchSalesRepresentatives = async () => {
            try {
                const data = await getSalesRepresentatives();
                setSalesRepresentatives(data);
            } catch (error) {
                console.error('Failed to load sales representatives', error);
            }
        };

        const fetchDepartments = async () => {
            try {
                const data = await getDepartments();
                console.log('Fetched Departments:', data);
                if (Array.isArray(data)) {
                    setDepartments(data);
                } else {
                    console.error('Departments data is not an array:', data);
                    showError('Failed to load departments: Invalid data format');
                }
            } catch (error) {
                console.error('Failed to load departments', error);
                showError('Failed to load Department master data');
            }
        };

        const fetchClients = async () => {
            try {
                const data = await getClients();
                setClients(data);
            } catch (error) {
                console.error('Failed to load clients', error);
            }
        };

        fetchCountryStates();
        fetchSalesRepresentatives();
        fetchDepartments();
        fetchClients();
    }, []);

    // Reset state when Ledger Group changes
    useEffect(() => {
        setLedgerData([]);
        setMode('idle');
        setValidationResult(null);
        setSelectedRows(new Set());
        setFilterType('all');
        setShowValidationModal(false);
        setValidationModalContent(null);

        setClearFlowStep(0);
        setClearCredentials({ username: '', password: '', reason: '' });

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [ledgerGroupId, ledgerGroupName]);

    // Helper functions for options
    const distinctCountries = useMemo(() => {
        return Array.from(new Set(countryStates.map(cs => cs.country)));
    }, [countryStates]);

    // Validation Map for O(1) lookup by rowIndex
    const validationMap = useMemo(() => {
        if (!validationResult) return new Map<number, LedgerRowValidation>();
        const map = new Map<number, LedgerRowValidation>();
        validationResult.rows.forEach((row: LedgerRowValidation) => {
            if (typeof row.rowIndex === 'number') {
                map.set(row.rowIndex, row);
            }
        });
        return map;
    }, [validationResult]);





    // Helper: Build dropdown params strictly from options
    const getDropdownParams = (options: any[]) => () => {
        const values = ['', ...options.map(o => String(o))];
        return { values };
    };

    // --- AG Grid Setup ---
    const gridApiRef = useRef<GridApi | null>(null);


    // Column Definitions for AG Grid
    const columnDefs: ColDef[] = useMemo(() => {
        const isSupplier = ledgerGroupName?.toLowerCase().includes('supplier') ?? false;
        const isEmployee = ledgerGroupName?.toLowerCase().includes('employee') ?? false;
        const isConsignee = ledgerGroupName?.toLowerCase().includes('consignee') ?? false;
        const isVendor = ledgerGroupName?.toLowerCase().includes('vendors') ?? false;
        const isTransporter = ledgerGroupName?.toLowerCase().includes('transporters') ?? false;

        return [
            {
                field: 'checkbox',
                headerName: '',
                checkboxSelection: true,
                headerCheckboxSelection: true,
                headerCheckboxSelectionFilteredOnly: true,
                width: 20,
                pinned: 'left',
                lockPosition: false,
                resizable: false,
                suppressMenu: true
            },
            {
                headerName: '#',
                valueGetter: "node.rowIndex + 1",
                width: 30,
                pinned: 'left',
                lockPosition: false,
                resizable: true,
                suppressMenu: true
            },
            { field: 'ledgerName', headerName: 'LedgerName', minWidth: 100 },
            { field: 'mailingName', headerName: 'MailingName' },
            // Consignee Specific
            {
                field: 'clientName',
                headerName: 'ClientName',
                hide: !isConsignee,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: getDropdownParams(clients.map(c => c.ledgerName || c.LedgerName || '').filter(Boolean)),
                cellRenderer: DropdownCellRenderer
            },

            { field: 'address1', headerName: 'Address1' },
            { field: 'address2', headerName: 'Address2' },
            { field: 'address3', headerName: 'Address3' },
            {
                field: 'country',
                headerName: 'Country',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: getDropdownParams(distinctCountries),
                cellRenderer: DropdownCellRenderer
            },
            {
                field: 'state',
                headerName: 'State',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: (params: any) => {
                    const selectedCountry = params.data.country;
                    if (!selectedCountry) return { values: [] };

                    const filteredStates = countryStates
                         .filter(cs => cs.country === selectedCountry)
                         .map(cs => cs.state);
                    
                    return { values: [...filteredStates.sort()] };
                },
                cellRenderer: DropdownCellRenderer
            },
            { field: 'city', headerName: 'City' },
            { field: 'pincode', headerName: 'Pincode' },
            { field: 'telephoneNo', headerName: 'TelephoneNo' },
            { field: 'email', headerName: 'Email' },
            { field: 'mobileNo', headerName: 'MobileNo' },
            // Employee Specific Columns
            {
                field: 'dateOfBirth',
                headerName: 'DateOfBirth',
                hide: !isEmployee,
                valueFormatter: (params) => {
                    if (!params.value) return '';
                    // Return formatted date or original string if parsing needed
                    // Assuming backend returns ISO string, or Excel returns string/date
                    // Simple display
                    return params.value;
                }
            },
            { field: 'panNo', headerName: 'PANNo' },
            {
                field: 'departmentName',
                headerName: 'DepartmentName',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: getDropdownParams(departments.map(d => d.departmentName || d.DepartmentName || '').filter(Boolean)),
                cellRenderer: DropdownCellRenderer,
                hide: !isEmployee
            },
            {
                field: 'designation',
                headerName: 'Designation',
                hide: !isEmployee
            },
            // End Employee Specific

            { field: 'website', headerName: 'Website', hide: isEmployee },
            { field: 'gstNo', headerName: 'GSTNo', hide: isEmployee },
            {
                field: 'currencyCode',
                headerName: 'CurrencyCode',
                hide: !isSupplier && !isVendor
            },
            {
                field: 'salesRepresentative',
                headerName: 'SalesRepresentative',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: getDropdownParams(salesRepresentatives.map(sr => sr.employeeName || sr.EmployeeName || '').filter(Boolean)),
                cellRenderer: DropdownCellRenderer,
                hide: isSupplier || isEmployee || isConsignee || isVendor || isTransporter
            },
            { field: 'supplyTypeCode', headerName: 'SupplyTypeCode', hide: isEmployee || isVendor || isTransporter },
            {
                field: 'gstApplicable',
                headerName: 'GSTApplicable',
                cellRenderer: (params: any) => {
                    const val = params.data?.gstApplicable;
                    const isTrue = val === true || val === 'TRUE' || val === 'true';
                    const isFalse = val === false || val === 'FALSE' || val === 'false';
                    
                    const toggleValue = () => {
                        if (mode === 'preview' || mode === 'validated') {
                            params.node.setDataValue('gstApplicable', !isTrue); // Toggle to false if true, true if false or undefined
                        }
                    };

                    if (isTrue) {
                        return (
                            <div className="flex items-center justify-center w-full h-full cursor-pointer" onClick={toggleValue}>
                                <div className="w-5 h-5 bg-green-500 rounded border border-green-600 flex items-center justify-center shadow-sm">
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                            </div>
                        );
                    }
                    
                    if (isFalse) {
                        return (
                            <div className="flex items-center justify-center w-full h-full cursor-pointer" onClick={toggleValue}>
                                <div className="w-5 h-5 bg-white dark:bg-[#1e293b] rounded border border-gray-300 dark:border-gray-600 shadow-sm hover:border-green-400 dark:hover:border-green-500 transition-colors"></div>
                            </div>
                        );
                    }
                    
                    // Invalid value state
                    return (
                        <div className="flex items-center justify-center w-full h-full cursor-pointer" onClick={toggleValue}>
                             <span className="text-purple-600 dark:text-purple-400 text-xs font-bold">{val}</span>
                        </div>
                    );
                },
                cellStyle: (params: any): Record<string, string> | null => {
                    const val = params.data?.gstApplicable;
                    const isValid = val === true || val === false || val === 'TRUE' || val === 'FALSE' || val === 'true' || val === 'false';
                    // Purple highlight for invalid boolean values
                    if (!isValid) {
                        return {
                            backgroundColor: isDark ? 'rgba(147, 51, 234, 0.2)' : '#f3e8ff',
                            color: isDark ? '#e9d5ff' : '#581c87',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        };
                    }
                    // Otherwise use default cellStyle logic
                    const rowIndex = ledgerData.indexOf(params.data);
                    if (rowIndex === -1) return null;
                    const rowValidation = validationMap.get(rowIndex);
                    if (rowValidation?.rowStatus === ValidationStatus.Duplicate) {
                        return { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#fee2e2' };
                    }
                    const cellVal = findLedgerCellValidation(rowValidation, params.colDef.field, params.colDef.headerName);
                    if (cellVal) {
                        const colors: Record<number, string> = {
                            [ValidationStatus.MissingData]: isDark ? 'rgba(37, 99, 235, 0.2)' : '#dbeafe',
                            [ValidationStatus.Mismatch]: isDark ? 'rgba(202, 138, 4, 0.2)' : '#fef9c3',
                            [ValidationStatus.InvalidContent]: isDark ? 'rgba(147, 51, 234, 0.2)' : '#f3e8ff'
                        };
                        const bgColor = colors[cellVal.status];
                        return bgColor ? { backgroundColor: bgColor } : null;
                    }
                    return null;
                },
                tooltipValueGetter: () => null,
                hide: isEmployee || isConsignee || isTransporter
            },
            { field: 'refCode', headerName: 'RefCode', hide: isEmployee || isVendor || isTransporter },
            { field: 'gstRegistrationType', headerName: 'GSTRegistrationType', hide: isEmployee || isConsignee || isVendor || isTransporter },
            { field: 'creditDays', headerName: 'CreditDays', hide: isSupplier || isEmployee || isConsignee || isVendor || isTransporter },
            { field: 'deliveredQtyTolerance', headerName: 'DeliveredQtyTolerance', hide: isEmployee || isConsignee || isVendor || isTransporter },
        ];
    }, [ledgerGroupName, distinctCountries, countryStates, salesRepresentatives, departments, clients]);

    // Helper: find matching CellValidation for a column
    const findLedgerCellValidation = useCallback((rowValidation: LedgerRowValidation | undefined, colField: string | undefined, colHeader: string | undefined) => {
        if (!rowValidation?.cellValidations || rowValidation.cellValidations.length === 0) return null;
        // Match by headerName (exact)
        let cellVal = rowValidation.cellValidations.find((cv: any) => cv.columnName === colHeader);
        // Match by field name (case-insensitive)
        if (!cellVal && colField) {
            cellVal = rowValidation.cellValidations.find((cv: any) =>
                cv.columnName?.toLowerCase() === colField.toLowerCase()
            );
        }
        // Match by headerName (case-insensitive)
        if (!cellVal && colHeader) {
            cellVal = rowValidation.cellValidations.find((cv: any) =>
                cv.columnName?.toLowerCase() === colHeader.toLowerCase()
            );
        }
        return cellVal || null;
    }, []);

    const defaultColDef = useMemo(() => {
        return {
            editable: () => mode === 'preview' || mode === 'validated',
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 50,
            tooltipValueGetter: () => null,
            cellStyle: (params: any): Record<string, string> | null => {
                const rowIndex = ledgerData.indexOf(params.data);
                if (rowIndex === -1) return null;

                const colors = {
                    duplicate: isDark ? 'rgba(220, 38, 38, 0.2)' : '#fee2e2',
                    missing: isDark ? 'rgba(37, 99, 235, 0.2)' : '#dbeafe',
                    mismatch: isDark ? 'rgba(202, 138, 4, 0.2)' : '#fef9c3',
                    invalid: isDark ? 'rgba(147, 51, 234, 0.2)' : '#f3e8ff'
                };

                const rowValidation = validationMap.get(rowIndex);

                if (rowValidation?.rowStatus === ValidationStatus.Duplicate) {
                    return { backgroundColor: colors.duplicate };
                }

                const cellVal = findLedgerCellValidation(rowValidation, params.colDef.field, params.colDef.headerName);
                if (cellVal) {
                    if (cellVal.status === ValidationStatus.MissingData) return { backgroundColor: colors.missing };
                    if (cellVal.status === ValidationStatus.Mismatch) return { backgroundColor: colors.mismatch };
                    if (cellVal.status === ValidationStatus.InvalidContent) {
                        return {
                            backgroundColor: colors.invalid,
                            borderBottom: '2px solid #9333ea',
                            borderRight: '2px solid #9333ea'
                        };
                    }
                }
                return null;
            }
        };
    }, [mode, validationMap, isDark, ledgerData, findLedgerCellValidation]);

    const handleCellEdit = useCallback((rowIndex: number, field: keyof LedgerMasterDto, newValue: any) => {
        setLedgerData(prevData => {
            const newData = [...prevData];
            newData[rowIndex] = { ...newData[rowIndex], [field]: newValue };
            return newData;
        });
    }, []);

    const handleCountryChange = useCallback((rowIndex: number, newCountry: string) => {
        setLedgerData(prevData => {
            const newData = [...prevData];
            newData[rowIndex] = { ...newData[rowIndex], country: newCountry, state: '' }; // Reset state if country changes
            return newData;
        });
    }, []);

    const onCellValueChanged = useCallback((params: any) => {
        const { colDef, newValue, data } = params;
        const rowIndex = ledgerData.indexOf(data);

        // Safety check to ensure we found the row
        if (rowIndex === -1) {
            console.error('Row data not found in state');
            return;
        }

        const field = colDef.field as keyof LedgerMasterDto;

        if (field === 'country') {
            handleCountryChange(rowIndex, newValue);
        } else {
            handleCellEdit(rowIndex, field, newValue);
        }
    }, [handleCountryChange, handleCellEdit, ledgerData]);

    const onSelectionChanged = useCallback((event: any) => {
        const selectedNodes = event.api.getSelectedNodes();
        const selectedIndices = new Set<number>(selectedNodes.map((node: any) => node.rowIndex));
        setSelectedRows(selectedIndices);
    }, []);

    const rowClassRules = useMemo<RowClassRules>(() => ({
        'bg-red-50 dark:bg-red-900/10': (params) => {
            if (validationMap.size === 0) return false;
            const rowIndex = ledgerData.indexOf(params.data);
            if (rowIndex === -1) return false;
            return validationMap.get(rowIndex)?.rowStatus === ValidationStatus.Duplicate;
        },
        'font-medium': (params) => {
            if (validationMap.size === 0) return false;
            const rowIndex = ledgerData.indexOf(params.data);
            if (rowIndex === -1) return false;
            return validationMap.get(rowIndex)?.rowStatus === ValidationStatus.Duplicate;
        }
    }), [validationMap, ledgerData]);

    const onGridReady = (params: any) => {
        gridApiRef.current = params.api;
    };


    // External Filter Logic
    const isExternalFilterPresent = useCallback(() => {
        return filterType !== 'all';
    }, [filterType]);

    const doesExternalFilterPass = useCallback((node: IRowNode) => {
        if (!validationResult || filterType === 'all') return true;

        const rowIndex = ledgerData.indexOf(node.data);
        if (rowIndex === -1) return true;

        const rowValidation = validationMap.get(rowIndex);
        if (!rowValidation) return false;

        switch (filterType) {
            case 'valid': return rowValidation.rowStatus === ValidationStatus.Valid;
            case 'duplicate': return rowValidation.rowStatus === ValidationStatus.Duplicate;
            // Check cellValidations so duplicate rows with missing/mismatch/invalid also appear in those sections
            case 'missing': return rowValidation.cellValidations?.some((cv: any) => cv.status === ValidationStatus.MissingData) ?? false;
            case 'mismatch': return rowValidation.cellValidations?.some((cv: any) => cv.status === ValidationStatus.Mismatch) ?? false;
            case 'invalid': return rowValidation.cellValidations?.some((cv: any) => cv.status === ValidationStatus.InvalidContent) ?? false;
            default: return true;
        }
    }, [validationResult, validationMap, filterType]);

    // Trigger filter update when filterType changes
    // Trigger filter update when filterType changes or validation/data updates
    // Trigger redraw when validation results or data changes
    useEffect(() => {
        if (gridApiRef.current) {
            gridApiRef.current.redrawRows();
        }
    }, [validationResult, ledgerData, validationMap]);

    // Trigger filter update when filterType changes
    useEffect(() => {
        if (gridApiRef.current) {
            gridApiRef.current.onFilterChanged();
        }
    }, [filterType]);


    const handleLoadData = async () => {
        // Strict Mode Check
        if (mode === 'preview' || mode === 'validated') {
            setPendingMode({
                type: 'load',
                action: () => performLoadData()
            });
            setShowModeSwitchModal(true);
            return;
        }
        performLoadData();
    };

    const performLoadData = async () => {
        setIsLoading(true);
        try {
            const data = await getLedgersByGroup(ledgerGroupId);
            setLedgerData(data);
            setMode('loaded');
            setValidationResult(null); // Clear validation
            setSelectedRows(new Set()); // Clear selection
            if (data.length > 0) {
                showMessage('success', 'Data Loaded', `Successfully loaded ${data.length} ledger record(s) for the ${ledgerGroupName} group.`);
            }
        } catch (error: any) {
            showError(error?.response?.data?.error || 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelectTrigger = () => {
        // Strict Mode Check: If in Loaded mode, confirm switch
        if (mode === 'loaded') {
            setPendingMode({
                type: 'upload',
                action: () => {
                    // Reset state for upload
                    setLedgerData([]);
                    setMode('idle');
                    setValidationResult(null);
                    setSelectedRows(new Set());
                    if (fileInputRef.current) fileInputRef.current.click();
                }
            });
            setShowModeSwitchModal(true);
            return;
        }

        // Re-Upload Confirmation (Excel Mode)
        if (ledgerData.length > 0 && (mode === 'preview' || mode === 'validated')) {
            setShowReUploadModal(true);
            return;
        }

        // Otherwise just click
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const confirmReUpload = () => {
        setShowReUploadModal(false);
        setLedgerData([]);
        setValidationResult(null);
        setMode('idle');
        setSelectedRows(new Set());
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset input
            fileInputRef.current.click();
        }
    };



    const handleRemoveRow = async () => {
        const selectedNodes = gridApiRef.current?.getSelectedNodes() || [];
        if (selectedNodes.length === 0) {
            showError('Please select at least one row to remove');
            return;
        }

        if (!window.confirm(`Are you sure you want to remove ${selectedNodes.length} ledger(s)?`)) {
            return;
        }

        // Gather indices or IDs to remove
        // Important: Use node.rowIndex if we assume 1:1 mapping with ledgerData (checked via isExternalFilterPresent)
        // With filtering, rowIndex might not match original index?
        // Actually, if we use rowData={ledgerData}, node.rowIndex corresponds to index in ledgerData IF no sorting/filtering is active?
        // NO, sorting changes row index in view.
        // We must identify rows by reference or add an ID.
        // Since ledgerData objects are references, we can find them.

        const selectedData = selectedNodes.map(node => node.data);
        const selectedIndices = new Set(selectedData.map(d => ledgerData.indexOf(d)).filter(i => i !== -1));

        if (mode === 'preview' || mode === 'validated') {
            const selectedIndicesList = Array.from(selectedIndices).sort((a, b) => b - a);
            const selectedSet = new Set(selectedIndicesList);

            // 1. Update data
            const newLedgerData = ledgerData.filter((_, index) => !selectedSet.has(index));
            setLedgerData(newLedgerData);
            setSelectedRows(new Set());

            // 2. Update validationResult (if exists)
            if (validationResult) {
                const oldRows = validationResult.rows;
                const newRows: LedgerRowValidation[] = [];
                const summary = { ...validationResult.summary };

                // Map to track index shifts
                const indexMap = new Map<number, number>();
                let shift = 0;
                for (let i = 0; i < ledgerData.length; i++) {
                    if (selectedSet.has(i)) {
                        shift++;
                    } else {
                        indexMap.set(i, i - shift);
                    }
                }

                // Filter and re-index rows
                oldRows.forEach(row => {
                    if (selectedSet.has(row.rowIndex)) {
                        // This row was deleted
                        summary.totalRows--;
                        if (row.rowStatus === ValidationStatus.Duplicate) summary.duplicateCount--;
                        else if (row.rowStatus === ValidationStatus.Valid) summary.validRows--;

                        row.cellValidations?.forEach((cv: any) => {
                            if (cv.status === ValidationStatus.MissingData) summary.missingDataCount--;
                            else if (cv.status === ValidationStatus.Mismatch) summary.mismatchCount--;
                            else if (cv.status === ValidationStatus.InvalidContent) summary.invalidContentCount--;
                        });
                    } else {
                        newRows.push({
                            ...row,
                            rowIndex: indexMap.get(row.rowIndex)!
                        });
                    }
                });

                summary.totalRows = Math.max(0, summary.totalRows);
                summary.duplicateCount = Math.max(0, summary.duplicateCount);
                summary.missingDataCount = Math.max(0, summary.missingDataCount);
                summary.mismatchCount = Math.max(0, summary.mismatchCount);
                summary.invalidContentCount = Math.max(0, summary.invalidContentCount);
                summary.validRows = Math.max(0, summary.validRows);

                const isStillValid = summary.duplicateCount === 0 &&
                    summary.missingDataCount === 0 &&
                    summary.mismatchCount === 0 &&
                    summary.invalidContentCount === 0;

                setValidationResult({
                    ...validationResult,
                    rows: newRows,
                    summary: summary,
                    isValid: isStillValid
                });

                if (mode === 'validated') {
                    // Stay in validated mode
                } else {
                    setMode('preview');
                }
            } else {
                setMode('preview');
            }

            showMessage('info', 'Rows Removed', `${selectedIndicesList.length} row(s) have been removed from the preview.`);
            return;
        }

        setIsLoading(true);
        try {
            const rowsToDelete = selectedData;

            let deletedCount = 0;
            for (const ledger of rowsToDelete) {
                if (ledger.ledgerID) {
                    await softDeleteLedger(ledger.ledgerID);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                showMessage('success', 'Records Deleted', `${deletedCount} ledger record(s) have been successfully removed from the database.`);
                await handleLoadData();
            } else {
                showMessage('warning', 'Nothing Deleted', 'No database records were found for deletion. Please select rows that exist in the database.');
            }
        } catch (error: any) {
            showError(error?.response?.data?.error || 'Failed to remove ledgers');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Step 1: File Extension Check
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (extension !== '.xlsx') {
            showMessage('error', 'Invalid Excel Version',
                'Your Excel file format is not supported.\n\nPlease upload file in .xlsx format only.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Step 2: File Name Validation
        const expectedName = ledgerGroupName;
        const actualNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')).trim();
        if (expectedName && actualNameWithoutExt.toLowerCase() !== expectedName.trim().toLowerCase()) {
            showMessage('error', 'Invalid File Name',
                `You have selected wrong file.\n\nPlease upload correct file for selected Module and Group.\n\nExpected: ${expectedName}.xlsx`);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const workbook = XLSX.read(event.target?.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // ── Column format validation ──────────────────────────────
                // Read headers directly from row 1 cells — includes headers even when columns have no data rows
                const uploadedColumns: string[] = (() => {
                    const ref = worksheet['!ref'];
                    if (!ref) return jsonData.length > 0 ? Object.keys(jsonData[0] as object) : [];
                    const { s, e } = XLSX.utils.decode_range(ref);
                    const cols: string[] = [];
                    for (let c = s.c; c <= e.c; c++) {
                        const cell = worksheet[XLSX.utils.encode_cell({ r: s.r, c })];
                        if (cell?.v !== undefined && String(cell.v).trim() !== '') cols.push(String(cell.v));
                    }
                    return cols;
                })();
                const colValidation = validateExcelColumns(uploadedColumns, getLedgerStandardColumns(ledgerGroupName || ''));
                if (!colValidation.isValid) {
                    showMessage('error', 'Invalid Excel Format', colValidation.message);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }
                // ─────────────────────────────────────────────────────────

                const ledgers: LedgerMasterDto[] = jsonData.map((row: any) => {
                    let country = row.Country;
                    let state = row.State;

                    if (country) {
                        const masterCountryPair = countryStates.find(cs => cs.country.trim().toLowerCase() === country.toString().trim().toLowerCase());
                        if (masterCountryPair) {
                            country = masterCountryPair.country;

                            if (state) {
                                const masterStatePair = countryStates.find(cs =>
                                    cs.country === country &&
                                    cs.state.trim().toLowerCase() === state.toString().trim().toLowerCase()
                                );
                                if (masterStatePair) {
                                    state = masterStatePair.state;
                                }
                            }
                        }
                    }

                    // Strict boolean validation: only accept true/false (case-insensitive), normalize to uppercase
                    let gstApplicable: any = true;
                    if (row.GSTApplicable !== undefined && row.GSTApplicable !== null && row.GSTApplicable !== '') {
                        const val = String(row.GSTApplicable).trim().toLowerCase();
                        if (val === 'true') {
                            gstApplicable = 'TRUE';
                        } else if (val === 'false') {
                            gstApplicable = 'FALSE';
                        } else {
                            // Invalid value - keep as-is for validation to catch
                            gstApplicable = row.GSTApplicable;
                        }
                    } else {
                        gstApplicable = 'TRUE'; // Default
                    }

                    let supplyTypeCode = 'B2B';
                    if (row.SupplyTypeCode !== undefined && row.SupplyTypeCode !== null && row.SupplyTypeCode !== '') {
                        supplyTypeCode = row.SupplyTypeCode;
                    }

                    // Format DateOfBirth
                    let dateOfBirth = row.DateOfBirth;
                    if (dateOfBirth && typeof dateOfBirth === 'number') {
                        // Excel serial date to JS Date
                        const date = new Date(Math.round((dateOfBirth - 25569) * 86400 * 1000));
                        dateOfBirth = date.toISOString().split('T')[0];
                    }

                    // Determine DepartmentName and Designation with fallback
                    // Sometimes Excel headers might have spaces or case differences
                    const departmentName = row.DepartmentName || row['Department Name'] || row['DEPARTMENT NAME'] || row.departmentname;
                    const designation = row.Designation || row.designation || row.DESIGNATION;

                    // ClientName for Consignee
                    const clientName = row.ClientName || row['Client Name'] || row.clientName;

                    const refCode = row.RefCode || '';

                    let gstRegistrationType = 'Regular';
                    if (row.GSTRegistrationType !== undefined && row.GSTRegistrationType !== null && row.GSTRegistrationType !== '') {
                        gstRegistrationType = row.GSTRegistrationType;
                    }

                    let creditDays: string | undefined = undefined;
                    if (row.CreditDays !== undefined && row.CreditDays !== null && row.CreditDays !== '') {
                        creditDays = String(row.CreditDays);
                    }

                    // LegalName and MailingAddress are NOT generated here at upload time.
                    // They will be regenerated at Save Data time using validated/corrected values.

                    // Helper to safely convert to string
                    const toStr = (v: any) => (v !== undefined && v !== null && v !== '') ? String(v) : undefined;

                    return {
                        ledgerGroupID: ledgerGroupId,
                        ledgerName: toStr(row.LedgerName),
                        mailingName: toStr(row.MailingName),
                        legalName: '', // Will be regenerated at Save Data time
                        mailingAddress: '', // Will be regenerated at Save Data time
                        address1: toStr(row.Address1),
                        address2: toStr(row.Address2),
                        address3: toStr(row.Address3),
                        country: toStr(country),
                        state: toStr(state),
                        city: toStr(row.City),
                        pincode: toStr(row.Pincode),
                        telephoneNo: toStr(row.TelephoneNo),
                        email: toStr(row.Email),
                        mobileNo: toStr(row.MobileNo),
                        website: toStr(row.Website),
                        panNo: toStr(row.PANNo),
                        gstNo: toStr(row.GSTNo),
                        salesRepresentative: toStr(row.SalesRepresentative),
                        supplyTypeCode: String(supplyTypeCode),
                        gstApplicable: gstApplicable,
                        refCode: String(refCode),
                        gstRegistrationType: String(gstRegistrationType),
                        creditDays: creditDays,
                        deliveredQtyTolerance: (row.DeliveredQtyTolerance && !isNaN(parseFloat(row.DeliveredQtyTolerance))) ? parseFloat(row.DeliveredQtyTolerance) : undefined,
                        currencyCode: toStr(row.CurrencyCode),

                        // Employee Fields
                        departmentName: toStr(departmentName),
                        designation: toStr(designation),
                        dateOfBirth: toStr(dateOfBirth),

                        // Consignee Fields
                        clientName: toStr(clientName)
                    };
                }).filter(item => {
                    // Remove empty rows: check if any core field has actual data
                    return !!(
                        item.ledgerName || item.mailingName || item.address1 ||
                        item.city || item.gstNo || item.mobileNo || item.email ||
                        item.panNo || item.clientName || item.departmentName
                    );
                });

                setLedgerData(ledgers);
                setMode('preview');
                showMessage('success', 'File Loaded', `Successfully loaded ${ledgers.length} row(s) from the Excel file. Please click "Check Validation" before importing.`);
            } catch (error) {
                showError('Failed to parse Excel file');
                console.error(error);
            }
        };
        reader.readAsBinaryString(file);
    };

    // Build MailingAddress string from individual address fields (used at Save Data time)
    const buildMailingAddress = useCallback((item: any): string => {
        const addressParts = [item.address1, item.address2, item.address3]
            .filter((p: any) => p && p.toString().trim() !== '');

        const cityPinParts: string[] = [];
        if (item.city && item.city.toString().trim() !== '') cityPinParts.push(item.city);
        if (item.pincode && item.pincode.toString().trim() !== '') cityPinParts.push(item.pincode);
        if (cityPinParts.length > 0) addressParts.push(cityPinParts.join('-'));

        const stateCountryParts: string[] = [];
        if (item.state && item.state.toString().trim() !== '') stateCountryParts.push(item.state);
        if (item.country && item.country.toString().trim() !== '') stateCountryParts.push(item.country);
        if (stateCountryParts.length > 0) addressParts.push(stateCountryParts.join(' - '));

        return addressParts.join(', ');
    }, []);

    // Reusable: clean ledger data for API — extracts invalid numeric/bool values into rawValues
    const cleanLedgerDataForApi = useCallback((data: any[]) => {
        const numericFields = new Set(['deliveredQtyTolerance', 'distance']);
        const boolFields = new Set(['gstApplicable']);

        return data.map(item => {
            const cleaned: any = {};
            const rawValues: Record<string, string> = {};

            Object.keys(item).forEach(key => {
                const value = item[key];
                if (value === undefined || value === null || value === '') return;

                if (numericFields.has(key)) {
                    const strVal = String(value).trim();
                    if (strVal === '') return;
                    if (!isNaN(Number(strVal))) {
                        cleaned[key] = Number(strVal);
                    } else {
                        rawValues[key] = strVal;
                    }
                } else if (boolFields.has(key)) {
                    const strVal = String(value).trim();
                    // Only accept uppercase TRUE or FALSE (already normalized from Excel)
                    if (strVal === 'TRUE') {
                        cleaned[key] = true;
                    } else if (strVal === 'FALSE') {
                        cleaned[key] = false;
                    } else {
                        // Invalid boolean value - send to rawValues for purple highlighting
                        rawValues[key] = strVal;
                    }
                } else {
                    // Ensure all string fields are sent as strings
                    cleaned[key] = typeof value === 'number' ? String(value) : value;
                }
            });

            if (Object.keys(rawValues).length > 0) {
                cleaned.rawValues = rawValues;
            }
            return cleaned;
        });
    }, []);

    const handleCheckValidation = async () => {
        if (ledgerData.length === 0) {
            showError('No data to validate');
            return;
        }

        setIsLoading(true);
        setValidationResult(null); // Reset UI first

        try {
            const cleanedData = cleanLedgerDataForApi(ledgerData);
            const result = await validateLedgers(cleanedData, ledgerGroupId);
            setValidationResult(result);

            if (result.isValid) {
                showMessage('success', 'Validation Passed', 'All records passed validation successfully. The data is ready to be imported.');
            } else {
                const totalIssues = result.summary.duplicateCount + result.summary.missingDataCount + result.summary.mismatchCount + result.summary.invalidContentCount;

                // Aggregate failures by column
                const columnFailures = new Map<string, Set<string>>();

                result.rows.forEach((row: LedgerRowValidation) => {
                    // 1. Handle Duplicates (Row Level)
                    if (row.rowStatus === ValidationStatus.Duplicate) {
                        // Attribute duplicate to LedgerName as primary indicator
                        const col = 'LedgerName';
                        if (!columnFailures.has(col)) columnFailures.set(col, new Set());
                        columnFailures.get(col)!.add('Duplicate data found');
                    }

                    // 2. Handle Cell Validations
                    if (row.cellValidations && row.cellValidations.length > 0) {
                        row.cellValidations.forEach((cell: any) => {
                            const col = cell.columnName || 'Unknown';
                            if (!columnFailures.has(col)) columnFailures.set(col, new Set());

                            let reason = 'Invalid';
                            if (cell.status === ValidationStatus.MissingData) reason = 'Missing';
                            else if (cell.status === ValidationStatus.Mismatch) reason = 'Master Mismatch';
                            else if (cell.status === ValidationStatus.InvalidContent) reason = 'Invalid Format';

                            columnFailures.get(col)!.add(reason);
                        });
                    }
                });

                // Construct Message
                const messages: string[] = [];
                columnFailures.forEach((reasons, col) => {
                    messages.push(`${col} – ${Array.from(reasons).join(', ')}`);
                });

                setValidationModalContent({
                    title: `Validation Failed: ${totalIssues} Issue${totalIssues !== 1 ? 's' : ''} Found`,
                    messages: messages.length > 0 ? messages : ['Please review the grid for specific issues that were not attributed to specific columns.']
                });
                setShowValidationModal(true);
            }
        } catch (error: any) {
            showError(error?.response?.data?.error || 'Validation failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        if (ledgerData.length === 0) {
            showError('No data to import');
            return;
        }

        const total = ledgerData.length;

        // ── Step 1: Validation ─────────────────────────────────────────────
        setImportProgress({ active: true, step: 'Validating data…', pct: 5, total });
        setIsLoading(true);
        // Clear old validation errors to prevent showing stale messages after successful import
        setValidationModalContent(null);

        try {
            const cleanedForValidation = cleanLedgerDataForApi(ledgerData);
            const result = await validateLedgers(cleanedForValidation, ledgerGroupId);
            setValidationResult(result);

            // ── Only block on DUPLICATES — other issues (mismatch, missing, invalid) are
            // ── handled by the backend which skips bad rows and reports them in errorMessages.
            const duplicateRows = result.rows.filter((r: LedgerRowValidation) => r.rowStatus === ValidationStatus.Duplicate);
            if (duplicateRows.length > 0) {
                setImportProgress(null);
                const dupNames = duplicateRows
                    .map((r: LedgerRowValidation) => r.data?.ledgerName || `Row ${r.rowIndex + 1}`)
                    .slice(0, 20);
                setValidationModalContent({
                    title: `Import Blocked: ${duplicateRows.length} Duplicate${duplicateRows.length !== 1 ? 's' : ''} Found`,
                    messages: [
                        `${duplicateRows.length} record(s) already exist in the database and cannot be imported:`,
                        ...dupNames,
                        ...(duplicateRows.length > 20 ? [`...and ${duplicateRows.length - 20} more`] : [])
                    ]
                });
                setShowValidationModal(true);
                showError(`Import blocked: ${duplicateRows.length} duplicate record(s) found. Remove duplicates and try again.`);
                return;
            }

            // ── Step 2: Uploading (bulk insert happens server-side) ───────────
            setImportProgress({ active: true, step: `Uploading ${total.toLocaleString()} rows to database…`, pct: 30, total });

            // Animate progress bar while server is working
            let animPct = 30;
            const animInterval = setInterval(() => {
                animPct = Math.min(animPct + 2, 88); // never quite hit 100 until done
                setImportProgress(prev =>
                    prev ? { ...prev, pct: animPct, step: `Uploading ${total.toLocaleString()} rows to database…` } : prev
                );
            }, 400);

            let importRes: any;
            try {
                const cleanedForImport = cleanLedgerDataForApi(ledgerData);
                // Regenerate derived strings at save time using validated/corrected values
                cleanedForImport.forEach((item: any) => {
                    item.mailingAddress = buildMailingAddress(item);
                    item.legalName = item.mailingName || item.ledgerName || '';
                });
                importRes = await importLedgers(cleanedForImport, ledgerGroupId);
            } finally {
                clearInterval(animInterval);
            }

            // ── Step 3: Finalizing ───────────────────────────────────────────
            setImportProgress({ active: true, step: 'Finalizing…', pct: 95, total });
            await new Promise(r => setTimeout(r, 400)); // brief visual pause
            setImportProgress(null);

            if (importRes.success) {
                setSuccessInfo({
                    groupName: ledgerGroupName,
                    totalRows: ledgerData.length,
                    insertedRows: importRes.importedRows ?? ledgerData.length,
                    failedRows: importRes.errorRows ?? 0,
                    errorMessages: importRes.errorMessages ?? [],
                });
            } else {
                if (importRes.errorMessages?.length > 0) {
                    setValidationModalContent({ title: 'Import Failed', messages: importRes.errorMessages });
                    setShowValidationModal(true);
                } else {
                    showError(importRes.message || 'Import failed');
                }
            }
        } catch (error: any) {
            setImportProgress(null);
            showError(error?.response?.data?.error || 'Import failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(ledgerGroupName || 'Sheet1');

        const isSupplier = ledgerGroupName?.toLowerCase().includes('supplier');
        const isEmployee = ledgerGroupName?.toLowerCase().includes('employee');
        const isConsignee = ledgerGroupName?.toLowerCase().includes('consignee');
        const isVendor = ledgerGroupName?.toLowerCase().includes('vendors');
        const isTransporter = ledgerGroupName?.toLowerCase().includes('transporters');

        const exportColumns = [
            'LedgerName', 'MailingName'
        ];

        if (isConsignee) {
            exportColumns.push('ClientName');
        }

        exportColumns.push('Address1', 'Address2', 'Address3', 'Country', 'State', 'City', 'Pincode', 'TelephoneNo', 'Email', 'MobileNo');

        if (isEmployee) {
            exportColumns.push('DateOfBirth');
            exportColumns.push('PANNo');
            exportColumns.push('DepartmentName');
            exportColumns.push('Designation');
        } else {
            // Supplier, Customer, Consignee
            exportColumns.push('Website');
            exportColumns.push('PANNo');
            exportColumns.push('GSTNo');
        }

        if (isSupplier || isVendor) {
            exportColumns.push('CurrencyCode');
        } else if (!isEmployee && !isConsignee && !isTransporter) {
            exportColumns.push('SalesRepresentative');
        }

        if (!isEmployee) {
            if (!isVendor && !isTransporter) {
                exportColumns.push('SupplyTypeCode');
            }

            if (!isConsignee && !isTransporter) {
                exportColumns.push('GSTApplicable');
                if (!isVendor) {
                    exportColumns.push('GSTRegistrationType');
                }
            }
            if (!isVendor && !isTransporter) {
                exportColumns.push('RefCode');
            }
        }

        if (!isSupplier && !isEmployee && !isConsignee && !isVendor && !isTransporter) {
            exportColumns.push('CreditDays');
        }

        if (!isEmployee && !isConsignee && !isVendor && !isTransporter) {
            exportColumns.push('DeliveredQtyTolerance');
        }

        worksheet.columns = exportColumns.map(col => ({ header: col, key: col, width: 20 }));
        worksheet.getRow(1).font = { bold: true };

        const exportColors = {
            duplicate: 'FFFFE0E0',
            missing: 'FFD0E8FF',
            mismatch: 'FFFFFF99',
            invalid: 'FFE8D0FF'
        };

        const passesExportFilter = (rowIndex: number): boolean => {
            if (filterType === 'all' || !validationResult) return true;
            const v = validationMap.get(rowIndex);
            if (!v) return filterType === 'valid';
            switch (filterType) {
                case 'valid': return v.rowStatus === ValidationStatus.Valid;
                case 'duplicate': return v.rowStatus === ValidationStatus.Duplicate;
                case 'missing': return v.cellValidations?.some((cv: any) => cv.status === ValidationStatus.MissingData) ?? false;
                case 'mismatch': return v.cellValidations?.some((cv: any) => cv.status === ValidationStatus.Mismatch) ?? false;
                case 'invalid': return v.cellValidations?.some((cv: any) => cv.status === ValidationStatus.InvalidContent) ?? false;
                default: return true;
            }
        };

        ledgerData.forEach((ledger, rowIndex) => {
            if (!passesExportFilter(rowIndex)) return;
            const rowValues: any = {
                LedgerName: ledger.ledgerName,
                MailingName: ledger.mailingName,
                Address1: ledger.address1,
                Address2: ledger.address2,
                Address3: ledger.address3,
                Country: ledger.country,
                State: ledger.state,
                City: ledger.city,
                Pincode: ledger.pincode,
                TelephoneNo: ledger.telephoneNo,
                Email: ledger.email,
                MobileNo: ledger.mobileNo,
                PANNo: ledger.panNo
            };

            if (isConsignee) {
                rowValues.ClientName = ledger.clientName;
            }

            if (isEmployee) {
                rowValues.DateOfBirth = ledger.dateOfBirth;
                rowValues.DepartmentName = ledger.departmentName;
                rowValues.Designation = ledger.designation;
            } else {
                rowValues.Website = ledger.website;
                rowValues.GSTNo = ledger.gstNo;
                rowValues.PANNo = ledger.panNo; // Ensure PAN is mapped
                if (!isVendor && !isTransporter) {
                    rowValues.RefCode = ledger.refCode;
                }

                if (!isConsignee && !isTransporter) {
                    rowValues.GSTApplicable = ledger.gstApplicable;
                    if (!isVendor) {
                        rowValues.GSTRegistrationType = ledger.gstRegistrationType;
                        rowValues.DeliveredQtyTolerance = ledger.deliveredQtyTolerance;
                    }
                }

                // SupplyTypeCode logic
                if (!isEmployee && !isVendor && !isTransporter) {
                    rowValues.SupplyTypeCode = ledger.supplyTypeCode;
                }
            }

            if (isSupplier || isVendor) {
                rowValues.CurrencyCode = ledger.currencyCode;
            } else if (!isEmployee && !isConsignee && !isTransporter) {
                rowValues.SalesRepresentative = ledger.salesRepresentative;
                rowValues.CreditDays = ledger.creditDays;
            }

            const excelRow = worksheet.addRow(rowValues);

            const rowValidation = validationMap.get(rowIndex);
            if (rowValidation) {
                if (rowValidation.rowStatus === ValidationStatus.Duplicate) {
                    excelRow.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: exportColors.duplicate } };
                    });
                } else {
                    rowValidation.cellValidations?.forEach((cellVal: any) => {
                        const colIdx = exportColumns.findIndex(c => c.toLowerCase() === cellVal.columnName.toLowerCase()) + 1;
                        if (colIdx > 0) {
                            const cell = excelRow.getCell(colIdx);
                            let argb = '';
                            if (cellVal.status === ValidationStatus.MissingData) argb = exportColors.missing;
                            else if (cellVal.status === ValidationStatus.Mismatch) argb = exportColors.mismatch;
                            else if (cellVal.status === ValidationStatus.InvalidContent) argb = exportColors.invalid;
                            if (argb) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
                        }
                    });
                }
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `${ledgerGroupName}.xlsx`);
        showMessage('success', 'Export Complete', 'The data has been exported to an Excel file and downloaded successfully.');
    };

    // Display rows now handled by AG Grid Filtering

    // Display rows now handled by AG Grid Filtering
    // const displayRows = getFilteredRows(); moved to doesExternalFilterPass logic



    return (
        <div className="space-y-4">

            {/* ⏳ Import Progress Overlay */}
            {importProgress?.active && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-1.5 w-full" />
                        <div className="p-8 text-center">
                            {/* Spinner */}
                            <div className="mx-auto mb-5 w-16 h-16 rounded-full border-4 border-blue-100 dark:border-blue-900/40 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Saving Data</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{importProgress.step}</p>

                            {/* Progress bar */}
                            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 mb-3 overflow-hidden">
                                <div
                                    className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
                                    style={{ width: `${importProgress.pct}%` }}
                                />
                            </div>
                            <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
                                {importProgress.pct}% &bull; {importProgress.total.toLocaleString()} rows
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ Import Summary Popup Modal */}
            {successInfo && (() => {
                const allSucceeded = successInfo.failedRows === 0;
                const downloadErrors = () => {
                    if (!successInfo.errorMessages.length) return;
                    const csvRows = ['Row,Error Reason', ...successInfo.errorMessages.map((msg, idx) => `"${idx + 1}","${msg.replace(/"/g, '""')}"`)]
                    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url;
                    a.download = `Import_Errors_${successInfo.groupName.replace(/\s+/g, '_')}.csv`;
                    a.click(); URL.revokeObjectURL(url);
                };
                return (
                    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 dark:border-gray-700 overflow-hidden">

                            {/* Top stripe */}
                            <div className={`h-2 w-full bg-gradient-to-r ${allSucceeded ? 'from-green-500 to-emerald-500' : 'from-amber-400 to-orange-500'}`} />

                            <div className="p-7">
                                {/* Header icon + title */}
                                <div className="flex flex-col items-center mb-6">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ring-8 ${allSucceeded ? 'bg-green-100 dark:bg-green-900/30 ring-green-50 dark:ring-green-900/10' : 'bg-amber-100 dark:bg-amber-900/30 ring-amber-50 dark:ring-amber-900/10'}`}>
                                        {allSucceeded
                                            ? <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                            : <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                                        }
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Import Completed!</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        <span className="font-semibold text-gray-700 dark:text-gray-300">{successInfo.groupName}</span> Ledger Group
                                    </p>
                                </div>

                                {/* Stats grid */}
                                <div className="grid grid-cols-3 gap-3 mb-5">
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Rows</p>
                                        <p className="text-2xl font-extrabold text-gray-800 dark:text-white">{successInfo.totalRows.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center border border-green-100 dark:border-green-800">
                                        <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">✅ Inserted</p>
                                        <p className="text-2xl font-extrabold text-green-700 dark:text-green-400">{successInfo.insertedRows.toLocaleString()}</p>
                                    </div>
                                    <div className={`rounded-xl p-3 text-center ${successInfo.failedRows > 0 ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-800'}`}>
                                        <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${successInfo.failedRows > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>❌ Failed</p>
                                        <p className={`text-2xl font-extrabold ${successInfo.failedRows > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>{successInfo.failedRows.toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Error list */}
                                {successInfo.errorMessages.length > 0 && (
                                    <div className="mb-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                ⚠️ Failed Row Details ({successInfo.errorMessages.length})
                                            </p>
                                            <button
                                                onClick={downloadErrors}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg transition-colors"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8-4-4m4 4 4-4M4 20h16" /></svg>
                                                Download CSV
                                            </button>
                                        </div>
                                        <div className="max-h-44 overflow-y-auto rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 divide-y divide-red-100 dark:divide-red-900/30">
                                            {successInfo.errorMessages.map((msg, idx) => (
                                                <div key={idx} className="flex items-start gap-2 px-3 py-2">
                                                    <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                                                    <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{msg}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* OK button */}
                                <button
                                    onClick={() => {
                                        setSuccessInfo(null);
                                        setLedgerData([]);
                                        setValidationResult(null);
                                        setMode('idle');
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className={`w-full px-6 py-3 font-semibold rounded-xl text-white text-base transition-all duration-200 active:scale-95 shadow-md ${allSucceeded ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-200 dark:shadow-green-900/30' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-200 dark:shadow-amber-900/30'}`}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}


            {/* 🗑️ Clear All Data Success Popup */}
            {clearSuccessInfo && (
                <ClearSuccessPopup
                    rowCount={clearSuccessInfo.rowCount}
                    groupName={clearSuccessInfo.groupName}
                    onClose={() => {
                        setClearSuccessInfo(null);
                        setLedgerData([]);
                        setValidationResult(null);
                        setMode('idle');
                        setFilterType('all');
                        setSelectedRows(new Set());
                        if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                />
            )}

            {/* ⚠️ No Data Found Popup (clearOnly when DB has 0 records) */}
            {noDataPopupGroup && (
                <NoDataPopup
                    groupName={noDataPopupGroup}
                    onClose={() => setNoDataPopupGroup(null)}
                />
            )}

            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleLoadData}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                    <Database className="w-4 h-4" />
                    Load Data
                </button>

                <button
                    onClick={() => handleClearAllDataTrigger('clearOnly')}
                    disabled={isLoading || selectedRows.size > 0}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                    <XCircle className="w-4 h-4" />
                    Clear All Data
                </button>

                {mode === 'loaded' ? (
                    <button
                        onClick={handleRemoveRow}
                        disabled={isLoading || selectedRows.size === 0}
                        className="px-4 py-2 bg-[#D2691E] text-white rounded-lg hover:bg-[#A55217] disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Soft Delete ({selectedRows.size})
                    </button>
                ) : (mode === 'preview' || mode === 'validated') && (
                    <button
                        onClick={handleRemoveRow}
                        disabled={isLoading || selectedRows.size === 0}
                        className="px-4 py-2 bg-[#D2691E] text-white rounded-lg hover:bg-[#A55217] disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Excel Row ({selectedRows.size})
                    </button>
                )}

                <button
                    onClick={() => handleClearAllDataTrigger('freshUpload')}
                    disabled={isLoading}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                    <FilePlus2 className="w-4 h-4" />
                    Fresh Upload
                </button>



                <button
                    onClick={handleFileSelectTrigger}
                    disabled={isLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                    <Upload className="w-4 h-4" />
                    Existing Upload
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {(mode === 'loaded' || mode === 'preview' || mode === 'validated') && (
                    <button
                        onClick={handleExport}
                        disabled={isLoading}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                )}

                {(mode === 'preview' || mode === 'validated') && (
                    <>
                        <button
                            onClick={handleCheckValidation}
                            disabled={isLoading}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Check Validation
                        </button>
                    </>
                )}

                {validationResult?.isValid && (
                    <button
                        onClick={handleImport}
                        disabled={isLoading || !!importProgress}
                        className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 flex items-center gap-2 transition-colors animate-pulse"
                    >
                        {importProgress ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                Saving…
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                Save Data
                            </>
                        )}
                    </button>
                )}
            </div>

            {validationResult && (
                <div className="bg-white dark:bg-[#0f172a] rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                    <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Validation Summary
                    </h3>
                    <div className="flex flex-row flex-wrap gap-2 text-sm">
                        <div
                            onClick={() => setFilterType('all')}
                            className={`w-32 p-2 rounded-lg cursor-pointer transition-all ${filterType === 'all' ? 'ring-1 ring-gray-400 dark:ring-gray-500 shadow-sm' : 'hover:opacity-80'} bg-gray-50 dark:bg-[#1e293b] flex flex-col justify-center items-center text-center border border-gray-100 dark:border-gray-700`}
                        >
                            <div className="text-gray-500 dark:text-gray-400 text-[10px] uppercase font-semibold tracking-wider mb-1">Total Rows</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white leading-none">{validationResult.summary.totalRows}</div>
                        </div>
                        <div
                            onClick={() => setFilterType('valid')}
                            className={`w-32 p-2 rounded-lg cursor-pointer transition-all ${filterType === 'valid' ? 'ring-1 ring-green-400 dark:ring-green-500 shadow-sm' : 'hover:opacity-80'} bg-green-50 dark:bg-green-900/10 flex flex-col justify-center items-center text-center border border-green-100 dark:border-green-900/30`}
                        >
                            <div className="text-green-600 dark:text-green-400 text-[10px] uppercase font-semibold tracking-wider mb-1">Valid Rows</div>
                            <div className="text-lg font-bold text-green-700 dark:text-green-300 leading-none">{validationResult.summary.validRows}</div>
                        </div>
                        <div
                            onClick={() => setFilterType('duplicate')}
                            className={`w-32 p-2 rounded-lg cursor-pointer transition-all ${filterType === 'duplicate' ? 'ring-1 ring-red-400 dark:ring-red-500 shadow-sm' : 'hover:opacity-80'} bg-red-50 dark:bg-red-900/10 flex flex-col justify-center items-center text-center border border-red-100 dark:border-red-900/30`}
                        >
                            <div className="text-red-600 dark:text-red-400 text-[10px] uppercase font-semibold tracking-wider mb-1">Duplicate</div>
                            <div className="text-lg font-bold text-red-700 dark:text-red-300 leading-none">{validationResult.summary.duplicateCount}</div>
                        </div>
                        <div
                            onClick={() => setFilterType('missing')}
                            className={`w-32 p-2 rounded-lg cursor-pointer transition-all ${filterType === 'missing' ? 'ring-1 ring-blue-400 dark:ring-blue-500 shadow-sm' : 'hover:opacity-80'} bg-blue-50 dark:bg-blue-900/10 flex flex-col justify-center items-center text-center border border-blue-100 dark:border-blue-900/30`}
                        >
                            <div className="text-blue-600 dark:text-blue-400 text-[10px] uppercase font-semibold tracking-wider mb-1">Missing</div>
                            <div className="text-lg font-bold text-blue-700 dark:text-blue-300 leading-none">{validationResult.summary.missingDataCount}</div>
                        </div>
                        <div
                            onClick={() => setFilterType('mismatch')}
                            className={`w-32 p-2 rounded-lg cursor-pointer transition-all ${filterType === 'mismatch' ? 'ring-1 ring-yellow-400 dark:ring-yellow-500 shadow-sm' : 'hover:opacity-80'} bg-yellow-50 dark:bg-yellow-900/10 flex flex-col justify-center items-center text-center border border-yellow-100 dark:border-yellow-900/30`}
                        >
                            <div className="text-yellow-600 dark:text-yellow-400 text-[10px] uppercase font-semibold tracking-wider mb-1">Mismatch</div>
                            <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300 leading-none">{validationResult.summary.mismatchCount}</div>
                        </div>
                        <div
                            onClick={() => setFilterType('invalid')}
                            className={`w-32 p-2 rounded-lg cursor-pointer transition-all ${filterType === 'invalid' ? 'ring-1 ring-purple-400 dark:ring-purple-500 shadow-sm' : 'hover:opacity-80'} bg-purple-50 dark:bg-purple-900/10 flex flex-col justify-center items-center text-center border border-purple-100 dark:border-purple-900/30`}
                        >
                            <div className="text-purple-600 dark:text-purple-400 text-[10px] uppercase font-semibold tracking-wider mb-1">Invalid Content</div>
                            <div className="text-lg font-bold text-purple-700 dark:text-purple-300 leading-none">{validationResult.summary.invalidContentCount ?? 0}</div>
                        </div>
                    </div>

                    {/* Detailed Invalid Content Errors */}
                    {filterType === 'invalid' && (validationResult.summary.invalidContentCount ?? 0) > 0 && (
                        <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg max-h-48 overflow-y-auto">
                            <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2">Invalid Content Details:</h4>
                            <div className="space-y-1">
                                {validationResult.rows
                                    .filter((row: LedgerRowValidation) => row.rowStatus === ValidationStatus.InvalidContent)
                                    .flatMap((row: LedgerRowValidation) =>
                                        row.cellValidations
                                            .filter((cv: any) => cv.status === ValidationStatus.InvalidContent)
                                            .map((cv: any, idx: number) => (
                                                <div key={`${row.rowIndex}-${idx}`} className="text-sm text-purple-700 dark:text-purple-300 flex items-start gap-2">
                                                    <span className="font-mono text-xs bg-purple-100 dark:bg-purple-800 px-1.5 py-0.5 rounded min-w-[60px] text-center">
                                                        Row {row.rowIndex + 1}
                                                    </span>
                                                    <span>{cv.validationMessage}</span>
                                                </div>
                                            ))
                                    )
                                    .slice(0, 50)
                                }
                                {validationResult.rows
                                    .filter((row: LedgerRowValidation) => row.rowStatus === ValidationStatus.InvalidContent)
                                    .reduce((count: number, row: LedgerRowValidation) =>
                                        count + row.cellValidations.filter((cv: any) => cv.status === ValidationStatus.InvalidContent).length, 0
                                    ) > 50 && (
                                        <div className="text-xs text-purple-500 dark:text-purple-400 italic mt-1">
                                            ...and more. Hover over purple cells in the grid for individual error details.
                                        </div>
                                    )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Grid Section - Show if data exists OR if explicitly loaded (even if empty) */}
            {(ledgerData.length > 0 || mode === 'loaded' || mode === 'validated') && (
                <div className="bg-white dark:bg-[#0f172a] rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1e293b]">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {mode === 'loaded' ? 'Database Records' : 'Excel Preview'} ({ledgerData.length} rows)
                        </h3>
                        {(mode === 'preview' || mode === 'validated') && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                📝 {validationResult ? 'Edit cells and re-run validation as needed' : 'Click any cell to edit the data directly before validation'}
                                {(validationResult?.summary?.invalidContentCount ?? 0) > 0 &&
                                    <span className="ml-2 text-purple-600 dark:text-purple-400 font-bold">
                                        ⚠️ Special characters found! Please remove single/double quotes.
                                    </span>
                                }
                            </p>
                        )}
                    </div>

                    <div
                        className={isDark ? "ag-theme-quartz-dark" : "ag-theme-quartz"}
                        style={{ height: 600, width: '100%' }}
                    >
                        <style>{`
                            /* Shared Base Styles */
                            .ag-theme-quartz, .ag-theme-quartz-dark {
                                --ag-grid-size: 8px;
                                --ag-list-item-height: 40px;
                                --ag-row-height: 48px;
                                --ag-header-height: 52px;
                                --ag-font-size: 14px;
                                --ag-font-family: 'Inter', system-ui, sans-serif;
                                
                                /* Border Structure */
                                --ag-borders: solid 1px;
                                --ag-row-border-style: solid;
                                --ag-row-border-width: 1px;
                                
                                /* Resize Handles & Separators */
                                --ag-header-column-separator-display: block;
                                --ag-header-column-separator-height: 50%;
                                --ag-header-column-separator-width: 1px;
                                --ag-header-column-separator-color: var(--ag-border-color);
                                
                                --ag-header-column-resize-handle-display: block;
                                --ag-header-column-resize-handle-height: 100%;
                                --ag-header-column-resize-handle-width: 2px;
                                --ag-header-column-resize-handle-color: var(--ag-border-color);
                            }

                            /* Light Theme Specifics */
                            .ag-theme-quartz {
                                --ag-background-color: #ffffff;
                                --ag-foreground-color: #0f172a;
                                --ag-header-background-color: #f8fafc;
                                --ag-header-foreground-color: #475569;
                                --ag-border-color: #e2e8f0;
                                --ag-secondary-border-color: #e2e8f0;
                                --ag-row-hover-color: #f8fafc;
                                --ag-selected-row-background-color: rgba(37, 99, 235, 0.1);
                                --ag-checkbox-checked-color: #2563eb;
                            }

                            /* Dark Theme Specifics */
                            .ag-theme-quartz-dark {
                                --ag-background-color: #0f172a !important;
                                --ag-foreground-color: #f1f5f9 !important;
                                --ag-header-background-color: #1e293b !important;
                                --ag-header-foreground-color: #cbd5e1 !important;
                                --ag-border-color: #334155 !important;
                                --ag-secondary-border-color: #334155 !important;
                                --ag-row-hover-color: #1e293b !important;
                                --ag-selected-row-background-color: rgba(59, 130, 246, 0.2) !important;
                                --ag-checkbox-checked-color: #3b82f6 !important;
                                color-scheme: dark;
                            }
                            .ag-theme-quartz-dark .ag-root-wrapper {
                                background-color: #0f172a !important;
                            }
                            .ag-theme-quartz-dark .ag-body-viewport,
                            .ag-theme-quartz-dark .ag-body-horizontal-scroll-viewport,
                            .ag-theme-quartz-dark .ag-center-cols-viewport {
                                background-color: #0f172a !important;
                            }
                            .ag-theme-quartz-dark .ag-row {
                                background-color: #0f172a !important;
                                color: #f1f5f9 !important;
                            }
                            .ag-theme-quartz-dark .ag-row-odd {
                                background-color: #0f172a !important;
                            }
                            .ag-theme-quartz-dark .ag-row-even {
                                background-color: #0f172a !important;
                            }
                            .ag-theme-quartz-dark .ag-cell {
                                color: #f1f5f9 !important;
                            }
                            .ag-theme-quartz-dark .ag-header {
                                background-color: #1e293b !important;
                            }
                            .ag-theme-quartz-dark .ag-header-cell {
                                background-color: #1e293b !important;
                                color: #cbd5e1 !important;
                            }

                            /* Universal Improvements */
                            .ag-header-cell {
                                border-right: 1px solid var(--ag-border-color);
                            }
                            
                            .ag-header-cell-text {
                                font-weight: 600;
                            }
                            
                            /* Sticky visuals for pinned columns */
                            .ag-pinned-left-header, .ag-pinned-left-cols-container {
                                box-shadow: 4px 0 8px -4px rgba(0,0,0,0.2);
                                border-right: 1px solid var(--ag-border-color);
                                z-index: 10 !important;
                            }

                            /* Center No Rows Message */
                            .ag-overlay-no-rows-center {
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100%;
                                font-size: 1.125rem;
                                color: #64748b;
                                font-weight: 500;
                            }
                            .ag-theme-quartz-dark .ag-overlay-no-rows-center {
                                color: #94a3b8;
                            }
                        `}</style>
                        <AgGridReact
                            rowData={ledgerData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            onGridReady={onGridReady}
                            rowSelection="multiple"
                            onSelectionChanged={onSelectionChanged}
                            onCellValueChanged={onCellValueChanged}
                            rowClassRules={rowClassRules}
                            isExternalFilterPresent={isExternalFilterPresent}
                            doesExternalFilterPass={doesExternalFilterPass}
                            pagination={true}
                            paginationPageSize={1000}
                            paginationPageSizeSelector={[1000, 2000, 5000]}
                            enableCellTextSelection={true}
                            ensureDomOrder={true}
                            tooltipShowDelay={300}
                            tooltipInteraction={true}
                            overlayNoRowsTemplate={`<div class="ag-overlay-no-rows-center">No data found</div>`}
                        />
                    </div>
                </div>
            )}

            {ledgerData.length === 0 && mode === 'idle' && (
                <div className="bg-white dark:bg-[#0f172a] rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
                    <Database className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Data Loaded</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Load data from database or import from Excel file
                    </p>
                </div>
            )}
            {/* Clear Data Flow Modals */}
            {clearFlowStep > 0 && clearFlowStep < 4 && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                            <ShieldAlert className="w-8 h-8" />
                            <h3 className="text-lg font-bold">Confirmation Required ({clearFlowStep}/3)</h3>
                        </div>

                        <p className="mb-6 text-gray-700 dark:text-gray-300 text-lg">
                            {clearFlowStep === 1 && `Are you sure you want to clear all the ${ledgerGroupName} data?`}
                            {clearFlowStep === 2 && "Discussed with the client that the data needs to be cleared?"}
                            {clearFlowStep === 3 && "Have you received an email from your client asking to clear the data?"}
                        </p>

                        {/* CAPTCHA */}
                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Security Verification - Solve this:
                            </label>
                            <div className="text-2xl font-mono font-bold text-center mb-3 text-blue-600 dark:text-blue-400">
                                {captchaQuestion.num1} - {captchaQuestion.num2} = ?
                            </div>
                            <input
                                type="number"
                                value={captchaInput}
                                onChange={(e) => {
                                    setCaptchaInput(e.target.value);
                                    setCaptchaError(false);
                                }}
                                className={`w-full p-2 border-2 rounded-lg text-center text-lg font-mono ${captchaError
                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                    : 'border-gray-300 dark:border-gray-600 dark:bg-gray-900'
                                    } dark:text-white`}
                                placeholder="Enter answer"
                                autoFocus
                            />
                            {captchaError && (
                                <p className="text-red-600 dark:text-red-400 text-sm mt-2">Incorrect answer. Please try again.</p>
                            )}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleClearCancel}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg"
                            >
                                No, Cancel
                            </button>
                            <button
                                onClick={handleClearConfirm}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                            >
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Credential Popup */}
            {clearFlowStep === 4 && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                    <form onSubmit={handleCredentialSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-6 text-gray-900 dark:text-white">
                            <Lock className="w-6 h-6" />
                            <h3 className="text-xl font-bold">Security Verification</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    value={clearCredentials.username}
                                    onChange={e => setClearCredentials({ ...clearCredentials, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                                <input
                                    type="password"

                                    className="w-full p-2 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    value={clearCredentials.password}
                                    onChange={e => setClearCredentials({ ...clearCredentials, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for Deletion</label>
                                <textarea
                                    required
                                    className="w-full p-2 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white h-24"
                                    placeholder="Please explicitly state why data is being cleared..."
                                    value={clearCredentials.reason}
                                    onChange={e => setClearCredentials({ ...clearCredentials, reason: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={handleClearCancel}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2"
                            >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                                Authorize & Clear Data
                            </button>
                        </div>
                    </form>
                </div>
            )}



            {/* Mode Switch Confirmation Modal */}
            {showModeSwitchModal && pendingMode && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                            {pendingMode.type === 'load' ? 'Leave Excel Upload?' : 'Leave Database View?'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            {pendingMode.type === 'load'
                                ? 'You have unsaved Excel data. Switching to Database View will discard your current upload.'
                                : 'Switching to Excel Upload will clear the current database view.'}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowModeSwitchModal(false);
                                    setPendingMode(null);
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    pendingMode.action();
                                    setShowModeSwitchModal(false);
                                    setPendingMode(null);
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* No Data Found Modal */}
            {noDataMessage && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 text-center animate-in fade-in zoom-in duration-200">
                        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Data Found</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg leading-relaxed">
                            {noDataMessage}
                        </p>
                        <button
                            onClick={() => setNoDataMessage(null)}
                            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-lg transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* Re-Upload Confirmation Modal */}
            {showReUploadModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700 transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-yellow-50 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                Do you want to Re-upload Excel?
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">
                                Uploading a new file will replace the current data. Previous changes will be lost.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setShowReUploadModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
                                >
                                    No
                                </button>
                                <button
                                    onClick={confirmReUpload}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                                >
                                    Yes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Standardized Message Modal */}
            {ModalRenderer}

            {/* Validation Result Modal */}
            {showValidationModal && validationModalContent && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
                        <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400 shrink-0">
                            <AlertCircle className="w-8 h-8" />
                            <h3 className="text-xl font-bold">{validationModalContent.title}</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-6 pr-2">
                            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 text-lg">
                                {validationModalContent.messages.map((msg, idx) => (
                                    <li key={idx} className="whitespace-pre-wrap leading-relaxed">{msg}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex justify-center shrink-0">
                            <button
                                onClick={() => setShowValidationModal(false)}
                                className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-lg min-w-[120px]"
                            >
                                Ok
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LedgerMasterEnhanced;
