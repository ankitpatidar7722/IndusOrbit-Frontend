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
    getAllSpareParts,
    softDeleteSparePart,
    validateSpareParts,
    importSpareParts,
    SparePartMasterDto,
    SparePartValidationResultDto,
    SparePartRowValidation,
    ValidationStatus,
    clearAllSparePartData,
    getSparePartCount,
    HSNGroupDto,
    UnitDto,
    getHSNGroups,
    getUnits
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLoader } from '../context/LoaderContext';
import { getSparePartMasterStandardColumns, validateExcelColumns } from '../utils/excelColumnValidator';

// AG Grid Imports
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, GridApi, RowClassRules, IRowNode } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule]);

const SparePartMasterEnhanced: React.FC = () => {
    const { isDark } = useTheme();
    const { showMessage, ModalRenderer } = useMessageModal();
    const { showLoader, hideLoader } = useLoader();

    const [sparePartData, setSparePartData] = useState<SparePartMasterDto[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isLoading) showLoader();
        else hideLoader();
    }, [isLoading]);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [validationResult, setValidationResult] = useState<SparePartValidationResultDto | null>(null);
    const [mode, setMode] = useState<'idle' | 'loaded' | 'preview' | 'validated'>('idle');
    const [filterType, setFilterType] = useState<'all' | 'valid' | 'duplicate' | 'missing' | 'mismatch' | 'invalid'>('all');
    const [pendingMode, setPendingMode] = useState<{ type: 'load' | 'upload'; action: () => void } | null>(null);
    const [showModeSwitchModal, setShowModeSwitchModal] = useState(false);

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

    const [noDataMessage, setNoDataMessage] = useState<string | null>(null);
    const [hsnGroups, setHSNGroups] = useState<HSNGroupDto[]>([]);
    const [units, setUnits] = useState<UnitDto[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Clear Data Flow State
    const [clearFlowStep, setClearFlowStep] = useState<0 | 1 | 2 | 3 | 4>(0);
    const [clearCredentials, setClearCredentials] = useState({ username: '', password: '', reason: '' });

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
    const [clearActionType, setClearActionType] = useState<'clearOnly' | 'freshUpload'>('freshUpload');

    const handleClearAllDataTrigger = async (type: 'clearOnly' | 'freshUpload') => {
        setClearActionType(type);

        if (type === 'clearOnly') {
            setIsLoading(true);
            const count = await getSparePartCount();
            setIsLoading(false);

            if (count === 0) {
                setNoDataPopupGroup('Spare Part Master');
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
                const response = await clearAllSparePartData(clearCredentials.username, clearCredentials.password, clearCredentials.reason);
                deletedCount = response.deletedCount || 0;
            } catch (clearError: any) {
                if (clearError?.response?.status === 401 || clearError?.response?.status === 403) {
                    throw clearError;
                }
                deletedCount = 0;
            }

            if (deletedCount > 0 && clearActionType === 'clearOnly') {
                setClearSuccessInfo({ rowCount: deletedCount, groupName: 'Spare Part Master' });
            } else if (deletedCount === 0 && clearActionType === 'clearOnly') {
                showMessage('info', 'No Data Found', 'No existing data was found in the database for Spare Part Master. Nothing was cleared.');
            }
            setSparePartData([]);
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
            showMessage('error', 'Clear Data Failed', error.response?.data?.message || 'Unable to clear data. Please verify your credentials and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const fetchHSNGroups = async () => {
            try {
                const data = await getHSNGroups();
                setHSNGroups(data);
            } catch (error) {
                console.error('Failed to load HSN groups', error);
                showError('Failed to load HSN group master data');
            }
        };

        const fetchUnits = async () => {
            try {
                const data = await getUnits();
                setUnits(data);
            } catch (error) {
                console.error('Failed to load units', error);
                showError('Failed to load Unit master data');
            }
        };

        fetchHSNGroups();
        fetchUnits();
    }, []);

    // Validation Map for O(1) lookup by rowIndex
    const validationMap = useMemo(() => {
        if (!validationResult) return new Map<number, SparePartRowValidation>();
        const map = new Map<number, SparePartRowValidation>();
        validationResult.rows.forEach((row: SparePartRowValidation) => {
            if (typeof row.rowIndex === 'number') {
                map.set(row.rowIndex, row);
            }
        });
        return map;
    }, [validationResult]);

    // --- AG Grid Setup ---
    const gridApiRef = useRef<GridApi | null>(null);

    const sparePartTypes = ['Electronics', 'Electrical', 'Mechanical', 'Others'];

    // Column Definitions for AG Grid
    const columnDefs: ColDef[] = useMemo(() => {
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
            { field: 'sparePartName', headerName: 'SparePartName', minWidth: 150 },
            { field: 'sparePartGroup', headerName: 'SparePartGroup', minWidth: 120 },
            {
                field: 'hsnGroup',
                headerName: 'HSNGroup',
                minWidth: 120,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: () => {
                    return { values: hsnGroups.map(h => h.displayName) };
                },
                cellRenderer: DropdownCellRenderer
            },
            {
                field: 'unit',
                headerName: 'Unit',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: () => {
                    return { values: units.map(u => u.unitSymbol) };
                },
                cellRenderer: DropdownCellRenderer
            },
            { field: 'rate', headerName: 'Rate' },
            {
                field: 'sparePartType',
                headerName: 'SparePartType',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: () => {
                    return { values: sparePartTypes };
                },
                cellRenderer: DropdownCellRenderer
            },
            { field: 'minimumStockQty', headerName: 'MinimumStockQty' },
            { field: 'purchaseOrderQuantity', headerName: 'PurchaseOrderQuantity' },
            { field: 'stockRefCode', headerName: 'StockRefCode' },
            { field: 'supplierReference', headerName: 'SupplierReference' },
            { field: 'narration', headerName: 'Narration' },
        ];
    }, [hsnGroups, units]);

    const defaultColDef = useMemo(() => {
        return {
            editable: () => mode === 'preview' || mode === 'validated',
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 50,
            cellStyle: (params: any) => {
                // Use data index for stable lookup
                const rowIndex = sparePartData.indexOf(params.data);
                if (rowIndex === -1) return null;

                // Color mapping for validation status
                const colors = {
                    duplicate: isDark ? 'rgba(220, 38, 38, 0.2)' : '#fee2e2',     // Red
                    missing: isDark ? 'rgba(37, 99, 235, 0.2)' : '#dbeafe',       // Blue
                    mismatch: isDark ? 'rgba(202, 138, 4, 0.2)' : '#fef9c3',      // Yellow
                    invalid: isDark ? 'rgba(147, 51, 234, 0.2)' : '#f3e8ff'       // Purple
                };

                // Get row validation from map
                const rowValidation = validationMap.get(rowIndex);

                // row style for duplicate from validation
                if (rowValidation?.rowStatus === ValidationStatus.Duplicate) {
                    return { backgroundColor: colors.duplicate };
                }

                // cell specific style
                const colHeader = params.colDef.headerName;
                if (rowValidation?.cellValidations) {
                    const cellVal = rowValidation.cellValidations.find((cv: any) => cv.columnName === colHeader);
                    if (cellVal) {
                        if (cellVal.status === ValidationStatus.MissingData) return { backgroundColor: colors.missing };
                        if (cellVal.status === ValidationStatus.Mismatch) return { backgroundColor: colors.mismatch };
                        if (cellVal.status === ValidationStatus.InvalidContent) return { backgroundColor: colors.invalid };
                    }
                }
                return null;
            }
        };
    }, [mode, validationMap, isDark, sparePartData]);

    const handleCellEdit = useCallback((rowIndex: number, field: keyof SparePartMasterDto, newValue: any) => {
        setSparePartData(prevData => {
            const newData = [...prevData];
            newData[rowIndex] = { ...newData[rowIndex], [field]: newValue };
            return newData;
        });
    }, []);

    const onCellValueChanged = useCallback((params: any) => {
        const { colDef, newValue, data } = params;
        const rowIndex = sparePartData.indexOf(data);

        // Safety check
        if (rowIndex === -1) {
            console.error('Row data not found in state');
            return;
        }

        const field = colDef.field as keyof SparePartMasterDto;
        handleCellEdit(rowIndex, field, newValue);
    }, [handleCellEdit, sparePartData]);

    const onSelectionChanged = useCallback((event: any) => {
        const selectedNodes = event.api.getSelectedNodes();
        const selectedIndices = new Set<number>(selectedNodes.map((node: any) => node.rowIndex));
        setSelectedRows(selectedIndices);
    }, []);

    const rowClassRules = useMemo<RowClassRules>(() => ({
        'bg-red-50 dark:bg-red-900/10': (params) => {
            if (validationMap.size === 0) return false;
            const rowIndex = sparePartData.indexOf(params.data);
            if (rowIndex === -1) return false;
            return validationMap.get(rowIndex)?.rowStatus === ValidationStatus.Duplicate;
        },
        'font-medium': (params) => {
            if (validationMap.size === 0) return false;
            const rowIndex = sparePartData.indexOf(params.data);
            if (rowIndex === -1) return false;
            return validationMap.get(rowIndex)?.rowStatus === ValidationStatus.Duplicate;
        }
    }), [validationMap, sparePartData]);

    const onGridReady = (params: any) => {
        gridApiRef.current = params.api;
    };

    // External Filter Logic
    const isExternalFilterPresent = useCallback(() => {
        return filterType !== 'all';
    }, [filterType]);

    const doesExternalFilterPass = useCallback((node: IRowNode) => {
        if (!validationResult || filterType === 'all') return true;

        const rowIndex = sparePartData.indexOf(node.data);
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
    }, [validationResult, validationMap, filterType, sparePartData]);

    // Trigger redraw when validation results or data changes
    useEffect(() => {
        if (gridApiRef.current) {
            gridApiRef.current.redrawRows();
        }
    }, [validationResult, sparePartData, validationMap]);

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
            const data = await getAllSpareParts();
            setSparePartData(data);
            setMode('loaded');
            setValidationResult(null); // Clear validation
            setFilterType('all');
            setSelectedRows(new Set()); // Clear selection
            if (data.length > 0) {
                showMessage('success', 'Data Loaded', `Successfully loaded ${data.length} spare part record(s) from the database.`);
            }
        } catch (error: any) {
            console.error(error);
            showError('Failed to load spare parts');
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
                    setSparePartData([]);
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
        if (sparePartData.length > 0 && (mode === 'preview' || mode === 'validated')) {
            setShowReUploadModal(true);
            return;
        }

        // Otherwise just click
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const confirmReUpload = () => {
        setShowReUploadModal(false);
        setSparePartData([]);
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
            showMessage('error', 'No Selection', 'Please select at least one row to remove.');
            return;
        }

        if (!window.confirm(`Are you sure you want to remove ${selectedNodes.length} spare part(s)?`)) {
            return;
        }

        const selectedData = selectedNodes.map(node => node.data);
        const selectedIndices = new Set(selectedData.map(d => sparePartData.indexOf(d)).filter(i => i !== -1));

        if (mode === 'preview' || mode === 'validated') {
            const selectedIndicesList = Array.from(selectedIndices).sort((a, b) => b - a);
            const selectedSet = new Set(selectedIndicesList);

            // 1. Update data
            const newSparePartData = sparePartData.filter((_, index) => !selectedSet.has(index));
            setSparePartData(newSparePartData);
            setSelectedRows(new Set());

            // 2. Update validationResult (if exists)
            if (validationResult) {
                const oldRows = validationResult.rows;
                const newRows: SparePartRowValidation[] = [];
                const summary = { ...validationResult.summary };

                // Map to track index shifts
                const indexMap = new Map<number, number>();
                let shift = 0;
                for (let i = 0; i < sparePartData.length; i++) {
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
            for (const sparePart of rowsToDelete) {
                if (sparePart.sparePartID) {
                    await softDeleteSparePart(sparePart.sparePartID);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                showMessage('success', 'Records Deleted', `${deletedCount} spare part record(s) have been successfully removed from the database.`);
                await handleLoadData();
            } else {
                showMessage('warning', 'Nothing Deleted', 'No database records were found for deletion. Please select rows that exist in the database.');
            }
        } catch (error: any) {
            showMessage('error', 'Delete Failed', error?.response?.data?.error || 'Failed to remove spare parts.');
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
        const expectedName = 'Spare Part Master';
        const actualNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')).trim();
        if (actualNameWithoutExt.toLowerCase() !== expectedName.toLowerCase()) {
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
                const colValidation = validateExcelColumns(uploadedColumns, getSparePartMasterStandardColumns());
                if (!colValidation.isValid) {
                    showMessage('error', 'Invalid Excel Format', colValidation.message);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }
                // ─────────────────────────────────────────────────────────

                const spareParts: SparePartMasterDto[] = jsonData.map((row: any) => {
                    return {
                        sparePartName: row.SparePartName ? String(row.SparePartName) : undefined,
                        sparePartGroup: row.SparePartGroup ? String(row.SparePartGroup) : undefined,
                        hsnGroup: row.HSNGroup ? String(row.HSNGroup) : undefined,
                        unit: row.Unit ? String(row.Unit) : undefined,
                        rate: (row.Rate && !isNaN(parseFloat(row.Rate))) ? parseFloat(row.Rate) : undefined,
                        sparePartType: row.SparePartType ? String(row.SparePartType) : undefined,
                        minimumStockQty: (row.MinimumStockQty && !isNaN(parseFloat(row.MinimumStockQty))) ? parseFloat(row.MinimumStockQty) : undefined,
                        purchaseOrderQuantity: (row.PurchaseOrderQuantity && !isNaN(parseFloat(row.PurchaseOrderQuantity))) ? parseFloat(row.PurchaseOrderQuantity) : undefined,
                        stockRefCode: row.StockRefCode ? String(row.StockRefCode) : undefined,
                        supplierReference: row.SupplierReference ? String(row.SupplierReference) : undefined,
                        narration: row.Narration ? String(row.Narration) : undefined,
                    };
                });

                setSparePartData(spareParts);
                setMode('preview');
                showMessage('success', 'File Loaded', `Successfully loaded ${spareParts.length} row(s) from the Excel file. Please click "Check Validation" before importing.`);
            } catch (error) {
                showMessage('error', 'Parse Error', 'Failed to parse the Excel file. Please ensure the file is formatted correctly.');
                console.error(error);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleCheckValidation = async () => {
        if (sparePartData.length === 0) {
            showMessage('error', 'No Data', 'There is no data to validate. Please load data from the database or upload an Excel file first.');
            return;
        }

        setIsLoading(true);
        setValidationResult(null); // Reset UI first

        try {
            const result = await validateSpareParts(sparePartData);
            setValidationResult(result);

            if (result.isValid) {
                showMessage('success', 'Validation Passed', 'All records passed validation successfully. The data is ready to be imported.');
            } else {
                const totalIssues = result.summary.duplicateCount + result.summary.missingDataCount + result.summary.mismatchCount + result.summary.invalidContentCount;

                // Aggregate failures by column
                const columnFailures = new Map<string, Set<string>>();

                result.rows.forEach((row: SparePartRowValidation) => {
                    // 1. Handle Duplicates (Row Level)
                    if (row.rowStatus === ValidationStatus.Duplicate) {
                        const col = 'SparePartName';
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
            showMessage('error', 'Validation Failed', error?.response?.data?.error || 'An error occurred during validation. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        if (sparePartData.length === 0) {
            showError('No data to import');
            return;
        }

        setIsLoading(true);
        // Clear old validation errors to prevent showing stale messages after successful import
        setValidationModalContent(null);

        try {
            // 1. Full Re-Validation
            const result = await validateSpareParts(sparePartData);
            setValidationResult(result);

            if (!result.isValid) {
                const totalIssues = result.summary.duplicateCount + result.summary.missingDataCount + result.summary.mismatchCount + result.summary.invalidContentCount;

                // Aggregate failures by column
                const columnFailures = new Map<string, Set<string>>();

                result.rows.forEach((row: SparePartRowValidation) => {
                    // 1. Handle Duplicates
                    if (row.rowStatus === ValidationStatus.Duplicate) {
                        const col = 'SparePartName';
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

            // 2. Confirmation
            if (!window.confirm(`Validation passed. Import ${sparePartData.length} spare part(s)?`)) {
                return;
            }

            // 3. Import
            const importRes = await importSpareParts(sparePartData);

            if (importRes.success) {
                // Show success popup instead of toast
                setSuccessInfo({ rowCount: importRes.importedRows ?? sparePartData.length });

                // If some rows failed, also show failed rows list after success popup
                if (importRes.errorRows > 0 && importRes.errorMessages && importRes.errorMessages.length > 0) {
                    setValidationModalContent({
                        title: `${importRes.errorRows} Row(s) Failed During Import`,
                        messages: importRes.errorMessages
                    });
                }
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
            console.error('[SparePartImport] Error:', error);
            const errorMsg = error?.response?.data?.error || error?.message || 'Import failed';
            showError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Spare Part Master');

        const exportColumns = [
            'SparePartName', 'SparePartGroup', 'HSNGroup', 'Unit', 'Rate',
            'SparePartType', 'MinimumStockQty', 'PurchaseOrderQuantity',
            'StockRefCode', 'SupplierReference', 'Narration'
        ];

        worksheet.columns = exportColumns.map(col => ({ header: col, key: col, width: 20 }));
        worksheet.getRow(1).font = { bold: true };

        // Color mapping for validation status
        const colors = {
            duplicate: 'FFFFE0E0',     // Light Red
            missing: 'FFD0E8FF',       // Light Blue
            mismatch: 'FFFFFF99',      // Light Yellow
            invalid: 'FFE8D0FF'        // Light Purple
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

        sparePartData.forEach((sparePart, rowIndex) => {
            if (!passesExportFilter(rowIndex)) return;

            const rowValues: any = {
                SparePartName: sparePart.sparePartName,
                SparePartGroup: sparePart.sparePartGroup,
                HSNGroup: sparePart.hsnGroup,
                Unit: sparePart.unit,
                Rate: sparePart.rate,
                SparePartType: sparePart.sparePartType,
                MinimumStockQty: sparePart.minimumStockQty,
                PurchaseOrderQuantity: sparePart.purchaseOrderQuantity,
                StockRefCode: sparePart.stockRefCode,
                SupplierReference: sparePart.supplierReference,
                Narration: sparePart.narration
            };

            const excelRow = worksheet.addRow(rowValues);

            // Apply validation colors if validation results exist
            if (validationResult && validationMap.has(rowIndex)) {
                const rowValidation = validationMap.get(rowIndex);

                if (rowValidation) {
                    // For duplicate rows, color the entire row red
                    if (rowValidation.rowStatus === ValidationStatus.Duplicate) {
                        excelRow.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: colors.duplicate }
                            };
                        });
                    } else {
                        // For other validations, color specific cells
                        rowValidation.cellValidations?.forEach((cellVal: any) => {
                            const colIndex = exportColumns.indexOf(cellVal.columnName) + 1;
                            if (colIndex > 0) {
                                const cell = excelRow.getCell(colIndex);
                                let fillColor = '';

                                if (cellVal.status === ValidationStatus.MissingData) {
                                    fillColor = colors.missing;
                                } else if (cellVal.status === ValidationStatus.Mismatch) {
                                    fillColor = colors.mismatch;
                                } else if (cellVal.status === ValidationStatus.InvalidContent) {
                                    fillColor = colors.invalid;
                                }

                                if (fillColor) {
                                    cell.fill = {
                                        type: 'pattern',
                                        pattern: 'solid',
                                        fgColor: { argb: fillColor }
                                    };
                                }
                            }
                        });
                    }
                }
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Spare Part Master.xlsx`);
        showMessage('success', 'Export Complete', 'The data has been exported to an Excel file and downloaded successfully.');
    };

    return (
        <div className="space-y-4">

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
                                {successInfo.rowCount === 1 ? 'row' : 'rows'} into <span className="font-semibold text-gray-800 dark:text-white">Spare Parts Master</span>
                            </p>
                            <button
                                onClick={() => {
                                    setSuccessInfo(null);
                                    setSparePartData([]);
                                    setValidationResult(null);
                                    setMode('idle');
                                    if (fileInputRef.current) fileInputRef.current.value = '';
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
                        setSparePartData([]);
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
                        disabled={isLoading}
                        className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 flex items-center gap-2 transition-colors animate-pulse"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        Save Data
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
                </div>
            )}

            {/* Grid Section */}
            {(sparePartData.length > 0 || mode === 'loaded' || mode === 'validated') && (
                <div className="bg-white dark:bg-[#0f172a] rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1e293b]">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {mode === 'loaded' ? 'Database Records' : 'Excel Preview'} ({sparePartData.length} rows)
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
                            .ag-theme-quartz, .ag-theme-quartz-dark {
                                --ag-grid-size: 8px;
                                --ag-list-item-height: 40px;
                                --ag-row-height: 48px;
                                --ag-header-height: 52px;
                                --ag-font-size: 14px;
                                --ag-font-family: 'Inter', system-ui, sans-serif;
                                --ag-borders: solid 1px;
                                --ag-row-border-style: solid;
                                --ag-row-border-width: 1px;
                                --ag-header-column-separator-display: block;
                                --ag-header-column-separator-height: 50%;
                                --ag-header-column-separator-width: 1px;
                                --ag-header-column-separator-color: var(--ag-border-color);
                                --ag-header-column-resize-handle-display: block;
                                --ag-header-column-resize-handle-height: 100%;
                                --ag-header-column-resize-handle-width: 2px;
                                --ag-header-column-resize-handle-color: var(--ag-border-color);
                            }
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
                            /* Force dark mode backgrounds */
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
                            .ag-header-cell {
                                border-right: 1px solid var(--ag-border-color);
                            }
                            .ag-header-cell-text {
                                font-weight: 600;
                            }
                            .ag-pinned-left-header, .ag-pinned-left-cols-container {
                                box-shadow: 4px 0 8px -4px rgba(0,0,0,0.2);
                                border-right: 1px solid var(--ag-border-color);
                                z-index: 10 !important;
                            }
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
                            rowData={sparePartData}
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
                            overlayNoRowsTemplate={`<div class="ag-overlay-no-rows-center">No data found</div>`}
                        />
                    </div>
                </div>
            )}

            {sparePartData.length === 0 && mode === 'idle' && (
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
                            {clearFlowStep === 1 && `Are you sure you want to clear all the Spare Part Master data?`}
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
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password <span className="text-gray-400 text-xs">(Optional)</span></label>
                                <input
                                    type="password"
                                    className="w-full p-2 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    value={clearCredentials.password}
                                    onChange={e => setClearCredentials({ ...clearCredentials, password: e.target.value })}
                                    placeholder="Leave blank if no password is set"
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
        </div>
    );
};

export default SparePartMasterEnhanced;
