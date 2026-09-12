/**
 * Standard Excel column definitions for each module / group.
 * These must match exactly what the Export function produces.
 */

// ─── Item Master ─────────────────────────────────────────────────────────────
const ITEM_MASTER_COLUMNS: Record<string, string[]> = {
    'PAPER': [
        'PaperGroup', 'Quality', 'GSM', 'Manufecturer', 'Finish', 'ManufecturerItemCode',
        'Caliper', 'SizeW', 'SizeL', 'PurchaseUnit', 'PurchaseRate',
        'ShelfLife', 'EstimationUnit', 'EstimationRate', 'StockUnit',
        'MinimumStockQty', 'IsStandardItem', 'IsRegularItem', 'StockRefCode',
        'PackingType', 'UnitPerPacking', 'WtPerPacking', 'ItemSize', 'ItemName',
        'ProductHSNName', 'CertificationType'
    ],
    'REEL': [
        'PaperGroup', 'Quality', 'BF', 'SizeW', 'GSM', 'Caliper', 'Manufecturer',
        'ManufecturerItemCode', 'Finish', 'ShelfLife', 'PurchaseUnit',
        'PurchaseRate', 'EstimationUnit', 'EstimationRate', 'StockUnit',
        'MinimumStockQty', 'IsStandardItem', 'IsRegularItem', 'StockRefCode',
        'ProductHSNName', 'CertificationType', 'ItemName'
    ],
    'INK & ADDITIVES': [
        'ItemSubGroupName', 'ItemType', 'InkColour', 'PantoneCode', 'Manufecturer',
        'ManufecturerItemCode', 'ShelfLife', 'PurchaseUnit', 'PurchaseRate',
        'EstimationUnit', 'EstimationRate', 'StockUnit', 'MinimumStockQty',
        'StockType', 'IsStandardItem', 'IsRegularItem', 'PurchaseOrderQuantity',
        'StockRefCode', 'ProductHSNName', 'ItemName'
    ],
    'VARNISHES & COATINGS': [
        'ItemType', 'Quality', 'ItemSubGroupName', 'Manufecturer', 'ManufecturerItemCode',
        'ShelfLife', 'PurchaseUnit', 'PurchaseRate', 'EstimationUnit', 'EstimationRate',
        'StockUnit', 'MinimumStockQty', 'StockType', 'IsStandardItem', 'IsRegularItem',
        'PurchaseOrderQuantity', 'StockRefCode', 'ProductHSNName', 'ItemName'
    ],
    'LAMINATION FILM': [
        'Quality', 'ItemSubGroupName', 'Manufecturer', 'ManufecturerItemCode', 'SizeW',
        'Thickness', 'Density', 'ShelfLife', 'PurchaseUnit', 'PurchaseRate',
        'EstimationUnit', 'EstimationRate', 'StockUnit', 'MinimumStockQty', 'StockType',
        'IsStandardItem', 'IsRegularItem', 'PurchaseOrderQuantity', 'StockRefCode',
        'ProductHSNName', 'ItemName'
    ],
    'FOIL': [
        'Quality', 'ItemSubGroupName', 'Manufecturer', 'ManufecturerItemCode', 'SizeW',
        'Thickness', 'Density', 'ShelfLife', 'PurchaseUnit', 'PurchaseRate',
        'EstimationUnit', 'EstimationRate', 'StockUnit', 'MinimumStockQty', 'StockType',
        'IsStandardItem', 'IsRegularItem', 'PurchaseOrderQuantity', 'StockRefCode',
        'ProductHSNName', 'ItemName'
    ],
    'ROLL': [
        'ItemType', 'Quality', 'Manufecturer', 'ManufecturerItemCode', 'GSM',
        'ReleaseGSM', 'AdhesiveGSM', 'SizeW', 'Thickness', 'Density', 'TotalGSM',
        'ShelfLife', 'PurchaseUnit', 'PurchaseRate', 'EstimationUnit', 'EstimationRate',
        'StockUnit', 'MinimumStockQty', 'IsStandardItem', 'IsRegularItem',
        'StockRefCode', 'ProductHSNName', 'ItemName'
    ],
    'OTHER MATERIAL': [
        'ItemSubGroupName', 'Quality', 'Manufecturer', 'ManufecturerItemCode',
        'ShelfLife', 'PurchaseUnit', 'PurchaseRate', 'EstimationUnit', 'EstimationRate',
        'StockUnit', 'MinimumStockQty', 'StockType', 'IsStandardItem', 'IsRegularItem',
        'PurchaseOrderQuantity', 'StockRefCode', 'ProductHSNName', 'ItemName'
    ],
    'SHIPPER CARTON': [
        'Quality', 'ItemSubGroupName', 'NoOfPly', 'ItemType',
        'SizeL', 'SizeW', 'SizeH', 'Manufecturer', 'ManufecturerItemCode',
        'EmptyCartonWt', 'PurchaseUnit', 'PurchaseRate', 'PurchaseOrderQuantity',
        'ShelfLife', 'EstimationUnit', 'EstimationRate', 'StockUnit',
        'MinimumStockQty', 'StockType', 'IsRegularItem', 'ProductHSNName',
        'Capacity', 'CBF', 'CBM', 'StockRefCode', 'ItemName'
    ],
    '__DEFAULT__': [
        'ItemName', 'HSNGroup', 'StockUnit', 'PurchaseUnit', 'EstimationUnit',
        'UnitPerPacking', 'WtPerPacking', 'ConversionFactor',
        'StockType', 'StockCategory', 'SizeW', 'SizeL',
        'PurchaseRate', 'StockRefCode', 'ItemDescription'
    ]
};

// ─── HSN Master ───────────────────────────────────────────────────────────────
const HSN_MASTER_COLUMNS: string[] = [
    'Group Name', 'Display Name', 'HSN Code', 'ProductType',
    'GST %', 'CGST %', 'SGST %', 'IGST %', 'ItemGroupName'
];

// ─── Spare Part Master ────────────────────────────────────────────────────────
const SPARE_PART_MASTER_COLUMNS: string[] = [
    'SparePartName', 'SparePartGroup', 'HSNGroup', 'Unit', 'Rate',
    'SparePartType', 'MinimumStockQty', 'PurchaseOrderQuantity',
    'StockRefCode', 'SupplierReference', 'Narration'
];

// ─── Tool Master ──────────────────────────────────────────────────────────────
const TOOL_MASTER_COLUMNS: Record<number, string[]> = {
    3: [ // DIE
        'ClientName', 'JobName', 'SizeL', 'SizeW', 'SizeH',
        'UpsAround', 'UpsAcross', 'TotalUps', 'ProductHSNName',
        'PurchaseUnit', 'PurchaseRate', 'StockUnit', 'ToolName', 'ToolRefCode'
    ],
    5: [ // PRINTING CYLINDER
        'SizeW', 'Manufacturer', 'NoOfTeeth', 'CircumferenceMM', 'CircumferenceInch',
        'ProductHSNName', 'PurchaseUnit', 'PurchaseRate', 'StockUnit', 'ToolName', 'ToolRefCode'
    ],
    6: [ // ANILOX CYLINDER
        'SizeW', 'Manufacturer', 'BCM', 'LPI',
        'ProductHSNName', 'PurchaseUnit', 'PurchaseRate', 'StockUnit', 'ToolName', 'ToolRefCode'
    ],
    7: [ // EMBOSSING CYLINDER
        'SizeW', 'Manufacturer', 'NoOfTeeth', 'CircumferenceMM', 'CircumferenceInch',
        'ProductHSNName', 'PurchaseUnit', 'PurchaseRate', 'StockUnit', 'ToolName', 'ToolRefCode'
    ],
    8: [ // FLEXO DIE
        'LedgerName', 'JobName', 'SizeL', 'SizeH', 'UpsAround', 'UpsAcross', 'TotalUps',
        'ProductHSNName', 'ToolName', 'ToolType', 'AroundGap', 'AcrossGap',
        'UnitSymbol', 'PurchaseUnit', 'PurchaseRate', 'ReferenceToolNo', 'EstimateRate', 'StockUnit', 'ToolRefCode'
    ],
    13: [ // SIM
        'LedgerName', 'JobName', 'SizeL', 'Positive', 'Negative', 'SizeW',
        'UpsAround', 'UpsAcross', 'TotalUps', 'ProductHSNName', 'ToolName', 'ToolType',
        'Master', 'Sim', 'UnitSymbol', 'PurchaseUnit', 'PurchaseRate',
        'ReferenceToolNo', 'EstimateRate', 'StockUnit', 'ToolRefCode', 'Location'
    ],
    0: [ // PLATES (default)
        'ToolType', 'JobName', 'SizeL', 'SizeW', 'TotalUps',
        'PurchaseRate', 'PurchaseUnit', 'StockUnit', 'ToolName', 'ProductHSNName', 'ToolRefCode'
    ]
};

// ─── Ledger Master ────────────────────────────────────────────────────────────
// Ledger columns vary by group, so we compute them dynamically using the same
// logic as the export function.
export function getLedgerStandardColumns(ledgerGroupName: string): string[] {
    const name = ledgerGroupName.toLowerCase();
    const isSupplier    = name.includes('supplier');
    const isEmployee    = name.includes('employee');
    const isConsignee   = name.includes('consignee');
    const isVendor      = name.includes('vendors');
    const isTransporter = name.includes('transporters');

    const cols: string[] = ['LedgerName', 'MailingName'];

    if (isConsignee) cols.push('ClientName');

    cols.push('Address1', 'Address2', 'Address3', 'Country', 'State', 'City',
              'Pincode', 'TelephoneNo', 'Email', 'MobileNo');

    if (isEmployee) {
        cols.push('DateOfBirth', 'PANNo', 'DepartmentName', 'Designation');
    } else {
        cols.push('Website', 'PANNo', 'GSTNo');
    }

    if (isSupplier || isVendor) {
        cols.push('CurrencyCode');
    } else if (!isEmployee && !isConsignee && !isTransporter) {
        cols.push('SalesRepresentative');
    }

    if (!isEmployee) {
        if (!isVendor && !isTransporter)    cols.push('SupplyTypeCode');
        if (!isConsignee && !isTransporter) {
            cols.push('GSTApplicable');
            if (!isVendor) cols.push('GSTRegistrationType');
        }
        if (!isVendor && !isTransporter) cols.push('RefCode');
    }

    if (!isSupplier && !isEmployee && !isConsignee && !isVendor && !isTransporter) {
        cols.push('CreditDays');
    }

    if (!isEmployee && !isConsignee && !isVendor && !isTransporter) {
        cols.push('DeliveredQtyTolerance');
    }

    return cols;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export function getItemMasterStandardColumns(itemGroupName: string): string[] {
    return ITEM_MASTER_COLUMNS[itemGroupName] ?? ITEM_MASTER_COLUMNS['__DEFAULT__'];
}

export function getHSNMasterStandardColumns(): string[] {
    return HSN_MASTER_COLUMNS;
}

export function getSparePartMasterStandardColumns(): string[] {
    return SPARE_PART_MASTER_COLUMNS;
}

export function getToolMasterStandardColumns(toolGroupId: number): string[] {
    return TOOL_MASTER_COLUMNS[toolGroupId] ?? TOOL_MASTER_COLUMNS[0];
}

// ─── Core validator ───────────────────────────────────────────────────────────

export interface ExcelColumnValidationResult {
    isValid: boolean;
    missingColumns: string[];   // in standard but not in uploaded file
    extraColumns: string[];     // in uploaded file but not in standard
    message: string;
}

/**
 * Compares the actual Excel columns against the standard columns.
 * Comparison is case-insensitive and trims spaces.
 */
export function validateExcelColumns(
    uploadedColumns: string[],
    standardColumns: string[]
): ExcelColumnValidationResult {
    const normalize = (s: string) => s.trim().toLowerCase();

    const standardSet   = new Set(standardColumns.map(normalize));
    const uploadedSet   = new Set(uploadedColumns.map(normalize));

    // Build lookup: normalised → original label (for readable messages)
    const standardByNorm  = new Map(standardColumns.map(c  => [normalize(c), c]));
    const uploadedByNorm  = new Map(uploadedColumns.map(c  => [normalize(c), c]));

    const missingColumns: string[] = [];
    for (const [norm, label] of standardByNorm) {
        if (!uploadedSet.has(norm)) missingColumns.push(label);
    }

    const extraColumns: string[] = [];
    for (const [norm, label] of uploadedByNorm) {
        if (!standardSet.has(norm)) extraColumns.push(label);
    }

    const isValid = missingColumns.length === 0 && extraColumns.length === 0;

    let message = '';
    if (!isValid) {
        const parts: string[] = ['Invalid Excel Format\nPlease use the standard Excel format.\n'];
        if (missingColumns.length > 0) {
            parts.push(`Missing Columns:\n${missingColumns.map(c => `  • ${c}`).join('\n')}`);
        }
        if (extraColumns.length > 0) {
            parts.push(`Extra Columns Found:\n${extraColumns.map(c => `  • ${c}`).join('\n')}`);
        }
        message = parts.join('\n\n');
    }

    return { isValid, missingColumns, extraColumns, message };
}
