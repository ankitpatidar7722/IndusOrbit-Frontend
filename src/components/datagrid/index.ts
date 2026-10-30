// Main component
export { DataGrid } from './DataGrid'
export type { DataGridProps } from './DataGrid'

// Controls
export { PaginationControls } from './controls/PaginationControls'
export { AutoResizeButton } from './controls/AutoResizeButton'

// Menu & Sections
export { ActionsMenu } from './controls/menu/ActionsMenu'
export { AdvancedFilterModal } from './controls/menu/filter/AdvancedFilterModal'
export { ColumnChooserModal } from './controls/menu/column/ColumnChooserModal'
export { CardView } from './controls/menu/view/CardView'
// ChartView (echarts) is NOT re-exported here: DataGrid loads it on demand, and a barrel re-export
// would put echarts into every page that imports from "@/components/datagrid".

// Columns
export { DraggableColumnHeader } from './columns/DraggableColumnHeader'
export { ColumnContextMenu } from './columns/ColumnContextMenu'
export { ActionsColumn, createActionsColumn } from './columns/ActionsColumn'
export type { ActionsColumnConfig } from './columns/ActionsColumn'

// Rows
export { createSelectColumn } from './rows/SelectColumn'
export { ExpandableRow, ExpansionToggleCell, ExpansionToggleHeader, ProcessBreakdown } from './rows/ExpandableRow'
export { DraggableRow } from './rows/DraggableRow'
export { SummaryRow } from './rows/SummaryRow'

// Cells
export { EditableCell, useCellEditing } from './cells/EditableCell'
export type { EditableCellProps } from './cells/EditableCell'
export { CellRenderer } from './cells/CellRenderer'
export { SelectionCell, SelectionCheckbox } from './cells/SelectionCell'
export { BooleanCell } from './cells/BooleanCell'

// Search
export { InlineSearchCell } from './search/InlineSearchCell'
export { SearchNavigator, useSearchNavigation } from './search/SearchNavigator'
export { SearchHighlighter, advancedSearch, fuzzyMatch } from './search/SearchHighlighter'
export { SearchNewModal } from './search/SearchNewModal'

// Hooks
export { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
export { useClipboard } from './hooks/useClipboard'
export { useCellRangeSelection } from './hooks/useCellRangeSelection'
export { useDataGridState } from './hooks/useDataGridState'

// Utils - Export/Import: import them from './controls/menu/export/export' / '…/import/import' directly
// (ideally with a dynamic import) — re-exporting them here put exceljs + jspdf into every grid page.
export type { ImportResult } from './controls/menu/import/import'