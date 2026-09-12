'use client'

import React from 'react'
import { Cell, flexRender } from '@tanstack/react-table'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface CellRendererProps<TData> {
  cell: Cell<TData, unknown>
  cellIndex: number
  row: any
  enableBacchaSearch?: boolean
  mainColumnsArray?: string[]
  frozenColumnsState?: Set<string>
  navigationState?: { searchTerm?: string }
  columnSearches?: Record<string, string>
  isColumnSearchActive?: Record<string, boolean>
  onColumnSearch?: (columnId: string, rowId: string, value: string) => void
  onClearColumnSearch?: (columnId: string) => void
  SearchHighlighter?: React.ComponentType<{ text: string; searchTerm: string }>
  InlineSearchCell?: React.ComponentType<any>
  isSelected?: boolean
  rowIndex?: number
  focusedCell?: { rowIndex: number; columnIndex: number } | null
  onCellFocus?: (rowIndex: number, columnIndex: number) => void
}

export function CellRenderer<TData>({
  cell,
  cellIndex,
  row,
  enableBacchaSearch = false,
  mainColumnsArray = [],
  frozenColumnsState = new Set(),
  navigationState = {},
  columnSearches = {},
  isColumnSearchActive = {},
  onColumnSearch,
  onClearColumnSearch,
  SearchHighlighter,
  InlineSearchCell,
  isSelected = false,
  rowIndex,
  focusedCell = null,
  onCellFocus
}: CellRendererProps<TData>) {
  const cellValue = cell.getValue()
  const cellString = String(cellValue ?? '').trim()

  // Simple and reliable badge detection
  // Check if the column cell renderer returns a Badge or BooleanCell
  const cellRenderer = cell.column.columnDef.cell
  const cellRendererString = cellRenderer?.toString() || ''

  // Check if cell uses Badge or BooleanCell components
  const isBadgeColumn =
    cellRendererString.includes('Badge') ||
    cellRendererString.includes('BooleanCell') ||
    cellRendererString.includes('rounded-full') ||
    cellRendererString.includes('inline-flex')

  // Check if cell value is a placeholder (dash, hyphen, empty indicator)
  // These should be center aligned like badges
  const isPlaceholderValue = cellString === '-' || cellString === '–' || cellString === '—' || cellString === 'N/A' || cellString === 'n/a' || cellString === ''

  // Excel-like alignment: Numbers RIGHT, Text/Strings LEFT, Placeholders CENTER
  // Only align RIGHT if the value is truly numeric (not mixed alphanumeric)
  const isNumericContent = (() => {
    // Type check - if JavaScript knows it's a number, align right
    if (typeof cellValue === 'number') return true

    // Empty or null values - treat as text (left align)
    if (!cellString || cellString === 'null' || cellString === 'undefined') return false

    // Pure number string (including decimals, negatives)
    // Matches: 123, -456, 12.5, 0.5, .5, 5.
    if (/^-?\d*\.?\d+$/.test(cellString)) return true

    // Formatted numbers with commas: 1,234 or 1,234.56
    if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(cellString)) return true

    // Percentages: 50%, 12.5%, -5%
    if (/^-?\d+\.?\d*%$/.test(cellString)) return true

    // Currency formats: $100, ₹1,234, €50.00, 100$, 1234₹
    if (/^[\$€£¥₹₽]\s?-?\d[\d,]*\.?\d*$/.test(cellString)) return true
    if (/^-?\d[\d,]*\.?\d*\s?[\$€£¥₹₽]$/.test(cellString)) return true

    // Dimensions: 437x420, 437 x 420, 10×20, 489.5×882.4, 95.5×915
    if (/^\d+\.?\d*\s*[xX×]\s*\d+\.?\d*$/.test(cellString)) return true

    // Parenthesized numbers (accounting negative): (100), (1,234.56)
    if (/^\(\d[\d,]*\.?\d*\)$/.test(cellString)) return true

    // Scientific notation: 1e5, 2.5E-10
    if (/^-?\d+\.?\d*[eE][+-]?\d+$/.test(cellString)) return true

    // Fractions: 1/2, 3/4
    if (/^\d+\/\d+$/.test(cellString)) return true

    // Everything else (strings, mixed content) - align LEFT
    return false
  })()

  const columnKey = cell.column.id || (cell.column.columnDef as any).accessorKey
  const isSelectColumn = (cell.column.columnDef.meta as any)?.isSelectColumn ||
    (cell.column.columnDef.meta as any)?.skipSearch ||
    cell.column.id === 'select' ||
    columnKey === 'select'
  const isMainColumn = enableBacchaSearch && !isSelectColumn && columnKey && mainColumnsArray.includes(columnKey)

  const isCellFrozen = frozenColumnsState.has(cell.column.id)
  const isPinnedRight = cell.column.getIsPinned() === 'right'
  const visibleCells = row.getVisibleCells()

  const isLastFrozenCell = isCellFrozen && (
    cellIndex === visibleCells.length - 1 ||
    !frozenColumnsState.has(visibleCells[cellIndex + 1]?.column.id)
  )

  const isFirstPinnedRightCell = isPinnedRight && (
    cellIndex === 0 ||
    visibleCells[cellIndex - 1]?.column.getIsPinned() !== 'right'
  )

  // Calculate left position for frozen cells
  let leftPosition = 0
  if (isCellFrozen) {
    for (let i = 0; i < cellIndex; i++) {
      const prevCell = visibleCells[i]
      if (frozenColumnsState.has(prevCell.column.id)) {
        leftPosition += prevCell.column.getSize()
      }
    }
  }

  // Calculate right position for right-pinned cells
  let rightPosition = 0
  if (isPinnedRight) {
    for (let i = cellIndex + 1; i < visibleCells.length; i++) {
      const nextCell = visibleCells[i]
      if (nextCell.column.getIsPinned() === 'right') {
        rightPosition += nextCell.column.getSize()
      }
    }
  }

  const rowId = (row.original as any).id || row.id
  const isFocused = rowIndex != null && focusedCell != null &&
    focusedCell.rowIndex === rowIndex && focusedCell.columnIndex === cellIndex

  return (
    <td
      key={cell.id}
      data-focused-cell={isFocused ? 'true' : undefined}
      onClick={() => { if (rowIndex != null) onCellFocus?.(rowIndex, cellIndex) }}
      className={`
        px-1 py-1 text-xs text-fg-default align-middle
        ${isBadgeColumn || isPlaceholderValue ? 'text-center' : isNumericContent ? 'text-right' : 'text-left'}
        ${isCellFrozen || isPinnedRight ? 'sticky z-[5]' : ''}
      `}
      style={{
        width: `${cell.column.getSize()}px`,
        minWidth: `${cell.column.getSize()}px`,
        // No maxWidth - allows user to drag columns wider than predefined width
        // Use box-shadow instead of border to prevent subpixel rendering issues at different zoom levels.
        // When keyboard-focused, an inset primary ring highlights the active cell.
        boxShadow: `inset 0 -1px 0 rgb(var(--bd-default))${isLastFrozenCell ? ', 2px 0 5px -2px rgba(0,0,0,0.1)' : ''}${isFirstPinnedRightCell ? ', -2px 0 5px -2px rgba(0,0,0,0.1)' : ''}`,
        // Containing block for the keyboard-focus ring overlay (spread below overrides to sticky for frozen cells).
        position: 'relative',
        ...(isCellFrozen && {
          position: 'sticky',
          left: `${leftPosition}px`,
          backgroundColor: isSelected
            ? 'color-mix(in srgb, rgb(var(--color-primary)) 8%, rgb(var(--bg-surface)))'
            : 'rgb(var(--bg-surface))',
          transform: 'translateZ(0)',
          willChange: 'transform',
        }),
        ...(isPinnedRight && {
          position: 'sticky',
          right: `${rightPosition}px`,
          backgroundColor: isSelected
            ? 'color-mix(in srgb, rgb(var(--color-primary)) 8%, rgb(var(--bg-surface)))'
            : 'rgb(var(--bg-surface))',
          transform: 'translateZ(0)',
          willChange: 'transform',
        })
      }}
    >
      <div className="relative" title={typeof cellValue === 'string' ? cellValue : undefined}>
        <div className="whitespace-nowrap overflow-hidden text-ellipsis">
          {/* Handle grouped cells */}
          {cell.getIsGrouped() ? (
            // This is a grouped cell - show expand/collapse toggle with group value
            <button
              onClick={(e) => {
                e.stopPropagation()
                row.getToggleExpandedHandler()()
              }}
              className="flex items-center gap-1 w-full text-left font-semibold text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-primary))]"
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}
              <span>{cellString}</span>
              <span className="ml-1 text-xs text-[rgb(var(--fg-muted))]">
                ({row.subRows?.length || 0})
              </span>
            </button>
          ) : cell.getIsAggregated() ? (
            // This is an aggregated cell - show aggregated value
            <span className="text-[rgb(var(--fg-muted))] italic">
              {flexRender(
                cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                cell.getContext()
              )}
            </span>
          ) : cell.getIsPlaceholder() ? null : (
            // Regular cell rendering
            <>
              {/* Baccha Search: Inline search for main columns */}
              {isMainColumn && InlineSearchCell ? (
                <InlineSearchCell
                  value={cellString}
                  columnId={columnKey}
                  rowId={rowId}
                  onSearch={onColumnSearch}
                  onClearSearch={onClearColumnSearch}
                  isSearchActive={isColumnSearchActive[columnKey] || false}
                  searchTerm={columnSearches[columnKey] || ''}
                  className="w-full"
                />
              ) : isSelectColumn ? (
                // Always render select column (checkbox/radio) normally, never apply search highlighting
                flexRender(cell.column.columnDef.cell, cell.getContext())
              ) : (
                // Regular cell content with search highlighting for global search.
                // IMPORTANT: columns with custom cell renderers (badges, buttons, formatted numbers)
                // must always use flexRender — highlighting the raw cellString would bypass
                // their JSX output and show raw backend values like "MarginApproved".
                navigationState.searchTerm && SearchHighlighter && !cellRenderer ? (
                  <SearchHighlighter
                    text={cellString}
                    searchTerm={navigationState.searchTerm}
                  />
                ) : (
                  flexRender(cell.column.columnDef.cell, cell.getContext())
                )
              )}
            </>
          )}
        </div>
      </div>
      {/* Keyboard-focus ring — an absolute overlay painted OVER any cell content (incl. validation-
          coloured bulk-import cells), so arrow-key navigation stays clearly visible. */}
      {isFocused && (
        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 2px rgb(var(--color-primary))', pointerEvents: 'none', zIndex: 2 }} />
      )}
    </td>
  )
}
