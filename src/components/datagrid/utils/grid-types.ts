import { ColumnDef } from '@tanstack/react-table'

/**
 * Main props interface for DataGrid component
 */
export interface DataGridProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]

  // Event handlers
  onRowClick?: (row: TData) => void
  onRowSelect?: (selectedRows: TData[]) => void
  onImport?: (data: TData[]) => void

  // Row configuration
  selectedRowIds?: string[]
  getRowId?: (row: TData) => string
  getRowProps?: (row: TData) => { className?: string; style?: React.CSSProperties }

  // View functionality
  enableViewToggle?: boolean
  viewMode?: 'all' | 'selected'
  onViewModeChange?: (mode: 'all' | 'selected') => void

  // Feature toggles
  enableVirtualization?: boolean
  enableColumnResizing?: boolean
  enableColumnReordering?: boolean
  enableColumnFreezing?: boolean
  enableInlineEditing?: boolean
  enableGrouping?: boolean
  enableExport?: boolean
  enableImport?: boolean
  enableVisualization?: boolean
  enableStickyActions?: boolean
  enableRowSelection?: boolean
  enableSorting?: boolean
  enableSearch?: boolean
  enableFiltering?: boolean
  enableColumnVisibility?: boolean

  // NEW: Pagination props
  enablePagination?: boolean
  paginationPageSize?: number
  paginationPageSizeOptions?: number[]

  // NEW: Selection style
  circularCheckboxes?: boolean

  // NEW: Auto-resize
  enableAutoResize?: boolean

  // NEW: Row selection modes (AG Grid style)
  rowSelectionMode?: 'single' | 'multi' // default: 'multi'
  enableRowClickSelection?: boolean // default: true - click row to select
  enableCtrlClickMultiSelect?: boolean // default: true - Ctrl+click for multi-select
  enableShiftClickRange?: boolean // default: true - Shift+click for range selection
  singleSelectionStyle?: 'radio' | 'highlight' // default: 'radio' - visual style for single mode

  // Column configuration
  frozenColumns?: string[]
  columnResizeMode?: 'onChange' | 'onEnd'

  // Layout
  pageSize?: number // Legacy: Use paginationPageSize instead
  stickyHeader?: boolean
  className?: string
  style?: React.CSSProperties
  autoSize?: boolean
  minHeight?: number
  maxHeight?: number
  rowHeight?: number

  // Header
  title?: string
  description?: string
  headerActions?: React.ReactNode
  preToggleActions?: React.ReactNode
  loading?: boolean
  hideHeader?: boolean

  // Baccha Search props
  mainColumns?: string
  enableBacchaSearch?: boolean
  searchType?: 'advanced' | 'new'

  // Summary/Footer row
  enableSummary?: boolean
  summaryConfig?: SummaryConfig<TData> | SummaryConfig<TData>[]
}

/**
 * Summary aggregation types
 */
export type SummaryAggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'custom'

/**
 * Summary configuration for a column
 */
export interface ColumnSummary<TData = any> {
  type: SummaryAggregationType
  label?: string // Optional label (e.g., "Total:", "Average:")
  customFn?: (data: TData[]) => string | number // For custom aggregations
  format?: (value: number) => string // Format function (e.g., currency, percentage)
  className?: string // Optional CSS classes for the cell (e.g., "text-right font-bold")
  customValue?: () => string | number // For custom value calculation (alternative to customFn)
}

/**
 * Summary configuration for the entire grid
 */
export interface SummaryConfig<TData = any> {
  columns: Record<string, ColumnSummary<TData>> // columnId -> summary config
  position?: 'top' | 'bottom' // default: 'bottom'
  style?: React.CSSProperties
  className?: string
}

/**
 * Pagination state
 */
export interface PaginationState {
  pageIndex: number
  pageSize: number
  pageCount: number
  totalRows: number
}

/**
 * Pagination handlers
 */
export interface PaginationHandlers {
  goToFirstPage: () => void
  goToPreviousPage: () => void
  goToNextPage: () => void
  goToLastPage: () => void
  goToPage: (page: number) => void
  setPageSize: (size: number) => void
  canPreviousPage: boolean
  canNextPage: boolean
}

/**
 * Selection handlers
 */
export interface SelectionHandlers<TData> {
  toggleRowSelection: (rowId: string) => void
  toggleAllRowsSelection: (checked: boolean) => void
  isRowSelected: (rowId: string) => boolean
  isAllRowsSelected: boolean
  isSomeRowsSelected: boolean
  selectedRows: TData[]
  selectedRowCount: number
}

/**
 * Column handlers
 */
export interface ColumnHandlers {
  toggleColumnVisibility: (columnId: string) => void
  resetColumnOrder: () => void
  resetColumnSizing: () => void
  autoSizeAllColumns: () => void
  freezeColumn: (columnId: string) => void
  unfreezeColumn: (columnId: string) => void
}

/**
 * Search handlers
 */
export interface SearchHandlers {
  globalSearch: string
  setGlobalSearch: (value: string) => void
  columnSearch: Record<string, string>
  setColumnSearch: (columnId: string, value: string) => void
  clearSearch: () => void
  clearColumnSearch: (columnId: string) => void
}

/**
 * Context menu state
 */
export interface ContextMenuState {
  column: any | null
  isVisible: boolean
  position: { x: number; y: number }
}