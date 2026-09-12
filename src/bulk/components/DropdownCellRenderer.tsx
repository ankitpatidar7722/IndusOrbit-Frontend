import React, { useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * DropdownCellRenderer
 *
 * A shared AG Grid custom cell renderer for any column that uses
 * `cellEditor: 'agSelectCellEditor'` (or any select-based editor).
 *
 * Behaviour:
 * - Always shows the cell value + a visible ▼ chevron icon
 * - Single-click anywhere in the cell starts edit mode immediately
 * - No double-click required
 *
 * Usage in ColDef:
 *   {
 *     field: 'country',
 *     cellEditor: 'agSelectCellEditor',
 *     cellEditorParams: { values: [...] },
 *     cellRenderer: DropdownCellRenderer,   // ← add this
 *   }
 */
const DropdownCellRenderer: React.FC<any> = (params) => {
    const handleClick = useCallback(() => {
        // Only trigger edit if the grid is in editable mode
        if (!params.colDef?.editable) return;
        const editable =
            typeof params.colDef.editable === 'function'
                ? params.colDef.editable(params)
                : params.colDef.editable;

        if (editable === false) return;

        // Start editing this cell immediately on single click
        params.api.startEditingCell({
            rowIndex: params.rowIndex,
            colKey: params.column.getColId(),
        });
    }, [params]);

    const value = params.value;
    const isEmpty = value === null || value === undefined || value === '';

    // Determine if the cell is currently editable
    let isEditable = false;
    if (params.colDef?.editable !== undefined) {
        isEditable =
            typeof params.colDef.editable === 'function'
                ? params.colDef.editable(params)
                : params.colDef.editable;
    }

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
                paddingRight: '2px',
                userSelect: 'text',
                gap: '4px',
            }}
        >
            {/* Value text */}
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

            {/* Dropdown chevron only if editable */}
            {isEditable && (
                <ChevronDown
                    size={13}
                    style={{
                        flexShrink: 0,
                        color: '#6b7280',
                        opacity: 0.8,
                    }}
                />
            )}
        </div>
    );
};

export default DropdownCellRenderer;
