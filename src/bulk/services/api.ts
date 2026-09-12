import axios from 'axios';

// Indus360-hosted BulkImport modules hit the folded-in backend under /bulk/api and target the CLIENT
// chosen in the Product+Client picker via the X-Target-Company header (the backend resolves that
// client's DB from it). No BulkImport login/localStorage token here — Indus360 owns auth + the shell.
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5080') + '/bulk/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30 * 60 * 1000, // 30 min for large bulk operations
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
});

// ─── Target client (CompanyUserID) — set by <BulkModuleShell> when a client is picked ─────────────
let _targetCompany: string | null = null;
export const setBulkTargetCompany = (companyUserId: string | null) => { _targetCompany = companyUserId; };
export const getBulkTargetCompany = () => _targetCompany;

// ─── Global Loader hooks (set by LoaderProvider) ──────────────────────────
let _showLoader: ((text?: string) => void) | null = null;
let _hideLoader: (() => void) | null = null;

export const setLoaderHooks = (
    show: (text?: string) => void,
    hide: () => void
) => {
    _showLoader = show;
    _hideLoader = hide;
};

api.interceptors.request.use((config) => {
    // Tell the backend which client's DB to operate on (from the Product+Client picker).
    if (_targetCompany) {
        config.headers['X-Target-Company'] = _targetCompany;
    }
    // Show loader for every API call
    if (_showLoader) _showLoader();
    return config;
});

api.interceptors.response.use(
    (response) => {
        if (_hideLoader) _hideLoader();
        return response;
    },
    (error) => {
        if (_hideLoader) _hideLoader();
        return Promise.reject(error);
    }
);

export interface ModuleDto {
    moduleId: number;
    moduleName: string;
    moduleHeadName?: string;
    moduleDisplayName?: string;
    description?: string;
    // Display Fields
    moduleHeadDisplayName?: string;
    moduleHeadDisplayOrder?: number;
    moduleDisplayOrder?: number;
    setGroupIndex?: number;
    // Print Fields
    printDocumentWebPage?: string;
    printDocumentName?: string;
    printDocumentWebPage1?: string;
    printDocumentName1?: string;
    // System Fields
    companyID?: number;
    userID?: number;
    fYear?: string;
}

export interface IndusModuleInfoDto {
    moduleName: string;
    moduleDisplayName?: string;
    moduleHeadName?: string;
    moduleHeadDisplayName?: string;
    setGroupIndex?: number;
    suggestedHeadDisplayOrder?: number;
}

export interface ModuleSystemDefaultsDto {
    companyID: number;
    userID: number;
    fYear: string;
    suggestedHeadDisplayOrder: number;
    suggestedDisplayOrder: number;
}

export const getAllModules = async (): Promise<ModuleDto[]> => {
    const response = await api.get('/module/GetModules?headName=ALL');
    return response.data;
};

export const createModule = async (module: ModuleDto): Promise<number> => {
    const response = await api.post('/module/Create', module);
    return response.data.moduleId;
};

export const updateModule = async (module: ModuleDto): Promise<void> => {
    await api.put('/module/Update', module);
};

export const deleteModule = async (moduleId: number): Promise<void> => {
    await api.delete(`/module/Delete/${moduleId}`);
};

export const getModuleHeads = async (): Promise<string[]> => {
    const response = await api.get('/module/GetHeads');
    return response.data;
};

export const getIndusModuleNames = async (): Promise<string[]> => {
    const response = await api.get('/module/IndusModuleNames');
    return response.data;
};

export const getIndusModules = async (): Promise<ModuleDto[]> => {
    const response = await api.get('/module/IndusModules');
    return response.data;
};

export const getIndusModuleInfo = async (moduleName: string): Promise<IndusModuleInfoDto> => {
    const response = await api.get(`/module/IndusModuleInfo?moduleName=${encodeURIComponent(moduleName)}`);
    return response.data;
};

export const getModuleSystemDefaults = async (): Promise<ModuleSystemDefaultsDto> => {
    const response = await api.get('/module/SystemDefaults');
    return response.data;
};

export const getNextDisplayOrder = async (setGroupIndex: number): Promise<number> => {
    const response = await api.get(`/module/NextDisplayOrder?setGroupIndex=${setGroupIndex}`);
    return response.data.nextOrder;
};

export const checkModuleExists = async (moduleName: string): Promise<boolean> => {
    const response = await api.get(`/module/CheckModuleExists?moduleName=${encodeURIComponent(moduleName)}`);
    return response.data.exists;
};

export const checkDisplayOrderExists = async (order: number, setGroupIndex: number): Promise<boolean> => {
    const response = await api.get(`/module/CheckDisplayOrderExists?order=${order}&setGroupIndex=${setGroupIndex}`);
    return response.data.exists;
};

export const checkGroupIndexInUse = async (groupIndex: number, headName: string): Promise<boolean> => {
    const response = await api.get(`/module/CheckGroupIndexInUse?groupIndex=${groupIndex}&headName=${encodeURIComponent(headName)}`);
    return response.data.inUse;
};

// ─── Client-DB Aware APIs (for CompanySubscription "New Module Addition" Tab) ───

export const getModulesForClient = async (connectionString: string): Promise<ModuleDto[]> => {
    const response = await api.post(`/module/GetModulesForClient`, { connectionString });
    return response.data;
};

export const getSystemDefaultsForClient = async (connectionString: string): Promise<ModuleSystemDefaultsDto> => {
    const response = await api.get(`/module/GetSystemDefaultsForClient?connectionString=${encodeURIComponent(connectionString)}`);
    return response.data;
};

export const getIndusModuleInfoForClient = async (moduleName: string, connectionString: string): Promise<IndusModuleInfoDto> => {
    const response = await api.get(`/module/GetIndusModuleInfoForClient?moduleName=${encodeURIComponent(moduleName)}&connectionString=${encodeURIComponent(connectionString)}`);
    return response.data;
};

export const checkModuleExistsForClient = async (moduleName: string, connectionString: string): Promise<boolean> => {
    const response = await api.get(`/module/CheckModuleExistsForClient?moduleName=${encodeURIComponent(moduleName)}&connectionString=${encodeURIComponent(connectionString)}`);
    return response.data.exists;
};

export const checkDisplayOrderExistsForClient = async (order: number, setGroupIndex: number, connectionString: string): Promise<boolean> => {
    const response = await api.get(`/module/CheckDisplayOrderExistsForClient?order=${order}&setGroupIndex=${setGroupIndex}&connectionString=${encodeURIComponent(connectionString)}`);
    return response.data.exists;
};

export const checkGroupIndexInUseForClient = async (groupIndex: number, headName: string, connectionString: string): Promise<boolean> => {
    const response = await api.get(`/module/CheckGroupIndexInUseForClient?groupIndex=${groupIndex}&headName=${encodeURIComponent(headName)}&connectionString=${encodeURIComponent(connectionString)}`);
    return response.data.inUse;
};

export const createModuleForClient = async (connectionString: string, module: ModuleDto): Promise<any> => {
    const response = await api.post(`/module/CreateForClient`, { connectionString, module });
    return response.data;
};

export const updateModuleForClient = async (connectionString: string, module: ModuleDto): Promise<any> => {
    const response = await api.put(`/module/UpdateForClient`, { connectionString, module });
    return response.data;
};

export const deleteModuleForClient = async (moduleId: number, connectionString: string): Promise<any> => {
    const response = await api.delete(`/module/DeleteForClient?moduleId=${moduleId}&connectionString=${encodeURIComponent(connectionString)}`);
    return response.data;
};

export const getItemGroupComparisonForClient = async (type: string, connectionString: string): Promise<ItemGroupComparisonDto[]> => {
    const response = await api.get(`/module/ItemGroupComparisonForClient?type=${type}&connectionString=${encodeURIComponent(connectionString)}`);
    return response.data;
};

export const syncItemGroupsForClient = async (syncData: ItemGroupComparisonDto[], type: string, connectionString: string): Promise<any> => {
    const response = await api.post(`/module/SyncItemGroupsForClient`, { syncData, type, connectionString });
    return response.data;
};

export interface ItemGroupComparisonDto {
    itemGroupId: number;
    itemGroupName: string;
    existsInSource: boolean;
    existsInClient: boolean;
    isDeletedInClient: boolean;
    status: boolean;
}

export const getItemGroupComparison = async (type: string = 'Item'): Promise<ItemGroupComparisonDto[]> => {
    const response = await api.get(`/module/ItemGroupComparison?type=${type}`);
    return response.data;
};

export const syncItemGroups = async (syncData: ItemGroupComparisonDto[], type: string = 'Item'): Promise<void> => {
    await api.post(`/module/SyncItemGroups?type=${type}`, syncData);
};

export interface ExcelPreviewDto {
    headers: string[];
    rows: any[][];
    totalRows: number;
    totalColumns: number;
}

export interface ImportResultDto {
    success: boolean;
    totalRows: number;
    importedRows: number;
    duplicateRows: number;
    errorRows: number;
    errorMessages: string[];
    message: string;
}

export const getModules = async (headName: string = 'Masters'): Promise<ModuleDto[]> => {
    const response = await api.get(`/module/GetModules?headName=${headName}`);
    return response.data;
};

export const previewExcel = async (file: File): Promise<ExcelPreviewDto> => {
    console.log('[API] previewExcel called with file:', file.name, file.type, file.size);
    const formData = new FormData();
    formData.append('file', file);

    console.log('[API] Sending POST to /excel/Preview');
    console.log('[API] FormData entries:', Array.from(formData.entries()));

    const response = await api.post('/excel/Preview', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    console.log('[API] Response received:', response.status, response.statusText);
    console.log('[API] Response data:', response.data);

    return response.data;
};

export const importExcel = async (file: File, tableName: string, subModuleId?: number): Promise<ImportResultDto> => {
    const formData = new FormData();
    formData.append('file', file);

    let url = `/excel/Import?tableName=${tableName}`;
    if (subModuleId !== undefined && subModuleId > 0) {
        url += `&subModuleId=${subModuleId}`;
    }

    const response = await api.post(url, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export interface LedgerGroupDto {
    ledgerGroupID: number;
    ledgerGroupName: string;
    ledgerGroupNameDisplay: string;
    ledgerGroupNameID?: number;
}

export interface MasterColumnDto {
    fieldName: string;
    dataType: string;
    isRequired: boolean;
    sequenceNo: number;
}

export const getLedgerGroups = async (): Promise<LedgerGroupDto[]> => {
    const response = await api.get('/excel/LedgerGroups');
    return response.data;
};

export const getMasterColumns = async (ledgerGroupId: number): Promise<MasterColumnDto[]> => {
    const response = await api.get(`/excel/MasterColumns/${ledgerGroupId}`);
    return response.data;
};

export const importLedger = async (file: File, ledgerGroupId: number): Promise<ImportResultDto> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/excel/ImportLedger?ledgerGroupId=${ledgerGroupId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

// ==========================================
// LEDGER MASTER ENHANCED API
// ==========================================

export interface LedgerMasterDto {
    ledgerID?: number;
    ledgerGroupID: number;
    ledgerName?: string;
    mailingName?: string;
    address1?: string;
    address2?: string;
    address3?: string;
    country?: string;
    state?: string;
    city?: string;
    pincode?: string;
    telephoneNo?: string;
    email?: string;
    mobileNo?: string;
    website?: string;
    panNo?: string;
    gstNo?: string;
    salesRepresentative?: string;
    supplyTypeCode?: string;
    gstApplicable?: boolean;
    deliveredQtyTolerance?: number;
    refCode?: string;
    gstRegistrationType?: string;
    creditDays?: string;  // Backend database column is nvarchar(64)
    legalName?: string;
    mailingAddress?: string;
    isDeletedTransaction?: boolean;
    currencyCode?: string;
    departmentName?: string;
    departmentID?: number;
    designation?: string;
    dateOfBirth?: string;
    clientName?: string;
    refClientID?: number;
}

export enum ValidationStatus {
    Valid = 0,
    Duplicate = 1,
    MissingData = 2,
    Mismatch = 3,
    InvalidContent = 4
}

export interface CellValidation {
    columnName: string;
    validationMessage: string;
    status: ValidationStatus;
}

export interface LedgerRowValidation {
    rowIndex: number;
    data: LedgerMasterDto;
    cellValidations: CellValidation[];
    rowStatus: ValidationStatus;
    errorMessage?: string;
}

export interface ValidationSummary {
    duplicateCount: number;
    missingDataCount: number;
    mismatchCount: number;
    invalidContentCount: number;
    totalRows: number;
    validRows: number;
}

export interface LedgerValidationResultDto {
    rows: LedgerRowValidation[];
    summary: ValidationSummary;
    isValid: boolean;
}

export interface CountryStateDto {
    country: string;
    state: string;
}

export interface SalesRepresentativeDto {
    employeeID?: number;
    employeeName?: string;
    // Handle potential PascalCase serialization
    EmployeeID?: number;
    EmployeeName?: string;
}

export interface DepartmentDto {
    departmentID?: number;
    departmentName?: string;
    DepartmentID?: number;
    DepartmentName?: string;
}

export interface ClientDto {
    ledgerID?: number;
    ledgerName?: string;
    LedgerID?: number;
    LedgerName?: string;
}

export const getLedgersByGroup = async (ledgerGroupId: number): Promise<LedgerMasterDto[]> => {
    const response = await api.get(`/ledger/bygroup/${ledgerGroupId}`);
    return response.data;
};

export const getCountryStates = async (): Promise<CountryStateDto[]> => {
    const response = await api.get('/ledger/country-states');
    return response.data;
};

export const getSalesRepresentatives = async (): Promise<SalesRepresentativeDto[]> => {
    const response = await api.get('/ledger/sales-representatives');
    return response.data;
};

export const getClients = async (): Promise<ClientDto[]> => {
    const response = await api.get('/ledger/clients');
    return response.data;
};

export const getDepartments = async (): Promise<DepartmentDto[]> => {
    const response = await api.get('/ledger/departments');
    return response.data;
};

export const softDeleteLedger = async (ledgerId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/ledger/soft-delete/${ledgerId}`);
    return response.data;
};

export const validateLedgers = async (ledgers: LedgerMasterDto[], ledgerGroupId: number): Promise<LedgerValidationResultDto> => {
    const response = await api.post('/ledger/validate', {
        ledgers,
        ledgerGroupId
    });
    return response.data;
};

export const importLedgers = async (ledgers: LedgerMasterDto[], ledgerGroupId: number): Promise<ImportResultDto> => {
    const response = await api.post('/ledger/import', {
        ledgers,
        ledgerGroupId
    });
    return response.data;
};

export const clearAllLedgerData = async (ledgerGroupId: number, username: string, password: string, reason: string): Promise<any> => {
    const response = await api.post('/ledger/clear-all-data', {
        ledgerGroupId,
        username,
        password,
        reason
    }, {
        headers: {
            'X-Skip-Auth-Redirect': 'true'
        }
    });
    return response.data;
};

export const parseExcelToLedgers = async (file: File): Promise<LedgerMasterDto[]> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/excel/ParseLedgerExcel', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
}

// ==========================================
// ITEM MASTER API
// ==========================================

export interface ItemGroupDto {
    itemGroupID: number;
    itemGroupName: string;
    itemGroupPrefix: string;
    itemNameFormula?: string;
    itemDescriptionFormula?: string;
}

export const getItemGroups = async (): Promise<ItemGroupDto[]> => {
    const response = await api.get('/excel/ItemGroups');
    return response.data;
};

export const getItemMasterColumns = async (itemGroupId: number): Promise<MasterColumnDto[]> => {
    const response = await api.get(`/excel/ItemMasterColumns/${itemGroupId}`);
    return response.data;
};

export const importItemMaster = async (file: File, itemGroupId: number): Promise<ImportResultDto> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/excel/ImportItem?itemGroupId=${itemGroupId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export interface CompanyDto {
    companyId: number;
    // 🏢 1. Company Basic Information
    companyName: string;
    tallyCompanyName?: string;
    productionUnitName?: string;
    productionUnitAddress?: string;
    address: string;
    address1?: string;
    address2?: string;
    address3?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    contactNO?: string;
    mobileNO?: string;
    phone: string;
    email: string;
    website: string;
    concerningPerson?: string;
    companyStartDate?: string;
    isActive: boolean;
    lastInvoiceDate?: string;

    // 🧾 2. Statutory & Tax Information
    gstin: string;
    pan?: string;
    cinNo?: string;
    iecNo?: string;
    importExportCode?: string;
    stateTinNo?: string;
    msmeno?: string;
    isSalesTax: boolean;
    isGstApplicable: boolean;
    isVatApplicable: boolean;
    isEinvoiceApplicable: boolean;
    defaultTaxLedgerTypeName?: string;
    taxApplicableBranchWise: boolean;

    // 🏦 3. Bank & Payment Information
    bankDetails?: string;
    cashAgainstDocumentsBankDetails?: string;

    // 🔐 4. Approval & Workflow Settings
    isRequisitionApproval: boolean;
    isPOApprovalRequired: boolean;
    isInvoiceApprovalRequired: boolean;
    isGRNApprovalRequired: boolean;
    isSalesOrderApprovalRequired: boolean;
    isJobReleaseFeatureRequired: boolean;
    isInternalApprovalRequired: boolean;
    byPassCostApproval: boolean;
    byPassInventoryForProduction: boolean;
    jobReleasedChecklistFeature: boolean;
    jobScheduleReleaseRequired: boolean;

    // ⚙️ 5. Domain / Module Enable Settings
    flexoDomainEnable?: boolean;
    offsetDomainEnable?: boolean;
    corrugationDomainEnable?: boolean;
    rotoDomainEnable?: boolean;
    bookPlanningFeatureEnable?: boolean;
    rigidBoxPlanningFeatureEnable?: boolean;
    shipperPlanningFeatureEnable?: boolean;
    isProductCatalogCreated?: boolean;
    isSupplierItemAllocationRequired?: boolean;

    // 🧮 6. Estimation & Calculation Settings
    costEstimationMethodType?: string;
    estimationRoundOffDecimalPlace?: number;
    purchaseRoundOffDecimalPlace?: number;
    invoiceRoundOffDecimalPlace?: number;
    estimationPerUnitCostDecimalPlace?: number;
    roundOffImpressionValue?: number;
    autoRoundOffNotApplicable?: boolean;
    wtCalculateOnEstimation?: string;
    showPlanUptoWastagePerc: number;
    isWastageAddInPrintingRate?: boolean;
    is_Book_Half_Form_Wastage?: boolean;

    // 🖨️ 7. Printing / RDLC Settings
    invoicePrintRDLC?: string;
    packingSlipPrintRDLC?: string;
    challanPrintRDLC?: string;
    pwoPrintRDLC?: string;
    salesReturnPrintRDLC?: string;
    coaPrintRDLC?: string;
    outSourceChallanRDLC?: string;
    pwoFlexoPrintRDLC?: string;
    pwoGangPrintRDLC?: string;
    qcAndPackingSlip?: string;
    itemSalesOrderBookingPrint?: string;
    unitwisePrintoutSetting?: boolean;
    fastInvoicePrint?: boolean;
    fastEInvoicePrint?: boolean;

    // 🏭 8. Production Configuration
    manualProductionEntryTime?: boolean;
    productionEntryBackDay?: string;
    productionUnitID?: number;
    generateVoucherNoByProductionUnit?: boolean;
    materialConsumptionDetailsFlage?: boolean;
    bufferGSMMinus?: number;
    bufferGSMPlus?: number;
    bufferSizeMinus?: number;
    bufferSizePlus?: number;

    // 🌐 9. API & Integration Settings
    apiBaseURL?: string;
    apiAuthenticationURL?: string;
    apiClientID?: string;
    apiClientSecretID?: string;
    apiIntegrationRequired?: boolean;
    indusAPIAuthToken?: string;
    clientAPIAuthToken?: string;
    indusAPIBaseUrl?: string;
    clientAPIBaseUrl?: string;
    indusTokenAuthAPI?: string;
    clientTokenAuthAPI?: string;
    indusMailAPIBaseUrl?: string;
    apiBasicAuthUserName?: string;
    apiBasicAuthPassword?: string;
    integrationType?: string;
    logoutPage?: string;
    desktopConnString?: string;
    applicationConfiguration?: string;
    companyStaticIP?: string;

    // 🕒 11. Time & System Settings
    timeZone?: string;
    duration?: string;
    end_time?: string;
    lastShownTime?: string;
    messageShow?: string;
    time?: string;

    // 🔐 12. Security & OTP Settings
    otpVerificationFeatureEnabled?: boolean;
    otpVerificationExcludedDevices?: string;
    multipleFYearNotRequired?: boolean;

    // 🏷️ 13. Prefix & Reference Settings
    refCompanyCode?: string;
    refSalesOfficeCode?: string;
    isotpRequired?: boolean;

    // 💱 14. Currency Settings
    currencyHeadName?: string;
    currencyChildName?: string;
    currencyCode?: string;
    currencySymboliconRef?: string;

    // 📝 15. Miscellaneous / Other Settings
    fax?: string;
    backupPath?: string;
    description?: string;
    isInvoicePrintProductWise?: boolean;
    isInvoiceBlockFeatureRequired?: boolean;
    purchaseTolerance?: number;
    isDeletedTransaction: boolean;

    // 🏭 Production extras
    isProductionSlipGenerated?: boolean;
    productionProcessWiseToleranceRequired?: boolean;

    // 💬 Communication & CRM
    isCrmActivated?: boolean;
    isWhatsAppActivated?: boolean;
    isEmailActivated?: boolean;
    isNotificationEnabled?: boolean;

    // 📢 Client Communication
    isJobScheduled_SendToClient?: boolean;
    isOrderReady_QcAndPacking_SendToClient?: boolean;
    isInvoice_Ready_SendToClient?: boolean;
    isSales_Order_Approve_ByClient?: boolean;

    // 🔄 Workflow Automation
    isAutoRequisitionCreation?: number;
    autoIndentFeatureRequired?: boolean;
    isPicklistFeatureRequired?: boolean;

    // 📄 Document extras
    isQuotationVisibleAfterSO?: boolean;

    // 🏷️ Prefix Settings
    productCatlogPrefix?: string;
    jobCardPrefix?: string;
}

export const getCompany = async (): Promise<CompanyDto> => {
    const response = await api.get('/Company');
    return response.data;
};

export const updateCompany = async (company: CompanyDto): Promise<void> => {
    await api.put('/Company', company);
};

export default api;

// ---------------------------------------------
// HSN Master Types & APIs
// ---------------------------------------------

export interface HSNMasterDto {
    productHSNID?: number;
    productHSNName?: string; // Group Name
    displayName?: string;
    hsnCode?: string;
    productCategory?: string; // ProductType
    gstTaxPercentage?: number;
    cgstTaxPercentage?: number;
    sgstTaxPercentage?: number;
    igstTaxPercentage?: number;
    itemGroupName?: string;
    itemGroupID?: number;
    companyID?: number;
    isDeletedTransaction?: boolean;
}

export interface HSNRowValidation {
    rowIndex: number;
    data: HSNMasterDto;
    cellValidations: CellValidation[];
    rowStatus: ValidationStatus;
    errorMessage?: string;
}

export interface HSNValidationResultDto {
    rows: HSNRowValidation[];
    summary: ValidationSummary;
    isValid: boolean;
}

export const getHSNs = async (companyId: number = 2): Promise<HSNMasterDto[]> => {
    const response = await api.get(`/hsn/list?companyId=${companyId}`);
    return response.data;
};

export const getItemGroupNames = async (companyId: number = 2): Promise<string[]> => {
    const response = await api.get(`/hsn/itemgroups?companyId=${companyId}`);
    return response.data;
};

export const importHSNs = async (hsns: HSNMasterDto[]): Promise<ImportResultDto> => {
    const response = await api.post('/hsn/import', hsns);
    return response.data;
};

export const softDeleteHSN = async (id: number): Promise<ImportResultDto> => {
    const response = await api.delete(`/hsn/delete/${id}`);
    return response.data;
};

export const clearHSNData = async (companyId: number, username?: string, password?: string, reason?: string) => {
    const response = await api.post('/hsn/clear', {
        companyId,
        username,
        password,
        reason
    }, {
        headers: {
            'X-Skip-Auth-Redirect': 'true'   // prevent 401 (wrong creds) from redirecting to login
        }
    });
    return response.data;
};

export const validateHSNs = async (hsns: HSNMasterDto[]): Promise<HSNValidationResultDto> => {
    const response = await api.post('/hsn/validate', hsns);
    return response.data;
};

// ==========================================
// SPARE PART MASTER API
// ==========================================

export interface SparePartMasterDto {
    sparePartID?: number;
    sparePartName?: string;
    sparePartGroup?: string;
    hsnGroup?: string;
    unit?: string;
    rate?: number;
    sparePartType?: string;
    minimumStockQty?: number;
    purchaseOrderQuantity?: number;
    stockRefCode?: string;
    supplierReference?: string;
    narration?: string;
    isDeletedTransaction?: boolean;
}

export interface SparePartRowValidation {
    rowIndex: number;
    data: SparePartMasterDto;
    cellValidations: CellValidation[];
    rowStatus: ValidationStatus;
    errorMessage?: string;
}

export interface SparePartValidationResultDto {
    rows: SparePartRowValidation[];
    summary: ValidationSummary;
    isValid: boolean;
}

export interface HSNGroupDto {
    productHSNID: number;
    displayName: string;
    hsnCode?: string;
}

export interface UnitDto {
    unitID: number;
    unitSymbol: string;
}

export const getAllSpareParts = async (): Promise<SparePartMasterDto[]> => {
    const response = await api.get('/sparepart/all');
    return response.data;
};

export const getHSNGroups = async (): Promise<HSNGroupDto[]> => {
    const response = await api.get('/sparepart/hsn-groups');
    return response.data;
};

export const getUnits = async (): Promise<UnitDto[]> => {
    const response = await api.get('/sparepart/units');
    return response.data;
};

export const softDeleteSparePart = async (sparePartId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/sparepart/soft-delete/${sparePartId}`);
    return response.data;
};

export const validateSpareParts = async (spareParts: SparePartMasterDto[]): Promise<SparePartValidationResultDto> => {
    const response = await api.post('/sparepart/validate', {
        spareParts
    });
    return response.data;
};

export const importSpareParts = async (spareParts: SparePartMasterDto[]): Promise<ImportResultDto> => {
    const response = await api.post('/sparepart/import', {
        spareParts
    });
    return response.data;
};

export const clearAllSparePartData = async (username: string, password: string, reason: string): Promise<any> => {
    const response = await api.post('/sparepart/clear-all-data', {
        username,
        password,
        reason
    }, {
        headers: {
            'X-Skip-Auth-Redirect': 'true'
        }
    });
    return response.data;
};

// ==================== ITEM MASTER ====================

export interface ItemMasterDto {
    itemID?: number;
    itemName?: string;
    itemCode?: string;
    itemGroupID?: number;
    itemGroupName?: string;
    productHSNID?: number;
    hsnGroup?: string;
    stockUnit?: string;
    purchaseUnit?: string;
    estimationUnit?: string;
    unitPerPacking?: number;
    wtPerPacking?: number;
    conversionFactor?: number;
    itemSubGroupID?: number;
    stockType?: string;
    stockCategory?: string;
    sizeW?: number;
    sizeL?: number;
    itemSize?: string;
    purchaseRate?: number;
    stockRefCode?: string;
    itemDescription?: string;
    isDeletedTransaction?: boolean;
    dynamicFields?: Record<string, any>;
    tempId?: string;

    // Paper-specific fields
    quality?: string;
    gsm?: number;
    manufecturer?: string;
    finish?: string;
    manufecturerItemCode?: string;
    caliper?: number;
    shelfLife?: number;
    estimationRate?: number;
    minimumStockQty?: number;
    isStandardItem?: boolean;
    isRegularItem?: boolean;
    packingType?: string;
    certificationType?: string;
    paperGroup?: string;
    productHSNName?: string;
    hsnCode?: string;

    // REEL-specific field
    bf?: string;

    // INK & ADDITIVES-specific fields
    itemSubGroupName?: string;
    itemType?: string;
    inkColour?: string;
    pantoneCode?: string;
    purchaseOrderQuantity?: number;

    // LAMINATION FILM-specific fields
    thickness?: number;
    density?: number;

    // ROLL-specific fields
    releaseGSM?: number;
    adhesiveGSM?: number;
    totalGSM?: number;

    // SHIPPER CARTON-specific fields
    sizeH?: number;
    noOfPly?: number;
    emptyCartonWt?: number;
    capacity?: number;
    cbf?: number;
    cbm?: number;
}

export interface ItemSubGroupDto {
    itemSubGroupID: number;
    itemSubGroupName: string;
}

export interface ItemValidationResultDto {
    isValid: boolean;
    rows: ItemRowValidation[];
    summary: ValidationSummary;
}

export interface ItemRowValidation {
    rowIndex: number;
    data: ItemMasterDto;
    cellValidations: CellValidation[];
    rowStatus: ValidationStatus;
    errorMessage?: string;
}

export const getAllItems = async (itemGroupId: number): Promise<ItemMasterDto[]> => {
    const response = await api.get(`/item?itemGroupId=${itemGroupId}`);
    return response.data;
};

export const getItemHSNGroups = async (): Promise<HSNGroupDto[]> => {
    const response = await api.get('/item/hsn-groups');
    return response.data;
};

export interface FieldUnitsDto {
    purchaseUnit: string[];
    estimationUnit: string[];
    stockUnit: string[];
}

export const getItemUnits = async (itemGroupId: number): Promise<FieldUnitsDto> => {
    const response = await api.get(`/item/units/${itemGroupId}`);
    return response.data;
};

export const getItemSubGroups = async (itemGroupId: number): Promise<ItemSubGroupDto[]> => {
    const response = await api.get(`/item/item-sub-groups?itemGroupId=${itemGroupId}`);
    return response.data;
};

export const softDeleteItem = async (itemId: number): Promise<any> => {
    const response = await api.delete(`/item/${itemId}`);
    return response.data;
};

export const validateItems = async (items: ItemMasterDto[], itemGroupId: number): Promise<ItemValidationResultDto> => {
    const response = await api.post('/item/validate', {
        items,
        itemGroupId
    });
    return response.data.validationResult;
};

export const importItems = async (items: ItemMasterDto[], itemGroupId: number): Promise<ImportResultDto> => {
    const response = await api.post('/item/import', {
        items,
        itemGroupId
    });
    return response.data;
};

export const clearAllItemData = async (username: string, password: string, reason: string, itemGroupId: number): Promise<any> => {
    const response = await api.post('/item/clear-all-data', {
        username,
        password,
        reason,
        itemGroupId
    }, {
        headers: {
            'X-Skip-Auth-Redirect': 'true'
        }
    });
    return response.data;
};

// ==================== TOOL MASTER API ====================

export interface ToolGroupDto {
    toolGroupID: number;
    toolGroupName: string;
    toolGroupNameDisplay?: string;
}

export interface ToolMasterDto {
    toolID?: number;
    toolName?: string;
    toolCode?: string;
    toolGroupID?: number;
    toolGroupName?: string;
    toolType?: string;
    jobName?: string;
    clientName?: string;
    toolRefCode?: string;
    manufacturer?: string;
    noOfTeeth?: number;
    circumferenceMM?: number;
    circumferenceInch?: number;
    bcm?: number;
    lpi?: number;
    aroundGap?: number;
    acrossGap?: number;
    unitSymbol?: string;
    referenceToolNo?: string;
    estimateRate?: number;
    productHSNID?: number;
    productHSNName?: string;
    hsnCode?: string;
    sizeL?: number;
    sizeW?: number;
    sizeH?: number;
    upsAround?: number;
    upsAcross?: number;
    totalUps?: number;
    purchaseUnit?: string;
    purchaseRate?: number;
    manufacturerItemCode?: string;
    purchaseOrderQuantity?: number;
    shelfLife?: number;
    stockUnit?: string;
    minimumStockQty?: number;
    isStandardItem?: boolean;
    isRegularItem?: boolean;
    // SIM / SHIM-specific fields (ToolGroupID 13)
    positive?: string;
    negative?: string;
    master?: string;
    sim?: string;
    location?: string;
    isDeletedTransaction?: boolean;
}

export interface ToolRowValidation {
    rowIndex: number;
    data: ToolMasterDto;
    cellValidations: CellValidation[];
    rowStatus: ValidationStatus;
    errorMessage?: string;
}

export interface ToolValidationResultDto {
    isValid: boolean;
    rows: ToolRowValidation[];
    summary: ValidationSummary;
}

export const getToolGroups = async (): Promise<ToolGroupDto[]> => {
    const response = await api.get('/tool/groups');
    return response.data;
};

export const getAllTools = async (toolGroupId: number): Promise<ToolMasterDto[]> => {
    const response = await api.get(`/tool?toolGroupId=${toolGroupId}`);
    return response.data;
};

export const getToolHSNGroups = async (): Promise<HSNGroupDto[]> => {
    const response = await api.get('/tool/hsn-groups');
    return response.data;
};

export const getToolUnits = async (): Promise<UnitDto[]> => {
    const response = await api.get('/tool/units');
    return response.data;
};

export const softDeleteTool = async (toolId: number): Promise<any> => {
    const response = await api.delete(`/tool/${toolId}`);
    return response.data;
};

export const validateTools = async (tools: ToolMasterDto[], toolGroupId: number): Promise<ToolValidationResultDto> => {
    const response = await api.post('/tool/validate', {
        tools,
        toolGroupId
    });
    return response.data.validationResult;
};

export const importTools = async (tools: ToolMasterDto[], toolGroupId: number): Promise<ImportResultDto> => {
    const response = await api.post('/tool/import', {
        tools,
        toolGroupId
    });
    return response.data;
};

export const clearAllToolData = async (username: string, password: string, reason: string, toolGroupId: number): Promise<any> => {
    const response = await api.post('/tool/clear-all-data', {
        username,
        password,
        reason,
        toolGroupId
    }, {
        headers: {
            'X-Skip-Auth-Redirect': 'true'
        }
    });
    return response.data;
};

// ==================== ITEM STOCK API ====================

export interface ItemStockRowDto {
    rowIndex?: number;
    itemCode?: string;
    receiptQuantity: number;
    landedRate: number;
    stockUnit?: string;
    batchNo?: string;
    supplierBatchNo?: string;
    warehouseName?: string;
    binName?: string;
    warehouseID?: number;
    quality?: string;
    gsm?: number;
    manufecturer?: string;
    finish?: string;
    sizeL?: number;
    sizeW?: number;
}

export interface ItemStockImportResult {
    success: boolean;
    totalRows: number;
    importedRows: number;
    failedRows: number;
    message: string;
    errorMessages: string[];
}

export interface ItemStockEnrichedRow {
    itemCode?: string;
    itemID: number;
    receiptQuantity: number;
    landedRate: number;
    batchNo?: string;
    supplierBatchNo?: string;
    stockUnit?: string;
    warehouseName?: string;
    binName?: string;
    itemName?: string;
    quality?: string;
    gsm?: number;
    manufecturer?: string;
    finish?: string;
    sizeL?: number;
    sizeW?: number;
    isValid: boolean;
    error?: string;
}

export interface ItemStockEnrichResult {
    rows: ItemStockEnrichedRow[];
    invalidItemCodes: string[];
}

export interface WarehouseDto {
    warehouseID: number;
    warehouseName: string;
    binName?: string;
}

export const getStockWarehouses = async (): Promise<WarehouseDto[]> => {
    const response = await api.get('/itemstock/warehouses');
    return response.data;
};

export const getStockBins = async (warehouseName: string): Promise<WarehouseDto[]> => {
    const response = await api.get('/itemstock/bins', { params: { warehouseName } });
    return response.data;
};

export const enrichItemStock = async (rows: { itemCode?: string; receiptQuantity: number; landedRate: number; stockUnit?: string; warehouseName?: string; binName?: string; batchNo?: string; quality?: string; gsm?: number; manufecturer?: string; finish?: string; sizeL?: number; sizeW?: number }[], itemGroupId: number): Promise<ItemStockEnrichResult> => {
    const response = await api.post('/itemstock/enrich', { rows, itemGroupId });
    return response.data;
};

export const importItemStock = async (rows: ItemStockRowDto[], itemGroupId: number): Promise<ItemStockImportResult> => {
    const response = await api.post('/itemstock/import', { rows, itemGroupId });
    return response.data;
};

export interface ItemStockCellValidation {
    columnName: string;
    status: string;
    validationMessage: string;
}

export interface ItemStockRowValidation {
    rowIndex: number;
    rowStatus: string;
    errorMessage?: string;
    cellValidations: ItemStockCellValidation[];
}

export interface ItemStockValidationSummary {
    totalRows: number;
    validRows: number;
    duplicateCount: number;
    missingDataCount: number;
    mismatchCount: number;
    invalidContentCount: number;
}

export interface ItemStockValidationResult {
    isValid: boolean;
    summary: ItemStockValidationSummary;
    rows: ItemStockRowValidation[];
}

export const validateItemStock = async (rows: ItemStockEnrichedRow[], itemGroupId: number): Promise<ItemStockValidationResult> => {
    const response = await api.post('/itemstock/validate', { rows, itemGroupId });
    return response.data;
};

export const loadStockData = async (itemGroupId: number): Promise<ItemStockEnrichedRow[]> => {
    const response = await api.get('/itemstock/load', { params: { itemGroupId } });
    return response.data;
};

export const resetItemStock = async (
    itemGroupId: number, username: string, password: string, reason: string,
    itemIds?: number[], fromDate?: string, toDate?: string
): Promise<ItemStockImportResult> => {
    const response = await api.post('/itemstock/reset-item-stock', {
        itemGroupId, username, password, reason,
        itemIds: itemIds ?? [],
        fromDate: fromDate || null, toDate: toDate || null
    });
    return response.data;
};

export const resetFloorStock = async (
    itemGroupId: number, username: string, password: string, reason: string,
    fromDate?: string, toDate?: string
): Promise<ItemStockImportResult> => {
    const response = await api.post('/itemstock/reset-floor-stock', {
        itemGroupId, username, password, reason,
        fromDate: fromDate || null, toDate: toDate || null
    });
    return response.data;
};

export const loadMasterData = async (itemGroupId: number): Promise<ItemStockEnrichedRow[]> => {
    const response = await api.get('/itemstock/master-data', { params: { itemGroupId } });
    return response.data;
};

// ==================== AUTH API ====================

export interface CompanyLoginRequest {
    companyUserID: string;
    password: string;
}

export interface CompanyLoginResponse {
    success: boolean;
    message: string;
    companyToken: string;
    companyName: string;
}

export interface UserLoginRequest {
    userName: string;
    password: string;
    fYear: string;
}

export interface UserLoginResponse {
    success: boolean;
    message: string;
    token: string;
    userID: number;
    userName: string;
    companyID: number;
    branchID: number;
    fYear: string;
    isAdmin: boolean;
    companyName: string;
    authorizedModules: string[];
}

export const companyLogin = async (data: CompanyLoginRequest): Promise<CompanyLoginResponse> => {
    const response = await api.post('/auth/company-login', data);
    return response.data;
};

export const userLogin = async (data: UserLoginRequest): Promise<UserLoginResponse> => {
    const response = await api.post('/auth/user-login', data);
    return response.data;
};

export const logout = async (): Promise<void> => {
    try {
        await api.post('/auth/logout');
    } catch {
        // Ignore error if logout fails
    }
};

// ==================== INDUS LOGIN ====================

export interface IndusLoginRequest {
    webUserName: string;
    password: string;
}

export interface IndusLoginResponse {
    success: boolean;
    message: string;
    token: string;
    webUserName: string;
}

export const indusLogin = async (data: IndusLoginRequest): Promise<IndusLoginResponse> => {
    const response = await api.post('/auth/indus-login', data);
    return response.data;
};

export const checkSession = async (): Promise<boolean> => {
    try {
        await api.get('/auth/check-session');
        return true;
    } catch (error: any) {
        // If it's a 401, the interceptor will handle it.
        // If it's another error, we still consider it "not authenticated" for safety in this check.
        return false;
    }
};

// ==================== COMPANY SUBSCRIPTION ====================

export interface CompanySubscriptionDto {
    companyUserID: string;
    password: string;
    conn_String?: string;
    companyName: string;
    apiCompanyUserName?: string;
    apiCompanyPassword?: string;
    applicationName?: string;
    applicationVersion?: string;
    dataBaseLocation?: string;
    lastLoginDateTime?: string;
    isActive?: boolean;
    country?: string;
    state?: string;
    city?: string;
    applicationBaseURL?: string;
    companyCode?: string;
    companyUniqueCode?: string;
    maxCompanyUniqueCode?: number;
    fromDate?: string;
    toDate?: string;
    fYear?: string;
    paymentDueDate?: string;
    subscriptionStatus?: string;
    statusDescription?: string;
    subscriptionStatusMessage?: string;
    loginAllowed?: number;
    gstin?: string;
    latestVersion?: string;
    loginAllowedOldVersion?: number;
    oldVersion?: string;
    email?: string;
    mobile?: string;
    address?: string;
    isMessageActive?: boolean;
    messageDurationValue?: number;
    messageDurationType?: string;
    cloudFromDate?: string;
    cloudToDate?: string;
    cloudPaymentDueDate?: string;
    cloudSubscriptionStatus?: string;
}

export interface CompanySubscriptionSaveRequest extends CompanySubscriptionDto {
    originalCompanyUserID?: string;
}

export interface CompanySubscriptionListResponse {
    success: boolean;
    message: string;
    data: CompanySubscriptionDto[];
}

export interface CompanySubscriptionResponse {
    success: boolean;
    message: string;
    data?: CompanySubscriptionDto;
}

export const getCompanySubscriptions = async (): Promise<CompanySubscriptionListResponse> => {
    const response = await api.get('/companysubscription');
    return response.data;
};

export const getCompanySubscriptionByKey = async (companyUserID: string): Promise<CompanySubscriptionResponse> => {
    const response = await api.get(`/companysubscription/${encodeURIComponent(companyUserID)}`);
    return response.data;
};

export const createCompanySubscription = async (data: CompanySubscriptionDto): Promise<CompanySubscriptionResponse> => {
    const response = await api.post('/companysubscription', data);
    return response.data;
};

export const updateCompanySubscription = async (data: CompanySubscriptionSaveRequest): Promise<CompanySubscriptionResponse> => {
    const response = await api.put('/companysubscription', data);
    return response.data;
};

export interface DeleteCompanySubscriptionRequest {
    companyUserID: string;
    companyName: string;
    companyUniqueCode: string;
    userName: string;
    password: string;
    reason: string;
}

export interface DeleteCompanySubscriptionResponse {
    success: boolean;
    message: string;
}

export const deleteCompanySubscription = async (data: DeleteCompanySubscriptionRequest): Promise<DeleteCompanySubscriptionResponse> => {
    const response = await api.post('/companysubscription/delete-with-auth', data);
    return response.data;
};

export interface SetupDatabaseRequest {
    server: string;
    applicationName: string;
    backupType: string;
    clientName: string;
    databaseName: string;
    backupDatabaseName?: string;
}

export interface SetupDatabaseResponse {
    success: boolean;
    message: string;
    connectionString: string;
    databaseName: string;
    server: string;
    applicationName: string;
    clientName: string;
}

export interface ServerListResponse {
    success: boolean;
    servers: string[];
}

export interface NextClientCodeResponse {
    success: boolean;
    companyUniqueCode: string;
    maxCompanyUniqueCode: number;
    message: string;
}

export const getNextClientCode = async (): Promise<NextClientCodeResponse> => {
    const response = await api.get('/companysubscription/next-client-code');
    return response.data;
};

export const getServers = async (): Promise<ServerListResponse> => {
    const response = await api.get('/companysubscription/servers');
    return response.data;
};

export interface DynamicBackupDatabaseResponse {
    success: boolean;
    message: string;
    databases: string[];
}

export const getBackupDatabases = async (applicationName: string): Promise<DynamicBackupDatabaseResponse> => {
    const response = await api.get(`/companysubscription/backup-databases/${encodeURIComponent(applicationName)}`);
    return response.data;
};

export const setupDatabase = async (data: SetupDatabaseRequest): Promise<SetupDatabaseResponse> => {
    const response = await api.post('/companysubscription/setup-database', data);
    return response.data;
};

// ─── Step 3: Company Master ───
export interface CompanyMasterRequest {
    connectionString: string;
    companyID: number;
    companyName: string;
    address1?: string;
    address2?: string;
    address3?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    contactNO?: string;
    mobileNO?: string;
    email?: string;
    website?: string;
    stateTinNo?: string;
    cinNo?: string;
    productionUnitAddress?: string;
    address?: string;
    gstin?: string;
    productionUnitName?: string;
    pan?: string;
}

export interface CompanyMasterResponse {
    success: boolean;
    message: string;
    companyID: number;
}

export const saveCompanyMaster = async (data: CompanyMasterRequest): Promise<CompanyMasterResponse> => {
    const response = await api.post('/companysubscription/save-company-master', data);
    return response.data;
};

// ─── Step 4: Branch Master ───
export interface BranchMasterRequest {
    connectionString: string;
    branchID: number;
    branchName: string;
    mailingName?: string;
    address1?: string;
    address2?: string;
    address3?: string;
    address?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    pincode?: string;
    mobileNo?: string;
    email?: string;
    stateTinNo?: string;
    gstin?: string;
    companyID?: number;
}

export interface BranchMasterResponse {
    success: boolean;
    message: string;
}

export const saveBranchMaster = async (data: BranchMasterRequest): Promise<BranchMasterResponse> => {
    const response = await api.post('/companysubscription/save-branch-master', data);
    return response.data;
};

// ─── Step 5: Production Unit ───
export interface ProductionUnitRequest {
    connectionString: string;
    productionUnitName: string;
    address?: string;
    city?: string;
    state?: string;
    gstNo?: string;
    pincode?: string;
    country?: string;
    pan?: string;
}

export interface ProductionUnitResponse {
    success: boolean;
    message: string;
}

export const saveProductionUnit = async (data: ProductionUnitRequest): Promise<ProductionUnitResponse> => {
    const response = await api.post('/companysubscription/save-production-unit', data);
    return response.data;
};

// ─── Final Step: Complete Setup ───
export interface CompleteSetupRequest {
    connectionString: string;
    city?: string;
    state?: string;
    country?: string;
    companyUserID: string;
}

export interface CompleteSetupResponse {
    success: boolean;
    message: string;
    companyUserID: string;
    password: string;
    userName?: string;
    userPassword?: string;
}

export const completeSetup = async (data: CompleteSetupRequest): Promise<CompleteSetupResponse> => {
    const response = await api.post('/companysubscription/complete-setup', data);
    return response.data;
};

// ─── Module Settings ───
export interface ModuleSettingsRow {
    moduleHeadName: string;
    moduleDisplayName: string;
    moduleName: string;
    status: boolean;
}

export interface ModuleSettingsResponse {
    success: boolean;
    message: string;
    data: ModuleSettingsRow[];
}

export interface SaveModuleSettingsRequest {
    applicationName: string;
    connectionString: string;
    modules: { moduleName: string; status: boolean }[];
}

export interface SaveModuleSettingsResponse {
    success: boolean;
    message: string;
    inserted: number;
    deleted: number;
}

export const getModuleSettings = async (applicationName: string, connectionString: string): Promise<ModuleSettingsResponse> => {
    const response = await api.post('/companysubscription/get-module-settings', { applicationName, connectionString });
    return response.data;
};

export const saveModuleSettings = async (data: SaveModuleSettingsRequest): Promise<SaveModuleSettingsResponse> => {
    const response = await api.post('/companysubscription/save-module-settings', data);
    return response.data;
};

// ─── Copy Modules ───
export interface ClientDropdownItem {
    companyName: string;
    companyUserID: string;
    applicationName: string;
}

export interface ClientDropdownResponse {
    success: boolean;
    message: string;
    data: ClientDropdownItem[];
}

export interface CopyModulesResponse {
    success: boolean;
    message: string;
    copiedCount: number;
}

export const getClientDropdown = async (): Promise<ClientDropdownResponse> => {
    const response = await api.get('/companysubscription/client-dropdown');
    return response.data;
};

export const copyModules = async (sourceConnectionString: string, targetCompanyUserID: string): Promise<CopyModulesResponse> => {
    const response = await api.post('/companysubscription/copy-modules', { sourceConnectionString, targetCompanyUserID });
    return response.data;
};

// ─── Module Group Authority ───
export interface ModuleGroupModuleRow {
    moduleHeadName: string;
    moduleDisplayName: string;
    moduleName: string;
}

export interface ModuleGroupDropdownResponse {
    success: boolean;
    message: string;
    data: string[];
}

export interface ModuleGroupModulesResponse {
    success: boolean;
    message: string;
    data: ModuleGroupModuleRow[];
}

export interface CreateModuleGroupRequest {
    applicationName: string;
    moduleGroupName: string;
    selectedModuleNames: string[];
}

export interface CreateModuleGroupResponse {
    success: boolean;
    message: string;
}

export const getModuleGroups = async (applicationName: string): Promise<ModuleGroupDropdownResponse> => {
    const response = await api.get(`/companysubscription/module-groups/${applicationName}`);
    return response.data;
};

export const getModuleGroupModules = async (applicationName: string, moduleGroupName: string): Promise<ModuleGroupModulesResponse> => {
    const response = await api.post('/companysubscription/module-group-modules', { applicationName, moduleGroupName });
    return response.data;
};

export const getAvailableModulesForGroup = async (applicationName: string): Promise<ModuleGroupModulesResponse> => {
    const response = await api.get(`/companysubscription/available-modules/${applicationName}`);
    return response.data;
};

export const createModuleGroup = async (data: CreateModuleGroupRequest): Promise<CreateModuleGroupResponse> => {
    const response = await api.post('/companysubscription/create-module-group', data);
    return response.data;
};

export interface UpdateModuleGroupRequest {
    applicationName: string;
    moduleGroupName: string;
    selectedModuleNames: string[];
}

export interface UpdateModuleGroupResponse {
    success: boolean;
    message: string;
    inserted: number;
    deleted: number;
}

export const updateModuleGroup = async (data: UpdateModuleGroupRequest): Promise<UpdateModuleGroupResponse> => {
    const response = await api.put('/companysubscription/update-module-group', data);
    return response.data;
};

export interface ApplyModuleGroupToClientRequest {
    applicationName: string;
    moduleGroupName: string;
    connectionString: string;
}

export interface ApplyModuleGroupToClientResponse {
    success: boolean;
    message: string;
    totalModules: number;
}

export const applyModuleGroupToClient = async (data: ApplyModuleGroupToClientRequest): Promise<ApplyModuleGroupToClientResponse> => {
    const response = await api.post('/companysubscription/apply-module-group-to-client', data);
    return response.data;
};

export interface CheckModulesExistResponse {
    success: boolean;
    message: string;
    hasModules: boolean;
    moduleCount: number;
}

export const checkModulesExist = async (connectionString: string): Promise<CheckModulesExistResponse> => {
    const response = await api.get('/companysubscription/check-modules-exist', {
        params: { connectionString }
    });
    return response.data;
};

export interface DeleteModuleGroupRequest {
    applicationName: string;
    moduleGroupName: string;
    userName: string;
    password: string;
    reason: string;
}

export interface DeleteModuleGroupResponse {
    success: boolean;
    message: string;
    deletedCount: number;
}

export const deleteModuleGroup = async (data: DeleteModuleGroupRequest): Promise<DeleteModuleGroupResponse> => {
    const response = await api.post('/companysubscription/delete-module-group', data);
    return response.data;
};

// ==================== DATABASE BACKUP & RESTORE ====================

export interface BackupAndTransferRequest {
    sourceConnectionString: string;
    destinationConnectionString: string;
    destinationServerUrl: string | null; // null = same server
    databaseName: string;
    backupDatabaseName: string;
    allowOverwrite: boolean;
    apiKey?: string; // For cross-server auth
}

export interface BackupAndTransferResponse {
    success: boolean;
    message: string;
    operationId: string;
}

export interface RestoreRequest {
    connectionString: string;
    backupFilePath: string;
    databaseName: string;
    allowOverwrite: boolean;
}

export interface RestoreResponse {
    success: boolean;
    message: string;
    databaseName?: string;
}

export interface OperationStatusResponse {
    operationId: string;
    stage: string; // "Backing up", "Transferring", "Restoring", "Complete", etc.
    percentComplete: number; // 0-100
    message: string;
    isComplete: boolean;
    success: boolean;
    error?: string;
    bytesTransferred: number;
    totalBytes: number;
    startedAt: string;
    completedAt?: string;
}

export const backupAndTransfer = async (request: BackupAndTransferRequest): Promise<BackupAndTransferResponse> => {
    const response = await api.post('/DatabaseBackupRestore/backup-and-transfer', request);
    return response.data;
};

export const restoreDatabase = async (request: RestoreRequest): Promise<RestoreResponse> => {
    const response = await api.post('/DatabaseBackupRestore/restore', request);
    return response.data;
};

export const getBackupRestoreStatus = async (operationId: string): Promise<OperationStatusResponse> => {
    const response = await api.get(`/DatabaseBackupRestore/status/${operationId}`);
    return response.data;
};

// Fresh COPY_ONLY backup of the given DB, compressed to .zip, streamed back for local download.
// Uses the shared `api` instance so the base URL (VITE_API_BASE_URL) + JWT Bearer are applied.
export const downloadDatabaseBackup = async (server: string, databaseName: string): Promise<Blob> => {
    const response = await api.get('/DatabaseBackupRestore/download-backup', {
        params: { server, databaseName },
        responseType: 'blob',
        timeout: 30 * 60 * 1000, // 30 min — large DBs take time to back up + stream
    });
    return response.data as Blob;
};

// ==========================================
// RECORD COUNT CHECK HELPERS
// Used by "Clear All Data" to decide whether to show "No Data found" popup
// or run the full confirmation flow.
// ==========================================

/** Returns the number of ledger records for a given ledger group. */
export const getLedgerCount = async (ledgerGroupId: number): Promise<number> => {
    try {
        const data = await getLedgersByGroup(ledgerGroupId);
        return Array.isArray(data) ? data.length : 0;
    } catch {
        return 0;
    }
};

/** Returns the number of item records for a given item group. */
export const getItemCount = async (itemGroupId: number): Promise<number> => {
    try {
        const data = await getAllItems(itemGroupId);
        return Array.isArray(data) ? data.length : 0;
    } catch {
        return 0;
    }
};

/** Returns the number of tool records for a given tool group. */
export const getToolCount = async (toolGroupId: number): Promise<number> => {
    try {
        const data = await getAllTools(toolGroupId);
        return Array.isArray(data) ? data.length : 0;
    } catch {
        return 0;
    }
};

/** Returns the number of spare part records in the database. */
export const getSparePartCount = async (): Promise<number> => {
    try {
        const data = await getAllSpareParts();
        return Array.isArray(data) ? data.length : 0;
    } catch {
        return 0;
    }
};

/** Returns the number of HSN records in the database. */
export const getHSNCount = async (companyId: number = 2): Promise<number> => {
    try {
        const data = await getHSNs(companyId);
        return Array.isArray(data) ? data.length : 0;
    } catch {
        return 0;
    }
};

// ==========================================
// MODULE AUTHORITY API
// ==========================================

export interface ModuleAuthorityRowDto {
    moduleHeadName: string;
    moduleName: string;
    moduleDisplayName: string;
    status: boolean;
    existsInLoginDb: boolean;
}

export interface ModuleAuthoritySaveDto {
    moduleHeadName: string;
    moduleName: string;
    moduleDisplayName: string;
    status: boolean;
}

export const getModuleAuthorityData = async (product: string): Promise<ModuleAuthorityRowDto[]> => {
    const response = await api.get(`/moduleauthority/GetData?product=${encodeURIComponent(product)}`);
    return response.data;
};

export const saveModuleAuthority = async (product: string, modules: ModuleAuthoritySaveDto[]): Promise<{ inserted: number; deleted: number; maintained: number; total: number }> => {
    const response = await api.post('/moduleauthority/Save', { product, modules });
    return response.data;
};

// ==================== SPARE PART MASTER STOCK API ====================

export interface SparePartStockRowDto {
    rowIndex?: number;
    sparePartCode?: string;
    sparePartName?: string;
    receiptQuantity: number;
    landedRate: number;
    stockUnit?: string;
    batchNo?: string;
    supplierBatchNo?: string;
    warehouseName?: string;
    binName?: string;
    warehouseID?: number;
}

export interface SparePartStockImportResult {
    success: boolean;
    totalRows: number;
    importedRows: number;
    failedRows: number;
    message: string;
    errorMessages: string[];
}

export interface SparePartStockEnrichedRow {
    sparePartCode?: string;
    sparePartName?: string;
    spareID: number;
    receiptQuantity: number;
    landedRate: number;
    batchNo?: string;
    supplierBatchNo?: string;
    stockUnit?: string;
    warehouseName?: string;
    binName?: string;
    isValid: boolean;
    error?: string;
}

export interface SparePartStockEnrichResult {
    rows: SparePartStockEnrichedRow[];
    invalidSparePartNames: string[];
}

export interface SparePartStockCellValidation {
    columnName: string;
    status: string;
    validationMessage: string;
}

export interface SparePartStockRowValidation {
    rowIndex: number;
    rowStatus: string;
    errorMessage?: string;
    cellValidations: SparePartStockCellValidation[];
}

export interface SparePartStockValidationSummary {
    totalRows: number;
    validRows: number;
    duplicateCount: number;
    missingDataCount: number;
    mismatchCount: number;
    invalidContentCount: number;
}

export interface SparePartStockValidationResult {
    isValid: boolean;
    summary: SparePartStockValidationSummary;
    rows: SparePartStockRowValidation[];
}

export const getSparePartStockWarehouses = async (): Promise<WarehouseDto[]> => {
    const response = await api.get('/sparepartmasterstock/warehouses');
    return response.data;
};

export const getSparePartStockBins = async (warehouseName: string): Promise<WarehouseDto[]> => {
    const response = await api.get('/sparepartmasterstock/bins', { params: { warehouseName } });
    return response.data;
};

export const enrichSparePartStock = async (rows: { sparePartCode?: string; sparePartName?: string; receiptQuantity: number; landedRate: number; stockUnit?: string; warehouseName?: string; binName?: string; batchNo?: string }[]): Promise<SparePartStockEnrichResult> => {
    const response = await api.post('/sparepartmasterstock/enrich', { rows });
    return response.data;
};

export const importSparePartStock = async (rows: SparePartStockRowDto[]): Promise<SparePartStockImportResult> => {
    const response = await api.post('/sparepartmasterstock/import', { rows });
    return response.data;
};

export const validateSparePartStock = async (rows: SparePartStockEnrichedRow[]): Promise<SparePartStockValidationResult> => {
    const response = await api.post('/sparepartmasterstock/validate', { rows });
    return response.data;
};

export const loadSparePartStockData = async (): Promise<SparePartStockEnrichedRow[]> => {
    const response = await api.get('/sparepartmasterstock/load');
    return response.data;
};

export const loadSparePartMasterData = async (): Promise<SparePartStockEnrichedRow[]> => {
    const response = await api.get('/sparepartmasterstock/master-data');
    return response.data;
};

// ==================== TOOL STOCK API ====================

export interface ToolStockRowDto {
    rowIndex?: number;
    toolGroupName?: string;
    toolCode?: string;
    toolName?: string;
    receiptQuantity: number;
    landedRate: number;
    stockUnit?: string;
    batchNo?: string;
    supplierBatchNo?: string;
    warehouseName?: string;
    binName?: string;
}

export interface ToolStockImportResult {
    success: boolean;
    totalRows: number;
    importedRows: number;
    failedRows: number;
    message: string;
    errorMessages: string[];
}

export interface ToolStockEnrichedRow {
    toolGroupName?: string;
    toolCode?: string;
    toolName?: string;
    toolID: number;
    toolGroupID: number;
    receiptQuantity: number;
    landedRate: number;
    batchNo?: string;
    supplierBatchNo?: string;
    stockUnit?: string;
    warehouseName?: string;
    binName?: string;
    warehouseID?: number;
    isValid: boolean;
    error?: string;
}

export interface ToolStockEnrichResult {
    rows: ToolStockEnrichedRow[];
    invalidToolNames: string[];
    invalidToolGroupNames: string[];
}

export interface ToolStockCellValidation {
    columnName: string;
    status: string;
    validationMessage: string;
}

export interface ToolStockRowValidation {
    rowIndex: number;
    rowStatus: string;
    errorMessage?: string;
    cellValidations: ToolStockCellValidation[];
}

export interface ToolStockValidationSummary {
    totalRows: number;
    validRows: number;
    duplicateCount: number;
    missingDataCount: number;
    mismatchCount: number;
    invalidContentCount: number;
}

export interface ToolStockValidationResult {
    isValid: boolean;
    summary: ToolStockValidationSummary;
    rows: ToolStockRowValidation[];
}

export const getToolStockWarehouses = async (): Promise<WarehouseDto[]> => {
    const response = await api.get('/toolstock/warehouses');
    return response.data;
};

export const getToolStockBins = async (warehouseName: string): Promise<WarehouseDto[]> => {
    const response = await api.get(`/toolstock/bins?warehouseName=${encodeURIComponent(warehouseName)}`);
    return response.data;
};

export const enrichToolStock = async (rows: { toolGroupName?: string; toolCode?: string; toolName?: string; receiptQuantity: number; landedRate: number; stockUnit?: string; warehouseName?: string; binName?: string; batchNo?: string }[]): Promise<ToolStockEnrichResult> => {
    const response = await api.post('/toolstock/enrich', { rows });
    return response.data;
};

export const importToolStock = async (rows: ToolStockRowDto[]): Promise<ToolStockImportResult> => {
    const response = await api.post('/toolstock/import', { rows });
    return response.data;
};

export const validateToolStock = async (rows: ToolStockEnrichedRow[]): Promise<ToolStockValidationResult> => {
    const response = await api.post('/toolstock/validate', { rows });
    return response.data;
};

export const loadToolStockData = async (toolGroupId: number): Promise<ToolStockEnrichedRow[]> => {
    const response = await api.get('/toolstock/load', { params: { toolGroupId } });
    return response.data;
};

export const loadToolMasterData = async (toolGroupId: number): Promise<ToolStockEnrichedRow[]> => {
    const response = await api.get('/toolstock/master-data', { params: { toolGroupId } });
    return response.data;
};

// ==================== MESSAGE FORMAT MASTER API ====================

export interface MessageFormatDto {
    messageID: number;
    messageTitle: string;
    messageContent: string;
    isActive: boolean;
}

export interface MessageFormatListResponse {
    success: boolean;
    message: string;
    data: MessageFormatDto[];
}

export interface MessageFormatResponse {
    success: boolean;
    message: string;
    data?: MessageFormatDto;
}

export interface MessageFormatSaveRequest {
    messageID?: number;
    messageTitle: string;
    messageContent: string;
    isActive?: boolean;
}

export const getMessageFormats = async (): Promise<MessageFormatListResponse> => {
    const response = await api.get('/messageformat');
    return response.data;
};

export const createMessageFormat = async (data: MessageFormatSaveRequest): Promise<MessageFormatResponse> => {
    const response = await api.post('/messageformat', data);
    return response.data;
};

export const updateMessageFormat = async (data: MessageFormatSaveRequest): Promise<MessageFormatResponse> => {
    const response = await api.put('/messageformat', data);
    return response.data;
};

export const deleteMessageFormat = async (messageId: number): Promise<MessageFormatResponse> => {
    const response = await api.delete(`/messageformat/${messageId}`);
    return response.data;
};

// ==================== ACTIVITY LOG ====================

export interface ActivityLogDto {
    activityLogID: number;
    webUserId?: number;
    webUserName: string;
    loginType: string;
    actionType: string;
    moduleName: string;
    entityName?: string;
    entityID?: number;
    actionDescription: string;
    oldValue?: string;
    newValue?: string;
    ipAddress?: string;
    userAgent?: string;
    createdDate: string;
    isSuccess: boolean;
    errorMessage?: string;
}

export interface ActivityLogFilterRequest {
    webUserId?: number;
    webUserName?: string;
    actionType?: string;
    entityName?: string;
    entityID?: number;
    startDate?: string;
    endDate?: string;
    pageNumber?: number;
    pageSize?: number;
}

export interface ActivityLogResponse {
    logs: ActivityLogDto[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
}

export interface ActivityLogSummary {
    totalActivities: number;
    todayActivities: number;
    thisWeekActivities: number;
    failedActivities: number;
    topActions: ActionTypeCount[];
    topUsers: UserActivityCount[];
}

export interface ActionTypeCount {
    actionType: string;
    count: number;
}

export interface UserActivityCount {
    webUserId?: number;
    webUserName: string;
    count: number;
}

export const getActivityLogs = async (filter: ActivityLogFilterRequest): Promise<ActivityLogResponse> => {
    const response = await api.post('/activitylog/search', filter);
    return response.data;
};

export const getActivityLogById = async (id: number): Promise<ActivityLogDto> => {
    const response = await api.get(`/activitylog/${id}`);
    return response.data;
};

export const getEntityActivityLogs = async (entityName: string, entityId: number): Promise<ActivityLogDto[]> => {
    const response = await api.get(`/activitylog/entity/${entityName}/${entityId}`);
    return response.data;
};

export const getActivitySummary = async (): Promise<ActivityLogSummary> => {
    const response = await api.get('/activitylog/summary');
    return response.data;
};

export const getActivityLogUsernames = async (): Promise<string[]> => {
    const response = await api.get('/activitylog/usernames');
    return response.data;
};

// Transaction Delete API
export const clearAllTransactions = async (username: string, password: string, reason: string): Promise<{ message: string; deletedCount: number }> => {
    const response = await api.post('/transactiondelete/clear-all-transactions', {
        username,
        password,
        reason
    });
    return response.data;
};

// Master Usage Check & Delete
export interface UsageDetail {
    area: string;
    tableName: string;
    count: number;
    description: string;
}

export interface MasterUsageResult {
    isUsed: boolean;
    usages: UsageDetail[];
    message: string;
    totalItemsInGroup: number;
    itemsUsedInTransactions: number;
    unusedItemsCount: number;
}

export interface DeleteMasterDataResult {
    success: boolean;
    message: string;
    deletedCount: number;
}

export const checkMasterUsage = async (moduleName: string, subModuleId: number): Promise<MasterUsageResult> => {
    const response = await api.post('/transactiondelete/check-master-usage', {
        moduleName,
        subModuleId
    });
    return response.data;
};

export const deleteMasterData = async (
    moduleName: string,
    subModuleId: number,
    username: string,
    password: string,
    reason: string
): Promise<DeleteMasterDataResult> => {
    const response = await api.post('/transactiondelete/delete-master-data', {
        moduleName,
        subModuleId,
        username,
        password,
        reason
    }, {
        headers: { 'X-Skip-Auth-Redirect': 'true' }  // Prevent 401 from redirecting to login
    });
    return response.data;
};

export const deleteUnusedMasterData = async (
    moduleName: string,
    subModuleId: number,
    username: string,
    password: string,
    reason: string
): Promise<DeleteMasterDataResult> => {
    const response = await api.post('/transactiondelete/delete-unused-master-data', {
        moduleName,
        subModuleId,
        username,
        password,
        reason
    }, {
        headers: { 'X-Skip-Auth-Redirect': 'true' }  // Prevent 401 from redirecting to login
    });
    return response.data;
};

// ─── Content Authority ────────────────────────────────────────────────────────

export interface ContentAuthorityRowDto {
    contentName: string;
    contentCaption: string;
    isSelected: boolean;      // In Client DB AND IsActive=1
    existsInClientDb: boolean; // In Client DB (regardless of IsActive)
    contentOpenHref: string;
    contentClosedHref: string;
}

export interface ContentAuthoritySaveRequest {
    selectedContents: string[];
    deselectedContents: string[];
}

export interface ContentAuthoritySaveResult {
    processed: number;
    inserted: number;
    updated: number;
    deactivated: number;
    childRowsDeleted: number;
    childRowsInserted: number;
    message: string;
}

export const getContentAuthorityData = async (): Promise<ContentAuthorityRowDto[]> => {
    const response = await api.get('/contentauthority');
    return response.data;
};

export const saveContentAuthority = async (request: ContentAuthoritySaveRequest): Promise<ContentAuthoritySaveResult> => {
    const response = await api.post<ContentAuthoritySaveResult>('/ContentAuthority/save', request);
    return response.data;
};

export const updateContentTechDetails = async (contentNames: string[]): Promise<ContentAuthoritySaveResult> => {
    const response = await api.post<ContentAuthoritySaveResult>('/ContentAuthority/update-tech-details', contentNames);
    return response.data;
};

export const updateKeylineTechDetails = async (contentNames: string[]): Promise<ContentAuthoritySaveResult> => {
    const response = await api.post<ContentAuthoritySaveResult>('/ContentAuthority/update-keyline-details', contentNames);
    return response.data;
};

// ─── Keyline Generator ────────────────────────────────────────────────────────

export interface KeylineCoordinateDto {
    coordinateID?: number;
    contentType?: string;
    grain?: string;
    upsType?: string;
    shapeType?: string;
    shapeName?: string;
    lineType?: string;
    addInX1?: string;
    addInY1?: string;
    addInX2?: string;
    addInY2?: string;
    addInXForUps?: string;
    addInYForUps?: string;
    lineStyles?: string;
    sheetSize?: string;
}

export interface KeylineFormulaDto {
    id: number;
    formula?: string;
}

export interface KeylinePlanningDto {
    formulaID?: number;
    contentType?: string;
    grain?: string;
    upsType?: string;
    sheetSize?: string;
    formula?: string;
}

export interface SaveCoordinatesRequest {
    coordinates: KeylineCoordinateDto[];
    contentName: string;
    grain: string;
    upsType: string;
}

export interface SavePlanningRequest {
    planning: KeylinePlanningDto[];
    contentName: string;
}

export interface SaveFormulaRequest {
    formula: string;
    editFlag: boolean;
    formulaID?: number;
}

export interface KeylineMetaDto {
    shapeNames: string[];
    formulaX1: string[];
    formulaY1: string[];
    formulaX2: string[];
    formulaY2: string[];
}

export const keylineGetContentNames = async (): Promise<string[]> => {
    const response = await api.get('/keyline/content-names');
    return response.data;
};

export const keylineGetMeta = async (contentType: string, grain: string, upsType: string): Promise<KeylineMetaDto> => {
    const response = await api.get<KeylineMetaDto>('/keyline/meta', { params: { contentType, grain, upsType } });
    return response.data;
};

export const keylineGetShapeNames = async (contentType: string, grain: string, upsType: string): Promise<string[]> => {
    const response = await api.get('/keyline/shape-names', { params: { contentType, grain, upsType } });
    return response.data;
};

export const keylineGetCoordinates = async (contentType: string, grain: string, upsType: string): Promise<KeylineCoordinateDto[]> => {
    const response = await api.get('/keyline/coordinates', { params: { contentType, grain, upsType } });
    return response.data;
};

export const keylineGetShapeWiseData = async (contentType: string, grain: string, upsType: string, shapeName: string): Promise<KeylineCoordinateDto[]> => {
    const response = await api.get('/keyline/shape-wise-data', { params: { contentType, grain, upsType, shapeName } });
    return response.data;
};

export const keylineGetFormulas = async (): Promise<KeylineFormulaDto[]> => {
    const response = await api.get('/keyline/formulas');
    return response.data;
};

export const keylineGetFormulaValues = async (axis: string, contentType: string, grain: string, upsType: string): Promise<string[]> => {
    const response = await api.get('/keyline/formula-values', { params: { axis, contentType, grain, upsType } });
    return response.data;
};

export const keylineSaveCoordinates = async (request: SaveCoordinatesRequest): Promise<void> => {
    await api.post('/keyline/save-coordinates', request);
};

export const keylineSaveFormula = async (request: SaveFormulaRequest): Promise<void> => {
    await api.post('/keyline/save-formula', request);
};

export const keylineDeleteFormula = async (id: number): Promise<void> => {
    await api.delete(`/keyline/formula/${id}`);
};

export const keylineDeleteCoordinates = async (contentName: string, grain: string, upsType: string): Promise<void> => {
    await api.delete('/keyline/coordinates', { params: { contentName, grain, upsType } });
};

export const keylineGetPlanning = async (contentType: string): Promise<KeylinePlanningDto[]> => {
    const response = await api.get('/keyline/planning', { params: { contentType } });
    return response.data;
};

export const keylineSavePlanning = async (request: SavePlanningRequest): Promise<void> => {
    await api.post('/keyline/save-planning', request);
};

export const keylineDeletePlanning = async (contentName: string): Promise<void> => {
    await api.delete('/keyline/planning', { params: { contentName } });
};

// ─── Indus Tool Module Authority ──────────────────────────────────────────────

export interface IndusToolModuleDto {
    moduleID: number;
    moduleName: string;
    modulePath: string;
    moduleIcon: string;
    displayOrder: number;
    isEnabled: boolean;
}

export interface SaveModuleAuthorityRequest {
    companyUserID: string;
    enabledModuleIDs: number[];
}

export interface IndusToolModuleAuthorityResult {
    success: boolean;
    message: string;
    savedCount: number;
}

export const getModulesForCompany = async (companyUserID: string): Promise<IndusToolModuleDto[]> => {
    const response = await api.get(`/moduleauthority/indus-tools/${encodeURIComponent(companyUserID)}`);
    return response.data;
};

export const saveCompanyModuleAuthority = async (request: SaveModuleAuthorityRequest): Promise<IndusToolModuleAuthorityResult> => {
    const response = await api.post('/moduleauthority/indus-tools', request);
    return response.data;
};

// ═══════════════════════════════════════════════════════════════════════════
//  Sahay & Email Feature Subscriptions — TENANT-LOCAL (Option A)
//  Backend: FeatureSubscriptionController (/api/FeatureSubscription/...)
//  No plan catalog: the plan (name/price/cycle/dates) is typed at Assign time
//  and stored in the company's own database.
// ═══════════════════════════════════════════════════════════════════════════
export type FeatureCode = 'Sahay' | 'Email';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export interface ClientUserDto {
    userID: number;
    userName: string;
    isSahayActive: boolean;
}

export interface FeatureSubscriptionDto {
    subscriptionID: number;
    featureCode: FeatureCode;
    planName: string;
    billingCycle: BillingCycle;
    unitPrice: number;
    perUser: boolean;
    seatCount: number;
    totalPrice: number;
    startDate: string;
    endDate: string;
    status: string;
    seats: ClientUserDto[];
}

export interface AssignFeatureRequest {
    companyUserID: string;
    featureCode: FeatureCode;
    planName: string;
    billingCycle: BillingCycle;
    unitPrice: number;       // per cycle; PER SEAT for Sahay
    startDate: string;       // yyyy-MM-dd
    endDate: string;
    seatUserIds: number[];   // Sahay only
}

export const getCompanyFeatureState = async (companyUserID: string): Promise<{ success: boolean; message: string; sahay?: FeatureSubscriptionDto; email?: FeatureSubscriptionDto }> => {
    const response = await api.get(`/featuresubscription/company/${encodeURIComponent(companyUserID)}`);
    return response.data;
};

export const getCompanyClientUsers = async (companyUserID: string): Promise<{ success: boolean; message: string; data: ClientUserDto[] }> => {
    const response = await api.get(`/featuresubscription/company/${encodeURIComponent(companyUserID)}/users`);
    return response.data;
};

export const assignFeature = async (request: AssignFeatureRequest): Promise<{ success: boolean; message: string; data?: FeatureSubscriptionDto }> => {
    const response = await api.post('/featuresubscription/assign', request);
    return response.data;
};

export const setFeatureStatus = async (companyUserID: string, featureCode: FeatureCode, active: boolean): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/featuresubscription/${active ? 'resume' : 'suspend'}`, { companyUserID, featureCode });
    return response.data;
};

// ─── Plan Catalog (global plan management) ────────────────────────────────────
// Feature → Plans. Lives in the Indus DB; managed on the admin side. 2-table model:
// sub-features + the customer-facing card fields are stored inline on the plan.

export interface CatalogResponse<T> {
    success: boolean;
    message: string;
    data?: T;
}

export interface FeatureDto {
    featureID: number;
    featureCode: string;
    featureName: string;
    isActive: boolean;
}

export interface PlanSubFeature {
    key: string;
    label: string;
    enabled: boolean;
}

export interface PlanDto {
    planID: number;
    featureID: number;
    featureCode: string;
    planName: string;               // internal name
    planDisplayName?: string | null; // customer-facing card name
    planCode?: string | null;        // stable id used at checkout
    billingCycle: string;            // 'MONTHLY' | 'ANNUAL'
    unitPrice: number;               // monthly price
    annualPrice?: number | null;
    perUser: boolean;
    perUserNote?: string | null;
    blurb?: string | null;
    highlight: boolean;
    badge?: string | null;
    features: string[];              // card bullet list
    subFeatures: PlanSubFeature[];
    razorpayPlanId?: string | null;
    isActive: boolean;
}

// Features
export const getCatalogFeatures = async (): Promise<FeatureDto[]> => {
    const response = await api.get('/plancatalog/features');
    return response.data;
};

export const upsertFeature = async (req: Partial<FeatureDto> & { featureCode: string; featureName: string }): Promise<CatalogResponse<FeatureDto>> => {
    const response = await api.post('/plancatalog/features', req);
    return response.data;
};

// Plans
export const getPlans = async (featureId?: number): Promise<PlanDto[]> => {
    const response = await api.get('/plancatalog/plans', { params: featureId ? { featureId } : {} });
    return response.data;
};

export const upsertPlan = async (req: Partial<PlanDto> & { featureID: number; planName: string }): Promise<CatalogResponse<PlanDto>> => {
    const response = await api.post('/plancatalog/plans', req);
    return response.data;
};

export const deletePlan = async (planId: number): Promise<CatalogResponse<boolean>> => {
    const response = await api.delete(`/plancatalog/plans/${planId}`);
    return response.data;
};
