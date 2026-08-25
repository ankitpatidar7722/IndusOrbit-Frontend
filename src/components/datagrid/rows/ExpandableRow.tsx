'use client'

import React, { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Row, ColumnDef } from '@tanstack/react-table'
import { useCurrency } from 'indas-ui'

// ==========================================
// EXPANDABLE ROW COMPONENT
// ==========================================
// Supports two modes:
// - basic: renders custom content in a colSpan td (e.g. ProcessBreakdown)
// - detailed: renders sub-data as real table rows matching parent grid columns

interface ExpandableRowProps<TData> {
  row: Row<TData>
  renderSubComponent?: (row: Row<TData>) => React.ReactNode
  /** 'basic' = custom content in colSpan td, 'detailed' = real grid rows from subData */
  expandMode?: 'basic' | 'detailed'
  /** Data items to render as rows in detailed mode */
  subData?: TData[]
  /** Column definitions for detailed mode (should match parent grid columns) */
  subColumns?: ColumnDef<TData, any>[]
  /** Row ID accessor for detailed mode */
  getSubRowId?: (row: TData) => string
  /** Callback when a sub-row is clicked in detailed mode */
  onSubRowClick?: (item: TData) => void
  /** Callback when a sub-row is selected (clicked) — propagates selection to parent */
  onSubRowSelect?: (item: TData) => void
  onRowClick?: (e: React.MouseEvent) => void
  onRowDoubleClick?: () => void
  onRowContextMenu?: (e: React.MouseEvent) => void
  className?: string
  rowHeight?: number
  children: React.ReactNode
}

export function ExpandableRow<TData>({
  row,
  renderSubComponent,
  expandMode = 'basic',
  subData,
  subColumns,
  getSubRowId,
  onSubRowClick,
  onSubRowSelect,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  className = '',
  rowHeight,
  children
}: ExpandableRowProps<TData>) {
  return (
    <>
      {/* Main Row */}
      <tr
        className={className}
        onClick={onRowClick}
        onDoubleClick={onRowDoubleClick}
        onContextMenu={onRowContextMenu}
        style={rowHeight ? { height: `${rowHeight}px` } : undefined}
      >
        {children}
      </tr>

      {/* Expanded Content */}
      {row.getIsExpanded() && expandMode === 'basic' && renderSubComponent && (
        <tr>
          <td colSpan={row.getVisibleCells().length} className="p-0 bg-gray-50 border-b">
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="p-4"
              >
                {renderSubComponent(row)}
              </motion.div>
            </AnimatePresence>
          </td>
        </tr>
      )}

      {/* Detailed mode: render sub-data as real table rows */}
      {row.getIsExpanded() && expandMode === 'detailed' && subData && subData.length > 0 && subColumns && (
        <DetailedSubRows
          subData={subData}
          subColumns={subColumns}
          getSubRowId={getSubRowId}
          onSubRowClick={onSubRowClick}
          onSubRowSelect={onSubRowSelect}
          parentRow={row}
        />
      )}
    </>
  )
}

// ==========================================
// DETAILED SUB-ROWS
// ==========================================
// Renders sub-data items as real <tr> rows with proper <td> cells
// using the same column definitions as the parent grid

interface DetailedSubRowsProps<TData> {
  subData: TData[]
  subColumns: ColumnDef<TData, any>[]
  getSubRowId?: (row: TData) => string
  onSubRowClick?: (item: TData) => void
  onSubRowSelect?: (item: TData) => void
  parentRow: Row<TData>
}

function DetailedSubRows<TData>({
  subData,
  subColumns,
  getSubRowId,
  onSubRowClick,
  onSubRowSelect,
  parentRow,
}: DetailedSubRowsProps<TData>) {
  const parentCells = parentRow.getVisibleCells()
  const [selectedSubRowId, setSelectedSubRowId] = useState<string | null>(null)

  const handleSubRowClick = useCallback((item: TData, rowId: string, e: React.MouseEvent) => {
    // If clicking a button/link (action buttons), don't select
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) return

    // Row click selects locally + propagates to parent
    const isDeselecting = selectedSubRowId === rowId
    setSelectedSubRowId(isDeselecting ? null : rowId)
    if (!isDeselecting && onSubRowSelect) {
      onSubRowSelect(item)
    }
  }, [selectedSubRowId, onSubRowSelect])

  return (
    <>
      {subData.map((item, itemIndex) => {
        const rawId = getSubRowId ? getSubRowId(item) : String(itemIndex)
        const rowId = `${parentRow.id}-${rawId}`
        const isSelected = selectedSubRowId === rowId
        const bgBase = isSelected
          ? 'bg-[color-mix(in_srgb,rgb(var(--color-primary))_12%,rgb(var(--bg-surface)))]'
          : 'bg-[color-mix(in_srgb,rgb(var(--color-primary))_5%,rgb(var(--bg-surface)))]'
        const bgHover = 'hover:bg-[color-mix(in_srgb,rgb(var(--color-primary))_18%,rgb(var(--bg-surface)))]'

        return (
          <tr
            key={rowId}
            className={`cursor-pointer group transition-colors duration-150 ease-out ${bgHover} ${bgBase}`}
            onClick={(e) => handleSubRowClick(item, rowId, e)}
          >
            {parentCells.map((parentCell, cellIndex) => {
              const colDef = parentCell.column.columnDef
              const colId = parentCell.column.id
              const accessorKey = (colDef as any).accessorKey
              const width = parentCell.column.getSize()

              // Check pinning state
              const isPinnedLeft = parentCell.column.getIsPinned() === 'left'
              const isPinnedRight = parentCell.column.getIsPinned() === 'right'

              // Calculate right position for right-pinned cells
              let rightPosition = 0
              if (isPinnedRight) {
                for (let i = cellIndex + 1; i < parentCells.length; i++) {
                  const nextCell = parentCells[i]
                  if (nextCell.column.getIsPinned() === 'right') {
                    rightPosition += nextCell.column.getSize()
                  }
                }
              }

              // Calculate left position for left-pinned (frozen) cells
              let leftPosition = 0
              if (isPinnedLeft) {
                for (let i = 0; i < cellIndex; i++) {
                  const prevCell = parentCells[i]
                  if (prevCell.column.getIsPinned() === 'left') {
                    leftPosition += prevCell.column.getSize()
                  }
                }
              }

              // Get cell value from sub-data item
              const cellValue = accessorKey ? (item as any)[accessorKey] : undefined
              const cellString = String(cellValue ?? '').trim()

              // Badge detection (same as CellRenderer)
              const cellRendererString = colDef.cell?.toString() || ''
              const isBadgeColumn =
                cellRendererString.includes('Badge') ||
                cellRendererString.includes('BooleanCell') ||
                cellRendererString.includes('rounded-full') ||
                cellRendererString.includes('inline-flex')

              const isPlaceholderValue = cellString === '-' || cellString === '–' || cellString === '—' || cellString === 'N/A' || cellString === 'n/a' || cellString === ''

              // Excel-like alignment: Numbers RIGHT, Text LEFT, Badges/Placeholders CENTER
              const isNumericContent = (() => {
                if (typeof cellValue === 'number') return true
                if (!cellString || cellString === 'null' || cellString === 'undefined') return false
                if (/^-?\d*\.?\d+$/.test(cellString)) return true
                if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(cellString)) return true
                if (/^-?\d+\.?\d*%$/.test(cellString)) return true
                if (/^[\$€£¥₹₽]\s?-?\d[\d,]*\.?\d*$/.test(cellString)) return true
                if (/^-?\d[\d,]*\.?\d*\s?[\$€£¥₹₽]$/.test(cellString)) return true
                if (/^\d+\.?\d*\s*[xX×]\s*\d+\.?\d*$/.test(cellString)) return true
                if (/^\(\d[\d,]*\.?\d*\)$/.test(cellString)) return true
                if (/^-?\d+\.?\d*[eE][+-]?\d+$/.test(cellString)) return true
                if (/^\d+\/\d+$/.test(cellString)) return true
                return false
              })()

              const alignClass = isBadgeColumn || isPlaceholderValue ? 'text-center' : isNumericContent ? 'text-right' : 'text-left'

              // Build a fake row context that satisfies TanStack cell renderers
              const fakeRow = {
                original: item,
                getValue: (key: string) => (item as any)[key],
                getIsSelected: () => isSelected,
                toggleSelected: () => setSelectedSubRowId(prev => prev === rowId ? null : rowId),
                getCanExpand: () => false,
                getIsExpanded: () => false,
                getToggleExpandedHandler: () => () => {},
              }

              // Render using the column's cell renderer if it exists, otherwise show raw value
              let content: React.ReactNode = cellValue ?? ''
              if (colDef.cell && typeof colDef.cell === 'function') {
                try {
                  content = (colDef.cell as any)({
                    getValue: () => cellValue,
                    row: fakeRow,
                    column: parentCell.column,
                    cell: parentCell,
                    renderValue: () => cellValue,
                  })
                } catch {
                  content = cellValue ?? ''
                }
              }

              // Pinned cells get solid surface background (no tint) to match parent rows
              const pinnedBg = isSelected
                ? 'color-mix(in srgb, rgb(var(--color-primary)) 12%, rgb(var(--bg-surface)))'
                : 'rgb(var(--bg-surface))'

              return (
                <td
                  key={`${rowId}-${colId}`}
                  className={`px-1 py-1 text-xs text-[rgb(var(--fg-default))] align-middle ${alignClass} ${isPinnedLeft || isPinnedRight ? 'sticky z-[5]' : ''}`}
                  style={{
                    width: `${width}px`,
                    minWidth: `${width}px`,
                    boxShadow: `inset 0 -1px 0 rgb(var(--bd-default))${isPinnedRight ? ', -2px 0 5px -2px rgba(0,0,0,0.1)' : ''}`,
                    ...(isPinnedRight && {
                      position: 'sticky',
                      right: `${rightPosition}px`,
                      backgroundColor: pinnedBg,
                      transform: 'translateZ(0)',
                      willChange: 'transform',
                    }),
                    ...(isPinnedLeft && {
                      position: 'sticky',
                      left: `${leftPosition}px`,
                      backgroundColor: pinnedBg,
                      transform: 'translateZ(0)',
                      willChange: 'transform',
                    }),
                  }}
                >
                  <div className="relative">
                    <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                      {content}
                    </div>
                  </div>
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}

// ==========================================
// EXPANSION TOGGLE CELL
// ==========================================
// This component renders the toggle button for expandable rows

interface ExpansionToggleCellProps<TData> {
  row: Row<TData>
}

export function ExpansionToggleCell<TData>({ row }: ExpansionToggleCellProps<TData>) {
  if (!row.getCanExpand?.()) {
    return null
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        row.getToggleExpandedHandler?.()?.()
      }}
      className="flex items-center justify-center w-6 h-6 rounded hover:bg-[rgb(var(--bg-hover))] transition-colors"
      aria-label={row.getIsExpanded?.() ? 'Collapse' : 'Expand'}
    >
      {row.getIsExpanded?.() ? (
        <ChevronDown className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
      ) : (
        <ChevronRight className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
      )}
    </button>
  )
}

// ==========================================
// EXPANSION TOGGLE HEADER
// ==========================================
// Header button to expand/collapse ALL rows at once

export function ExpansionToggleHeader({ table }: { table: any }) {
  const isAllExpanded = table.getIsAllRowsExpanded()
  const isSomeExpanded = table.getIsSomeRowsExpanded()

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        table.toggleAllRowsExpanded(!isAllExpanded)
      }}
      className="flex items-center justify-center w-6 h-6"
    >
      {isAllExpanded || isSomeExpanded ? (
        <ChevronsDownUp className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
      ) : (
        <ChevronsUpDown className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
      )}
    </button>
  )
}

// ==========================================
// PROCESS BREAKDOWN COMPONENT
// ==========================================
// Reusable component for displaying process details in expanded rows

interface ProcessBreakdownProps {
  processes: Array<{
    name: string
    totalCost: number
    unitCost: number
  }>
}

export function ProcessBreakdown({ processes }: ProcessBreakdownProps) {
  const { getCurrencyInfo, selectedCurrency } = useCurrency()
  const currencySymbol = getCurrencyInfo(selectedCurrency)?.symbol || ''

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {processes.map((process, index) => (
        <div
          key={index}
          className="flex flex-col p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="text-sm font-medium text-gray-700 mb-2">{process.name}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-gray-900">
              {currencySymbol}{process.totalCost.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500">/</span>
            <span className="text-sm text-gray-600">{currencySymbol}{process.unitCost.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
