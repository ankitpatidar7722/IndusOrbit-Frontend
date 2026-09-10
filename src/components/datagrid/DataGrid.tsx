'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  useReactTable,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  ColumnSizingState,
  ExpandedState,
  GroupingState,
  Row,
  ColumnPinningState,
} from '@tanstack/react-table'
import { useIntelligentColumnSizing, COLUMN_SIZING_PRESETS } from '@/hooks/useIntelligentColumnSizing'
import { useDebouncedValue } from '@/hooks/useDebounce'
import { useDevice } from 'indas-ui'
import { naturalCompare } from '@/lib/utils'
// Import new pagination and selection components
import { PaginationControls, DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS } from './controls/PaginationControls'
import { SelectionCell as SelectionCheckbox } from './cells/SelectionCell'
import { ActionsMenu } from './controls/menu'
import { AutoResizeButton } from './controls/AutoResizeButton'
// Virtual scrolling
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  restrictToHorizontalAxis,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Upload,
  Filter,
  ListFilter,
  Search,
  Mic,
  MicOff,
  Grid3X3,
  BarChart3,
  PieChart,
  TrendingUp,
  Eye,
  EyeOff,
  Settings,
  MoreHorizontal,
  LayoutGrid,
  Pin,
  PinOff,
  GripVertical,
  XCircle,
  Layers,
  RefreshCw,
  Save,
  RotateCcw,
} from 'lucide-react'

import { getCurrentUserId } from '@/lib/currentUser'
import { Button } from 'indas-ui'
import { Input } from 'indas-ui'
import { Checkbox } from 'indas-ui'
import { DatePicker } from 'indas-ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from 'indas-ui'
import { Dropdown } from 'indas-ui'
import { Badge } from 'indas-ui'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from 'indas-ui'
import { Card, CardContent, CardHeader, CardTitle } from 'indas-ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'indas-ui'
import { Skeleton } from 'indas-ui'

// Advanced Filter Modal
import { AdvancedFilterModal } from './controls/menu/filter/AdvancedFilterModal'
// Column Chooser Modal (now integrated into AdvancedFilterModal)
// Data Visualization Component (Chart View)
import { ChartView as DataVisualization } from './controls/menu/view/ChartView'
// Export/Import - Now handled via ActionsMenu (ExportSection/ImportSection)
// Draggable Column Header
import { DraggableColumnHeader } from './columns/DraggableColumnHeader'
// Draggable Row Component
import { DraggableRow } from './rows/DraggableRow'
import { CellRenderer } from './cells/CellRenderer'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
// Card View Component
import { CardView } from './controls/menu/view/CardView'
// Column Context Menu Component
import { ColumnContextMenu } from './columns/ColumnContextMenu'
// Baccha Search Components
import { InlineSearchCell } from './search/InlineSearchCell'
import { SearchNavigator, useSearchNavigation } from './search/SearchNavigator'
import { SearchHighlighter, fuzzyMatch } from './search/SearchHighlighter'
import { SearchNewModal } from './search/SearchNewModal'
import { useSearchPreferences } from 'indas-ui'
import { usePageAccess } from '@/contexts/ModuleAuthContext'
import { advancedSearch } from './search/advancedSearch'
// Expandable Row Component
import { ExpandableRow, ExpansionToggleCell, ExpansionToggleHeader, ProcessBreakdown } from './rows/ExpandableRow'
// Summary Row Component
import { SummaryRow } from './rows/SummaryRow'
// Filter Row Component
import { FilterRow } from './rows/FilterRow'

// ─── Advanced filter evaluation ────────────────────────────────
// A single advanced condition. `connector` is how this condition joins the PREVIOUS
// one ('AND'/'OR'); the first condition's connector is ignored.
export interface AdvancedCondition {
  id: string
  column: string
  operator: string
  value: any
  type?: string
  connector?: 'AND' | 'OR'
}

const VALUELESS_OPERATORS = new Set([
  'is_empty', 'is_not_empty', 'is_true', 'is_false',
  'last_7_days', 'last_30_days', 'this_month', 'this_year',
])

function conditionHasValue(v: any): boolean {
  if (v === '' || v === null || v === undefined) return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.values(v).some(x => x !== '' && x !== null && x !== undefined)
  return true
}

/**
 * Whether a cell value is worth attempting date parsing on.
 *
 * `new Date(297)` is a valid Date (297ms after the epoch), so passing plain numbers
 * to the date matcher made every numeric cell resolve to 01/01/1970 — and since that
 * string contains 0, 1, 7 and 9, filtering a number column by any of those digits
 * matched every row. Only Date objects and date-shaped strings qualify.
 */
function looksLikeDate(value: any): boolean {
  if (value instanceof Date) return true
  if (typeof value !== 'string') return false
  const s = value.trim()
  if (s === '') return false
  // A bare number as a string ("297") is a number, not a date.
  if (/^-?\d+(\.\d+)?$/.test(s)) return false
  // Needs a date separator or a month name to be plausibly a date.
  return /[/-]/.test(s) || /\d{1,2}:\d{2}/.test(s) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s)
}

/** Evaluate one condition against a row's cell value. Mirrors the inline advancedFilterFn operators. */
function evaluateCondition(cellValue: any, operator: string, value: any): boolean {
  const cellString = String(cellValue ?? '')
  const lc = (s: any) => String(s ?? '').toLowerCase()
  switch (operator) {
    case 'contains': return lc(cellString).includes(lc(value))
    case 'not_contains': return !lc(cellString).includes(lc(value))
    case 'equals': return cellValue == value
    case 'not_equals': return cellValue != value
    case 'starts_with': return lc(cellString).startsWith(lc(value))
    case 'ends_with': return lc(cellString).endsWith(lc(value))
    case 'is_empty': return !cellValue || cellString.trim() === ''
    case 'is_not_empty': return !!cellValue && cellString.trim() !== ''
    case 'greater_than': return Number(cellValue) > Number(value)
    case 'greater_than_equal': return Number(cellValue) >= Number(value)
    case 'less_than': return Number(cellValue) < Number(value)
    case 'less_than_equal': return Number(cellValue) <= Number(value)
    case 'between': return Number(cellValue) >= Number(value?.min ?? value?.[0]) && Number(cellValue) <= Number(value?.max ?? value?.[1])
    case 'not_between': return Number(cellValue) < Number(value?.min ?? value?.[0]) || Number(cellValue) > Number(value?.max ?? value?.[1])
    case 'is_true': return cellValue === true || cellValue === 'true' || cellValue === 1
    case 'is_false': return cellValue === false || cellValue === 'false' || cellValue === 0
    default: return true
  }
}

/**
 * Evaluate all advanced conditions against a row, honoring per-condition AND/OR connectors.
 * Left-to-right evaluation (AND binds the same as OR — no precedence), which matches how
 * users read a stacked condition list top to bottom.
 */
function evaluateConditions<TData>(row: TData, conditions: AdvancedCondition[]): boolean {
  const active = conditions.filter(c => c.column && (VALUELESS_OPERATORS.has(c.operator) || conditionHasValue(c.value)))
  if (active.length === 0) return true

  let result = evaluateCondition((row as any)[active[0].column], active[0].operator, active[0].value)
  for (let i = 1; i < active.length; i++) {
    const c = active[i]
    const matches = evaluateCondition((row as any)[c.column], c.operator, c.value)
    result = c.connector === 'OR' ? (result || matches) : (result && matches)
  }
  return result
}

export interface DataGridProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  onRowClick?: (row: TData) => void
  onRowContextMenu?: (row: TData, event: React.MouseEvent) => void
  onRowSelect?: (selectedRows: TData[]) => void
  onImport?: (data: TData[]) => void
  selectedRowIds?: string[]
  getRowId?: (row: TData) => string
  getRowProps?: (row: TData) => { className?: string; style?: React.CSSProperties }
  // All/Selected view functionality
  enableViewToggle?: boolean
  viewMode?: 'all' | 'selected'
  onViewModeChange?: (mode: 'all' | 'selected') => void
  enableVirtualization?: boolean
  enableColumnResizing?: boolean
  enableColumnReordering?: boolean
  enableColumnFreezing?: boolean
  frozenColumns?: string[] // Array of column IDs to freeze (left)
  rightFrozenColumns?: string[] // Array of column IDs to freeze (right)
  enableGrouping?: boolean
  groupByColumns?: string[] // Array of column IDs to group by
  onGroupingChange?: (grouping: string[]) => void
  enableExport?: boolean
  enableImport?: boolean
  enableVisualization?: boolean
  enableStickyActions?: boolean
  enableRowSelection?: boolean
  enableSorting?: boolean
  defaultSortBy?: string // Column ID to sort by initially (e.g., "DepartmentSequenceNo")
  defaultSortOrder?: 'asc' | 'desc' // Sort order for initial sort (default: 'asc')
  initialColumnVisibility?: Record<string, boolean> // Initial column visibility state (e.g., { DepartmentSequenceNo: false })
  persistKey?: string // When set, view prefs (column show/hide, order, width, sort) persist to localStorage under this key
  enableSavedLayout?: boolean // Show per-user "Save Layout" / "Reset Layout" buttons (default true) — persists column width/order/visibility per logged-in user
  enableSearch?: boolean
  enableFiltering?: boolean
  enableColumnVisibility?: boolean
  pageSize?: number
  stickyHeader?: boolean
  className?: string
  title?: React.ReactNode
  description?: string
  headerActions?: React.ReactNode
  headerActionsRight?: React.ReactNode
  /**
   * Icon actions rendered inside the search pill, right of the actions (sliders) menu.
   * Only rendered when searchType resolves to 'advanced' (the default) — the pill
   * does not exist in the other search layouts.
   */
  toolbarActions?: React.ReactNode
  /**
   * Reload handler. When provided, a refresh icon appears in the search pill next to
   * the actions menu. May return a promise — the icon spins until it settles.
   */
  onRefresh?: () => void | Promise<unknown>
  /** External loading flag for the refresh icon (e.g. a React Query isFetching). */
  isRefreshing?: boolean
  preToggleActions?: React.ReactNode
  loading?: boolean
  hideHeader?: boolean
  compactHeader?: boolean // Use compact header with actions menu (default: true). Set false for legacy full header.
  columnResizeMode?: 'onChange' | 'onEnd'
  style?: React.CSSProperties
  compactMode?: boolean // Fit grid height to content with tighter constraints (modals/dialogs). Default is standard mode with calc(100vh - 300px)
  minHeight?: number | string
  maxHeight?: number | string
  rowHeight?: number
  // Baccha Search props
  mainColumns?: string // Comma-separated list of main column keys for Baccha Search
  cardColumns?: string[] // Mobile card view: show only these columns (accessorKey/id), in order
  enableBacchaSearch?: boolean
  searchType?: 'advanced' | 'new' // Search UI type: 'advanced' = current inline, 'new' = top header modal style. If not specified, uses user preference
  // NEW: Pagination props
  enablePagination?: boolean
  paginationPageSize?: number
  paginationPageSizeOptions?: number[]
  // NEW: Circular checkboxes
  circularCheckboxes?: boolean
  // NEW: Auto-resize
  enableAutoResize?: boolean
  // NEW: Row selection modes
  rowSelectionMode?: 'single' | 'multi'
  enableRowClickSelection?: boolean
  enableCtrlClickMultiSelect?: boolean
  enableShiftClickRange?: boolean
  singleSelectionStyle?: 'radio' | 'highlight'
  // NEW: Row reordering
  enableRowReordering?: boolean
  onRowOrderChange?: (reorderedData: TData[]) => void
  hideSelectionInSelectedView?: boolean
  // NEW: Row Expansion - Expandable rows for detailed breakdown
  renderSubComponent?: (row: Row<TData>) => React.ReactNode
  getRowCanExpand?: (row: Row<TData>) => boolean
  /** 'basic' = custom content in colSpan td, 'detailed' = real grid rows from subData */
  expandMode?: 'basic' | 'detailed'
  /** Return sub-data items for a row (used in detailed mode) */
  getSubData?: (row: TData) => TData[]
  /** Row ID accessor for sub-rows in detailed mode */
  getSubRowId?: (row: TData) => string
  /** Callback when a sub-row is clicked in detailed mode */
  onSubRowClick?: (item: TData) => void
  /** Callback when a sub-row is selected — propagates to parent for footer actions */
  onSubRowSelect?: (item: TData) => void
  /** Auto-expand all expandable rows by default */
  defaultExpandAll?: boolean
  // NEW: Date Filter
  enableDateFilter?: boolean
  dateFrom?: Date | null
  dateTo?: Date | null
  onDateFromChange?: (date: Date | null) => void
  onDateToChange?: (date: Date | null) => void
  /** Actions to render just before the date picker (left of date picker) */
  preDateActions?: React.ReactNode
  // NEW: Summary/Footer row
  enableSummary?: boolean
  summaryConfig?: import('./utils/grid-types').SummaryConfig<TData>
  // NEW: Filter Row (DevExtreme-style per-column filtering)
  enableFilterRow?: boolean
  /**
   * Optional initial values for the column filter row. Seeded into state on mount and
   * re-applied when the prop reference changes (so modals can pre-filter on open).
   */
  initialColumnFilters?: ColumnFiltersState
}

export function DataGrid<TData>({
  data,
  columns: initialColumns,
  onRowClick,
  onRowContextMenu,
  onRowSelect,
  onImport,
  selectedRowIds = [],
  getRowId,
  getRowProps,
  enableViewToggle = false,
  viewMode = 'all',
  onViewModeChange,
  enableVirtualization = true,
  enableColumnResizing = true,
  enableColumnReordering = true,
  enableColumnFreezing = false,
  frozenColumns = [],
  rightFrozenColumns = [],
  enableGrouping = false,
  groupByColumns = [],
  onGroupingChange,
  enableExport = true,
  enableImport = true,
  enableVisualization = true,
  enableStickyActions = false,
  enableRowSelection = true,
  enableSorting = true,
  defaultSortBy,
  defaultSortOrder = 'asc',
  initialColumnVisibility,
  persistKey,
  enableSavedLayout = true,
  enableSearch = true,
  enableFiltering = true,
  enableColumnVisibility = true,
  pageSize = 50,
  stickyHeader = true,
  className = '',
  title,
  description,
  headerActions,
  headerActionsRight,
  toolbarActions,
  onRefresh,
  isRefreshing: isRefreshingProp,
  preToggleActions,
  loading = false,
  hideHeader = false,
  compactHeader = true,
  columnResizeMode = 'onChange',
  style,
  compactMode = false,
  minHeight = 60,
  maxHeight = "calc(100vh - 300px)", // Default: standard mode, responsive to screen height
  rowHeight = 24.75,
  // Baccha Search props
  mainColumns,
  cardColumns,
  enableBacchaSearch = true,
  searchType,
  // NEW: Pagination props
  enablePagination = true,
  paginationPageSize = DEFAULT_PAGE_SIZE,
  paginationPageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  // NEW: Circular checkboxes
  circularCheckboxes = false,
  // NEW: Auto-resize
  enableAutoResize = true,
  // NEW: Row selection modes
  rowSelectionMode = 'multi',
  enableRowClickSelection = true,
  enableCtrlClickMultiSelect = true,
  enableShiftClickRange = true,
  singleSelectionStyle = 'radio',
  // NEW: Row reordering
  enableRowReordering = false,
  onRowOrderChange,
  hideSelectionInSelectedView = true,
  // NEW: Row Expansion
  renderSubComponent,
  getRowCanExpand,
  expandMode = 'basic',
  getSubData,
  getSubRowId,
  onSubRowClick,
  onSubRowSelect,
  defaultExpandAll = false,
  // NEW: Date Filter
  enableDateFilter = false,
  preDateActions,
  // NEW: Summary/Footer row
  enableSummary = false,
  summaryConfig,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  // NEW: Filter Row
  enableFilterRow = false,
  initialColumnFilters,
}: DataGridProps<TData>) {
  // Persisted view prefs (show/hide, order, width, sort). Falls back to an auto key
  // (route + column-id fingerprint) so every grid persists without an explicit persistKey.
  const pathname = usePathname()
  const autoPersistKey = useMemo(() => {
    const ids = initialColumns
      .map((c, i) => (c as any).id || (c as any).accessorKey || `col-${i}`)
      .join('|')
    // Cheap stable hash of the column-id list (djb2).
    let hash = 5381
    for (let i = 0; i < ids.length; i++) hash = ((hash << 5) + hash + ids.charCodeAt(i)) | 0
    return `${pathname || 'route'}:${(hash >>> 0).toString(36)}`
  }, [initialColumns, pathname])
  // Namespace the saved-view key with the logged-in user's id so each user only ever sees THEIR
  // OWN saved layout (per-user, even on a shared browser). getCurrentUserId() is set synchronously
  // in the app Shell's render before any grid mounts, so it's available here on first render.
  const layoutUserKey = getCurrentUserId() ?? 'anon'
  const persistStorageKey = `datagrid-view:u${layoutUserKey}:${persistKey || autoPersistKey}`
  const savedView = useMemo(() => {
    if (!persistStorageKey || typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(persistStorageKey)
      return raw ? JSON.parse(raw) as {
        columnVisibility?: VisibilityState
        columnSizing?: ColumnSizingState
        sorting?: SortingState
        columnOrder?: string[]
      } : null
    } catch {
      return null
    }
  }, [persistStorageKey])

  // Device detection for mobile-specific column behaviour
  const { isMobile } = useDevice()

  // Get user search preferences
  const { defaultSearchType } = useSearchPreferences()

  // Page-level permissions — used to gate export when enableExport is not explicitly set to false
  const pageAccess = usePageAccess()

  // Determine which search type to use: explicit prop > user preference > 'advanced' fallback
  const effectiveSearchType = searchType || defaultSearchType || 'advanced'

  // Normalize columns: ensure all columns have explicit IDs for consistent drag/drop behavior
  // This fixes the issue where some columns have only accessorKey (auto-generated ID)
  // and others have explicit ID, causing drag/drop to fail inconsistently
  const normalizedColumns = useMemo(() => {
    return initialColumns.map((col, index) => {
      // If column already has an id, use it
      let normalized = col
      if (!col.id) {
        if ((col as any).accessorKey) {
          normalized = { ...col, id: (col as any).accessorKey as string }
        } else {
          const header = typeof col.header === 'string' ? col.header : `column`
          normalized = { ...col, id: `${header.toLowerCase().replace(/\s+/g, '-')}-${index}` }
        }
      }

      // On mobile, shrink the actions column to just fit the dropdown trigger
      if (isMobile && (normalized.id === 'actions' || (normalized as any).accessorKey === 'actions')) {
        normalized = { ...normalized, size: 30, minSize: 30, maxSize: 30 }
      }

      // Auto-apply date sorting for columns with "Date" in accessor key;
      // otherwise default to numeric-aware natural sort so "10" sorts after "9".
      const accessorKey = (normalized as any).accessorKey as string | undefined
      if (!(normalized as any).sortingFn) {
        if (accessorKey && /date/i.test(accessorKey)) {
          normalized = { ...normalized, sortingFn: 'dateSort' as any }
        } else {
          normalized = { ...normalized, sortingFn: 'naturalSort' as any }
        }
      }

      return normalized
    })
  }, [initialColumns, isMobile])

  // Create initial row selection state from selectedRowIds
  const initialRowSelection = useMemo(() => {
    const selection: Record<string, boolean> = {}
    data.forEach((row, index) => {
      // Use getRowId if provided, otherwise fall back to .id or index
      const rowId = getRowId ? getRowId(row) : ((row as any).id || index.toString())
      if (selectedRowIds.includes(rowId)) {
        // ✅ FIX: Use rowId as key (not index) when getRowId is provided
        // TanStack Table expects ID-based selection when getRowId is configured
        selection[rowId] = true
      }
    })
    return selection
  }, [selectedRowIds, data, getRowId])

  // Row reordering state - must be declared before filteredData
  const [reorderedData, setReorderedData] = useState<TData[] | null>(null)

  // Sync reorderedData with external data prop changes (e.g. cell edits update parent data)
  // Preserves custom row order while reflecting updated values
  useEffect(() => {
    if (!reorderedData || !enableRowReordering) return

    // Build a map of updated data by ID for O(n) lookup
    const dataMap = new Map<string, TData>()
    data.forEach(item => {
      const id = getRowId ? getRowId(item) : (item as any).id || ''
      dataMap.set(String(id), item)
    })

    // Update reorderedData values while preserving order
    // Also handle additions/removals
    const synced: TData[] = []
    const seenIds = new Set<string>()

    for (const item of reorderedData) {
      const id = String(getRowId ? getRowId(item) : (item as any).id || '')
      const updated = dataMap.get(id)
      if (updated) {
        synced.push(updated)
        seenIds.add(id)
      }
      // If item was removed from data, skip it
    }

    // Add any new items from data that weren't in reorderedData
    for (const item of data) {
      const id = String(getRowId ? getRowId(item) : (item as any).id || '')
      if (!seenIds.has(id)) {
        synced.push(item)
      }
    }

    // Only update if there's an actual difference to avoid infinite loops
    const hasChanges = synced.length !== reorderedData.length ||
      synced.some((item, i) => item !== reorderedData[i])

    if (hasChanges) {
      setReorderedData(synced)
    }
  }, [data, enableRowReordering]) // eslint-disable-line react-hooks/exhaustive-deps

  // Row Expansion state — defaultExpandAll expands every row on mount
  const [expanded, setExpanded] = useState<ExpandedState>(defaultExpandAll ? true : {})

  // Advanced filter conditions (from the Filters modal). Evaluated together with per-condition
  // AND/OR connectors in `filteredData` — kept separate from column/search filters so OR works.
  const [advancedConditions, setAdvancedConditions] = useState<AdvancedCondition[]>([])

  // Filter data based on view mode if view toggle is enabled
  const filteredData = useMemo(() => {
    // Use reordered data if available and reordering is enabled (in selected view OR when viewToggle is disabled)
    const useReorderedData = enableRowReordering && (viewMode === 'selected' || !enableViewToggle) && reorderedData
    const baseData = useReorderedData ? reorderedData : data

    // Advanced filter pass: evaluate all conditions with their AND/OR connectors.
    // Applied before view-toggle so it composes with both 'all' and 'selected' views.
    const applyAdvanced = (rows: TData[]) =>
      advancedConditions.length > 0 ? rows.filter(r => evaluateConditions(r, advancedConditions)) : rows

    if (!enableViewToggle || viewMode === 'all') {
      return applyAdvanced(baseData)
    }

    // If in 'selected' mode, filter to only show selected rows
    if (selectedRowIds.length === 0) {
      return [] // Show empty grid when no selections in 'selected' mode
    }

    // Filter for selected view
    const selectedIdsSet = new Set(selectedRowIds)
    const filtered = baseData.filter(item => {
      const itemId = getRowId ? getRowId(item) : (item as any).id || baseData.indexOf(item).toString()
      return selectedIdsSet.has(itemId)
    })

    return applyAdvanced(filtered)
  }, [enableViewToggle, viewMode, data, selectedRowIds, getRowId, enableRowReordering, reorderedData, advancedConditions])

  // Intelligent column sizing based on cell content only
  const { enhancedColumns: intelligentColumns, autoResizeAllColumns } = useIntelligentColumnSizing(
    filteredData,
    normalizedColumns,
    COLUMN_SIZING_PRESETS.standard
  )

  // State management
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (savedView?.sorting) {
      return savedView.sorting
    }
    // Initialize with default sort if provided
    if (defaultSortBy) {
      return [{ id: defaultSortBy, desc: defaultSortOrder === 'desc' }]
    }
    return []
  })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialColumnFilters || [])
  // Re-seed column filters when the caller passes a new initialColumnFilters reference
  // (e.g. modal reopening for a different row). Identity-based check: skip when undefined.
  useEffect(() => {
    if (initialColumnFilters) {
      setColumnFilters(initialColumnFilters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialColumnFilters])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(savedView?.columnVisibility || initialColumnVisibility || {})
  const [rowSelection, setRowSelection] = useState(initialRowSelection)
  const [globalFilter, setGlobalFilter] = useState('')
  const [frozenColumnsState, setFrozenColumnsState] = useState<Set<string>>(new Set(frozenColumns))

  // Grouping state
  const [grouping, setGrouping] = useState<GroupingState>(groupByColumns || [])

  // Column Pinning State
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: frozenColumns || [],
    // Right-frozen + auto-pin actions — deduped (a caller passing rightFrozenColumns={["actions"]}
    // would otherwise get "actions" twice here, which React then renders as duplicate-keyed pinned
    // columns and throws "two children with the same key" on first paint).
    right: [...new Set([...(rightFrozenColumns || []), 'actions'])]
  })

  // NEW: Pagination state
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: enablePagination ? paginationPageSize : filteredData.length,
  })

  // Sync frozen columns state with prop changes (but allow user overrides)
  useEffect(() => {
    if (frozenColumns && frozenColumns.length > 0) {
      setFrozenColumnsState(prev => {
        const newSet = new Set(prev)
        frozenColumns.forEach(colId => newSet.add(colId))
        return newSet
      })
    }
  }, [frozenColumns])

  // Sync right frozen columns with pinning state
  useEffect(() => {
    if (rightFrozenColumns && rightFrozenColumns.length > 0) {
      setColumnPinning(prev => ({
        ...prev,
        right: [...new Set([...(rightFrozenColumns || []), 'actions'])]
      }))
    }
  }, [rightFrozenColumns])

  // Baccha Search state
  const [columnSearches, setColumnSearches] = useState<Record<string, string>>({})
  const [isColumnSearchActive, setIsColumnSearchActive] = useState<Record<string, boolean>>({})

  // Voice search
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const searchHandlerRef = useRef<((val: string) => void) | null>(null)

  useEffect(() => {
    setSpeechSupported(
      typeof window !== 'undefined' &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    )
  }, [])

  const handleVoiceSearch = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-IN'

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) searchHandlerRef.current?.(transcript.trim())
      setIsListening(false)
      recognitionRef.current = null
    }
    recognition.onerror = () => { setIsListening(false); recognitionRef.current = null }
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening])

  // Search navigation
  const searchInputRef = useRef<HTMLInputElement>(null)
  const {
    navigationState,
    updateSearchResults,
    navigate: navigateSearch,
    selectRow: selectSearchRow,
    clearNavigation
  } = useSearchNavigation()

  // Parse main columns from comma-separated string
  const mainColumnsArray = useMemo(() => {
    if (!mainColumns) return []
    return mainColumns.split(',').map(col => col.trim()).filter(Boolean)
  }, [mainColumns])

  // ✅ DISABLED: This was causing selection to reset on every change
  // Let the DataGrid manage its own selection state internally
  // Parent component gets notified via onRowSelect callback
  /*
  React.useEffect(() => {
    if (!selectedRowIds || selectedRowIds.length === 0) return

    const newSelection: Record<string, boolean> = {}
    data.forEach((row, index) => {
      const rowId = (row as any).id || index.toString()
      if (selectedRowIds.includes(rowId)) {
        newSelection[index.toString()] = true
      }
    })

    const newKeys = Object.keys(newSelection).sort().join(',')
    const currentKeys = Object.keys(rowSelection).filter(k => rowSelection[k]).sort().join(',')

    if (newKeys !== currentKeys) {
      setRowSelection(newSelection)
    }
  }, [selectedRowIds])
  */

  // Ensure toggle visibility is always stable
  const toggleShouldBeVisible = useMemo(() => {
    return Boolean(enableViewToggle && enableRowSelection)
  }, [enableViewToggle, enableRowSelection])

  // Safe selectedRowIds count to prevent undefined errors
  const safeSelectedCount = useMemo(() => {
    const count = Array.isArray(selectedRowIds) ? selectedRowIds.length : 0
    // console.log('🔢 [DataGrid] safeSelectedCount recalculated:', {
    //   count,
    //   selectedRowIds,
    //   isArray: Array.isArray(selectedRowIds)
    // })
    return count
  }, [selectedRowIds])

  // Note: full selectedRowIds sync is disabled to allow internal selection state
  // management. Removal-only sync below: when the external selectedRowIds shrink
  // (parent removed rows), delete ONLY those keys — never rebuild or blanket-clear.
  const prevSelectedRowIdsRef = React.useRef<string[]>(selectedRowIds)
  React.useEffect(() => {
    if (!enableRowSelection) { prevSelectedRowIdsRef.current = selectedRowIds; return }
    const prev = prevSelectedRowIdsRef.current
    prevSelectedRowIdsRef.current = selectedRowIds
    const removed = prev.filter(id => !selectedRowIds.includes(id))
    if (removed.length === 0) return
    setRowSelection(current => {
      const next = { ...current }
      let changed = false
      for (const id of removed) {
        if (next[id]) { delete next[id]; changed = true }
      }
      return changed ? next : current
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRowIds])

  // Preserve row selection state during view mode transitions
  const stableRowSelection = useMemo(() => {
    if (!enableViewToggle) return rowSelection

    // In 'selected' mode, ensure selection state remains consistent.
    // MUST be keyed by rowId (the table registers rows via getRowId) — keying by
    // index made getSelectedRowModel() return [] and any internal state change
    // fired onRowSelect([]), wiping the parent's selection.
    if (viewMode === 'selected' && selectedRowIds.length > 0) {
      const preservedSelection: Record<string, boolean> = {}

      filteredData.forEach((item) => {
        const itemId = getRowId ? getRowId(item) : ((item as any).id || data.indexOf(item).toString())
        if (selectedRowIds.includes(itemId)) {
          preservedSelection[itemId] = true
        }
      })

      return preservedSelection
    }

    return rowSelection
  }, [enableViewToggle, viewMode, selectedRowIds, filteredData, rowSelection, getRowId, data])

  // Helper function to format dates as "12 Oct, 2025"
  const formatDateCell = (dateString: any) => {
    if (!dateString) return '-'

    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString

      const day = date.getDate()
      const month = date.toLocaleDateString('en-US', { month: 'short' })
      const year = date.getFullYear()
      return `${day} ${month}, ${year}`
    } catch {
      return dateString
    }
  }

  // Create columns with selection column if needed
  const enhancedColumns = useMemo(() => {
    let baseColumns = intelligentColumns || normalizedColumns


    // Auto-format date columns (columns ending with "Date")
    baseColumns = baseColumns.map((col: any) => {
      const accessorKey = col.accessorKey as string
      const header = col.header as string

      // Check if column name ends with "Date" or header contains "Date"
      const isDateColumn =
        (accessorKey && (accessorKey.endsWith('Date') || accessorKey.toLowerCase().includes('date'))) ||
        (typeof header === 'string' && header.toLowerCase().includes('date'))

      // If it's a date column and doesn't have a custom cell renderer, add date formatting
      if (isDateColumn && !col.cell) {
        return {
          ...col,
          cell: ({ row }: any) => {
            const value = row.getValue(accessorKey)
            const formattedValue = formatDateCell(value)
            // Center the dash if it's an empty value
            return (
              <span className={formattedValue === '-' ? 'flex justify-center w-full' : ''}>
                {formattedValue}
              </span>
            )
          }
        }
      }

      return col
    })

    // Hide selection column in Selected view if hideSelectionInSelectedView is true
    const shouldHideSelection = hideSelectionInSelectedView && viewMode === 'selected'

    if (!enableRowSelection || shouldHideSelection) return baseColumns

    // Check if there's already a selection column
    const hasSelectionColumn = baseColumns.some(col =>
      col.id === 'select' ||
      (col as any).accessorKey === 'select' ||
      ((col as any).meta && (col as any).meta.isSelectColumn)
    )

    if (hasSelectionColumn) {
      return baseColumns
    }

    const selectionColumn = {
      id: 'select',
      header: ({ table }: any) => (
        <div className="w-full h-full flex items-center justify-center">
          {rowSelectionMode === 'multi' ? (
            <SelectionCheckbox
              checked={table.getIsAllRowsSelected()}
              indeterminate={table.getIsSomeRowsSelected()}
              onChange={(checked) => {
                table.toggleAllRowsSelected(checked)
              }}
              circular={circularCheckboxes}
              mode="checkbox"
            />
          ) : (
            <div className="w-5 h-5" /> /* Empty space in single mode */
          )}
        </div>
      ),
      cell: ({ row }: any) => (
        <div className="w-full h-full flex items-center justify-center">
          <SelectionCheckbox
            checked={row.getIsSelected()}
            onChange={(checked) => {
              row.toggleSelected(checked)
            }}
            circular={circularCheckboxes}
            mode={rowSelectionMode === 'single' ? 'radio' : 'checkbox'}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 30, // 1.875rem (30px ÷ 16)
      minSize: 30,
      maxSize: 30,
    }

    const result = [selectionColumn, ...baseColumns]
    return result
  }, [intelligentColumns, normalizedColumns, enableRowSelection, hideSelectionInSelectedView, viewMode, rowSelectionMode, circularCheckboxes])

  // Auto-prepend expand column when getRowCanExpand is provided
  const columnsWithExpand = useMemo(() => {
    if (!getRowCanExpand) return enhancedColumns

    // Check if there's already an expand column
    const hasExpandColumn = enhancedColumns.some(col => col.id === 'expand')
    if (hasExpandColumn) return enhancedColumns

    const expandColumn = {
      id: 'expand',
      header: ({ table }: any) => (
        <div className="w-full h-full flex items-center justify-center">
          <ExpansionToggleHeader table={table} />
        </div>
      ),
      cell: ({ row }: any) => <ExpansionToggleCell row={row} />,
      enableSorting: false,
      enableHiding: false,
      enableColumnFilter: false,
      size: 36,
      minSize: 36,
      maxSize: 36,
    }

    // Insert after select column if it exists, otherwise prepend
    const selectIndex = enhancedColumns.findIndex(col => col.id === 'select')
    if (selectIndex >= 0) {
      const result = [...enhancedColumns]
      result.splice(selectIndex + 1, 0, expandColumn)
      return result
    }
    return [expandColumn, ...enhancedColumns]
  }, [enhancedColumns, getRowCanExpand])

  // For column reordering, we need mutable state - but keep it simple.
  // Lazily seed from a persisted column order (by id) when persistKey is set.
  // Store only the ORDER (string ids), never a snapshot of column objects — otherwise
  // the frozen snapshot keeps stale `cell` closures (over old state/props), which made
  // edited cells render/write stale data (e.g. corrugation flute stuck "Loading", reel
  // wiped on edit). `columns` is re-derived from the FRESH columnsWithExpand every render.
  const colId = (col: any) => col.id || col.accessorKey
  const [columnOrderState, setColumnOrderState] = useState<string[] | null>(() => {
    const order = savedView?.columnOrder
    return order && order.length > 0 ? order : null
  })

  const columns = useMemo(() => {
    if (!columnOrderState || columnOrderState.length === 0) return columnsWithExpand
    const currentIds = columnsWithExpand.map(colId)
    // Only apply a saved order that matches the current column set exactly.
    if (columnOrderState.length !== currentIds.length || !columnOrderState.every((id) => currentIds.includes(id))) {
      return columnsWithExpand
    }
    return [...columnsWithExpand].sort((a, b) => columnOrderState.indexOf(colId(a)) - columnOrderState.indexOf(colId(b)))
  }, [columnsWithExpand, columnOrderState])

  // Search hook - handles all search state and logic (must be after columns definition)
  const {
    searchValue,
    setSearchValue,
    currentSearchTerm,
    selectedDuringSearch,
    debouncedSearchValue,
    handleGlobalSearchChange,
    handleRowSelectionChange,
    clearSearch
  } = advancedSearch({
    data,
    columns,
    mainColumnsArray,
    enableSearch,
    totalSearchResults: navigationState.totalResults,
    updateSearchResults,
    clearNavigation,
    setGlobalFilter
  })

  // Keep voice search handler ref in sync
  searchHandlerRef.current = handleGlobalSearchChange

  // (Column order is re-derived from fresh columns each render; no snapshot to reset.)
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'filters' | 'columns' | 'sort'>('filters')
  const [currentView, setCurrentView] = useState<'grid' | 'chart' | 'cards'>('grid')

  // Mobile ergonomics: auto-switch to the card view on phones (a wide table is unusable there),
  // and back to the grid on larger screens — but stop auto-switching once the user manually
  // picks a view, so their choice is always respected.
  const userChoseViewRef = useRef(false)
  useEffect(() => {
    if (userChoseViewRef.current) return
    setCurrentView(isMobile ? 'cards' : 'grid')
  }, [isMobile])

  const handleViewChange = useCallback((view: 'grid' | 'chart' | 'cards') => {
    userChoseViewRef.current = true
    setCurrentView(view)
  }, [])

  // Column sizing state - initialize with explicit sizes from column definitions for SSR consistency
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    const initialSizing: ColumnSizingState = {}
    columns.forEach((col: any) => {
      // Only set size if explicitly defined in column
      if (col.id && col.size !== undefined) {
        initialSizing[col.id] = col.size
      }
    })
    return { ...initialSizing, ...(savedView?.columnSizing || {}) }
  })

  // Persist view preferences (show/hide, order, width, sort) to localStorage when persistKey is set
  const columnOrderIds = useMemo(
    () => columns.map((col: any) => col.id || col.accessorKey).filter(Boolean),
    [columns]
  )
  // Explicit per-user layout Save / Reset (the two toolbar buttons). "Layout" = column show/hide,
  // order and width (plus the current sort). Persisted under the USER-scoped persistStorageKey, so
  // only the user who saved it ever sees it. (Replaces the previous save-on-every-change effect —
  // now the user decides when to save, and can reset back to the grid's defaults.)
  const [layoutFlash, setLayoutFlash] = useState<'' | 'saved' | 'reset'>('')
  const saveLayout = useCallback(() => {
    if (!persistStorageKey || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(persistStorageKey, JSON.stringify({
        columnVisibility, columnSizing, sorting, columnOrder: columnOrderIds,
      }))
      setLayoutFlash('saved'); window.setTimeout(() => setLayoutFlash(''), 1600)
    } catch {
      // localStorage unavailable (private mode / quota) — layout just won't persist
    }
  }, [persistStorageKey, columnVisibility, columnSizing, sorting, columnOrderIds])

  const resetLayout = useCallback(() => {
    if (typeof window !== 'undefined' && persistStorageKey) {
      try { window.localStorage.removeItem(persistStorageKey) } catch { /* ignore */ }
    }
    // Back to the grid's default column layout (widths from the column defs, default visibility/order).
    const defaultSizing: ColumnSizingState = {}
    columns.forEach((col: any) => { if (col.id && col.size !== undefined) defaultSizing[col.id] = col.size })
    setColumnSizing(defaultSizing)
    setColumnVisibility(initialColumnVisibility || {})
    setColumnOrderState(null)
    setLayoutFlash('reset'); window.setTimeout(() => setLayoutFlash(''), 1600)
  }, [persistStorageKey, columns, initialColumnVisibility])

  // Track selected rows during search - now handled by useDataGridSearch hook

  // Track last clicked row for Shift+Click range selection
  const [lastClickedRowIndex, setLastClickedRowIndex] = React.useState<number | null>(null)

  // Auto-sizing calculation (FIXED: Now includes summary row, borders, and proper height calculations)
  const calculateOptimalHeight = useMemo(() => {
    // Only enable auto-sizing in compactMode (for modals/dialogs)
    // Default mode uses flex with minHeight/maxHeight
    if (!compactMode) return null

    // When search/filter is active, maintain minimum height to prevent grid collapse
    const hasActiveSearch = globalFilter && globalFilter.trim().length > 0
    const minRowsForSearch = 8 // Minimum rows to show when searching to prevent collapse
    const actualDataLength = filteredData.length
    const dataLength = hasActiveSearch
      ? Math.max(Math.min(actualDataLength, pageSize), minRowsForSearch)
      : Math.min(actualDataLength, pageSize)

    // ========================================
    // HEIGHT COMPONENTS (All in pixels)
    // ========================================

    // 1. Toolbar/Header height
    const toolbarHeight = hideHeader ? 0 : (compactHeader ? 48 : 60)

    // 2. Table header row height
    const headerRowHeight = 44 // From DraggableColumnHeader (h-11 = 2.75rem = 44px)

    // 3. Filter row height (if enabled): h-8 = 32px
    const filterRowHeight = enableFilterRow ? 32 : 0

    // 4. Data rows height
    const dataRowsHeight = dataLength * rowHeight

    // 5. Summary row height (if enabled)
    const summaryRowCount = (enableSummary && summaryConfig)
      ? (Array.isArray(summaryConfig) ? summaryConfig.length : 1)
      : 0
    const summaryRowHeight = summaryRowCount * 24.75 // Summary rows use py-1 same as data rows (~24.75px)

    // 6. Pagination height (if enabled)
    const paginationHeight = enablePagination ? 56 : 0

    // 7. Borders and spacing
    const borderAndSpacing = 4 // Top and bottom borders (2px each)

    // Total content height
    const contentHeight =
      toolbarHeight +
      headerRowHeight +
      filterRowHeight +
      dataRowsHeight +
      summaryRowHeight +
      paginationHeight +
      borderAndSpacing

    // ========================================
    // HEIGHT LOGIC
    // ========================================

    // Special handling for no data or 1 row — let grid size naturally
    if (dataLength <= 1) {
      return null
    }

    // Threshold: ~10 rows before scrolling kicks in
    const compactThreshold = 10
    if (dataLength <= compactThreshold) {
      // Small dataset: return null to let grid size naturally (no fixed height constraint)
      // This prevents scrolling when actual row content is taller than estimated rowHeight
      return null
    } else {
      // Use configured max height for larger datasets (allow scrolling): 500px default
      const maxHeightValue = typeof maxHeight === 'number' ? maxHeight : 500
      return Math.min(contentHeight, maxHeightValue)
    }
  }, [compactMode, filteredData.length, pageSize, hideHeader, compactHeader, maxHeight, rowHeight, enablePagination, enableSummary, summaryConfig, globalFilter, enableFilterRow])

  // Column context menu state
  const [contextMenu, setContextMenu] = useState<{
    column: any
    isVisible: boolean
    position: { x: number; y: number }
  }>({
    column: null,
    isVisible: false,
    position: { x: 0, y: 0 }
  })

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Custom filter function for advanced filters
  const advancedFilterFn = React.useCallback((row: any, columnId: string, filterValue: any) => {
    if (!filterValue) return true

    // Handle plain string filter values (from FilterRow inline search)
    if (typeof filterValue === 'string') {
      const cellValue = row.getValue(columnId)
      const cellString = String(cellValue ?? '')
      const filterLower = filterValue.toLowerCase()

      // Standard string matching first
      if (cellString.toLowerCase().includes(filterLower)) return true

      // Date-aware matching: try to parse cell value as date and match against common formats
      // This handles cases where raw value is "2026-02-14T00:00:00" but user types "14 Feb" or "Feb 2026"
      //
      // Only attempt this on values that actually look like dates. new Date(297) is a VALID
      // date (297ms after epoch → 01/01/1970), so feeding plain numbers here made every
      // numeric cell match any digit the user typed — filtering a number column did nothing.
      if (cellValue && looksLikeDate(cellValue)) {
        const dateObj = new Date(cellValue)
        if (!isNaN(dateObj.getTime())) {
          const day = dateObj.getDate()
          const month = dateObj.getMonth() // 0-indexed
          const year = dateObj.getFullYear()
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
          const monthFull = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
          const dd = String(day).padStart(2, '0')
          const mm = String(month + 1).padStart(2, '0')

          // Generate searchable date strings in common formats
          const dateFormats = [
            `${dd}/${mm}/${year}`,          // 14/02/2026
            `${mm}/${dd}/${year}`,          // 02/14/2026
            `${dd}-${mm}-${year}`,          // 14-02-2026
            `${day} ${monthNames[month]} ${year}`,  // 14 feb 2026
            `${monthNames[month]} ${day}, ${year}`, // feb 14, 2026
            `${day} ${monthFull[month]} ${year}`,   // 14 february 2026
            `${monthFull[month]} ${day}, ${year}`,  // february 14, 2026
            `${monthNames[month]} ${year}`,         // feb 2026
            `${monthFull[month]} ${year}`,          // february 2026
            `${dd}/${mm}`,                          // 14/02
            `${day} ${monthNames[month]}`,          // 14 feb
          ]

          if (dateFormats.some(fmt => fmt.toLowerCase().includes(filterLower))) return true
        }
      }

      return false
    }

    if (typeof filterValue !== 'object') return true

    const { operator, value, type } = filterValue
    const cellValue = row.getValue(columnId)
    // Use ?? (not ||) so falsy-but-valid values keep their real string: boolean `false`, 0, and ''
    // must become "false"/"0"/"" — with `|| ''` they collapsed to '', so "Filter by Values" → false
    // (operator 'in') matched nothing even though the grid had many false rows. (The string-search
    // branch above already uses ?? — this aligns the object/advanced-filter branch with it.)
    const cellString = String(cellValue ?? '')

    // Handle 'type' field (from Quick Filter)
    if (type && !operator) {
      switch (type) {
        case 'contains':
          return cellString.toLowerCase().includes(String(value).toLowerCase())
        case 'equals':
          return cellString.toLowerCase() === String(value).toLowerCase()
        case 'starts_with':
          return cellString.toLowerCase().startsWith(String(value).toLowerCase())
        case 'greater_than':
          return Number(cellValue) > Number(value)
        case 'less_than':
          return Number(cellValue) < Number(value)
        case 'in':
          // Check if cellValue is in the array of values
          return Array.isArray(value) && value.map(v => String(v)).includes(cellString)
        default:
          return true
      }
    }

    // Handle different operators (from Advanced Filter)
    switch (operator) {
      case 'contains':
        return cellString.toLowerCase().includes(String(value).toLowerCase())
      case 'not_contains':
        return !cellString.toLowerCase().includes(String(value).toLowerCase())
      case 'equals':
        return cellValue == value
      case 'not_equals':
        return cellValue != value
      case 'starts_with':
        return cellString.toLowerCase().startsWith(String(value).toLowerCase())
      case 'ends_with':
        return cellString.toLowerCase().endsWith(String(value).toLowerCase())
      case 'is_empty':
        return !cellValue || cellString.trim() === ''
      case 'is_not_empty':
        return cellValue && cellString.trim() !== ''
      case 'greater_than':
        return Number(cellValue) > Number(value)
      case 'greater_than_equal':
        return Number(cellValue) >= Number(value)
      case 'less_than':
        return Number(cellValue) < Number(value)
      case 'less_than_equal':
        return Number(cellValue) <= Number(value)
      case 'between':
        return Number(cellValue) >= Number(value[0]) && Number(cellValue) <= Number(value[1])
      case 'not_between':
        return Number(cellValue) < Number(value[0]) || Number(cellValue) > Number(value[1])
      case 'is_true':
        return cellValue === true || cellValue === 'true' || cellValue === 1
      case 'is_false':
        return cellValue === false || cellValue === 'false' || cellValue === 0
      default:
        return true
    }
  }, [])

  // Table instance with intelligent selection handler
  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: getRowId || ((row) => (row as any).id || data.indexOf(row).toString()),
    defaultColumn: {
      size: 150, // Ensure consistent default size for SSR/CSR
      minSize: 30,
      maxSize: 2000, // High limit allows users to drag columns wider than auto-calculated width
      filterFn: 'advancedFilter' as any, // Use custom filter function for all columns
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    filterFns: {
      advancedFilter: advancedFilterFn,
    },
    sortingFns: {
      // Numeric-aware text sort so "10" sorts after "9", not after "1".
      naturalSort: (rowA: any, rowB: any, columnId: string) =>
        naturalCompare(rowA.getValue(columnId), rowB.getValue(columnId)),
      // Date-aware sort: parses DD/MM/YYYY, ISO, and other common date formats
      dateSort: (rowA: any, rowB: any, columnId: string) => {
        const parseDate = (val: any): number => {
          if (!val) return 0
          const s = String(val)
          // DD/MM/YYYY or DD/MM/YY
          if (s.includes('/')) {
            const parts = s.split('/')
            if (parts.length === 3) {
              const y = parseInt(parts[2])
              return new Date(y < 100 ? 2000 + y : y, parseInt(parts[1]) - 1, parseInt(parts[0])).getTime()
            }
          }
          const d = new Date(s)
          return isNaN(d.getTime()) ? 0 : d.getTime()
        }
        return parseDate(rowA.getValue(columnId)) - parseDate(rowB.getValue(columnId))
      },
    },
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    onPaginationChange: enablePagination ? setPagination : undefined,
    autoResetPageIndex: false,
    // Grouping
    getGroupedRowModel: enableGrouping ? getGroupedRowModel() : undefined,
    onGroupingChange: (updater) => {
      const newGrouping = typeof updater === 'function' ? updater(grouping) : updater
      setGrouping(newGrouping)
      onGroupingChange?.(newGrouping)
    },
    // Expanding (also used for grouped rows)
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setExpanded,
    getRowCanExpand: getRowCanExpand || ((row) => !!renderSubComponent || row.subRows?.length > 0),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      setRowSelection(updater)

      // Track selections and deselections for intelligent search clearing
      if (typeof updater === 'function') {
        const newSelection = updater(rowSelection)
        const oldKeys = Object.keys(rowSelection).filter(key => rowSelection[key])
        const newKeys = Object.keys(newSelection).filter(key => newSelection[key])

        // Find newly selected and deselected rows
        const newlySelected = newKeys.filter(key => !oldKeys.includes(key))
        const newlyDeselected = oldKeys.filter(key => !newKeys.includes(key))

        if (currentSearchTerm.trim()) {
          // Handle newly selected rows
          newlySelected.forEach(rowIndexStr => {
            const rowIndex = parseInt(rowIndexStr, 10)
            const rowData = filteredData[rowIndex]
            const rowId = (rowData as any)?.id || rowIndexStr
            handleRowSelectionChange(rowId, true)
          })

          // Handle newly deselected rows
          newlyDeselected.forEach(rowIndexStr => {
            const rowIndex = parseInt(rowIndexStr, 10)
            const rowData = filteredData[rowIndex]
            const rowId = (rowData as any)?.id || rowIndexStr
            handleRowSelectionChange(rowId, false)
          })
        }
      }
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection: stableRowSelection,
      globalFilter,
      columnSizing,
      expanded,
      columnPinning,
      grouping,
      ...(enablePagination && { pagination }),
    },
    onColumnPinningChange: setColumnPinning,
    enableRowSelection: true,
    enableMultiRowSelection: rowSelectionMode === 'multi',
    enableColumnResizing: enableColumnResizing,
    columnResizeMode: columnResizeMode,
  })

  // Table rows
  const { rows } = table.getRowModel()

  // Virtual scrolling setup
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)

  // Track if data has ever been loaded (non-empty) to distinguish initial empty vs result empty
  const hasEverHadDataRef = useRef(false)
  if (data.length > 0) {
    hasEverHadDataRef.current = true
  }

  // Force re-render state for virtualizer (workaround for React 19 flushSync issue)
  const [, forceRerender] = React.useReducer((x) => x + 1, 0)

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 20,
    enabled: enableVirtualization && currentView === 'grid',
    // React 19 fix: never allow synchronous flushSync from inside render.
    // All virtualizer-triggered re-renders go through a microtask so they
    // happen after the current render cycle completes.
    onChange: (_instance, sync) => {
      if (sync) {
        queueMicrotask(forceRerender)
      } else {
        forceRerender()
      }
    },
    // Override the scroll offset observer to avoid flushSync during render.
    // Default implementation calls flushSync when scroll events fire while
    // React is already rendering. Using rAF breaks the synchronous chain.
    observeElementOffset: (instance, cb) => {
      const el = instance.scrollElement
      if (!el) return
      let rafId: number
      const handler = () => {
        cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => cb(el.scrollTop, false))
      }
      cb(el.scrollTop, false)
      el.addEventListener('scroll', handler, { passive: true })
      return () => {
        el.removeEventListener('scroll', handler)
        cancelAnimationFrame(rafId)
      }
    },
  })

  // ── Keyboard cell navigation (↑ ↓ ← → move a highlighted cell) ─────────────
  // Only active AFTER the user clicks a cell (useKeyboardNavigation guards on
  // focusedCell + editable targets), so it never hijacks page scroll or inputs.
  const kbdNav = useKeyboardNavigation(table, { enableTabNavigation: false, enableEnterToEdit: false })
  const { focusedCell: navFocusedCell, setFocus: navSetFocus, clearFocus: navClearFocus } = kbdNav

  // Scroll the active cell into view when it moves (vertical via the virtualizer,
  // then nudge the focused <td> horizontally into the scroll container).
  useEffect(() => {
    if (!navFocusedCell) return
    try { rowVirtualizer.scrollToIndex(navFocusedCell.rowIndex, { align: 'auto' }) } catch { /* ignore */ }
    requestAnimationFrame(() => {
      tableContainerRef.current
        ?.querySelector('[data-focused-cell="true"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navFocusedCell])

  // Clicking outside the grid clears the active cell → arrows return to normal.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (tableContainerRef.current && !tableContainerRef.current.contains(e.target as Node)) navClearFocus()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [navClearFocus])

  // Column reordering handler
  const handleColumnReorder = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    // Use accessor keys for matching since that's what we're using as IDs
    const activeIndex = columns.findIndex((col) =>
      (col as any).accessorKey === active.id || col.id === active.id
    )
    const overIndex = columns.findIndex((col) =>
      (col as any).accessorKey === over.id || col.id === over.id
    )

    if (activeIndex !== overIndex && activeIndex !== -1 && overIndex !== -1) {
      // Persist the new ORDER (ids), not the column objects.
      const currentIds = columns.map(colId)
      setColumnOrderState(arrayMove(currentIds, activeIndex, overIndex))
    }
  }, [columns])

  // Row reordering handler
  const handleRowReorder = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const currentData = reorderedData || filteredData
    const activeIndex = currentData.findIndex(item => {
      const itemId = getRowId ? getRowId(item) : (item as any).id
      return itemId === active.id
    })
    const overIndex = currentData.findIndex(item => {
      const itemId = getRowId ? getRowId(item) : (item as any).id
      return itemId === over.id
    })

    if (activeIndex !== overIndex && activeIndex !== -1 && overIndex !== -1) {
      const newData = arrayMove(currentData, activeIndex, overIndex)
      setReorderedData(newData)
      onRowOrderChange?.(newData)
    }
  }, [filteredData, reorderedData, getRowId, onRowOrderChange])

  // Selected rows data - use getSelectedRowModel() to get ALL selected rows, not just filtered ones
  const selectedRows = useMemo(() => {
    return table.getSelectedRowModel().rows.map(row => row.original)
  }, [table, rowSelection])

  // Notify parent of selected rows
  React.useEffect(() => {
    onRowSelect?.(selectedRows)
  }, [selectedRows, onRowSelect])

  // Filtered and sorted data for visualization
  const processedData = useMemo(() => {
    return table.getFilteredRowModel().rows.map(row => row.original)
  }, [table])

  // Export rows: mirror what's on screen — only visible columns, in display order,
  // keyed by their header label, over the filtered + sorted rows.
  const exportRows = useMemo(() => {
    const exportable = table.getVisibleLeafColumns().filter(
      (col) => col.id !== 'select' && col.id !== 'actions' && col.id !== 'expand'
    )
    const headerOf = (col: any): string => {
      const h = col.columnDef?.header
      return typeof h === 'string' && h.trim() ? h : col.id
    }
    return table.getSortedRowModel().rows.map((row) => {
      const out: Record<string, any> = {}
      exportable.forEach((col) => {
        out[headerOf(col)] = row.getValue(col.id)
      })
      return out
    })
    // Recompute when filters, sorting, visibility, order, or data change
  }, [table, columnFilters, sorting, columnVisibility, columnSizing, globalFilter, data, columnOrderState])

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'json') => {
    // Export functionality will be implemented in ExportImportButtons
  }

  const handleImport = (importedData: TData[]) => {
    // Pass imported data to parent component
    onImport?.(importedData)
  }

  // Row click handler for selection
  const handleRowClick = useCallback((row: Row<TData>, rowIndex: number, event: React.MouseEvent) => {
    if (!enableRowClickSelection) return

    // Prevent selection if clicking on a button or input (but allow checkbox clicks)
    const target = event.target as HTMLElement
    if (target.closest('button') || target.closest('a')) {
      return
    }

    // Prevent selection if clicking on an editable cell (double-click area)
    if (target.closest('[data-editable-cell="true"]')) {
      return
    }

    // ✅ FIX: Don't block row clicks in Selected view - only block if clicking the row itself (not checkbox)
    // The checkbox click should always work, even in Selected view
    if (viewMode === 'selected' && !target.closest('input[type="checkbox"]')) {
      return
    }

    const isCtrlOrCmd = event.ctrlKey || event.metaKey
    const isShift = event.shiftKey

    if (rowSelectionMode === 'single') {
      // Single mode: just toggle this row
      row.toggleSelected()
      setLastClickedRowIndex(rowIndex)
    } else {
      // Multi mode
      if (isShift && enableShiftClickRange && lastClickedRowIndex !== null) {
        // Shift+Click: select range
        const start = Math.min(lastClickedRowIndex, rowIndex)
        const end = Math.max(lastClickedRowIndex, rowIndex)
        const allRows = table.getRowModel().rows

        for (let i = start; i <= end; i++) {
          if (allRows[i]) {
            allRows[i].toggleSelected(true)
          }
        }
      } else if (isCtrlOrCmd && enableCtrlClickMultiSelect) {
        // Ctrl+Click: toggle individual row
        row.toggleSelected()
        setLastClickedRowIndex(rowIndex)
      } else {
        // Regular click: toggle this row only
        row.toggleSelected()
        setLastClickedRowIndex(rowIndex)
      }
    }
  }, [enableRowClickSelection, viewMode, rowSelectionMode, enableShiftClickRange, enableCtrlClickMultiSelect, lastClickedRowIndex, table])

  // Keyboard handler for Space key selection
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Removed spacebar row selection - was causing performance issues and unwanted behavior

      // Ctrl+A to select all rows - but ONLY if not in an input/textarea/contenteditable
      if ((event.ctrlKey || event.metaKey) && event.key === 'a' && rowSelectionMode === 'multi') {
        const target = event.target as HTMLElement
        const isInputField = target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable

        // Only handle Ctrl+A for grid if user is NOT in an input field
        // This allows standard browser Ctrl+A to work in input fields
        if (!isInputField) {
          event.preventDefault()
          table.toggleAllRowsSelected(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [table, rowSelectionMode])

  // Context menu handlers
  const handleColumnRightClick = useCallback((header: any, event: React.MouseEvent) => {
    setContextMenu({
      column: header.column,
      isVisible: true,
      position: { x: event.clientX, y: event.clientY }
    })
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isVisible: false }))
  }, [])

  const handleApplyColumnFilter = useCallback((columnId: string, filterType: string, value: any) => {
    const column = table.getColumn(columnId)
    if (!column) return

    switch (filterType) {
      case 'contains':
        column.setFilterValue(value)
        break
      case 'equals':
        column.setFilterValue((old: any) => ({ type: 'equals', value }))
        break
      case 'starts_with':
        column.setFilterValue((old: any) => ({ type: 'starts_with', value }))
        break
      case 'greater_than':
        column.setFilterValue((old: any) => ({ type: 'greater_than', value: Number(value) }))
        break
      case 'less_than':
        column.setFilterValue((old: any) => ({ type: 'less_than', value: Number(value) }))
        break
      case 'in':
        column.setFilterValue((old: any) => ({ type: 'in', value }))
        break
      default:
        column.setFilterValue(value)
    }
  }, [table])

  const handleAdvancedFilter = (conditions: AdvancedCondition[]) => {
    // Conditions are evaluated together in filteredData with their AND/OR connectors,
    // so OR actually works (TanStack's columnFilters can only AND independent columns).
    setAdvancedConditions(conditions)
    setShowAdvancedFilter(false)
  }

  // Baccha Search handlers
  const handleColumnSearch = useCallback((columnId: string, searchTerm: string) => {
    setColumnSearches(prev => ({
      ...prev,
      [columnId]: searchTerm
    }))

    setIsColumnSearchActive(prev => ({
      ...prev,
      [columnId]: searchTerm.length > 0
    }))

    // Apply column-specific filter
    const column = table.getColumn(columnId)
    if (column) {
      column.setFilterValue(searchTerm || undefined)
    }
  }, [table])

  // Spin the refresh icon while the caller's handler is in flight. Callers that
  // already track their own loading state can drive it via the isRefreshing prop.
  const [isRefreshingInternal, setIsRefreshingInternal] = useState(false)
  const refreshSpinning = isRefreshingProp || isRefreshingInternal

  const handleRefreshClick = useCallback(async () => {
    if (!onRefresh || refreshSpinning) return
    try {
      const result = onRefresh()
      if (result && typeof (result as any).then === 'function') {
        setIsRefreshingInternal(true)
        await result
      }
    } finally {
      setIsRefreshingInternal(false)
    }
  }, [onRefresh, refreshSpinning])

  const handleClearColumnSearch = useCallback((columnId: string) => {
    setColumnSearches(prev => {
      const newSearches = { ...prev }
      delete newSearches[columnId]
      return newSearches
    })

    setIsColumnSearchActive(prev => ({
      ...prev,
      [columnId]: false
    }))

    // Clear column filter
    const column = table.getColumn(columnId)
    if (column) {
      column.setFilterValue(undefined)
    }
  }, [table])

  // Clear ALL filters (global search + column filters)
  // Total active filters for the badge / clear-all visibility: column filters + advanced conditions.
  const totalActiveFilters = columnFilters.length + advancedConditions.length

  const handleClearAllFilters = useCallback(() => {
    // Clear global filter/search (clearSearch also resets the debounced value,
    // which otherwise re-applies the old filter 300ms later)
    clearSearch()

    // Clear all column filters
    setColumnFilters([])

    // Clear advanced filter conditions
    setAdvancedConditions([])

    // Clear column search states
    setColumnSearches({})
    setIsColumnSearchActive({})
  }, [clearSearch])

  // Navigation handlers
  const handleSearchNavigation = useCallback((direction: 'up' | 'down') => {
    navigateSearch(direction)
  }, [navigateSearch])

  const handleSearchSelection = useCallback((rowId: string) => {

    // Find the row in the current filtered view
    const filteredRows = table.getRowModel().rows
    const targetRow = filteredRows.find(row => {
      const currentRowId = (row.original as any).id || row.id
      return currentRowId === rowId
    })

    if (targetRow) {
      const isCurrentlySelected = targetRow.getIsSelected()
      const newSelectionState = !isCurrentlySelected

      // Toggle selection - this will trigger handleRowSelectionChange via table callback
      targetRow.toggleSelected(newSelectionState)

      // Optionally call onRowClick if provided
      if (onRowClick) {
        onRowClick(targetRow.original)
      }
    }
  }, [table, onRowClick])

  // No default height class - rely on maxHeight style for responsiveness
  const hasHeightClass = className && /h-\[|h-\d|h-full|h-screen|h-auto/.test(className)
  const finalClassName = `border border-[rgb(var(--bd-default))] rounded-lg overflow-hidden flex flex-col ${className || ''}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={finalClassName}
      style={{
        ...style,
        isolation: 'isolate',
        position: 'relative',
        zIndex: 0
      }}
    >
      {/* Header Row - 20% more height for better balance */}
      {!hideHeader && (
        <div
          className={`flex flex-row items-center justify-between gap-1.5 sm:gap-0 py-2 sm:py-1.5 px-2 sm:px-3 border-b border-bd-default bg-bg-subtle transition-colors ${enableGrouping ? 'group-drop-zone' : ''}`}
          onDragOver={enableGrouping ? (e) => {
            e.preventDefault()
            e.currentTarget.classList.add('bg-[rgb(var(--color-primary))]/5', 'border-[rgb(var(--color-primary))]')
          } : undefined}
          onDragLeave={enableGrouping ? (e) => {
            e.currentTarget.classList.remove('bg-[rgb(var(--color-primary))]/5', 'border-[rgb(var(--color-primary))]')
          } : undefined}
          onDrop={enableGrouping ? (e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('bg-[rgb(var(--color-primary))]/5', 'border-[rgb(var(--color-primary))]')
            const columnId = e.dataTransfer.getData('text/plain')
            if (columnId && !grouping.includes(columnId)) {
              setGrouping(prev => [...prev, columnId])
            }
          } : undefined}
        >
          {/* Left side - Title, Grouped Columns, and Pre-toggle Actions */}
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 sm:gap-4 min-w-0 shrink sm:flex-1">
            {title && (
              <h3 className="text-sm sm:text-base font-medium text-fg-default truncate">
                {title}
              </h3>
            )}

            {/* Grouped Columns Chips */}
            {enableGrouping && grouping.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Layers className="h-3.5 w-3.5 text-[rgb(var(--fg-muted))]" />
                {grouping.map((columnId, index) => {
                  const column = table.getColumn(columnId)
                  const header = typeof column?.columnDef.header === 'string'
                    ? column.columnDef.header
                    : columnId
                  return (
                    <React.Fragment key={columnId}>
                      {index > 0 && (
                        <span className="text-[rgb(var(--fg-muted))] text-xs">→</span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))] border border-[rgb(var(--color-primary))]/30">
                        {header}
                        <button
                          onClick={() => setGrouping(prev => prev.filter(id => id !== columnId))}
                          className="hover:bg-[rgb(var(--color-primary))]/20 rounded p-0.5 -mr-1"
                          aria-label="Remove grouping"
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      </span>
                    </React.Fragment>
                  )
                })}
              </div>
            )}

            {/* Hint when grouping enabled but no groups */}
            {enableGrouping && grouping.length === 0 && (
              <span className="text-xs text-[rgb(var(--fg-muted))] italic hidden sm:inline">
                Drag column headers here to group
              </span>
            )}

            {headerActions && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {headerActions}
              </div>
            )}
            {/* Pre-toggle Actions - Moved to left side */}
            {preToggleActions && (
              <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 shrink">
                {preToggleActions}
              </div>
            )}
          </div>

          {/* Right side - Reordered Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 justify-end">

            {/* All/Selected Toggle - Pill-shaped Segmented Control with Enhanced Stability */}
            {toggleShouldBeVisible && (
              <div key="view-toggle" className="inline-flex items-center bg-[rgb(var(--bg-subtle))] rounded-full border border-[rgb(var(--bd-default))] p-0.5">
                <button
                  onClick={() => {
                    try {
                      onViewModeChange?.('all')
                    } catch (error) {
                      console.error('Error switching to All view:', error)
                    }
                  }}
                  className={`px-2 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-full transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 whitespace-nowrap ${viewMode === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--fg-default))]'
                    }`}
                  aria-label="View all items"
                >
                  All
                </button>
                <button
                  onClick={() => {
                    try {
                      // Clear search/filters so the Selected view shows every selected
                      // row, not just those matching a leftover filter
                      handleClearAllFilters()
                      // Always allow switching to selected mode, even with 0 selections
                      // This prevents the toggle from becoming unresponsive
                      onViewModeChange?.('selected')
                    } catch (error) {
                      console.error('Error switching to Selected view:', error)
                    }
                  }}
                  className={`px-2 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-full transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 whitespace-nowrap ${viewMode === 'selected'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--fg-default))]'
                    }`}
                  aria-label={`View selected items (${safeSelectedCount} selected)`}
                >
                  <span className="hidden sm:inline">Selected </span>({safeSelectedCount})
                </button>
              </div>
            )}

            {/* Pre-Date Actions - Just before date picker */}
            {preDateActions}

            {/* Unified Search + Date + Filter pill */}
            {enableSearch && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="min-w-0 flex-1">
                  {effectiveSearchType === 'advanced' ? (
                    <>
                      {/* Unified pill: 🔍 Search... [grows] | 📅 Date | ≡ Filters | ⚙ Options | toolbarActions */}
                      <TooltipProvider delayDuration={100}>
                      <div className="flex items-center h-8 rounded-full border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] px-3 focus-within:border-[rgb(var(--color-primary))] focus-within:ring-1 focus-within:ring-[rgb(var(--color-primary)/0.2)] transition-all">
                        {/* Search section — grows to fill */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {speechSupported && (
                            <button
                              type="button"
                              onClick={handleVoiceSearch}
                              className={`flex-shrink-0 transition-colors ${isListening ? 'text-[rgb(var(--color-error))] animate-pulse' : 'text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]'}`}
                              title={isListening ? 'Stop listening' : 'Voice search'}
                            >
                              {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          <input
                            ref={searchInputRef}
                            placeholder={speechSupported ? 'Type or speak to search...' : 'Search...'}
                            value={searchValue}
                            onChange={(e) => handleGlobalSearchChange(e.target.value)}
                            className="flex-1 min-w-0 w-full bg-transparent border-none outline-none text-xs text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))]"
                          />
                        </div>
                        {/* Date + Filter + Menu section — right side of pill */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <div className="w-px h-4 bg-[rgb(var(--bd-default))]" />
                          {enableDateFilter && (
                            <DatePicker
                              mode="range"
                              value={{ from: dateFrom || undefined, to: dateTo || undefined }}
                              onChange={(range) => {
                                if (range && typeof range === 'object' && 'from' in range) {
                                  onDateFromChange?.(range.from || null)
                                  onDateToChange?.(range.to || null)
                                }
                              }}
                              iconOnly={true}
                            />
                          )}
                          {enableDateFilter && <div className="w-px h-4 bg-[rgb(var(--bd-default))]" />}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => { setSettingsInitialTab('filters'); setShowAdvancedFilter(true) }}
                                className="relative flex items-center gap-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] transition-colors"
                              >
                                <ListFilter className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline text-xs">Filters</span>
                                {totalActiveFilters > 0 && (
                                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-[rgb(var(--color-primary))] rounded-full flex items-center justify-center">
                                    <span className="text-[8px] text-white font-bold">{totalActiveFilters}</span>
                                  </div>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {totalActiveFilters > 0 ? `Filters (${totalActiveFilters} active)` : 'Filters'}
                            </TooltipContent>
                          </Tooltip>
                          {enableSavedLayout && !isMobile && (
                            <>
                              <div className="w-px h-4 bg-[rgb(var(--bd-default))]" />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={saveLayout}
                                    className="flex items-center gap-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--color-primary))] transition-colors"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline text-xs">{layoutFlash === 'saved' ? 'Saved ✓' : 'Save Layout'}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Save this column layout (width / order / show-hide) — only you see it</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={resetLayout}
                                    className="flex items-center gap-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] transition-colors"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline text-xs">{layoutFlash === 'reset' ? 'Reset ✓' : 'Reset'}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Reset to the default column layout</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {compactHeader && (
                            <>
                              <div className="w-px h-4 bg-[rgb(var(--bd-default))]" />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <ActionsMenu
                                      enableVisualization={enableVisualization}
                                      currentView={currentView}
                                      onViewChange={handleViewChange}
                                      enableExport={enableExport && pageAccess.canExport}
                                      enableImport={enableImport}
                                      data={exportRows as any}
                                      filename={typeof title === 'string' && title ? title : 'data-export'}
                                      onImportComplete={(importedData) => { if (onImport) onImport(importedData) }}
                                      enableColumnVisibility={enableColumnVisibility}
                                      onOpenColumnChooser={() => { setSettingsInitialTab('columns'); setShowAdvancedFilter(true) }}
                                      enableAutoResize={enableAutoResize}
                                      onAutoResize={() => { if (autoResizeAllColumns) autoResizeAllColumns(table) }}
                                      enableDateFilter={enableDateFilter}
                                      dateFrom={dateFrom}
                                      dateTo={dateTo}
                                      onDateFromChange={onDateFromChange}
                                      onDateToChange={onDateToChange}
                                      enableFiltering={enableFiltering}
                                      onOpenAdvancedFilter={() => { setSettingsInitialTab('filters'); setShowAdvancedFilter(true) }}
                                      activeFiltersCount={totalActiveFilters}
                                      enableGrouping={enableGrouping}
                                      columns={table.getAllColumns()}
                                      grouping={grouping}
                                      onGroupingChange={(columnId) => {
                                        setGrouping((prev) => prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId])
                                      }}
                                      onClearGrouping={() => setGrouping([])}
                                    />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Options</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {onRefresh && (
                            <>
                              <div className="w-px h-4 bg-[rgb(var(--bd-default))]" />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={handleRefreshClick}
                                    disabled={refreshSpinning}
                                    aria-label="Refresh"
                                    className="flex items-center text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <RefreshCw className={`h-3.5 w-3.5 ${refreshSpinning ? 'animate-spin' : ''}`} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Refresh</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {toolbarActions && (
                            <>
                              <div className="w-px h-4 bg-[rgb(var(--bd-default))]" />
                              {toolbarActions}
                            </>
                          )}
                        </div>
                      </div>
                      </TooltipProvider>

                    {/* Search Navigator */}
                    <SearchNavigator
                      navigationState={navigationState}
                      onNavigate={handleSearchNavigation}
                      onSelect={handleSearchSelection}
                      onClear={clearNavigation}
                      searchInputRef={searchInputRef}
                      enabled={enableSearch}
                    />
                  </>
                ) : (
                  // Search New (top header modal style)
                  <SearchNewModal
                    data={processedData}
                    columns={columns}
                    mainColumns={mainColumns}
                    onRowSelect={handleSearchSelection}
                    selectedRows={new Set(Object.keys(rowSelection).filter(key => rowSelection[key]))}
                    className="w-full"
                  />
                )}
              </div>

              {/* Clear All Filters Button */}
              {(globalFilter || totalActiveFilters > 0) && (
                <Button
                  variant="action-cancel"
                  size="xs"
                  onClick={handleClearAllFilters}
                  className="h-8 rounded-full whitespace-nowrap"
                  aria-label="Clear all filters"
                >
                  Clear
                </Button>
              )}
            </div>
            )}

            {/* Actions Menu - Legacy Header only (compact header has it inside the pill) */}
            {!compactHeader && (
              /* LEGACY FULL HEADER: Show all buttons */
              <>
                {/* View Toggle - Second - Compact Dropdown */}
                {enableVisualization && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-9 h-8 p-0">
                        {currentView === 'grid' && <Grid3X3 className="h-4 w-4" />}
                        {currentView === 'cards' && <LayoutGrid className="h-4 w-4" />}
                        {currentView === 'chart' && <BarChart3 className="h-4 w-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleViewChange('grid')}>
                        <Grid3X3 className="mr-2 h-4 w-4" />
                        <span>Grid</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewChange('cards')}>
                        <LayoutGrid className="mr-2 h-4 w-4" />
                        <span>Cards</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewChange('chart')}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        <span>Charts</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Export/Import removed from legacy header - use compact header with ActionsMenu instead */}

                {/* Enhanced Column Chooser - Fourth */}
                {enableColumnVisibility && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-9 h-8 p-0">
                        <LayoutGrid className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
                      {(() => {
                        const allColumns = table.getAllColumns().filter((column) => column.getCanHide())
                        const frozenColumns = allColumns.filter((column) =>
                          frozenColumnsState.has(column.id) && column.id !== 'select'
                        )
                        const availableColumns = allColumns.filter((column) =>
                          !frozenColumnsState.has(column.id)
                        )

                        return (
                          <div className="space-y-1">
                            {/* Bulk Actions Header */}
                            <div className="px-3 py-2 border-b border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-subtle))]">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-[rgb(var(--fg-default))]">Column Management</span>
                                <div className="flex items-center space-x-1">
                                  {frozenColumns.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setFrozenColumnsState(new Set())
                                      }}
                                      aria-label="Unfreeze all columns"
                                    >
                                      Unfreeze All
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      autoResizeAllColumns?.(table)
                                    }}
                                    aria-label="Auto-size all columns to fit content"
                                  >
                                    Auto-size
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Frozen Columns Section */}
                            {enableColumnFreezing && frozenColumns.length > 0 && (
                              <div className="px-2 py-1">
                                <div className="bg-[rgb(var(--color-primary-subtle))] rounded-md p-1 space-y-0.5">
                                  {frozenColumns.map((column) => (
                                    <div key={column.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-[rgb(var(--bg-selected))]/50 rounded group cursor-pointer">
                                      <div className="flex items-center space-x-2 flex-1">
                                        <input
                                          type="checkbox"
                                          checked={column.getIsVisible()}
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            column.toggleVisibility(e.target.checked)
                                          }}
                                          className="w-3 h-3 rounded border-[rgb(var(--bd-default))] text-[rgb(var(--color-primary))] focus:ring-[rgb(var(--color-primary))] cursor-pointer"
                                        />
                                        <span className="text-sm font-medium text-[rgb(var(--fg-default))] capitalize truncate">
                                          {column.id}
                                        </span>
                                      </div>

                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-[rgb(var(--color-primary))] hover:text-[rgb(var(--color-primary-hover))] hover:bg-[rgb(var(--bg-selected))] opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const newFrozenColumns = new Set(frozenColumnsState)
                                          newFrozenColumns.delete(column.id)
                                          setFrozenColumnsState(newFrozenColumns)
                                        }}
                                        aria-label="Unfreeze this column"
                                      >
                                        <PinOff className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Available Columns Section */}
                            {availableColumns.length > 0 && (
                              <div className="px-2 py-1">
                                <div className="space-y-0.5">
                                  {availableColumns.map((column) => {
                                    const isSelectColumn = column.id === 'select'

                                    return (
                                      <div key={column.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-[rgb(var(--bg-subtle))] rounded group cursor-pointer">
                                        <div className="flex items-center space-x-2 flex-1">
                                          <input
                                            type="checkbox"
                                            checked={column.getIsVisible()}
                                            onChange={(e) => {
                                              e.stopPropagation()
                                              column.toggleVisibility(e.target.checked)
                                            }}
                                            className="w-3 h-3 rounded border-[rgb(var(--bd-default))] text-[rgb(var(--color-primary))] focus:ring-[rgb(var(--color-primary))] cursor-pointer"
                                          />
                                          <span className="text-sm text-[rgb(var(--fg-default))] capitalize truncate">
                                            {column.id}
                                          </span>
                                        </div>

                                        {enableColumnFreezing && !isSelectColumn && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-[rgb(var(--color-icon))] hover:text-[rgb(var(--color-icon-hover))] hover:bg-[rgb(var(--bg-hover))] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const newFrozenColumns = new Set(frozenColumnsState)
                                              newFrozenColumns.add(column.id)
                                              setFrozenColumnsState(newFrozenColumns)
                                            }}
                                            aria-label="Freeze this column to the left"
                                          >
                                            <Pin className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                          </div>
                        )
                      })()}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}

            {/* Auto-resize button - only show in legacy header or when compact is disabled */}
            {!compactHeader && enableAutoResize && (
              <AutoResizeButton
                onAutoResize={() => {
                  if (autoResizeAllColumns) {
                    autoResizeAllColumns(table)
                  }
                }}
              />
            )}

            {/* Header Actions Right - Custom actions on the right side */}
            {headerActionsRight && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {headerActionsRight}
              </div>
            )}

            {/* Selected Rows Info */}
          </div>
        </div>
      )}

      {/* Main Content - Table directly below header */}
      <div className="overflow-hidden bg-bg-surface flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {currentView === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* Data Grid - Header and Body Separated */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {(() => {
                  // Determine if row reordering is active
                  // Allow reordering when: 1) viewMode is 'selected', OR 2) viewToggle is disabled (simple mode)
                  const isRowReorderingActive = enableRowReordering && (viewMode === 'selected' || !enableViewToggle) && !loading && table.getRowModel().rows.length > 0
                  return (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={isRowReorderingActive ? handleRowReorder : handleColumnReorder}
                      modifiers={isRowReorderingActive ? [restrictToVerticalAxis] : [restrictToHorizontalAxis]}
                    >
                      {/* Single table with sticky header - cleaner approach */}
                      <div
                        ref={tableContainerRef}
                        className={`${compactMode ? '' : 'flex-1'} scrollbar-thin relative bg-[rgb(var(--bg-surface))]`}
                        style={{
                          overscrollBehavior: 'contain',
                          WebkitOverflowScrolling: 'touch',
                          overflowX: 'auto',
                          overflowY: compactMode && data.length === 0 ? 'hidden' : 'auto',
                          // Removed scrollBehavior: 'smooth' - can cause lag with virtualization
                          willChange: 'scroll-position',
                          ...(calculateOptimalHeight && { height: `${calculateOptimalHeight}px` }),
                          ...(!compactMode && {
                            // Default mode: use standard minHeight/maxHeight (grid won't collapse due to flex-1)
                            minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
                            maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
                          })
                        }}
                      >
                        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                          <colgroup>
                            {/* Add drag handle column when row reordering is active */}
                            {isRowReorderingActive && (
                              <col style={{ width: '1.875rem', minWidth: '1.875rem', maxWidth: '1.875rem' }} />
                            )}
                            {table.getHeaderGroups()[0]?.headers.map((header) => (
                              <col key={header.id} style={{ width: `${header.getSize()}px` }} suppressHydrationWarning />
                            ))}
                          </colgroup>
                          <thead className="bg-[color-mix(in_srgb,rgb(var(--color-primary))_16%,white)] dark:bg-[color-mix(in_srgb,rgb(var(--color-primary))_16%,rgb(var(--bg-surface)))] sticky top-0 z-10">
                            {table.getHeaderGroups().map((headerGroup) => {
                              // Only use SortableContext for column reordering when row reordering is NOT active
                              if (isRowReorderingActive) {
                                return (
                                  <tr key={headerGroup.id} className="border-b border-[rgb(var(--bd-default))]">
                                    {/* Drag Handle Header Column */}
                                    <th
                                      className="text-center relative after:content-[''] after:absolute after:right-0 after:top-[20%] after:bottom-[20%] after:w-[1px] after:bg-[rgb(var(--bd-medium))]"
                                      style={{
                                        width: '1.875rem',
                                        minWidth: '1.875rem',
                                        maxWidth: '1.875rem',
                                      }}
                                    >
                                    </th>
                                    {headerGroup.headers.map((header, headerIndex) => {
                                      const isFrozen = frozenColumnsState.has(header.id)
                                      const isPinnedRight = header.column.getIsPinned() === 'right'

                                      // Check if this is the last column
                                      const isLastColumn = headerIndex === headerGroup.headers.length - 1

                                      // Check if this is the last frozen column
                                      const isLastFrozenColumn = isFrozen && (
                                        headerIndex === headerGroup.headers.length - 1 ||
                                        !frozenColumnsState.has(headerGroup.headers[headerIndex + 1]?.id)
                                      )

                                      // Check if this is the first right-pinned column
                                      const isFirstPinnedRight = isPinnedRight && (
                                        headerIndex === 0 ||
                                        headerGroup.headers[headerIndex - 1]?.column.getIsPinned() !== 'right'
                                      )

                                      // Calculate left position for frozen columns
                                      let leftPosition = 0
                                      if (isFrozen) {
                                        // Add select column width if row selection is enabled
                                        if (enableRowSelection && !hideSelectionInSelectedView) {
                                          leftPosition = 30 // Select column width
                                        }

                                        // Sum up widths of all previous frozen columns (excluding select column)
                                        for (let i = 0; i < headerIndex; i++) {
                                          const prevHeader = headerGroup.headers[i]
                                          if (frozenColumnsState.has(prevHeader.id) && prevHeader.id !== 'select') {
                                            leftPosition += prevHeader.getSize()
                                          }
                                        }
                                      }

                                      // Calculate right position for right-pinned columns
                                      let rightPosition = 0
                                      if (isPinnedRight) {
                                        for (let i = headerIndex + 1; i < headerGroup.headers.length; i++) {
                                          const nextHeader = headerGroup.headers[i]
                                          if (nextHeader.column.getIsPinned() === 'right') {
                                            rightPosition += nextHeader.getSize()
                                          }
                                        }
                                      }

                                      return (
                                        <DraggableColumnHeader
                                          key={header.id}
                                          header={header}
                                          enableReordering={enableColumnReordering}
                                          enableResizing={enableColumnResizing}
                                          enableFreezing={enableColumnFreezing}
                                          enableGrouping={enableGrouping}
                                          isGrouped={grouping.includes(header.column.id)}
                                          isFrozen={isFrozen}
                                          isLastFrozen={isLastFrozenColumn}
                                          isFirstPinnedRight={isFirstPinnedRight}
                                          isLastColumn={isLastColumn}
                                          onRightClick={handleColumnRightClick}
                                          onFilterClick={handleColumnRightClick}
                                          style={{
                                            ...(isFrozen && {
                                              position: 'sticky',
                                              left: `${leftPosition}px`,
                                              zIndex: 11,
                                              transform: 'translateZ(0)',
                                              willChange: 'transform'
                                            }),
                                            ...(isPinnedRight && {
                                              position: 'sticky',
                                              right: `${rightPosition}px`,
                                              zIndex: 12,
                                              backgroundColor: 'color-mix(in srgb, rgb(var(--color-primary)) 16%, rgb(var(--bg-surface)))',
                                              transform: 'translateZ(0)',
                                              willChange: 'transform'
                                            })
                                          }}
                                        />
                                      )
                                    })}
                                  </tr>
                                )
                              } else {
                                // Column reordering mode - use SortableContext
                                return (
                                  <SortableContext
                                    key={headerGroup.id}
                                    items={headerGroup.headers.map(header => header.column.id)}
                                    strategy={horizontalListSortingStrategy}
                                  >
                                    <tr className="border-b border-[rgb(var(--bd-default))]">
                                      {headerGroup.headers.map((header, headerIndex) => {
                                        const isFrozen = frozenColumnsState.has(header.id)
                                        const isPinnedRight = header.column.getIsPinned() === 'right'

                                        // Check if this is the last column
                                        const isLastColumn = headerIndex === headerGroup.headers.length - 1

                                        // Check if this is the last frozen column
                                        const isLastFrozenColumn = isFrozen && (
                                          headerIndex === headerGroup.headers.length - 1 ||
                                          !frozenColumnsState.has(headerGroup.headers[headerIndex + 1]?.id)
                                        )

                                        // Check if this is the first right-pinned column
                                        const isFirstPinnedRight = isPinnedRight && (
                                          headerIndex === 0 ||
                                          headerGroup.headers[headerIndex - 1]?.column.getIsPinned() !== 'right'
                                        )

                                        // Calculate left position for frozen columns
                                        let leftPosition = 0
                                        if (isFrozen) {
                                          // Sum up widths of all previous frozen columns
                                          for (let i = 0; i < headerIndex; i++) {
                                            const prevHeader = headerGroup.headers[i]
                                            if (frozenColumnsState.has(prevHeader.id)) {
                                              leftPosition += prevHeader.getSize()
                                            }
                                          }
                                        }

                                        // Calculate right position for right-pinned columns
                                        let rightPosition = 0
                                        if (isPinnedRight) {
                                          for (let i = headerIndex + 1; i < headerGroup.headers.length; i++) {
                                            const nextHeader = headerGroup.headers[i]
                                            if (nextHeader.column.getIsPinned() === 'right') {
                                              rightPosition += nextHeader.getSize()
                                            }
                                          }
                                        }

                                        return (
                                          <DraggableColumnHeader
                                            key={header.id}
                                            header={header}
                                            enableReordering={enableColumnReordering}
                                            enableResizing={enableColumnResizing}
                                            enableFreezing={enableColumnFreezing}
                                            enableGrouping={enableGrouping}
                                            isGrouped={grouping.includes(header.column.id)}
                                            isFrozen={isFrozen}
                                            isLastFrozen={isLastFrozenColumn}
                                            isFirstPinnedRight={isFirstPinnedRight}
                                            isLastColumn={isLastColumn}
                                            onRightClick={handleColumnRightClick}
                                            onFilterClick={handleColumnRightClick}
                                            style={{
                                              ...(isFrozen && {
                                                position: 'sticky',
                                                left: `${leftPosition}px`,
                                                zIndex: 11,
                                                transform: 'translateZ(0)',
                                                willChange: 'transform'
                                              }),
                                              ...(isPinnedRight && {
                                                position: 'sticky',
                                                right: `${rightPosition}px`,
                                                zIndex: 12,
                                                backgroundColor: 'color-mix(in srgb, rgb(var(--color-primary)) 16%, rgb(var(--bg-surface)))',
                                                transform: 'translateZ(0)',
                                                willChange: 'transform'
                                              })
                                            }}
                                          />
                                        )
                                      })}
                                    </tr>
                                  </SortableContext>
                                )
                              }
                            })}

                            {/* Filter Row - DevExtreme-style per-column filtering */}
                            {enableFilterRow && (
                              <FilterRow
                                table={table}
                                frozenColumnsState={frozenColumnsState}
                                isRowReorderingActive={isRowReorderingActive}
                                onColumnFilterChange={() => {
                                  // Clear global filter when column filter is used - they should work independently
                                  if (globalFilter) {
                                    setGlobalFilter('')
                                    setSearchValue('')
                                  }
                                }}
                              />
                            )}
                          </thead>
                          <tbody>
                            {/* Determine if row reordering is active */}
                            {(() => {
                              // Allow reordering when: 1) viewMode is 'selected', OR 2) viewToggle is disabled (simple mode)
                              const isRowReorderingActive = enableRowReordering && (viewMode === 'selected' || !enableViewToggle) && !loading && table.getRowModel().rows.length > 0
                              const showDragHandle = isRowReorderingActive

                              return (
                                <>
                                  {/* Loading state - Skeleton rows */}
                                  {loading ? (
                                    <>
                                      {Array.from({ length: compactMode ? 3 : Math.min(pageSize || 10, 10) }).map((_, skeletonIndex) => (
                                        <tr key={`skeleton-${skeletonIndex}`} className="hover:bg-[rgb(var(--bg-hover))] transition-colors" style={{ height: `${rowHeight}px` }}>
                                          {showDragHandle && (
                                            <td className="px-1 py-1 border-b border-[rgb(var(--bd-subtle))]" style={{ width: '2.5rem' }}>
                                              <Skeleton width="20px" height="12px" />
                                            </td>
                                          )}
                                          {table.getVisibleFlatColumns().map((column, colIndex) => (
                                            <td key={column.id} className="px-1 py-1 border-b border-[rgb(var(--bd-subtle))]">
                                              <Skeleton
                                                width={colIndex === 0 ? '60%' : '85%'}
                                                height="12px"
                                              />
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </>
                                  ) : table.getRowModel().rows.length === 0 ? (
                                    <>
                                      {Array.from({ length: compactMode ? 3 : Math.min(pageSize || 10, 10) }).map((_, skeletonIndex) => (
                                        <tr key={`empty-skeleton-${skeletonIndex}`} className="transition-colors" style={{ height: `${rowHeight}px` }}>
                                          {showDragHandle && (
                                            <td className="px-1 py-1 border-b border-[rgb(var(--bd-subtle))]" style={{ width: '2.5rem' }}>
                                              <Skeleton width="20px" height="12px" />
                                            </td>
                                          )}
                                          {table.getVisibleFlatColumns().map((column, colIndex) => (
                                            <td key={column.id} className="px-1 py-1 border-b border-[rgb(var(--bd-subtle))]">
                                              <Skeleton
                                                width={colIndex === 0 ? '60%' : '85%'}
                                                height="12px"
                                              />
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </>
                                  ) : isRowReorderingActive ? (
                                    /* Row reordering mode - DndContext is at table level */
                                    <SortableContext
                                      items={rows.map(row => (row.original as any).id || row.id)}
                                      strategy={verticalListSortingStrategy}
                                    >
                                      {rows.map((row, rowIndex) => {
                                        const rowId = (row.original as any).id || row.id
                                        const isHighlighted = navigationState.highlightedRowId === rowId
                                        const isSelected = row.getIsSelected()

                                        return (
                                          <DraggableRow
                                            key={row.id}
                                            row={row}
                                            rowIndex={rowIndex}
                                            enableBacchaSearch={enableBacchaSearch}
                                            mainColumnsArray={mainColumnsArray}
                                            frozenColumnsState={frozenColumnsState}
                                            isHighlighted={isHighlighted}
                                            isSelected={isSelected}
                                            onRowClick={(e) => handleRowClick(row, rowIndex, e)}
                                            onRowDoubleClick={() => onRowClick?.(row.original)}
                                            onRowContextMenu={(e) => {
                                              if (onRowContextMenu) {
                                                e.preventDefault()
                                                onRowContextMenu(row.original, e)
                                              }
                                            }}
                                            showDragHandle={showDragHandle}
                                            navigationState={navigationState}
                                            columnSearches={columnSearches}
                                            isColumnSearchActive={isColumnSearchActive}
                                            onColumnSearch={handleColumnSearch}
                                            onClearColumnSearch={handleClearColumnSearch}
                                            SearchHighlighter={SearchHighlighter}
                                            InlineSearchCell={InlineSearchCell}
                                          />
                                        )
                                      })}
                                    </SortableContext>
                                  ) : (
                                    /* Virtualized row rendering */
                                    <>
                                      {enableVirtualization && currentView === 'grid' ? (
                                        <>
                                          {/* Padding for virtual scroll offset */}
                                          {rowVirtualizer.getVirtualItems().length > 0 && (
                                            <tr>
                                              <td
                                                colSpan={table.getVisibleFlatColumns().length}
                                                style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px` }}
                                              />
                                            </tr>
                                          )}

                                          {/* Render only visible rows */}
                                          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                            const row = rows[virtualRow.index]
                                            const rowIndex = virtualRow.index
                                            const rowId = (row.original as any).id || row.id
                                            const isHighlighted = navigationState.highlightedRowId === rowId
                                            const isSelected = row.getIsSelected()

                                            return (
                                              <ExpandableRow
                                                key={row.id}
                                                row={row}
                                                renderSubComponent={renderSubComponent}
                                                expandMode={expandMode}
                                                subData={getSubData && !globalFilter && columnFilters.length === 0 ? getSubData(row.original) : undefined}
                                                subColumns={columns as any}
                                                getSubRowId={getSubRowId}
                                                onSubRowClick={onSubRowClick}
                                                onSubRowSelect={onSubRowSelect}
                                                onRowClick={(e) => handleRowClick(row, rowIndex, e)}
                                                onRowDoubleClick={() => onRowClick?.(row.original)}
                                                onRowContextMenu={(e) => {
                                                  if (onRowContextMenu) {
                                                    e.preventDefault()
                                                    onRowContextMenu(row.original, e)
                                                  }
                                                }}
                                                className={`
                                  cursor-pointer group
                                  transition-colors duration-150 ease-out
                                  ${isHighlighted
                                                    ? 'border-2 border-[rgb(var(--color-primary))] bg-gradient-to-r from-[rgb(var(--color-primary))]/10 to-[rgb(var(--color-primary))]/20 shadow-lg relative'
                                                    : isSelected
                                                      ? 'bg-[color-mix(in_srgb,rgb(var(--color-primary))_8%,rgb(var(--bg-surface)))] shadow-sm hover:bg-[color-mix(in_srgb,rgb(var(--color-primary))_15%,rgb(var(--bg-surface)))]'
                                                      : 'hover:bg-[color-mix(in_srgb,rgb(var(--color-primary))_5%,rgb(var(--bg-surface)))]'
                                                  }
                                `}
                                              >
                                                {row.getVisibleCells().map((cell, cellIndex) => (
                                                  <CellRenderer
                                                    key={cell.id}
                                                    cell={cell}
                                                    cellIndex={cellIndex}
                                                    row={row}
                                                    enableBacchaSearch={enableBacchaSearch}
                                                    mainColumnsArray={mainColumnsArray}
                                                    frozenColumnsState={frozenColumnsState}
                                                    navigationState={navigationState}
                                                    columnSearches={columnSearches}
                                                    isColumnSearchActive={isColumnSearchActive}
                                                    onColumnSearch={handleColumnSearch}
                                                    onClearColumnSearch={handleClearColumnSearch}
                                                    SearchHighlighter={SearchHighlighter}
                                                    InlineSearchCell={InlineSearchCell}
                                                    isSelected={isSelected}
                                                    rowIndex={rowIndex}
                                                    focusedCell={navFocusedCell}
                                                    onCellFocus={navSetFocus}
                                                  />
                                                ))}
                                              </ExpandableRow>
                                            )
                                          })}

                                          {/* Bottom padding for virtual scroll */}
                                          {rowVirtualizer.getVirtualItems().length > 0 && (
                                            <tr>
                                              <td
                                                colSpan={table.getVisibleFlatColumns().length}
                                                style={{
                                                  height: `${rowVirtualizer.getTotalSize() -
                                                    (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0)
                                                    }px`,
                                                }}
                                              />
                                            </tr>
                                          )}
                                        </>
                                      ) : (
                                        /* Non-virtualized rendering (fallback) */
                                        rows.map((row, rowIndex) => {
                                          const rowId = (row.original as any).id || row.id
                                          const isHighlighted = navigationState.highlightedRowId === rowId
                                          const isSelected = row.getIsSelected()

                                          return (
                                            <ExpandableRow
                                              key={row.id}
                                              row={row}
                                              renderSubComponent={renderSubComponent}
                                              expandMode={expandMode}
                                              subData={getSubData && !globalFilter && columnFilters.length === 0 ? getSubData(row.original) : undefined}
                                              subColumns={columns as any}
                                              getSubRowId={getSubRowId}
                                              onSubRowClick={onSubRowClick}
                                              onSubRowSelect={onSubRowSelect}
                                              onRowClick={(e) => handleRowClick(row, rowIndex, e)}
                                              onRowDoubleClick={() => onRowClick?.(row.original)}
                                              onRowContextMenu={(e) => {
                                                if (onRowContextMenu) {
                                                  e.preventDefault()
                                                  onRowContextMenu(row.original, e)
                                                }
                                              }}
                                              rowHeight={rowHeight}
                                              className={`
                                      cursor-pointer group
                                      transition-colors duration-150 ease-out
                                      ${isHighlighted
                                                  ? 'border-2 border-primary bg-gradient-to-r from-primary/10 to-primary/20 shadow-lg relative z-10'
                                                  : isSelected
                                                    ? 'bg-[rgb(var(--bg-selected))] shadow-sm hover:bg-[rgb(var(--bg-hover))]'
                                                    : 'hover:bg-[rgb(var(--bg-hover))]'
                                                }
                                    `}
                                            >
                                              {row.getVisibleCells().map((cell, cellIndex) => (
                                                <CellRenderer
                                                  key={cell.id}
                                                  cell={cell}
                                                  cellIndex={cellIndex}
                                                  row={row}
                                                  enableBacchaSearch={enableBacchaSearch}
                                                  mainColumnsArray={mainColumnsArray}
                                                  frozenColumnsState={frozenColumnsState}
                                                  navigationState={navigationState}
                                                  columnSearches={columnSearches}
                                                  isColumnSearchActive={isColumnSearchActive}
                                                  onColumnSearch={handleColumnSearch}
                                                  onClearColumnSearch={handleClearColumnSearch}
                                                  SearchHighlighter={SearchHighlighter}
                                                  InlineSearchCell={InlineSearchCell}
                                                  isSelected={isSelected}
                                                  rowIndex={rowIndex}
                                                  focusedCell={navFocusedCell}
                                                  onCellFocus={navSetFocus}
                                                />
                                              ))}
                                            </ExpandableRow>
                                          )
                                        })
                                      )}
                                    </>
                                  )}
                                </>
                              )
                            })()}
                          </tbody>

                          {/* Summary/Footer Row */}
                          {enableSummary && summaryConfig && (
                            <SummaryRow
                              table={table}
                              data={processedData}
                              config={summaryConfig}
                              enableRowSelection={enableRowSelection}
                              showDragHandle={isRowReorderingActive}
                            />
                          )}
                        </table>

                        {/* Empty state: skeleton rows + "No data" message centered over rows */}
                        {!loading && table.getRowModel().rows.length === 0 && (
                          <div className="absolute left-0 right-0 bottom-0 flex items-center justify-center pointer-events-none z-10" style={{ top: '44px' }}>
                            <span className="text-[rgb(var(--fg-muted))] text-sm">
                              No data available
                            </span>
                          </div>
                        )}
                      </div>
                    </DndContext>
                  )
                })()}
              </div>

            </motion.div>
          ) : currentView === 'cards' ? (
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Card View — compact on auto-switch (mobile), normal when user-selected.
                  Feed the PAGINATED rows (getRowModel), not the full filtered set, so a large
                  grid (thousands of rows) renders only one page of cards on mobile — fast. */}
              <CardView
                data={table.getRowModel().rows.map(row => row.original)}
                columns={columns}
                onRowClick={onRowClick}
                selectedRows={selectedRows}
                cardSize="compact"
                cardColumns={cardColumns}
                circularCheckboxes={circularCheckboxes}
                onRowSelect={(item, selected) => {
                  const rowIndex = table.getRowModel().rows.findIndex(row => row.original === item)
                  if (rowIndex !== -1) {
                    table.getRowModel().rows[rowIndex].toggleSelected(selected)
                  }
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="chart"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Data Visualization */}
              <DataVisualization
                data={processedData}
                columns={columns}
                title="Data Insights"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Unified Table Settings Modal (Filters + Columns + Sort) */}
      <AdvancedFilterModal
        isOpen={showAdvancedFilter}
        onClose={() => setShowAdvancedFilter(false)}
        onApply={handleAdvancedFilter}
        columns={columns}
        data={filteredData}
        initialTab={settingsInitialTab}
        table={table}
        sorting={sorting}
        onSortingChange={setSorting}
        enableGrouping={enableGrouping}
        grouping={grouping}
        onGroupingChange={(columnId) => {
          setGrouping((prev) => prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId])
        }}
        onClearGrouping={() => setGrouping([])}
      />

      {/* Column Context Menu */}
      {contextMenu.column && (
        <ColumnContextMenu
          column={contextMenu.column}
          table={table}
          data={data}
          isVisible={contextMenu.isVisible}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
          onApplyFilter={handleApplyColumnFilter}
        />
      )}

      {/* Pagination Controls — shown for both the table and the card view (cards are paginated too). */}
      {enablePagination && (currentView === 'grid' || currentView === 'cards') && (
        <PaginationControls
          pageIndex={table.getState().pagination.pageIndex}
          pageSize={table.getState().pagination.pageSize}
          totalRows={filteredData.length}
          pageSizeOptions={paginationPageSizeOptions}
          onPageChange={(pageIndex) => table.setPageIndex(pageIndex)}
          onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
        />
      )}
    </motion.div>
  )
}