import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ClearSuccessPopup from './ClearSuccessPopup';
import NoDataPopup from './NoDataPopup';
import { Database, Trash2, Upload, Download, CheckCircle2, AlertCircle, FilePlus2, XCircle, ShieldAlert } from 'lucide-react';
import { useMessageModal } from './MessageModal';
import DropdownCellRenderer from './DropdownCellRenderer';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
    getHSNs,
    getItemGroupNames,
    importHSNs,
    softDeleteHSN,
    clearHSNData,
    validateHSNs,
    getHSNCount,
    HSNMasterDto,
    HSNValidationResultDto,
    HSNRowValidation,
    ValidationStatus
} from '../services/api';
import { useLoader } from '../context/LoaderContext';
import { useTheme } from '../context/ThemeContext';
import { getHSNMasterStandardColumns, validateExcelColumns } from '../utils/excelColumnValidator';

// AG Grid Imports
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, GridApi, RowClassRules, ICellRendererParams } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface HSNMasterEnhancedProps {
    moduleId?: number; // Optional, similar to Ledger logic
}

const HSNMasterEnhanced: React.FC<HSNMasterEnhancedProps> = () => {
    const { showMessage, ModalRenderer } = useMessageModal();
    const { showLoader, hideLoader } = useLoader();
    const { isDark } = useTheme();

    const [hsnData, setHsnData] = useState<HSNMasterDto[]>([]);
    const [itemGroups, setItemGroups] = useState<string[]>([]); // Added state for Item Groups
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isLoading) showLoader();
        else hideLoader();
    }, [isLoading]);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [validationResult, setValidationResult] = useState<HSNValidationResultDto | null>(null);
    const [mode, setMode] = useState<'idle' | 'loaded' | 'preview' | 'validated'>('idle');
    const [filterType, setFilterType] = useState<'all' | 'valid' | 'duplicate' | 'missing' | 'mismatch' | 'invalid'>('all');


    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingMode, setPendingMode] = useState<{ type: 'load' | 'upload'; action: () => void } | null>(null);
    const [showModeSwitchModal, setShowModeSwitchModal] = useState(false);

    // Clear Data Flow State
    const [clearFlowStep, setClearFlowStep] = useState<0 | 1 | 2 | 3 | 4>(0);
    const [clearCredentials, setClearCredentials] = useState({ username: '', password: '', reason: '' });
    const [clearActionType, setClearActionType] = useState<'clearOnly' | 'freshUpload'>('freshUpload');

    // CAPTCHA State
    const [captchaQuestion, setCaptchaQuestion] = useState({ num1: 0, num2: 0, answer: 0 });
    const [captchaInput, setCaptchaInput] = useState('');
    const [captchaError, setCaptchaError] = useState(false);

    // Generate CAPTCHA
    const generateCaptcha = () => {
        const num1 = Math.floor(Math.random() * 50) + 20;
        const num2 = Math.floor(Math.random() * 30) + 10;
        const answer = num1 - num2;
        setCaptchaQuestion({ num1, num2, answer });
        setCaptchaInput('');
        setCaptchaError(false);
    };

    // Validation Modal State
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [validationModalContent, setValidationModalContent] = useState<{ title: string; messages: string[] } | null>(null);

    // Re-Upload Confirmation State
    const [showReUploadModal, setShowReUploadModal] = useState(false);

    const showError = (message: string) => {
        showMessage('error', 'Error', message);
    };

    // Success Popup State (Import)
    const [successInfo, setSuccessInfo] = useState<{ rowCount: number } | null>(null);

    // Clear Success Popup State
    const [clearSuccessInfo, setClearSuccessInfo] = useState<{ rowCount: number; groupName: string } | null>(null);

    // No Data Popup State
    const [noDataPopupGroup, setNoDataPopupGroup] = useState<string | null>(null);

    // Helper: Build dropdown params strictly from options
    const getDropdownParams = (options: any[]) => () => {
        const values = ['', ...options.map(o => String(o))];
        return { values };
    };

    // --- AG Grid Setup ---
    const gridApiRef = useRef<GridApi | null>(null);

    // Fetch Item Groups on Mount for Dropdown
    useEffect(() => {
        const fetchItemGroups = async () => {
            try {
                const groups = await getItemGroupNames();
                setItemGroups(groups);
            } catch (error) {
                console.error("Failed to fetch item groups", error);
                showError("Failed to load Item Group list");
            }
        };
        fetchItemGroups();
    }, []);

    // Validation Map for O(1) lookup by rowIndex
    const validationMap = useMemo(() => {
        if (!validationResult) return new Map<number, HSNRowValidation>();
        const map = new Map<number, HSNRowValidation>();
        validationResult.rows.forEach((row: HSNRowValidation) => {
            // Ensure we use the correct index field
            if (typeof row.rowIndex === 'number') {
                map.set(row.rowIndex, row);
            }
        });
        return map;
    }, [validationResult]);

    // Force redraw when validation result changes to ensure highlights are cleared/updated
    useEffect(() => {
        if (gridApiRef.current) {
            gridApiRef.current.redrawRows();
        }
    }, [validationResult, hsnData, validationMap]);

    const handleCellEdit = useCallback((rowIndex: number, field: keyof HSNMasterDto, newValue: any) => {
        setHsnData(prevData => {
            const newData = [...prevData];
            newData[rowIndex] = { ...newData[rowIndex], [field]: newValue || '' }; // Ensure non-null for required fields
            return newData;
        });
    }, []);

    const onCellValueChanged = useCallback((params: any) => {
        const { colDef, newValue, data } = params;

        // Use hsnData.indexOf(data) because node.rowIndex may be relative to filtered view
        const rowIndex = hsnData.indexOf(data);

        if (rowIndex === -1) {
            console.warn("Row data not found in state:", data);
            return;
        }

        const field = colDef.field as keyof HSNMasterDto;

        // Logic: Clear Item Group Name if Product Type is NOT Raw Material
        if (field === 'productCategory') {
            const isRawMaterial = (newValue || '').trim().toLowerCase() === 'raw material';
            if (!isRawMaterial && data.itemGroupName) {
                // Clear state
                handleCellEdit(rowIndex, 'itemGroupName', '');
            }
        }

        handleCellEdit(rowIndex, field, newValue);
    }, [handleCellEdit, hsnData]);

    // Custom Cell Renderer for Item Group Name with Clear Button + always-visible dropdown arrow
    const ItemGroupRenderer = (params: ICellRendererParams) => {
        const value = params.value;
        const isModeEditable = mode === 'preview' || mode === 'validated';
        const isRawMaterial = (params.data?.productCategory || '').trim().toLowerCase() === 'raw material';
        const isEditable = isModeEditable && isRawMaterial;
        const isEmpty = value === null || value === undefined || value === '';

        const handleClick = () => {
            if (!isEditable) return;
            params.api.startEditingCell({
                rowIndex: params.node.rowIndex!,
                colKey: params.column!.getColId(),
            });
        };

        return (
            <div
                onClick={handleClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    height: '100%',
                    cursor: isEditable ? 'pointer' : 'default',
                    userSelect: 'text',
                    gap: '4px',
                }}
            >
                <span
                    style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'inherit',
                        fontSize: '13px',
                        userSelect: 'text',
                    }}
                >
                    {isEmpty ? '' : String(value)}
                </span>

                {isEditable && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                        {!isEmpty && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    params.node.setDataValue('itemGroupName', '');
                                }}
                                className="p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Clear Item Group"
                            >
                                <XCircle className="w-3 h-3" />
                            </button>
                        )}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="13" height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ color: '#6b7280', opacity: 0.8 }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                )}
            </div>
        );
    };

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 50,
        cellStyle: (params: any) => {
            const rowIndex = hsnData.indexOf(params.data);
            if (rowIndex === -1) return null;

            const colors = {
                duplicate: isDark ? 'rgba(220, 38, 38, 0.2)' : '#fee2e2',
                missing:   isDark ? 'rgba(37, 99, 235, 0.2)'  : '#dbeafe',
                mismatch:  isDark ? 'rgba(202, 138, 4, 0.2)'  : '#fef9c3',
                invalid:   isDark ? 'rgba(147, 51, 234, 0.2)' : '#f3e8ff'
            };

            const rowVal = validationMap.get(rowIndex);
            if (!rowVal) return null;

            // Whole-row red for duplicate
            if (rowVal.rowStatus === ValidationStatus.Duplicate) {
                return { backgroundColor: colors.duplicate };
            }

            // Cell-level coloring: match by field (camelCase), headerName, or PascalCase property name
            // Backend sends ColumnName as PascalCase (e.g. "ProductHSNName"), camelCase (e.g. "itemGroupName"),
            // so we need case-insensitive matching against both field and headerName
            const colField = params.colDef.field ?? '';
            const colHeader = params.colDef.headerName ?? '';
            if (rowVal.cellValidations) {
                const cellVal = rowVal.cellValidations.find((cv: any) => {
                    const cn = cv.columnName ?? '';
                    return cn.toLowerCase() === colField.toLowerCase()
                        || cn.toLowerCase() === colHeader.toLowerCase()
                        || cn.toLowerCase() === colHeader.replace(/\s+/g, '').toLowerCase();
                });
                if (cellVal) {
                    if (cellVal.status === ValidationStatus.MissingData)    return { backgroundColor: colors.missing };
                    if (cellVal.status === ValidationStatus.Mismatch)       return { backgroundColor: colors.mismatch };
                    if (cellVal.status === ValidationStatus.InvalidContent) return { backgroundColor: colors.invalid };
                }
            }
            return null;
        }
    }), [isDark, validationMap, hsnData]);

    const columnDefs: ColDef[] = useMemo(() => {
        const isEditable = mode === 'preview' || mode === 'validated';

        return [
            {
                field: 'checkbox',
                headerName: '',
                checkboxSelection: true,
                headerCheckboxSelection: true,
                headerCheckboxSelectionFilteredOnly: true,
                width: 40,
                pinned: 'left',
                lockPosition: true,
                resizable: false,
                suppressMenu: true,
                cellStyle: undefined  // no coloring on checkbox column
            },
            {
                headerName: '#',
                valueGetter: "node.rowIndex + 1",
                width: 50,
                pinned: 'left',
                lockPosition: true,
                resizable: true,
                suppressMenu: true,
                cellStyle: undefined  // no coloring on row-number column
            },
            { field: 'productHSNName', headerName: 'Group Name', minWidth: 150, editable: isEditable },
            { field: 'displayName', headerName: 'Display Name', minWidth: 200, editable: isEditable },
            { field: 'hsnCode', headerName: 'HSN Code', width: 120, editable: isEditable },
            {
                field: 'productCategory',
                headerName: 'Product Type',
                width: 130,
                editable: isEditable,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: getDropdownParams(['Raw Material', 'Finish Goods', 'Spare Parts', 'Service', 'Tool']),
                cellRenderer: DropdownCellRenderer,
            },
            { field: 'gstTaxPercentage', headerName: 'GST %', width: 90, editable: isEditable },
            { field: 'cgstTaxPercentage', headerName: 'CGST %', width: 90, editable: isEditable },
            { field: 'sgstTaxPercentage', headerName: 'SGST %', width: 90, editable: isEditable },
            { field: 'igstTaxPercentage', headerName: 'IGST %', width: 90, editable: isEditable },
            {
                field: 'itemGroupName',
                headerName: 'Item Group Name',
                minWidth: 150,
                editable: (params) => {
                    if (!isEditable) return false;
                    return (params.data?.productCategory || '').trim().toLowerCase() === 'raw material';
                },
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: getDropdownParams(itemGroups),
                cellRenderer: ItemGroupRenderer,
            }
        ];
    }, [mode, itemGroups]);

    const rowClassRules: RowClassRules = useMemo(() => {
        return {
            // Only color the entire row for Duplicates (red) — all other issues highlight only the specific cell
            'bg-red-50 dark:bg-red-900/10': (params) => {
                if (!validationResult) return false;
                const rowIndex = hsnData.indexOf(params.data);
                if (rowIndex === -1) return false;
                const rowVal = validationMap.get(rowIndex);
                return rowVal?.rowStatus === ValidationStatus.Duplicate;
            }
        };
    }, [validationMap, hsnData, validationResult]);

    // External Filter Logic
    const isExternalFilterPresent = useCallback(() => {
        return filterType !== 'all';
    }, [filterType]);

    const doesExternalFilterPass = useCallback((node: any) => {
        if (!validationResult || filterType === 'all') return true;

        const rowIndex = hsnData.indexOf(node.data);
        if (rowIndex === -1) return true;

        const rowVal = validationMap.get(rowIndex);
        if (!rowVal) return true;

        switch (filterType) {
            case 'valid': return rowVal.rowStatus === ValidationStatus.Valid;
            case 'duplicate': return rowVal.rowStatus === ValidationStatus.Duplicate;
            // Check cellValidations so duplicate rows with missing/mismatch/invalid also appear in those sections
            case 'missing': return rowVal.cellValidations?.some((cv: any) => cv.status === ValidationStatus.MissingData) ?? false;
            case 'mismatch': return rowVal.cellValidations?.some((cv: any) => cv.status === ValidationStatus.Mismatch) ?? false;
            case 'invalid': return rowVal.cellValidations?.some((cv: any) => cv.status === ValidationStatus.InvalidContent) ?? false;
            default: return true;
        }
    }, [filterType, validationMap, validationResult, hsnData]);

    // Trigger filter update when type changes
    useEffect(() => {
        if (gridApiRef.current) {
            gridApiRef.current.onFilterChanged();
        }
    }, [filterType, validationResult]);

    // --- Actions ---

    const loadData = async () => {
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
            const data = await getHSNs();
            setHsnData(data);
            setMode('loaded');
            setValidationResult(null);
            setFilterType('all');
            setSelectedRows(new Set());
            if (data.length > 0) {
                showMessage('success', 'Data Loaded', `Successfully loaded ${data.length} HSN record(s) from the database.`);
            }
        } catch (error: any) {
            console.error(error);
            showError(error?.response?.data?.error || 'Failed to load HSN data');
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
                    setHsnData([]);
                    setMode('idle');
                    setValidationResult(null);
                    setSelectedRows(new Set());
                    // Open file dialog
                    if (fileInputRef.current) fileInputRef.current.click();
                }
            });
            setShowModeSwitchModal(true);
            return;
        }

        // Re-Upload Confirmation (Excel Mode)
        if (hsnData.length > 0 && (mode === 'preview' || mode === 'validated')) {
            setShowReUploadModal(true);
            return;
        }

        // Otherwise just click
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const confirmReUpload = () => {
        setShowReUploadModal(false);
        setHsnData([]);
        setValidationResult(null);
        setMode('idle');
        setSelectedRows(new Set());
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset input
            fileInputRef.current.click();
        }
    };

    const handleClearAllDataTrigger = async (type: 'clearOnly' | 'freshUpload') => {
        setClearActionType(type);

        if (type === 'clearOnly') {
            setIsLoading(true);
            const count = await getHSNCount();
            setIsLoading(false);

            if (count === 0) {
                setNoDataPopupGroup('HSN Master');
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
            showError('❌ Incorrect CAPTCHA answer. Please try again.');
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
                const response = await clearHSNData(2, clearCredentials.username, clearCredentials.password, clearCredentials.reason);
                deletedCount = response.importedRows || 0;
            } catch (clearError: any) {
                if (clearError?.response?.status === 401 || clearError?.response?.status === 403) {
                    throw clearError;
                }
                deletedCount = 0;
            }

            if (deletedCount > 0 && clearActionType === 'clearOnly') {
                setClearSuccessInfo({ rowCount: deletedCount, groupName: 'HSN Master' });
            } else if (deletedCount === 0 && clearActionType === 'clearOnly') {
                showMessage('info', 'No Data Found', 'No existing data was found in the database for HSN Master. Nothing was cleared.');
            }
            setHsnData([]);
            setValidationResult(null);
            setMode('idle');

            if (clearActionType === 'freshUpload' && fileInputRef.current) {
                setIsLoading(false);
                fileInputRef.current.value = '';
                fileInputRef.current.click();
            } else {
                setIsLoading(false);
            }

            handleClearCancel();
        } catch (error: any) {
            console.error(error);
            showError(error.response?.data?.message || 'Failed to clear data. Check credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Step 1: File Extension Check
        const fileName = file.name;
        const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
        if (extension !== '.xlsx') {
            showMessage('error', 'Invalid Excel Version',
                'Your Excel file format is not supported.\n\nPlease upload file in .xlsx format only.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Step 2: File Name Validation
        const expectedName = 'HSN Master';
        const actualNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')).trim();
        if (actualNameWithoutExt.toLowerCase() !== expectedName.toLowerCase()) {
            showMessage('error', 'Invalid File Name',
                `You have selected wrong file.\n\nPlease upload correct file for selected Module and Group.\n\nExpected: ${expectedName}.xlsx`);
            if (fileInputRef.current) fileInputRef.current.value = '';
            // Reset any existing data
            setHsnData([]);
            setMode('idle');
            setValidationResult(null);
            return;
        }


        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // ── Column format validation ──────────────────────────────
                // Read headers directly from row 1 cells — includes headers even when columns have no data rows
                const uploadedColumns: string[] = (() => {
                    const ref = ws['!ref'];
                    if (!ref) return data.length > 0 ? Object.keys(data[0] as object) : [];
                    const { s, e } = XLSX.utils.decode_range(ref);
                    const cols: string[] = [];
                    for (let c = s.c; c <= e.c; c++) {
                        const cell = ws[XLSX.utils.encode_cell({ r: s.r, c })];
                        if (cell?.v !== undefined && String(cell.v).trim() !== '') cols.push(String(cell.v));
                    }
                    return cols;
                })();
                const colValidation = validateExcelColumns(uploadedColumns, getHSNMasterStandardColumns());
                if (!colValidation.isValid) {
                    showMessage('error', 'Invalid Excel Format', colValidation.message);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }
                // ─────────────────────────────────────────────────────────

                // Map Excel columns to DTO
                const safeParseFloat = (value: any): number => {
                    if (value === null || value === undefined) return 0;
                    const str = String(value).trim();
                    if (str === '') return 0;
                    const num = parseFloat(str);
                    return isNaN(num) ? 0 : num;
                };

                const mappedData: HSNMasterDto[] = data.map((row: any) => ({
                    productHSNName: String(row['Group Name'] || row['Group Name'] || '').trim(),
                    displayName: String(row['Display Name'] || row['DisplayName'] || '').trim(),
                    hsnCode: String(row['HSN Code'] || row['HSNCode'] || '').trim(),
                    productCategory: String(row['Product Type'] || row['ProductType'] || row['ProductCategory'] || '').trim(),
                    gstTaxPercentage: safeParseFloat(row['GST %'] || row['GSTTaxPercentage']),
                    cgstTaxPercentage: safeParseFloat(row['CGST %'] || row['CGSTTaxPercentage']),
                    sgstTaxPercentage: safeParseFloat(row['SGST %'] || row['SGSTTaxPercentage']),
                    igstTaxPercentage: safeParseFloat(row['IGST %'] || row['IGSTTaxPercentage']),
                    itemGroupName: String(row['ItemGroupName'] || row['Item Group Name'] || '').trim(),
                    companyID: 2 // Default
                }));

                setHsnData(mappedData);
                setMode('preview');
                setValidationResult(null);
                setFilterType('all');
                showMessage('success', 'File Loaded', `Successfully loaded ${mappedData.length} row(s) from the Excel file. Please click "Check Validation" to validate.`);

            } catch (error) {
                console.error(error);
                showError('Failed to parse Excel file');
                setIsLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleValidate = async () => {
        if (hsnData.length === 0) return;

        // Clear stale validation state before re-validating
        setValidationResult(null);
        setValidationModalContent(null);
        setIsLoading(true);

        try {
            const result = await validateHSNs(hsnData);
            setValidationResult(result);
            setMode('validated');

            if (result.isValid) {
                showMessage('success', 'Validation Passed', 'All records passed validation successfully. The data is ready to be imported.');
            } else {
                const totalIssues = result.summary.duplicateCount + result.summary.missingDataCount + result.summary.mismatchCount + result.summary.invalidContentCount;

                // Map backend PascalCase/camelCase column names to human-readable labels
                const colDisplayNames: Record<string, string> = {
                    producthsnname: 'Group Name',
                    displayname:    'Display Name',
                    hsncode:        'HSN Code',
                    productcategory:'Product Type',
                    gsttaxpercentage: 'GST %',
                    itemgroupname:  'Item Group Name'
                };
                const toDisplayName = (raw: string) =>
                    colDisplayNames[raw.toLowerCase()] ?? raw;

                // Aggregate failures by column (same as ItemMasterEnhanced)
                const columnFailures = new Map<string, Set<string>>();
                result.rows.forEach((row: HSNRowValidation) => {
                    if (row.rowStatus === ValidationStatus.Duplicate) {
                        const col = 'HSN Code';
                        if (!columnFailures.has(col)) columnFailures.set(col, new Set());
                        columnFailures.get(col)!.add('Duplicate data found');
                    }
                    if (row.cellValidations && row.cellValidations.length > 0) {
                        row.cellValidations.forEach((cell: any) => {
                            const col = toDisplayName(cell.columnName || 'Unknown');
                            if (!columnFailures.has(col)) columnFailures.set(col, new Set());
                            let reason = 'Invalid';
                            if (cell.status === ValidationStatus.MissingData) reason = 'Missing';
                            else if (cell.status === ValidationStatus.Mismatch) reason = 'Master Mismatch';
                            else if (cell.status === ValidationStatus.InvalidContent) reason = 'Invalid Format';
                            columnFailures.get(col)!.add(reason);
                        });
                    }
                });

                const messages: string[] = [];
                columnFailures.forEach((reasons, col) => {
                    messages.push(`${col} – ${Array.from(reasons).join(', ')}`);
                });

                setValidationModalContent({
                    title: `Validation Failed: ${totalIssues} Issue${totalIssues !== 1 ? 's' : ''} Found`,
                    messages: messages.length > 0 ? messages : ['Please review the grid for specific issues.']
                });
                setShowValidationModal(true);
            }
        } catch (error) {
            console.error(error);
            showError('Validation failed');
        } finally {
            setIsLoading(false);
        }
    };

    // Actual Import/Save
    const handleSave = async () => {
        if (hsnData.length === 0) {
            showError('No data to import');
            return;
        }

        setIsLoading(true);
        // Clear old validation errors to prevent showing stale messages after successful import
        setValidationModalContent(null);

        try {
            // 1. Full Re-Validation
            const result = await validateHSNs(hsnData);
            setValidationResult(result);

            if (!result.isValid) {
                const totalIssues = result.summary.duplicateCount + result.summary.missingDataCount + result.summary.mismatchCount + result.summary.invalidContentCount;

                // Aggregate failures by column
                const columnFailures = new Map<string, Set<string>>();

                result.rows.forEach((row: HSNRowValidation) => {
                    // 1. Handle Duplicates
                    if (row.rowStatus === ValidationStatus.Duplicate) {
                        const col = 'HSNCode'; // Assuming HSNCode or DisplayName is key
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
                showError('Validation failed. Please correct highlighted errors before saving.');
                return; // ABORT
            }

            // 3. Import
            const importRes = await importHSNs(hsnData);
            if (importRes.success) {
                // Reset upload state FIRST so loadData() guard doesn't fire the mode-switch modal
                setValidationResult(null);
                setMode('idle');
                // Show success popup
                setSuccessInfo({ rowCount: importRes.importedRows ?? hsnData.length });

                // If some rows failed, also show failed rows list after success popup
                if (importRes.errorRows > 0 && importRes.errorMessages && importRes.errorMessages.length > 0) {
                    setValidationModalContent({
                        title: `${importRes.errorRows} Row(s) Failed During Import`,
                        messages: importRes.errorMessages
                    });
                }

                // Use performLoadData directly to skip the mode-switch guard
                performLoadData();
            } else {
                if (importRes.errorMessages && importRes.errorMessages.length > 0) {
                    setValidationModalContent({
                        title: 'Import Failed',
                        messages: importRes.errorMessages
                    });
                    setShowValidationModal(true);
                } else {
                    showMessage('error', 'Import Failed', importRes.message || 'Import failed. Please try again.');
                }
            }
        } catch (error: any) {
            console.error(error);
            showError(error.response?.data?.message || 'Import Failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveRow = async () => {
        const selectedNodes = gridApiRef.current?.getSelectedNodes() || [];
        if (selectedNodes.length === 0) {
            showError('Please select at least one row to remove');
            return;
        }

        // Logic split: If uploaded (preview/validated), remove from local state.
        // If loaded (DB mode), remove from DB.

        if (mode === 'loaded') {
            if (!window.confirm(`Are you sure you want to delete ${selectedNodes.length} records from database?`)) return;

            setIsLoading(true);
            try {
                let deleted = 0;
                for (const node of selectedNodes) {
                    if (node.data.productHSNID) {
                        await softDeleteHSN(node.data.productHSNID);
                        deleted++;
                    }
                }
                showMessage('success', 'Records Deleted', `${deleted} HSN record(s) have been successfully removed from the database.`);
                loadData();
            } catch (e) {
                console.error(e);
                showError('Failed to delete records');
            } finally {
                setIsLoading(false);
            }
        } else {
            // Local remove from Excel Preview
            const selectedData = selectedNodes.map(node => node.data);
            const selectedIndices = new Set(selectedData.map(d => hsnData.indexOf(d)).filter(i => i !== -1));
            const selectedIndicesList = Array.from(selectedIndices).sort((a, b) => b - a);

            // 1. Update data
            const newData = hsnData.filter((_, idx) => !selectedIndices.has(idx));
            setHsnData(newData);
            setSelectedRows(new Set());
            gridApiRef.current?.deselectAll();

            // 2. Update validationResult (if exists)
            if (validationResult) {
                const oldRows = validationResult.rows;
                const newRows: HSNRowValidation[] = [];
                const summary = { ...validationResult.summary };

                // Map to track index shifts
                const indexMap = new Map<number, number>();
                let shift = 0;
                for (let i = 0; i < hsnData.length; i++) {
                    if (selectedIndices.has(i)) {
                        shift++;
                    } else {
                        indexMap.set(i, i - shift);
                    }
                }

                // Filter and re-index rows
                oldRows.forEach(row => {
                    if (selectedIndices.has(row.rowIndex)) {
                        // This row was deleted - decrement summary counts
                        summary.totalRows--;
                        if (row.rowStatus === ValidationStatus.Duplicate) summary.duplicateCount--;
                        else if (row.rowStatus === ValidationStatus.Valid) summary.validRows--;

                        // Cell-level failures
                        row.cellValidations?.forEach((cv: any) => {
                            if (cv.status === ValidationStatus.MissingData) summary.missingDataCount--;
                            else if (cv.status === ValidationStatus.Mismatch) summary.mismatchCount--;
                            else if (cv.status === ValidationStatus.InvalidContent) summary.invalidContentCount--;
                        });
                    } else {
                        // This row stays - update index
                        newRows.push({
                            ...row,
                            rowIndex: indexMap.get(row.rowIndex)!
                        });
                    }
                });

                // Sanity check: Ensure counts don't go negative
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
                
                // Keep the mode as validated if it was already
                if (mode === 'validated') {
                     // Stay in validated mode to show updated summary
                } else {
                    setMode('preview');
                }
            } else {
                setMode('preview');
            }

            showMessage('info', 'Rows Removed', `${selectedIndicesList.length} row(s) have been removed from the preview.`);
        }
    };

    const handleExport = () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('HSN Master');

        const exportColumns = ['Group Name', 'Display Name', 'HSN Code', 'ProductType', 'GST %', 'CGST %', 'SGST %', 'IGST %', 'ItemGroupName'];
        worksheet.addRow(exportColumns);

        const exportColors = {
            duplicate: 'FFFFE0E0',
            missing:   'FFD0E8FF',
            mismatch:  'FFFFFF99',
            invalid:   'FFE8D0FF'
        };

        const passesExportFilter = (rowIndex: number): boolean => {
            if (filterType === 'all' || !validationResult) return true;
            const v = validationMap.get(rowIndex);
            if (!v) return filterType === 'valid';
            switch (filterType) {
                case 'valid':     return v.rowStatus === ValidationStatus.Valid;
                case 'duplicate': return v.rowStatus === ValidationStatus.Duplicate;
                case 'missing':   return v.cellValidations?.some((cv: any) => cv.status === ValidationStatus.MissingData) ?? false;
                case 'mismatch':  return v.cellValidations?.some((cv: any) => cv.status === ValidationStatus.Mismatch) ?? false;
                case 'invalid':   return v.cellValidations?.some((cv: any) => cv.status === ValidationStatus.InvalidContent) ?? false;
                default: return true;
            }
        };

        hsnData.forEach((row, rowIndex) => {
            if (!passesExportFilter(rowIndex)) return;

            const excelRow = worksheet.addRow([
                row.productHSNName,
                row.displayName,
                row.hsnCode,
                row.productCategory,
                row.gstTaxPercentage,
                row.cgstTaxPercentage,
                row.sgstTaxPercentage,
                row.igstTaxPercentage,
                row.itemGroupName
            ]);

            const rowValidation = validationMap.get(rowIndex);
            if (rowValidation) {
                if (rowValidation.rowStatus === ValidationStatus.Duplicate) {
                    excelRow.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: exportColors.duplicate } };
                    });
                } else {
                    rowValidation.cellValidations?.forEach((cellVal: any) => {
                        const colIdx = exportColumns.findIndex(c => c.toLowerCase() === (cellVal.columnName ?? '').toLowerCase()) + 1;
                        if (colIdx > 0) {
                            const cell = excelRow.getCell(colIdx);
                            let argb = '';
                            if (cellVal.status === ValidationStatus.MissingData)    argb = exportColors.missing;
                            else if (cellVal.status === ValidationStatus.Mismatch)  argb = exportColors.mismatch;
                            else if (cellVal.status === ValidationStatus.InvalidContent) argb = exportColors.invalid;
                            if (argb) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
                        }
                    });
                }
            }
        });

        workbook.xlsx.writeBuffer().then((buffer) => {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, 'HSN Master.xlsx');
            showMessage('success', 'Export Complete', 'The HSN Master data has been exported to an Excel file and downloaded successfully.');
        });
    };

    // Calculate if Save is enabled
    const canSave = useMemo(() => {
        if (mode !== 'validated' || !validationResult) return false;

        const { duplicateCount, missingDataCount, mismatchCount, invalidContentCount } = validationResult.summary;
        return duplicateCount === 0 && missingDataCount === 0 && mismatchCount === 0 && invalidContentCount === 0 && validationResult.isValid;
    }, [mode, validationResult]);

    return (
        <div className="bg-white dark:bg-[#0f172a] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col h-[calc(100vh-180px)]">

            {/* ✅ Success Popup Modal */}
            {successInfo && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 w-full" />
                        <div className="p-8 text-center">
                            <div className="mx-auto mb-5 w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center ring-8 ring-green-50 dark:ring-green-900/10">
                                <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Import Successful!</h2>
                            <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-1">Successfully imported</p>
                            <p className="text-4xl font-extrabold text-green-600 dark:text-green-400 mb-1">{successInfo.rowCount}</p>
                            <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-6">
                                {successInfo.rowCount === 1 ? 'row' : 'rows'} into <span className="font-semibold text-gray-800 dark:text-white">HSN Master</span>
                            </p>
                            <button
                                onClick={() => {
                                    setSuccessInfo(null);
                                    // Show failed rows list if any rows failed during import
                                    if (validationModalContent && validationModalContent.title.includes('Failed During Import')) {
                                        setShowValidationModal(true);
                                    }
                                }}
                                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl text-lg transition-all duration-200 active:scale-95 shadow-md shadow-green-200 dark:shadow-green-900/30"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🗑️ Clear All Data Success Popup */}
            {clearSuccessInfo && (
                <ClearSuccessPopup
                    rowCount={clearSuccessInfo.rowCount}
                    groupName={clearSuccessInfo.groupName}
                    onClose={() => {
                        setClearSuccessInfo(null);
                        setHsnData([]);
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

            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 items-center justify-between bg-white dark:bg-[#0f172a] sticky top-0 z-10 rounded-t-lg">
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={loadData} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium shadow-sm">
                        <Database className="w-4 h-4" /> Load Data
                    </button>

                    <button onClick={() => handleClearAllDataTrigger('clearOnly')} disabled={isLoading || selectedRows.size > 0} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-medium shadow-sm">
                        <XCircle className="w-4 h-4" /> Clear All Data
                    </button>

                    {mode === 'loaded' ? (
                        <button onClick={handleRemoveRow} disabled={isLoading || selectedRows.size === 0} className="flex items-center gap-2 px-4 py-2 bg-[#D2691E] text-white rounded-lg hover:bg-[#A55217] transition-colors disabled:opacity-50 text-sm font-medium shadow-sm">
                            <Trash2 className="w-4 h-4" /> Soft Delete ({selectedRows.size})
                        </button>
                    ) : (mode === 'preview' || mode === 'validated') && (
                        <button onClick={handleRemoveRow} disabled={isLoading || selectedRows.size === 0} className="flex items-center gap-2 px-4 py-2 bg-[#D2691E] text-white rounded-lg hover:bg-[#A55217] transition-colors disabled:opacity-50 text-sm font-medium shadow-sm">
                            <Trash2 className="w-4 h-4" /> Delete Excel Row ({selectedRows.size})
                        </button>
                    )}

                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1 mobile-hide"></div>

                    <button onClick={() => handleClearAllDataTrigger('freshUpload')} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium shadow-sm">
                        <FilePlus2 className="w-4 h-4" /> Fresh Upload
                    </button>

                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx" className="hidden" />
                    <button onClick={handleFileSelectTrigger} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm">
                        <Upload className="w-4 h-4" /> Existing Upload
                    </button>

                    {/* Show Validate Button if in Preview or Validated mode (allow re-validate) */}
                    {(mode === 'preview' || mode === 'validated') && (
                        <button onClick={handleValidate} disabled={isLoading || hsnData.length === 0} className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 text-sm font-medium shadow-sm">
                            <ShieldAlert className="w-4 h-4" /> Check Validation
                        </button>
                    )}

                    {/* Show Save Button only if Validated and Safe */}
                    {canSave && (
                        <button onClick={handleSave} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-medium shadow-sm">
                            <CheckCircle2 className="w-4 h-4" /> Save
                        </button>
                    )}

                    <button onClick={handleExport} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm font-medium shadow-sm">
                        <Download className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>


            {/* Validation Summary - Top Box (Ledger Master Style) */}
            {validationResult && (
                <div className="bg-white dark:bg-[#0f172a] rounded-lg p-4 border border-gray-200 dark:border-gray-800 m-4 mb-0">
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
                </div>
            )}


            {/* Grid */}
            <div className="flex-1 w-full overflow-hidden ag-theme-quartz p-4" style={{ height: '100%' }}>
                {(mode === 'loaded' || mode === 'preview' || mode === 'validated') && (
                    <AgGridReact
                        onGridReady={(params) => gridApiRef.current = params.api}
                        rowData={hsnData}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        rowClassRules={rowClassRules}
                        rowSelection="multiple"
                        onSelectionChanged={() => {
                            const rows = gridApiRef.current?.getSelectedNodes().map(n => n.rowIndex) || [];
                            setSelectedRows(new Set(rows.filter((r): r is number => r !== null)));
                        }}
                        onCellValueChanged={onCellValueChanged}
                        pagination={true}
                        paginationPageSize={1000}
                        paginationPageSizeSelector={[1000, 2000, 5000]}
                        suppressRowClickSelection={true}
                        enableCellTextSelection={true}
                        isExternalFilterPresent={isExternalFilterPresent}
                        doesExternalFilterPass={doesExternalFilterPass}
                        overlayNoRowsTemplate={`<div class="ag-overlay-no-rows-center">No data found</div>`}
                        gridOptions={{
                            headerHeight: 40,
                            rowHeight: 35,
                        }}
                    />
                )}
            </div>


            {/* Clear Data Modal Flow */}
            {clearFlowStep > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">

                        {/* Header */}
                        <div className="flex items-center gap-3 p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-[#0f172a]/50 rounded-t-xl">
                            <div className={`p-2 rounded-lg ${clearFlowStep === 4 ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                                {clearFlowStep === 4 ? <ShieldAlert className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {clearFlowStep === 4 ? 'Security Verification' : 'Confirmation Required'}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Step {clearFlowStep} of 4
                                </p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6">

                            {/* Step 1 */}
                            {clearFlowStep === 1 && (
                                <div className="space-y-4">
                                    <p className="text-gray-600 dark:text-gray-300 font-medium">
                                        Are you sure you want to clear all the HSN Master data?
                                    </p>

                                    {/* CAPTCHA */}
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
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

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            onClick={handleClearCancel}
                                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            No, Cancel
                                        </button>
                                        <button
                                            onClick={handleClearConfirm}
                                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                        >
                                            Yes, Proceed
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2 */}
                            {clearFlowStep === 2 && (
                                <div className="space-y-4">
                                    <p className="text-gray-600 dark:text-gray-300 font-medium">
                                        Have you discussed with the client that the data needs to be cleared?
                                    </p>

                                    {/* CAPTCHA */}
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
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

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            onClick={handleClearCancel}
                                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            No, Cancel
                                        </button>
                                        <button
                                            onClick={handleClearConfirm}
                                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                        >
                                            Yes, Discussed
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 3 */}
                            {clearFlowStep === 3 && (
                                <div className="space-y-4">
                                    <p className="text-gray-600 dark:text-gray-300 font-medium">
                                        Have you received an email from your client requesting to clear the data?
                                    </p>

                                    {/* CAPTCHA */}
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
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

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            onClick={handleClearCancel}
                                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            No, Cancel
                                        </button>
                                        <button
                                            onClick={handleClearConfirm}
                                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                        >
                                            Yes, Received
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Login */}
                            {clearFlowStep === 4 && (
                                <form onSubmit={handleCredentialSubmit} className="space-y-4">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Username</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all dark:text-white"
                                                value={clearCredentials.username}
                                                onChange={e => setClearCredentials({ ...clearCredentials, username: e.target.value })}
                                                required
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Password</label>
                                            <input
                                                type="password"
                                                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all dark:text-white"
                                                value={clearCredentials.password}
                                                onChange={e => setClearCredentials({ ...clearCredentials, password: e.target.value })}

                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Reason for Clearing</label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all dark:text-white resize-none h-20"
                                                value={clearCredentials.reason}
                                                onChange={e => setClearCredentials({ ...clearCredentials, reason: e.target.value })}
                                                required
                                                placeholder="Please specify why you are clearing this data..."
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <button
                                            type="button"
                                            onClick={handleClearCancel}
                                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isLoading ? 'Verifying...' : 'Authenticate & Clear Data'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
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
        </div>
    );
};

export default HSNMasterEnhanced;
