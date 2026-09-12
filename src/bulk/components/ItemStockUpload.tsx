import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Database, Upload, Download, Trash2, AlertCircle, CheckCircle2, RotateCcw, Lock, ShieldAlert, RefreshCw, X, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, GridApi, RowClassRules, IRowNode } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { useTheme } from '../context/ThemeContext';
import { useMessageModal } from './MessageModal';
import {
    enrichItemStock, importItemStock, validateItemStock, loadStockData, loadMasterData,
    resetItemStock, resetFloorStock,
    getStockWarehouses, getStockBins,
    ItemStockEnrichedRow, ItemStockImportResult, ItemStockValidationResult,
    ItemStockRowValidation, ItemStockCellValidation, WarehouseDto
} from '../services/api';
import DropdownCellRenderer from './DropdownCellRenderer';

ModuleRegistry.registerModules([AllCommunityModule]);

interface ItemStockUploadProps {
    itemGroupId: number;
    itemGroupName: string;
    onHasDataChange?: (hasData: boolean) => void;
}

const ItemStockUpload: React.FC<ItemStockUploadProps> = ({ itemGroupId, itemGroupName, onHasDataChange }) => {
    const { isDark } = useTheme();

    // ─── State ───────────────────────────────────────────────────────────────
    const [gridData, setGridData] = useState<ItemStockEnrichedRow[]>([]);
    const [mode, setMode] = useState<'idle' | 'loaded' | 'preview' | 'validated' | 'master-template'>('idle');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [gridApi, setGridApi] = useState<GridApi | null>(null);

    // Warehouses
    const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
    const [binsCache, setBinsCache] = useState<Record<string, WarehouseDto[]>>({});

    // Validation
    const [validationResult, setValidationResult] = useState<ItemStockValidationResult | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'valid' | 'duplicate' | 'missing' | 'mismatch' | 'invalid'>('all');

    // Modals
    const { showMessage, ModalRenderer: MessageModalRenderer } = useMessageModal();
    const [successInfo, setSuccessInfo] = useState<{ rowCount: number; groupName: string } | null>(null);
    const [importProgress, setImportProgress] = useState<{ active: boolean; step: string; pct: number; total: number } | null>(null);

    // Reset Confirmation Flow State (3 CAPTCHA steps + 1 security verification)
    const [resetFlowStep, setResetFlowStep] = useState<0 | 1 | 2 | 3 | 4>(0);
    const [resetFlowType, setResetFlowType] = useState<'item' | 'floor'>('item');
    const [resetCredentials, setResetCredentials] = useState({ username: '', password: '', reason: '' });
    // Optional date-range filter for Reset (blank = reset ALL). Asked as the FIRST step.
    const [resetDateRange, setResetDateRange] = useState({ fromDate: '', toDate: '' });
    const [showDateModal, setShowDateModal] = useState(false);
    const [dateModalError, setDateModalError] = useState<string | null>(null);
    const [captchaQuestion, setCaptchaQuestion] = useState({ num1: 0, num2: 0, answer: 0 });
    const [captchaInput, setCaptchaInput] = useState('');
    const [captchaError, setCaptchaError] = useState(false);
    const [resetAuthError, setResetAuthError] = useState<string | null>(null);

    // Item selection modal (before CAPTCHA — only for 'item' reset)
    const [showItemSelect, setShowItemSelect] = useState(false);
    const [itemSelectList, setItemSelectList] = useState<{ itemId: number; itemCode: string; itemName: string; totalQty: number; stockUnit: string }[]>([]);
    const [itemSelectLoading, setItemSelectLoading] = useState(false);
    const [itemSelectSearch, setItemSelectSearch] = useState('');
    const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());

    // State-switch confirmation
    const [switchConfirm, setSwitchConfirm] = useState<{ action: 'upload' | 'load' | 'load-master' | 'reset-item' | 'reset-floor'; message: string } | null>(null);
    const pendingFileRef = useRef<File | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Notify parent when data exists/clears ──────────────────────────────
    useEffect(() => {
        onHasDataChange?.(gridData.length > 0);
    }, [gridData.length, onHasDataChange]);

    // ─── Fetch warehouses on mount ───────────────────────────────────────────
    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const data = await getStockWarehouses();
                setWarehouses(data);
            } catch (err) {
                console.error('Failed to load warehouses', err);
            }
        };
        fetchWarehouses();
    }, []);

    const warehouseNames = useMemo(() => {
        const names = [...new Set(warehouses.map(w => w.warehouseName))];
        return names.sort();
    }, [warehouses]);

    const getBinsForWarehouse = useCallback(async (whName: string): Promise<string[]> => {
        if (binsCache[whName]) {
            return binsCache[whName].map(b => b.binName || '').filter(Boolean);
        }
        try {
            const bins = await getStockBins(whName);
            setBinsCache(prev => ({ ...prev, [whName]: bins }));
            return bins.map(b => b.binName || '').filter(Boolean);
        } catch {
            return [];
        }
    }, [binsCache]);

    // ─── Validation Map (rowIndex → rowValidation) ───────────────────────────
    const validationMap = useMemo(() => {
        const map = new Map<number, ItemStockRowValidation>();
        if (validationResult) {
            validationResult.rows.forEach((row) => {
                map.set(row.rowIndex, row);
            });
        }
        return map;
    }, [validationResult]);

    // ─── Force grid refresh when validation result changes ────────────────────
    useEffect(() => {
        if (gridApi) {
            // Force re-render all cells so cellStyle picks up new validation data
            gridApi.refreshCells({ force: true });
            gridApi.redrawRows();
        }
    }, [validationResult, gridApi]);

    // ─── Find cell validation helper ─────────────────────────────────────────
    const findCellValidation = useCallback((rowValidation: ItemStockRowValidation | undefined, field: string | undefined, headerName: string | undefined): ItemStockCellValidation | null => {
        if (!rowValidation?.cellValidations) return null;
        for (const cv of rowValidation.cellValidations) {
            const colName = cv.columnName?.toLowerCase() ?? '';
            if ((field && colName === field.toLowerCase()) || (headerName && colName === headerName.toLowerCase())) {
                return cv;
            }
        }
        return null;
    }, []);

    // ─── State label helper ──────────────────────────────────────────────────
    const getModeLabel = () => {
        switch (mode) {
            case 'preview': return 'Upload Excel';
            case 'validated': return 'Upload Excel (Validated)';
            case 'loaded': return 'Check Stock';
            default: return '';
        }
    };

    // ─── Excel Filename Validation & Upload ──────────────────────────────────
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Step 1: File Extension Check (FIRST PRIORITY)
        const fileName = file.name;
        const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

        if (extension !== '.xlsx') {
            showMessage('error', 'Invalid Excel Version',
                'Your Excel file format is not supported.\n\nPlease upload file in .xlsx format only.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Step 2: File Name Validation (Only if extension is correct)
        const expectedName = `${itemGroupName}Stock`;
        const actualNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')).trim();

        if (actualNameWithoutExt.toLowerCase() !== expectedName.toLowerCase()) {
            showMessage('error', 'Invalid File Name',
                `You have selected wrong file.\n\nPlease upload correct file for selected Module and Group.\n\nExpected: ${expectedName}.xlsx`);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // If data exists, ask confirmation before switching
        if (mode !== 'idle' && gridData.length > 0) {
            pendingFileRef.current = file;
            setSwitchConfirm({
                action: 'upload',
                message: `You are currently in "${getModeLabel()}" mode with ${gridData.length} row(s). Switching to Upload Excel will clear the current data. Do you want to continue?`
            });
            return;
        }

        await processFileUpload(file);
    };

    const processFileUpload = async (file: File) => {
        setValidationResult(null);
        setFilterType('all');
        setGridData([]);
        setSelectedRows(new Set());
        setIsLoading(true);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null })
                .filter((r: any) => r.ItemCode || r.itemCode || r.ITEMCODE);

            if (jsonData.length === 0) {
                showMessage('error', 'Empty Excel', 'Excel file is empty. No rows found.');
                setIsLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            // Check required columns
            const keys = Object.keys(jsonData[0]);
            const hasItemCode = keys.some(k => k.toLowerCase() === 'itemcode');
            if (!hasItemCode) {
                showMessage('error', 'Missing Column', 'Excel must contain an ItemCode column.');
                setIsLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            const hasQty = keys.some(k => k.toLowerCase() === 'receiptquantity' || k.toLowerCase() === 'quantity');
            if (!hasQty) {
                showMessage('error', 'Missing Column', 'Excel must contain a ReceiptQuantity (or Quantity) column.');
                setIsLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            // PAPER group stores quantities in whole Sheets — round away Excel float noise
            // (e.g. 18 stored as 17.999999999999943 in IEEE-754).
            const isPaper = itemGroupName.toUpperCase() === 'PAPER';

            // Safe converters: backend requires decimal (non-nullable) for qty/rate,
            // decimal? for gsm/sizeL/sizeW, and string? for quality/finish/manufecturer.
            // JSON.stringify converts NaN → null, which fails model binding for non-nullable decimals.
            const toSafeNum = (val: any): number => {
                const n = Number(val);
                return isFinite(n) ? n : 0;
            };
            const toOptNum = (val: any): number | undefined => {
                if (val === null || val === undefined || val === '') return undefined;
                const n = Number(val);
                return isFinite(n) ? n : undefined;
            };
            const toOptStr = (val: any): string | undefined => {
                if (val === null || val === undefined) return undefined;
                const s = String(val).trim();
                return s === '' ? undefined : s;
            };

            // Map Excel rows
            const rows = jsonData.map((row: any) => {
                const rawQty = toSafeNum(row.ReceiptQuantity ?? row.receiptQuantity ?? row.Quantity ?? row.quantity ?? 0);
                const rawRate = toSafeNum(row.LandedRate ?? row.landedRate ?? row.Rate ?? row.rate ?? 0);
                return {
                    itemCode: String(row.ItemCode || row.itemCode || row.ITEMCODE || '').trim() || undefined,
                    receiptQuantity: isPaper ? Math.round(rawQty) : rawQty,
                    landedRate: Math.round(rawRate * 1000) / 1000,
                    stockUnit: String(row.StockUnit || row.stockUnit || row.STOCKUNIT || '').trim() || undefined,
                    warehouseName: String(row.WarehouseName || row.warehouseName || row.WAREHOUSENAME || '').trim() || undefined,
                    binName: String(row.BinName || row.binName || row.BINNAME || '').trim() || undefined,
                    batchNo: String(row.BatchNo || row.batchNo || row.BATCHNO || '').trim() || undefined,
                    supplierBatchNo: String(row.SupplierBatchNo || row.supplierBatchNo || row.SUPPLIERBATCHNO || '').trim() || undefined,
                    quality: toOptStr(row.Quality ?? row.quality ?? row.QUALITY),
                    gsm: toOptNum(row.GSM ?? row.gsm ?? row.GSMValue ?? row.GSMvalue),
                    manufecturer: toOptStr(row.Manufecturer ?? row.manufecturer ?? row.Manufacturer ?? row.manufacturer),
                    finish: toOptStr(row.Finish ?? row.finish ?? row.FINISH),
                    sizeL: toOptNum(row.SizeL ?? row.sizeL ?? row.SIZEL),
                    sizeW: toOptNum(row.SizeW ?? row.sizeW ?? row.SIZEW),
                };
            });

            // Enrich via backend (validate ItemCodes, fill ItemID/BatchNo/StockUnit)
            const enrichResult = await enrichItemStock(rows, itemGroupId);
            setGridData(enrichResult.rows);
            setMode('preview');

            // Pre-load bins for all unique warehouses in the data
            const uniqueWarehouses = [...new Set(enrichResult.rows
                .map(r => r.warehouseName?.trim())
                .filter(Boolean)
            )] as string[];

            for (const whName of uniqueWarehouses) {
                if (!binsCache[whName]) {
                    try {
                        const bins = await getStockBins(whName);
                        setBinsCache(prev => ({ ...prev, [whName]: bins }));
                    } catch {
                        // Ignore errors
                    }
                }
            }

        } catch (error: any) {
            const errMsg = error?.response?.data?.message
                || error?.response?.data?.title
                || error?.message
                || 'Failed to process Excel file.';
            showMessage('error', 'Upload Error', errMsg);
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleLoadMasterData = async () => {
        // If data exists, ask confirmation before switching
        if (mode !== 'idle' && gridData.length > 0) {
            setSwitchConfirm({
                action: 'load-master',
                message: `You are currently in "${getModeLabel()}" mode with ${gridData.length} row(s). Switching to Load Data (Master Template) will clear the current data. Do you want to continue?`
            });
            return;
        }

        await processLoadMasterData();
    };

    const processLoadMasterData = async () => {
        setIsLoading(true);
        setValidationResult(null);
        setFilterType('all');
        setSelectedRows(new Set());

        try {
            const data = await loadMasterData(itemGroupId);
            setGridData(data || []);
            setMode('master-template'); // Master data acts as a template for new uploads
        } catch (error: any) {
            showMessage('error', 'Load Master Error', error?.response?.data?.message || error?.message || 'Failed to load master records.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Check Validation ────────────────────────────────────────────────────
    const handleCheckValidation = async () => {
        if (gridData.length === 0) {
            showMessage('info', 'No Data', 'There is no data to validate.');
            return;
        }

        setValidationResult(null);
        setFilterType('all');
        setIsLoading(true);

        try {
            // Pre-process data to ensure numeric fields are valid numbers (prevent 400 error for empty strings)
            const sanitizedData = gridData.map(row => ({
                ...row,
                receiptQuantity: Number(row.receiptQuantity) || 0,
                landedRate: Number(row.landedRate) || 0
            }));

            const result = await validateItemStock(sanitizedData, itemGroupId);
            setValidationResult(result);
            setMode('validated');

            if (result.isValid) {
                showMessage('success', 'Validation Passed', 'All records passed validation successfully. The data is ready to be imported.');
            } else {
                // Build column-wise failure messages
                const columnFailures = new Map<string, Set<string>>();
                result.rows.forEach((row: ItemStockRowValidation) => {
                    if (row.cellValidations && row.cellValidations.length > 0) {
                        row.cellValidations.forEach((cell: ItemStockCellValidation) => {
                            const col = cell.columnName || 'Unknown';
                            if (!columnFailures.has(col)) columnFailures.set(col, new Set());

                            let reason = cell.validationMessage;
                            if (cell.status === 'Duplicate') reason = 'Duplicate data found';
                            else if (cell.status === 'MissingData') reason = 'Missing data';
                            else if (cell.status === 'Mismatch') reason = 'Mismatch with Master';
                            else if (cell.status === 'InvalidContent') reason = 'Invalid format';

                            columnFailures.get(col)!.add(reason);
                        });
                    }
                });

                const totalIssues = (result.summary.duplicateCount || 0)
                    + (result.summary.missingDataCount || 0)
                    + (result.summary.mismatchCount || 0)
                    + (result.summary.invalidContentCount || 0);

                const messages: string[] = [];
                columnFailures.forEach((reasons, col) => {
                    messages.push(`${col}: ${Array.from(reasons).join(', ')}`);
                });

                showMessage('error', `Validation Failed: ${totalIssues} Issue${totalIssues !== 1 ? 's' : ''} Found`,
                    messages.length > 0 ? messages.join('\n') : 'Validation failed. Please check the grid for errors.');
            }
        } catch (error: any) {
            showMessage('error', 'Validation Error', error?.response?.data?.message || error?.message || 'Validation failed.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Save Data (Import) ──────────────────────────────────────────────────
    const handleImport = async () => {
        if (gridData.length === 0) {
            showMessage('info', 'No Data', 'No data to import.');
            return;
        }

        setIsLoading(true);

        try {
            // Re-validate (duplicate gate)
            const reValidation = await validateItemStock(gridData, itemGroupId);
            setValidationResult(reValidation);

            const duplicateRows = reValidation.rows.filter((r: ItemStockRowValidation) =>
                r.cellValidations?.some((cv: ItemStockCellValidation) => cv.status === 'Duplicate'));
            if (duplicateRows.length > 0) {
                setImportProgress(null);
                const messages = duplicateRows.map((r: ItemStockRowValidation) => `Row ${r.rowIndex + 1}: ${r.errorMessage || 'Duplicate row (same ItemID, BatchNo, WarehouseName, BinName)'}`);
                showMessage('error', `Import Blocked: ${duplicateRows.length} Duplicate Row(s) Found`, messages.join('\n'));
                setIsLoading(false);
                return;
            }

            // Check if there are any other validation issues
            if (!reValidation.isValid) {
                setImportProgress(null);
                showMessage('error', 'Import Blocked', 'Please fix all validation errors before saving.');
                setIsLoading(false);
                return;
            }

            // Show progress overlay
            const total = gridData.length;
            setImportProgress({ active: true, step: `Importing Stock (${itemGroupName})...`, pct: 10, total });

            const progressTimer = setInterval(() => {
                setImportProgress(prev => {
                    if (!prev) return prev;
                    const next = Math.min(prev.pct + 15, 90);
                    return { ...prev, pct: next };
                });
            }, 800);

            // Build import rows
            const importRows = gridData.map((r, idx) => ({
                rowIndex: idx + 1,
                itemCode: r.itemCode,
                receiptQuantity: r.receiptQuantity,
                landedRate: r.landedRate,
                stockUnit: r.stockUnit,
                batchNo: r.batchNo,
                supplierBatchNo: r.supplierBatchNo,
                warehouseName: r.warehouseName,
                binName: r.binName,
            }));

            let importRes: ItemStockImportResult | null = null;
            try {
                importRes = await importItemStock(importRows, itemGroupId);
            } catch (axiosErr: any) {
                importRes = axiosErr?.response?.data ?? null;
                if (!importRes) {
                    clearInterval(progressTimer);
                    setImportProgress(null);
                    showMessage('error', 'Import Failed', axiosErr?.message || 'Import request failed.');
                    setIsLoading(false);
                    return;
                }
            } finally {
                clearInterval(progressTimer);
                setImportProgress({ active: true, step: 'Finalising...', pct: 100, total });
                await new Promise(r => setTimeout(r, 400));
                setImportProgress(null);
            }

            const imported = importRes?.importedRows ?? 0;
            const isSuccess = importRes?.success ?? false;
            const errRows = importRes?.failedRows ?? 0;
            const errMsgs = importRes?.errorMessages ?? [];

            if (isSuccess || imported > 0) {
                setSuccessInfo({ rowCount: imported || gridData.length, groupName: itemGroupName });
                if (errRows > 0 && errMsgs.length > 0) {
                    showMessage('warning', `${errRows} Row(s) Skipped During Import`, errMsgs.join('\n'));
                }
            } else {
                if (errMsgs.length > 0) {
                    showMessage('error', 'Import Failed', errMsgs.join('\n'));
                } else {
                    const msg = importRes?.message ?? 'Import failed - no rows were inserted.';
                    showMessage('error', 'Import Failed', msg);
                }
            }
        } catch (error: any) {
            setImportProgress(null);
            showMessage('error', 'Import Error', error?.message || 'An unexpected error occurred during import.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Delete Excel Row ────────────────────────────────────────────────────
    const handleRemoveSelectedRows = () => {
        if (selectedRows.size === 0) {
            showMessage('info', 'No Selection', 'Please select at least one row to remove.');
            return;
        }

        if (!window.confirm(`Are you sure you want to remove ${selectedRows.size} row(s)?`)) {
            return;
        }

        const selectedIndicesList = Array.from(selectedRows).sort((a, b) => b - a);
        const selectedSet = new Set(selectedIndicesList);

        // 1. Update data
        const newData = gridData.filter((_, index) => !selectedSet.has(index));
        setGridData(newData);
        setSelectedRows(new Set());

        // 2. Update validationResult (if exists)
        if (validationResult) {
            const oldRows = validationResult.rows;
            const newRows: any[] = [];
            const summary = { ...validationResult.summary };

            // Map to track index shifts
            const indexMap = new Map<number, number>();
            let shift = 0;
            for (let i = 0; i < gridData.length; i++) {
                if (selectedSet.has(i)) {
                    shift++;
                } else {
                    indexMap.set(i, i - shift);
                }
            }

            // Filter and re-index rows
            oldRows.forEach((row: any) => {
                if (selectedSet.has(row.rowIndex)) {
                    // This row was deleted
                    summary.totalRows--;
                    
                    const isDuplicate = row.cellValidations?.some((cv: any) => cv.status === 'Duplicate') || row.rowStatus === 'Duplicate';
                    if (isDuplicate) summary.duplicateCount--;
                    else if (row.isValid || row.rowStatus === 'Valid') summary.validRows--;

                    row.cellValidations?.forEach((cv: any) => {
                        if (cv.status === 'MissingData') summary.missingDataCount--;
                        else if (cv.status === 'Mismatch') summary.mismatchCount--;
                        else if (cv.status === 'InvalidContent') summary.invalidContentCount--;
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

            const isStillValid = summary.duplicateCount <= 0 &&
                summary.missingDataCount <= 0 &&
                summary.mismatchCount <= 0 &&
                summary.invalidContentCount <= 0;

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

        showMessage('success', 'Rows Removed', `${selectedIndicesList.length} row(s) have been removed from the preview.`);
    };

    // ─── Load Stock from Database ───────────────────────────────────────────
    const handleLoadStock = async () => {
        // If data exists, ask confirmation before switching
        if (mode !== 'idle' && gridData.length > 0) {
            setSwitchConfirm({
                action: 'load',
                message: `You are currently in "${getModeLabel()}" mode with ${gridData.length} row(s). Switching to Check Stock will clear the current data. Do you want to continue?`
            });
            return;
        }

        await processLoadStock();
    };

    const processLoadStock = async () => {
        setIsLoading(true);
        setValidationResult(null);
        setFilterType('all');
        setSelectedRows(new Set());

        try {
            const data = await loadStockData(itemGroupId);
            setGridData(data || []);
            setMode('loaded');
        } catch (error: any) {
            showMessage('error', 'Load Error', error?.response?.data?.message || error?.message || 'Failed to load stock data.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── CAPTCHA Helper ─────────────────────────────────────────────────────
    const generateCaptcha = () => {
        const num1 = Math.floor(Math.random() * 50) + 20;
        const num2 = Math.floor(Math.random() * 30) + 10;
        setCaptchaQuestion({ num1, num2, answer: num1 - num2 });
        setCaptchaInput('');
        setCaptchaError(false);
    };

    // ─── Reset Flow: Trigger (opens Date-Range step FIRST) ──────────────────
    const handleResetTrigger = (type: 'item' | 'floor') => {
        const label = type === 'item' ? 'Reset Item Stock' : 'Reset Floor Stock';

        // If data exists in grid, ask confirmation before proceeding
        if (mode !== 'idle' && gridData.length > 0) {
            setSwitchConfirm({
                action: type === 'item' ? 'reset-item' : 'reset-floor',
                message: `You are currently in "${getModeLabel()}" mode with ${gridData.length} row(s). Proceeding with ${label} will clear the current data. Do you want to continue?`
            });
            return;
        }

        openDateModal(type);
    };

    // ─── Date-Range Modal: the FIRST step (asked before CAPTCHA/credentials) ─
    const openDateModal = (type: 'item' | 'floor') => {
        setResetFlowType(type);
        setResetDateRange({ fromDate: '', toDate: '' });
        setDateModalError(null);
        setShowDateModal(true);
    };

    const handleDateModalNext = () => {
        const { fromDate, toDate } = resetDateRange;
        if ((fromDate && !toDate) || (!fromDate && toDate)) {
            setDateModalError('Please select BOTH From Date and To Date, or leave both blank to reset ALL stock.');
            return;
        }
        if (fromDate && toDate && fromDate > toDate) {
            setDateModalError('From Date cannot be later than To Date.');
            return;
        }
        setShowDateModal(false);
        setDateModalError(null);

        // Continue with the existing flow: item → item-select, floor → CAPTCHA
        if (resetFlowType === 'item') {
            openItemSelectModal();
        } else {
            setResetFlowStep(1);
            generateCaptcha();
        }
    };

    // ─── Item Selection Modal: open and load items ───────────────────────────
    const openItemSelectModal = async () => {
        setShowItemSelect(true);
        setItemSelectLoading(true);
        setItemSelectSearch('');
        setSelectedItemIds(new Set());
        try {
            const data = await loadStockData(itemGroupId);
            const grouped = new Map<number, { itemId: number; itemCode: string; itemName: string; totalQty: number; stockUnit: string }>();
            for (const row of data) {
                if (!grouped.has(row.itemID)) {
                    grouped.set(row.itemID, {
                        itemId: row.itemID,
                        itemCode: row.itemCode ?? '',
                        itemName: row.itemName ?? '',
                        totalQty: 0,
                        stockUnit: row.stockUnit ?? '',
                    });
                }
                grouped.get(row.itemID)!.totalQty += row.receiptQuantity;
            }
            const list = [...grouped.values()].sort((a, b) => a.itemCode.localeCompare(b.itemCode));
            setItemSelectList(list);

            if (selectedRows.size > 0) {
                // Pre-select only the items the user chose in the grid
                const gridSelectedItemIds = new Set<number>(
                    Array.from(selectedRows)
                        .map(idx => gridData[idx]?.itemID)
                        .filter((id): id is number => id != null && id > 0)
                );
                setSelectedItemIds(gridSelectedItemIds);
            } else {
                // No grid selection → default all selected
                setSelectedItemIds(new Set(list.map(i => i.itemId)));
            }
        } catch {
            showMessage('error', 'Error', 'Failed to load stock items for selection.');
            setShowItemSelect(false);
        } finally {
            setItemSelectLoading(false);
        }
    };

    const handleItemSelectNext = () => {
        setShowItemSelect(false);
        setResetFlowStep(1);
        generateCaptcha();
    };

    const handleItemSelectCancel = () => {
        setShowItemSelect(false);
        setItemSelectList([]);
        setSelectedItemIds(new Set());
    };

    // ─── Reset Flow: Confirm CAPTCHA (Steps 1→2→3→4) ────────────────────────
    const handleResetConfirm = (step: 1 | 2 | 3) => {
        const userAnswer = parseInt(captchaInput);
        if (isNaN(userAnswer) || userAnswer !== captchaQuestion.answer) {
            setCaptchaError(true);
            return;
        }
        setResetFlowStep((step + 1) as any);
        generateCaptcha();
    };

    // ─── Reset Flow: Cancel ──────────────────────────────────────────────────
    const handleResetCancel = () => {
        setResetFlowStep(0);
        setResetCredentials({ username: '', password: '', reason: '' });
        setResetDateRange({ fromDate: '', toDate: '' });
        setShowDateModal(false);
        setDateModalError(null);
        setCaptchaInput('');
        setCaptchaError(false);
        setShowItemSelect(false);
        setItemSelectList([]);
        setSelectedItemIds(new Set());
    };

    // ─── State-Switch Confirmation Handler ────────────────────────────────────
    const handleSwitchConfirm = async () => {
        if (!switchConfirm) return;
        const action = switchConfirm.action;
        setSwitchConfirm(null);

        // Clear current state
        setGridData([]);
        setMode('idle');
        setValidationResult(null);
        setFilterType('all');
        setSelectedRows(new Set());
        setSuccessInfo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Execute the pending action
        if (action === 'upload' && pendingFileRef.current) {
            const file = pendingFileRef.current;
            pendingFileRef.current = null;
            await processFileUpload(file);
        } else if (action === 'load') {
            await processLoadStock();
        } else if (action === 'load-master') {
            await processLoadMasterData();
        } else if (action === 'reset-item') {
            openDateModal('item');
        } else if (action === 'reset-floor') {
            openDateModal('floor');
        }
    };

    const handleSwitchCancel = () => {
        setSwitchConfirm(null);
        pendingFileRef.current = null;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ─── Reset Flow: Final Submit (Step 4 credentials) ──────────────────────
    const handleResetCredentialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Date range was already chosen & validated in the first (Date-Range) step.
        setIsLoading(true);

        try {
            const { username, password, reason } = resetCredentials;
            const result = resetFlowType === 'item'
                ? await resetItemStock(
                    itemGroupId, username, password, reason,
                    selectedItemIds.size > 0 && selectedItemIds.size < itemSelectList.length
                        ? [...selectedItemIds]
                        : undefined,
                    resetDateRange.fromDate || undefined, resetDateRange.toDate || undefined
                )
                : await resetFloorStock(
                    itemGroupId, username, password, reason,
                    resetDateRange.fromDate || undefined, resetDateRange.toDate || undefined
                );

            const label = resetFlowType === 'item' ? 'Item Stock' : 'Floor Stock';

            if (result.success) {
                showMessage('success', `${label} Reset Successful`, result.message || `${label} has been reset successfully.`);

                // Clear grid if data was loaded
                if (mode === 'loaded') {
                    setGridData([]);
                    setMode('idle');
                    setValidationResult(null);
                    setFilterType('all');
                }

                handleResetCancel();
            } else {
                // Invalid credentials — show error INLINE inside the modal (keep modal open)
                setResetAuthError(result.message || `Authorization failed. Please check your credentials.`);
            }
        } catch (error: any) {
            setResetAuthError(error?.response?.data?.message || error?.message || 'Failed to reset stock. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Export to Excel ─────────────────────────────────────────────────────
    const handleExport = () => {
        const isReelOrRoll = itemGroupName === 'REEL' || itemGroupName === 'ROLL';
        const isSimple = ['INK & ADDITIVES', 'VARNISHES & COATINGS', 'LAMINATION FILM', 'SHIPPER CARTON', 'FOIL', 'OTHER MATERIAL']
            .includes(itemGroupName.toUpperCase());

        const exportData = gridData.length > 0
            ? gridData.map(r => {
                const row: any = { ItemCode: r.itemCode || '', ItemID: r.itemID || '' };
                if (isSimple) {
                    row.ItemName = (r as any).itemName || '';
                } else {
                    row.Quality = r.quality || '';
                    row.GSM = r.gsm || '';
                    row.Manufacturer = r.manufecturer || '';
                    row.Finish = r.finish || '';
                    if (!isReelOrRoll) row.SizeL = r.sizeL || '';
                    row.SizeW = r.sizeW || '';
                }
                row.ReceiptQuantity = r.receiptQuantity || 0;
                row.LandedRate = r.landedRate || 0;
                row.BatchNo = r.batchNo || '';
                row.SupplierBatchNo = r.supplierBatchNo || '';
                row.StockUnit = r.stockUnit || '';
                row.WarehouseName = r.warehouseName || '';
                row.BinName = r.binName || '';
                return row;
            })
            : [isSimple
                ? { ItemCode: '', ItemID: '', ItemName: '', ReceiptQuantity: 0, LandedRate: 0, BatchNo: '', SupplierBatchNo: '', StockUnit: '', WarehouseName: '', BinName: '' }
                : {
                    ItemCode: '', ItemID: '', Quality: '', GSM: '', Manufacturer: '', Finish: '',
                    ...((itemGroupName === 'REEL' || itemGroupName === 'ROLL') ? {} : { SizeL: '' }),
                    SizeW: '', ReceiptQuantity: 0, LandedRate: 0, BatchNo: '', SupplierBatchNo: '', StockUnit: '', WarehouseName: '', BinName: '',
                }
            ];

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stock');
        const filename = `${itemGroupName}Stock.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    // ─── Grid Callbacks ──────────────────────────────────────────────────────
    const onGridReady = useCallback((params: any) => {
        setGridApi(params.api);
    }, []);

    const onSelectionChanged = useCallback(() => {
        if (!gridApi) return;
        const selectedNodes = gridApi.getSelectedNodes();
        const indices = new Set(selectedNodes.map((node: IRowNode) => gridData.indexOf(node.data)).filter((i: number) => i !== -1));
        setSelectedRows(indices);
    }, [gridApi, gridData]);

    const onCellValueChanged = useCallback(async (params: any) => {
        const { colDef, data, newValue } = params;

        // 1. Update the gridData state to keep it in sync with grid edits
        setGridData(prev => {
            const newData = [...prev];
            const rowIndex = newData.indexOf(data);
            if (rowIndex !== -1) {
                // Ensure the mutated row is captured in a fresh array to trigger re-render
                newData[rowIndex] = { ...data };
            }
            return newData;
        });

        // 2. Keep validation visible but mark as invalid so Save button hides
        setValidationResult(prev => prev ? { ...prev, isValid: false } : null);
        setMode('preview');

        // 3. Special handling for warehouse vs bin dependencies
        if (colDef.field === 'warehouseName') {
            data.binName = '';
            if (newValue) {
                await getBinsForWarehouse(newValue);
            }
            params.api.refreshCells({ rowNodes: [params.node], columns: ['binName'], force: true });
        }
    }, [getBinsForWarehouse]);

    // ─── External Filter (for validation card clicks) ────────────────────────
    const isExternalFilterPresent = useCallback(() => {
        return filterType !== 'all' && validationResult !== null;
    }, [filterType, validationResult]);

    const doesExternalFilterPass = useCallback((node: IRowNode) => {
        const rowIndex = gridData.indexOf(node.data);
        if (rowIndex === -1) return false;

        const validation = validationMap.get(rowIndex);

        switch (filterType) {
            case 'valid':
                return !validation || validation.rowStatus === 'Valid';
            case 'duplicate':
                return validation?.cellValidations?.some((cv: ItemStockCellValidation) => cv.status === 'Duplicate') ?? false;
            case 'missing':
                return validation?.cellValidations?.some((cv: ItemStockCellValidation) => cv.status === 'MissingData') ?? false;
            case 'mismatch':
                return validation?.cellValidations?.some((cv: ItemStockCellValidation) => cv.status === 'Mismatch') ?? false;
            case 'invalid':
                return validation?.cellValidations?.some((cv: ItemStockCellValidation) => cv.status === 'InvalidContent') ?? false;
            default:
                return true;
        }
    }, [filterType, validationMap, gridData]);

    // Notify grid when filter changes
    useEffect(() => {
        if (gridApi) {
            gridApi.onFilterChanged();
        }
    }, [filterType, gridApi, validationResult]);

    // ─── Column Definitions ──────────────────────────────────────────────────
    const columnDefs: ColDef[] = useMemo(() => {
        const isReelOrRoll = itemGroupName === 'REEL' || itemGroupName === 'ROLL';
        const isSimple = ['INK & ADDITIVES', 'VARNISHES & COATINGS', 'LAMINATION FILM', 'SHIPPER CARTON', 'FOIL', 'OTHER MATERIAL']
            .includes(itemGroupName.toUpperCase());

        const cols: ColDef[] = [
            {
                headerName: '',
                headerCheckboxSelection: true,
                headerCheckboxSelectionFilteredOnly: true,
                checkboxSelection: true,
                width: 50,
                pinned: 'left' as const,
                sortable: false,
                filter: false
            },
            {
                headerName: '#', valueGetter: 'node.rowIndex + 1', width: 60,
                pinned: 'left' as const, sortable: false, filter: false
            },
            { field: 'itemCode', headerName: 'ItemCode', width: 140, editable: false },
            {
                field: 'itemID', headerName: 'ItemID', width: 90, editable: false,
                cellStyle: { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
            },
            // ItemName column — only for simple sub-modules
            ...(isSimple ? [{
                field: 'itemName', headerName: 'ItemName', width: 200, editable: false,
                cellStyle: { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
            } as ColDef] : []),
            // Quality/GSM/Manufacturer/Finish/SizeL/SizeW — hidden for simple sub-modules
            ...(!isSimple ? [
                { field: 'quality', headerName: 'Quality', width: 120, editable: false, cellStyle: { backgroundColor: isDark ? '#374151' : '#f3f4f6' } } as ColDef,
                { field: 'gsm', headerName: 'GSM', width: 90, editable: false, cellStyle: { backgroundColor: isDark ? '#374151' : '#f3f4f6' } } as ColDef,
                { field: 'manufecturer', headerName: 'Manufacturer', width: 150, editable: false, cellStyle: { backgroundColor: isDark ? '#374151' : '#f3f4f6' } } as ColDef,
                { field: 'finish', headerName: 'Finish', width: 120, editable: false, cellStyle: { backgroundColor: isDark ? '#374151' : '#f3f4f6' } } as ColDef,
                ...(!isReelOrRoll ? [{ field: 'sizeL', headerName: 'SizeL', width: 90, editable: false, cellStyle: { backgroundColor: isDark ? '#374151' : '#f3f4f6' } } as ColDef] : []),
                { field: 'sizeW', headerName: 'SizeW', width: 90, editable: false, cellStyle: { backgroundColor: isDark ? '#374151' : '#f3f4f6' } } as ColDef,
            ] : []),
            { field: 'receiptQuantity', headerName: 'ReceiptQuantity', width: 140, editable: mode !== 'loaded', type: 'numericColumn' },
            { field: 'landedRate', headerName: 'LandedRate', width: 120, editable: mode !== 'loaded', type: 'numericColumn', valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(3) : '' },
            {
                field: 'batchNo', headerName: 'BatchNo', width: 220, editable: false,
                cellStyle: { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
            },
            {
                field: 'supplierBatchNo', headerName: 'SupplierBatchNo', width: 200, editable: mode !== 'loaded'
            },
            {
                field: 'stockUnit', headerName: 'StockUnit', width: 110, editable: false,
                cellStyle: { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
            },
            {
                field: 'warehouseName', headerName: 'WarehouseName', width: 170, editable: mode !== 'loaded',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: (_params: any) => {
                    const options = [...warehouseNames];
                    return { values: ['', ...options] };
                },
                cellRenderer: DropdownCellRenderer
            },
            {
                field: 'binName', headerName: 'BinName', width: 150, editable: mode !== 'loaded',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: (params: any) => {
                    const whName = params.data?.warehouseName?.trim();
                    const bins = whName && binsCache[whName]
                        ? binsCache[whName].map(b => b.binName || '').filter(Boolean)
                        : [];
                    
                    const options = [...bins];
                    return { values: ['', ...options] };
                },
                cellRenderer: DropdownCellRenderer
            }
        ];

        return cols;
    }, [warehouseNames, binsCache, isDark, mode, itemGroupName]);

    // ─── Columns with Validation Styling ─────────────────────────────────────
    const columnsWithStyle = useMemo(() => {
        return columnDefs.map(col => {
            if (!col.field) return col;

            return {
                ...col,
                tooltipValueGetter: (params: any) => {
                    const rowIndex = gridData.indexOf(params.data);
                    const rowValidation = validationMap.get(rowIndex);
                    if (!rowValidation) return null;

                    const cellVal = findCellValidation(rowValidation, params.colDef.field, params.colDef.headerName);
                    if (cellVal) {
                        // Hide specific "not found under Warehouse" message for BinName if requested by user
                        if (params.colDef.field === 'binName' && cellVal.validationMessage?.includes('not found under Warehouse')) {
                            return null;
                        }
                        // User requested to hide the tooltip on WarehouseName
                        if (params.colDef.field === 'warehouseName') {
                            return null;
                        }
                        return cellVal.validationMessage;
                    }

                    if (rowValidation.rowStatus === 'Duplicate') {
                        return rowValidation.errorMessage || 'Duplicate row detected';
                    }
                    return null;
                },
                cellStyle: (params: any): Record<string, string> | null => {
                    // Preserve read-only gray styling
                    const origStyle = typeof col.cellStyle === 'function' ? col.cellStyle(params) : col.cellStyle;

                    const rowIndex = gridData.indexOf(params.data);
                    if (rowIndex === -1) return origStyle as Record<string, string> | null;

                    const colors = {
                        duplicate: isDark ? 'rgba(220, 38, 38, 0.2)' : '#fee2e2',
                        missing: isDark ? 'rgba(37, 99, 235, 0.2)' : '#dbeafe',
                        mismatch: isDark ? 'rgba(202, 138, 4, 0.2)' : '#fef9c3',
                        invalid: isDark ? 'rgba(147, 51, 234, 0.2)' : '#f3e8ff'
                    };

                    const rowValidation = validationMap.get(rowIndex);

                    // Cell-specific coloring (takes priority over row-level duplicate)
                    const cellVal = findCellValidation(rowValidation, params.colDef.field, params.colDef.headerName);
                    if (cellVal && cellVal.status !== 'Duplicate') {
                        if (cellVal.status === 'MissingData') {
                            return { backgroundColor: colors.missing };
                        }
                        if (cellVal.status === 'Mismatch') {
                            return { backgroundColor: colors.mismatch };
                        }
                        if (cellVal.status === 'InvalidContent') {
                            return {
                                backgroundColor: colors.invalid,
                                borderBottom: '2px solid #9333ea',
                                borderRight: '2px solid #9333ea'
                            };
                        }
                    }

                    // Duplicate row: cells without other issues get red background
                    const hasDuplicate = rowValidation?.cellValidations?.some((cv: ItemStockCellValidation) => cv.status === 'Duplicate');
                    if (hasDuplicate) {
                        return { backgroundColor: colors.duplicate };
                    }

                    return origStyle as Record<string, string> | null;
                }
            };
        });
    }, [columnDefs, validationMap, isDark, gridData, findCellValidation]);

    // ─── Row Class Rules ─────────────────────────────────────────────────────
    const rowClassRules: RowClassRules = useMemo(() => ({
        'bg-red-50 dark:bg-red-900/20': (params: any) => {
            const rowIndex = gridData.indexOf(params.data);
            if (rowIndex === -1) return false;
            const validation = validationMap.get(rowIndex);
            return validation?.cellValidations?.some((cv: ItemStockCellValidation) => cv.status === 'Duplicate') ?? false;
        }
    }), [gridData, validationMap]);

    const defaultColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: false,
    }), []);

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">

            {/* ✅ Success Popup Modal */}
            {successInfo && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl max-w-sm w-full p-8 border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <svg className="w-9 h-9 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Import Successful!</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-base">
                            <span className="text-3xl font-bold text-green-600 dark:text-green-400 block mb-1">
                                {successInfo.rowCount.toLocaleString()}
                            </span>
                            rows imported into <strong>{successInfo.groupName}</strong>
                        </p>
                        <button
                            onClick={() => {
                                setSuccessInfo(null);
                                setGridData([]);
                                setValidationResult(null);
                                setMode('idle');
                                setFilterType('all');
                                setSelectedRows(new Set());
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="mt-2 w-full px-6 py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-xl font-semibold text-lg transition-colors"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Stock Upload - {itemGroupName}
                </h2>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-3">
                {/* Load Data (Master template) */}
                <button
                    onClick={handleLoadMasterData}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                >
                    <RefreshCw className="w-5 h-5" />
                    Load Data
                </button>

                {/* Check Stock */}
                <button
                    onClick={handleLoadStock}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                    <Database className="w-5 h-5" />
                    Check Stock
                </button>

                {/* Reset Item Stock */}
                <button
                    onClick={() => handleResetTrigger('item')}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                    <RotateCcw className="w-5 h-5" />
                    Reset Item Stock
                </button>

                {/* Reset Floor Stock */}
                <button
                    onClick={() => handleResetTrigger('floor')}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                    <RotateCcw className="w-5 h-5" />
                    Reset Floor Stock
                </button>

                {/* Upload Excel */}
                <label className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium cursor-pointer disabled:opacity-50">
                    <Upload className="w-5 h-5" />
                    <span>{isLoading ? 'Processing...' : 'Upload Excel'}</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        disabled={isLoading}
                        className="hidden"
                    />
                </label>

                {/* Delete Excel Row */}
                {(mode === 'preview' || mode === 'validated' || mode === 'master-template') && (
                    <button
                        onClick={handleRemoveSelectedRows}
                        disabled={isLoading || selectedRows.size === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-[#D2691E] hover:bg-[#A55217] text-white rounded-lg font-medium disabled:opacity-50"
                    >
                        <Trash2 className="w-5 h-5" />
                        Delete Excel Row ({selectedRows.size})
                    </button>
                )}

                {/* Export */}
                {(mode === 'loaded' || mode === 'preview' || mode === 'validated' || mode === 'master-template') && (
                    <button
                        onClick={handleExport}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50"
                    >
                        <Download className="w-5 h-5" />
                        Export
                    </button>
                )}

                {/* Check Validation */}
                {(mode === 'preview' || mode === 'validated') && (
                    <button
                        onClick={handleCheckValidation}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium disabled:opacity-50"
                    >
                        <AlertCircle className="w-5 h-5" />
                        Check Validation
                    </button>
                )}

                {/* Save Data (only when validation passes) */}
                {validationResult?.isValid && (
                    <button
                        onClick={handleImport}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 animate-pulse"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        Save Data
                    </button>
                )}
            </div>

            {/* Validation Summary */}
            {validationResult && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">Validation Summary</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div
                            onClick={() => setFilterType('all')}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${filterType === 'all' ? 'ring-2 ring-blue-500' : ''} bg-gray-100 dark:bg-gray-700`}
                        >
                            <div className="text-sm text-gray-600 dark:text-gray-400">TOTAL ROWS</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{validationResult.summary.totalRows}</div>
                        </div>
                        <div
                            onClick={() => setFilterType('valid')}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${filterType === 'valid' ? 'ring-2 ring-green-500' : ''} bg-green-50 dark:bg-green-900/20`}
                        >
                            <div className="text-sm text-green-700 dark:text-green-400">VALID ROWS</div>
                            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{validationResult.summary.validRows}</div>
                        </div>
                        <div
                            onClick={() => setFilterType('duplicate')}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${filterType === 'duplicate' ? 'ring-2 ring-red-500' : ''} bg-red-50 dark:bg-red-900/20`}
                        >
                            <div className="text-sm text-red-700 dark:text-red-400">DUPLICATE</div>
                            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{validationResult.summary.duplicateCount}</div>
                        </div>
                        <div
                            onClick={() => setFilterType('missing')}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${filterType === 'missing' ? 'ring-2 ring-blue-500' : ''} bg-blue-50 dark:bg-blue-900/20`}
                        >
                            <div className="text-sm text-blue-700 dark:text-blue-400">MISSING</div>
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{validationResult.summary.missingDataCount}</div>
                        </div>
                        <div
                            onClick={() => setFilterType('mismatch')}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${filterType === 'mismatch' ? 'ring-2 ring-yellow-500' : ''} bg-yellow-50 dark:bg-yellow-900/20`}
                        >
                            <div className="text-sm text-yellow-700 dark:text-yellow-400">MISMATCH</div>
                            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{validationResult.summary.mismatchCount}</div>
                        </div>
                        <div
                            onClick={() => setFilterType('invalid')}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${filterType === 'invalid' ? 'ring-2 ring-purple-500' : ''} bg-purple-50 dark:bg-purple-900/20`}
                        >
                            <div className="text-sm text-purple-700 dark:text-purple-400">INVALID CONTENT</div>
                            <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{validationResult.summary.invalidContentCount}</div>
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                        Edit cells directly in the grid below, or click on validation summary to filter rows.
                        {validationResult.summary.duplicateCount > 0 &&
                            <span className="ml-2 text-red-600 dark:text-red-400 font-bold">
                                {validationResult.summary.duplicateCount} duplicate(s) found! Remove or edit them.
                            </span>
                        }
                        {validationResult.summary.missingDataCount > 0 &&
                            <span className="ml-2 text-blue-600 dark:text-blue-400 font-bold">
                                {validationResult.summary.missingDataCount} row(s) have missing data! Fill in required fields.
                            </span>
                        }
                        {validationResult.summary.mismatchCount > 0 &&
                            <span className="ml-2 text-yellow-600 dark:text-yellow-400 font-bold">
                                {validationResult.summary.mismatchCount} row(s) have mismatched data! Check WarehouseName and BinName.
                            </span>
                        }
                        {validationResult.summary.invalidContentCount > 0 &&
                            <span className="ml-2 text-purple-600 dark:text-purple-400 font-bold">
                                {validationResult.summary.invalidContentCount} row(s) have invalid content! Hover over purple cells for details.
                            </span>
                        }
                    </p>

                    {/* Detailed Invalid Content Errors */}
                    {filterType === 'invalid' && validationResult.summary.invalidContentCount > 0 && (
                        <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg max-h-48 overflow-y-auto">
                            <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2">Invalid Content Details:</h4>
                            <div className="space-y-1">
                                {validationResult.rows
                                    .filter((row: ItemStockRowValidation) => row.cellValidations?.some(cv => cv.status === 'InvalidContent'))
                                    .flatMap((row: ItemStockRowValidation) =>
                                        row.cellValidations
                                            .filter((cv: ItemStockCellValidation) => cv.status === 'InvalidContent')
                                            .map((cv: ItemStockCellValidation, idx: number) => (
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
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* AG Grid */}
            {mode !== 'idle' && (
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
                    `}</style>
                    <AgGridReact
                        rowData={gridData}
                        columnDefs={columnsWithStyle}
                        defaultColDef={defaultColDef}
                        onGridReady={onGridReady}
                        getRowId={(params) => `stock-${gridData.indexOf(params.data)}`}
                        rowSelection="multiple"
                        rowMultiSelectWithClick={true}
                        onSelectionChanged={onSelectionChanged}
                        onCellValueChanged={onCellValueChanged}
                        rowClassRules={rowClassRules}
                        isExternalFilterPresent={isExternalFilterPresent}
                        doesExternalFilterPass={doesExternalFilterPass}
                        pagination={true}
                        paginationPageSize={1000}
                        paginationPageSizeSelector={[1000, 2000, 5000]}
                        tooltipShowDelay={300}
                        tooltipInteraction={true}
                        enableCellTextSelection={true}
                        ensureDomOrder={true}
                        overlayNoRowsTemplate='<span class="text-gray-500 dark:text-gray-400 text-lg">No records found</span>'
                    />
                </div>
            )}



            {/* Message Modal Renderer */}
            {MessageModalRenderer}

            {/* Import Progress Overlay */}
            {importProgress?.active && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-14 h-14 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 text-center">
                                {importProgress.step}
                            </h3>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-3 bg-blue-600 dark:bg-blue-400 rounded-full transition-all duration-500"
                                    style={{ width: `${importProgress.pct}%` }}
                                />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {importProgress.pct}% &bull; {importProgress.total.toLocaleString()} rows
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── State-Switch Confirmation Modal ────────────────────────────── */}
            {switchConfirm && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border-2 border-orange-400">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle className="w-6 h-6 text-orange-500" />
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Switch Confirmation</h3>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-6">
                            {switchConfirm.message}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleSwitchCancel}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSwitchConfirm}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium"
                            >
                                OK, Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Date-Range Modal (FIRST step for both Item & Floor Reset) ────── */}
            {showDateModal && (() => {
                const isFloor = resetFlowType === 'floor';
                const title = isFloor ? 'Reset Floor Stock' : 'Reset Item Stock';
                const smallLabel = isFloor ? '(issue date)' : '(voucher date)';
                const stockWord = isFloor ? 'floor stock' : 'item stock';
                return (
                    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center gap-3 mb-1 text-gray-900 dark:text-white">
                                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                <h3 className="text-xl font-bold">{title} — Date Range</h3>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                                Choose a date range to reset, or leave blank to reset <span className="font-semibold">ALL</span> {stockWord}.
                            </p>

                            {dateModalError && (
                                <div className="flex items-start gap-3 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                                    <p className="text-sm font-medium text-red-700 dark:text-red-300">{dateModalError}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From Date <span className="text-[10px] font-normal text-gray-400">{smallLabel}</span></label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                        value={resetDateRange.fromDate}
                                        max={resetDateRange.toDate || undefined}
                                        onChange={e => { setResetDateRange({ ...resetDateRange, fromDate: e.target.value }); setDateModalError(null); }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To Date <span className="text-[10px] font-normal text-gray-400">{smallLabel}</span></label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                        value={resetDateRange.toDate}
                                        min={resetDateRange.fromDate || undefined}
                                        onChange={e => { setResetDateRange({ ...resetDateRange, toDate: e.target.value }); setDateModalError(null); }}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-6">
                                <button
                                    type="button"
                                    onClick={() => { setResetDateRange({ fromDate: '', toDate: '' }); setDateModalError(null); }}
                                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                                >
                                    Clear dates (reset all)
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={handleResetCancel}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDateModalNext}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                                    >
                                        Continue
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ─── Item Selection Modal (Step 0 for Item Reset) ─────────────────── */}
            {showItemSelect && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">

                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Items to Reset</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {itemGroupName} — only selected items' stock will be zeroed out
                                </p>
                            </div>
                            <button onClick={handleItemSelectCancel} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search + Select All */}
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 space-y-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search item code or name..."
                                    value={itemSelectSearch}
                                    onChange={e => setItemSelectSearch(e.target.value)}
                                    className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {itemSelectSearch && (
                                    <button
                                        onClick={() => setItemSelectSearch('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={!itemSelectLoading && itemSelectList.length > 0 && selectedItemIds.size === itemSelectList.length}
                                        onChange={e => {
                                            if (e.target.checked) setSelectedItemIds(new Set(itemSelectList.map(i => i.itemId)));
                                            else setSelectedItemIds(new Set());
                                        }}
                                        className="rounded accent-blue-600"
                                    />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select All</span>
                                </label>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {selectedItemIds.size} of {itemSelectList.length} selected
                                </span>
                            </div>
                        </div>

                        {/* Item List */}
                        <div className="flex-1 overflow-y-auto px-4 py-2">
                            {itemSelectLoading ? (
                                <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
                                    <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                                    <span className="text-sm">Loading stock items...</span>
                                </div>
                            ) : itemSelectList.length === 0 ? (
                                <div className="text-center py-12 text-sm text-gray-400">No stock items found for this group.</div>
                            ) : (
                                itemSelectList
                                    .filter(item =>
                                        item.itemCode.toLowerCase().includes(itemSelectSearch.toLowerCase()) ||
                                        item.itemName.toLowerCase().includes(itemSelectSearch.toLowerCase())
                                    )
                                    .map(item => (
                                        <label
                                            key={item.itemId}
                                            className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedItemIds.has(item.itemId)}
                                                onChange={e => {
                                                    const next = new Set(selectedItemIds);
                                                    if (e.target.checked) next.add(item.itemId);
                                                    else next.delete(item.itemId);
                                                    setSelectedItemIds(next);
                                                }}
                                                className="rounded accent-blue-600 shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.itemCode}</div>
                                                {item.itemName && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.itemName}</div>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-sm font-semibold text-orange-600 dark:text-orange-400">{item.totalQty.toLocaleString()}</div>
                                                <div className="text-xs text-gray-400">{item.stockUnit || 'units'}</div>
                                            </div>
                                        </label>
                                    ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <button
                                onClick={handleItemSelectCancel}
                                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleItemSelectNext}
                                disabled={selectedItemIds.size === 0 || itemSelectLoading}
                                className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2"
                            >
                                Next
                                {selectedItemIds.size > 0 && selectedItemIds.size < itemSelectList.length && (
                                    <span className="bg-white/25 text-xs px-1.5 py-0.5 rounded-full">{selectedItemIds.size} items</span>
                                )}
                                {selectedItemIds.size === itemSelectList.length && itemSelectList.length > 0 && (
                                    <span className="bg-white/25 text-xs px-1.5 py-0.5 rounded-full">All</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Reset Confirmation Step 1/3: WARNING ─────────────────────────── */}
            {resetFlowStep === 1 && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border-4 border-red-500">
                        <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">WARNING - Data Deletion (1/3)</h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-6">
                            Are you sure you want to clear all the <strong>{itemGroupName}</strong> {resetFlowType === 'item' ? 'Item Stock' : 'Floor Stock'} data?
                        </p>

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
                                onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(false); }}
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
                            <button onClick={handleResetCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg">
                                Cancel
                            </button>
                            <button onClick={() => handleResetConfirm(1)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">
                                Yes, Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Reset Confirmation Step 2/3: CONFIRMATION ────────────────────── */}
            {resetFlowStep === 2 && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border-4 border-orange-500">
                        <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400 mb-4">CONFIRMATION (2/3)</h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-6">
                            Discussed with the client that the data needs to be cleared?
                        </p>

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
                                onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(false); }}
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
                            <button onClick={handleResetCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg">
                                No, Cancel
                            </button>
                            <button onClick={() => handleResetConfirm(2)} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium">
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Reset Confirmation Step 3/3: FINAL CONFIRMATION ──────────────── */}
            {resetFlowStep === 3 && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border-4 border-red-700">
                        <h3 className="text-xl font-bold text-red-700 dark:text-red-500 mb-4">FINAL CONFIRMATION (3/3)</h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-6">
                            Have you received an email from your client asking to clear the data?
                        </p>

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
                                onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(false); }}
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
                            <button onClick={handleResetCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg">
                                No, Cancel
                            </button>
                            <button onClick={() => handleResetConfirm(3)} className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-medium">
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Reset Step 4: Security Verification ──────────────────────────── */}
            {resetFlowStep === 4 && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                    <form onSubmit={handleResetCredentialSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-6 text-gray-900 dark:text-white">
                            <Lock className="w-6 h-6" />
                            <h3 className="text-xl font-bold">Security Verification</h3>
                        </div>

                        <div className="space-y-4">
                            {/* ─── Inline auth error ─── */}
                            {resetAuthError && (
                                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                                    <p className="text-sm font-medium text-red-700 dark:text-red-300">{resetAuthError}</p>
                                </div>
                            )}

                            {/* ─── Read-only summary of the date scope chosen in step 1 ─── */}
                            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                    Scope:&nbsp;
                                    <span className="font-semibold">
                                        {resetDateRange.fromDate && resetDateRange.toDate
                                            ? `${resetDateRange.fromDate} to ${resetDateRange.toDate}`
                                            : `ALL ${resetFlowType === 'floor' ? 'floor' : 'item'} stock`}
                                    </span>
                                </span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    value={resetCredentials.username}
                                    onChange={e => { setResetCredentials({ ...resetCredentials, username: e.target.value }); setResetAuthError(null); }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password <span className="text-gray-400 text-xs">(Optional)</span></label>
                                <input
                                    type="password"
                                    className="w-full p-2 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    value={resetCredentials.password}
                                    onChange={e => { setResetCredentials({ ...resetCredentials, password: e.target.value }); setResetAuthError(null); }}
                                    placeholder="Leave blank if no password is set"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for Deletion</label>
                                <textarea
                                    required
                                    className="w-full p-2 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white h-24"
                                    placeholder="Please explicitly state why data is being cleared..."
                                    value={resetCredentials.reason}
                                    onChange={e => setResetCredentials({ ...resetCredentials, reason: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={handleResetCancel}
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
        </div>
    );
};

export default ItemStockUpload;
