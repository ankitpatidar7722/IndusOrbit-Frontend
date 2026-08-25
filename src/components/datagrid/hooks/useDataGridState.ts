import { useState, useMemo, useEffect } from 'react'
import {
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  ExpandedState,
} from '@tanstack/react-table'

export interface UseDataGridStateProps<TData> {
  data: TData[]
  selectedRowIds: string[]
  enablePagination: boolean
  paginationPageSize: number
  frozenColumns: string[]
  enableViewToggle: boolean
  viewMode: 'all' | 'selected'
  enableRowReordering: boolean
  getRowId?: (row: TData) => string
}

export function useDataGridState<TData>({
  data,
  selectedRowIds,
  enablePagination,
  paginationPageSize,
  frozenColumns,
  enableViewToggle,
  viewMode,
  enableRowReordering,
  getRowId,
}: UseDataGridStateProps<TData>) {
  // Core table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [frozenColumnsState, setFrozenColumnsState] = useState<Set<string>>(new Set(frozenColumns))

  // Row selection state
  const initialRowSelection = useMemo(() => {
    const selection: Record<string, boolean> = {}
    data.forEach((row, index) => {
      const rowId = (row as any).id || index.toString()
      if (selectedRowIds.includes(rowId)) {
        selection[rowId] = true
      }
    })
    return selection
  }, [selectedRowIds, data])

  const [rowSelection, setRowSelection] = useState(initialRowSelection)

  // Row reordering state
  const [reorderedData, setReorderedData] = useState<TData[] | null>(null)

  // Pagination state
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: enablePagination ? paginationPageSize : data.length,
  })

  // Search state
  const [columnSearches, setColumnSearches] = useState<Record<string, string>>({})
  const [isColumnSearchActive, setIsColumnSearchActive] = useState<Record<string, boolean>>({})

  // Sync frozen columns with prop changes
  useEffect(() => {
    if (frozenColumns && frozenColumns.length > 0) {
      setFrozenColumnsState(prev => {
        const newSet = new Set(prev)
        frozenColumns.forEach(colId => newSet.add(colId))
        return newSet
      })
    }
  }, [frozenColumns])

  // Filter data based on view mode
  const filteredData = useMemo(() => {
    const baseData = (enableRowReordering && viewMode === 'selected' && reorderedData) ? reorderedData : data

    if (!enableViewToggle || viewMode === 'all') {
      return baseData
    }

    if (selectedRowIds.length === 0) {
      return []
    }

    const selectedIdsSet = new Set(selectedRowIds)
    return baseData.filter(item => {
      const itemId = getRowId ? getRowId(item) : (item as any).id || baseData.indexOf(item).toString()
      return selectedIdsSet.has(itemId)
    })
  }, [enableViewToggle, viewMode, data, selectedRowIds, getRowId, enableRowReordering, reorderedData])

  // Stable row selection
  const stableRowSelection = useMemo(() => {
    if (!enableViewToggle) return rowSelection

    if (viewMode === 'selected' && selectedRowIds.length > 0) {
      const preservedSelection: Record<string, boolean> = {}
      filteredData.forEach((item, index) => {
        const itemId = getRowId ? getRowId(item) : (item as any).id || data.indexOf(item).toString()
        if (selectedRowIds.includes(itemId)) {
          preservedSelection[index.toString()] = true
        }
      })
      return preservedSelection
    }

    return rowSelection
  }, [enableViewToggle, viewMode, selectedRowIds, filteredData, rowSelection, getRowId, data])

  // Safe selected count
  const safeSelectedCount = useMemo(() => {
    return Array.isArray(selectedRowIds) ? selectedRowIds.length : 0
  }, [selectedRowIds])

  // Toggle visibility
  const toggleShouldBeVisible = useMemo(() => {
    return Boolean(enableViewToggle && true)
  }, [enableViewToggle])

  return {
    // State
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    columnVisibility,
    setColumnVisibility,
    rowSelection,
    setRowSelection,
    globalFilter,
    setGlobalFilter,
    expanded,
    setExpanded,
    frozenColumnsState,
    setFrozenColumnsState,
    reorderedData,
    setReorderedData,
    pagination,
    setPagination,
    columnSearches,
    setColumnSearches,
    isColumnSearchActive,
    setIsColumnSearchActive,

    // Computed
    filteredData,
    stableRowSelection,
    safeSelectedCount,
    toggleShouldBeVisible,
  }
}
