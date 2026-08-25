'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Table, Header } from '@tanstack/react-table'
import { Search, X, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterRowProps<TData> {
  table: Table<TData>
  frozenColumnsState: Set<string>
  isRowReorderingActive: boolean
  onColumnFilterChange?: () => void
}

// Extract the display value from a filter value (which could be a string or an object from context menu/advanced filter)
function extractFilterDisplayValue(filterValue: any): string {
  if (!filterValue) return ''
  if (typeof filterValue === 'string') return filterValue
  if (typeof filterValue === 'object' && filterValue.value !== undefined) {
    // Handle array values (from "in" filter) - show comma separated
    if (Array.isArray(filterValue.value)) return filterValue.value.join(', ')
    return String(filterValue.value)
  }
  return ''
}

// Debounce hook for filter inputs
function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  ) as T

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

// Detect if column is a date column based on id, accessorKey, or meta
function isDateColumn<TData>(header: Header<TData, unknown>): boolean {
  const columnId = header.column.id.toLowerCase()
  const accessorKey = ((header.column.columnDef as any).accessorKey || '').toLowerCase()
  const meta = header.column.columnDef.meta as any

  // Check meta first (most reliable)
  if (meta?.filterType === 'date') return true
  if (meta?.type === 'date') return true

  // Check column ID/accessor for date-related names (be specific to avoid false positives)
  const dateKeywords = ['date', 'createdat', 'updatedat', 'timestamp', 'datetime']
  return dateKeywords.some(keyword =>
    columnId.includes(keyword) || accessorKey.includes(keyword)
  )
}

// Detect if column is a number column
function isNumberColumn<TData>(header: Header<TData, unknown>): boolean {
  const meta = header.column.columnDef.meta as any

  // Check meta first
  if (meta?.filterType === 'number') return true
  if (meta?.type === 'number') return true

  return false
}

// Check if column should skip filtering (select columns, action columns)
function shouldSkipFilter<TData>(header: Header<TData, unknown>): boolean {
  const meta = header.column.columnDef.meta as any
  const columnId = header.column.id.toLowerCase()

  // Skip select/checkbox columns
  if (meta?.isSelectColumn || meta?.skipSearch || columnId === 'select') return true

  // Skip action columns
  if (columnId === 'actions' || meta?.isActionColumn) return true

  // Skip expand toggle columns
  if (columnId === 'expand' || meta?.isExpandColumn) return true

  return false
}

interface FilterCellProps<TData> {
  header: Header<TData, unknown>
  isFrozen: boolean
  isPinnedRight: boolean
  leftPosition: number
  rightPosition: number
  isLastFrozen: boolean
  isFirstPinnedRight: boolean
  isLastColumn: boolean
  onColumnFilterChange?: () => void
}

function FilterCell<TData>({
  header,
  isFrozen,
  isPinnedRight,
  leftPosition,
  rightPosition,
  isLastFrozen,
  isFirstPinnedRight,
  isLastColumn,
  onColumnFilterChange
}: FilterCellProps<TData>) {
  const [localValue, setLocalValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Get current filter value from table (could be string or object from context menu)
  const currentFilterValue = header.column.getFilterValue()

  // Sync local value with table filter value - extract display string from any format
  useEffect(() => {
    setLocalValue(extractFilterDisplayValue(currentFilterValue))
  }, [currentFilterValue])

  // Debounced filter update
  const debouncedSetFilter = useDebouncedCallback(
    (value: string) => {
      header.column.setFilterValue(value || undefined)
      onColumnFilterChange?.()
    },
    300
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalValue(value)
    debouncedSetFilter(value)
  }

  const handleClear = () => {
    setLocalValue('')
    header.column.setFilterValue(undefined)
    inputRef.current?.focus()
  }

  const skipFilter = shouldSkipFilter(header)
  const isDate = !skipFilter && isDateColumn(header)
  const isNumber = !skipFilter && isNumberColumn(header)

  // Build box-shadow for consistent rendering (no vertical separators in filter row)
  const cellBoxShadow = [
    'inset 0 -1px 0 rgb(var(--bd-default))', // Bottom border only
    ...(isLastFrozen ? ['2px 0 5px -2px rgba(0,0,0,0.1)'] : []),
    ...(isFirstPinnedRight ? ['-2px 0 5px -2px rgba(0,0,0,0.1)'] : [])
  ].join(', ')

  return (
    <th
      style={{
        width: `${header.getSize()}px`,
        minWidth: `${header.getSize()}px`,
        height: '2rem',
        position: 'relative',
        boxShadow: cellBoxShadow,
        ...(isFrozen && {
          position: 'sticky',
          left: `${leftPosition}px`,
          zIndex: 11,
          backgroundColor: 'rgb(var(--bg-surface))',
          transform: 'translateZ(0)',
          willChange: 'transform'
        }),
        ...(isPinnedRight && {
          position: 'sticky',
          right: `${rightPosition}px`,
          zIndex: 12,
          backgroundColor: 'rgb(var(--bg-surface))',
          transform: 'translateZ(0)',
          willChange: 'transform'
        })
      }}
      className={cn(
        'px-1 text-left align-middle',
        'bg-white',
        'dark:bg-[rgb(var(--bg-surface))]'
      )}
    >
      {skipFilter ? (
        // Empty cell for select/action columns
        <div className="h-full" />
      ) : (
        <div className="relative flex items-center h-full">
          {/* Search Icon */}
          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
            {isDate ? (
              <Calendar className="h-3 w-3 text-[rgb(var(--color-icon))]" />
            ) : (
              <Search className="h-3 w-3 text-[rgb(var(--color-icon))]" />
            )}
          </div>

          {/* Filter Input */}
          <input
            ref={inputRef}
            type={isNumber ? 'number' : 'text'}
            value={localValue}
            onChange={handleChange}
            placeholder=""
            className={cn(
              'w-full h-6 pl-6 pr-5 text-xs',
              'bg-[rgb(var(--bg-surface))] rounded',
              'focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))] focus:border-[rgb(var(--color-primary))]',
              'placeholder:text-[rgb(var(--fg-muted))]',
              'text-[rgb(var(--fg-default))]',
              // Highlight active filter
              localValue
                ? 'border-2 border-[rgb(var(--color-primary))] bg-[color-mix(in_srgb,rgb(var(--color-primary))_5%,rgb(var(--bg-surface)))]'
                : 'border border-[rgb(var(--bd-default))]'
            )}
          />

          {/* Clear Button */}
          {localValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:bg-[rgb(var(--bg-hover))] rounded transition-colors"
            >
              <X className="h-3 w-3 text-[rgb(var(--color-icon))]" />
            </button>
          )}
        </div>
      )}
    </th>
  )
}

export function FilterRow<TData>({
  table,
  frozenColumnsState,
  isRowReorderingActive,
  onColumnFilterChange
}: FilterRowProps<TData>) {
  const headerGroups = table.getHeaderGroups()

  // Get the last header group (bottom-most headers in case of grouped headers)
  const headerGroup = headerGroups[headerGroups.length - 1]
  if (!headerGroup) return null

  return (
    <tr className="border-t border-b border-[rgb(var(--bd-default))] bg-white dark:bg-[rgb(var(--bg-surface))]">
      {/* Drag Handle Column Placeholder */}
      {isRowReorderingActive && (
        <th
          style={{
            width: '1.875rem',
            minWidth: '1.875rem',
            maxWidth: '1.875rem',
            height: '2rem'
          }}
          className="bg-white dark:bg-[rgb(var(--bg-surface))]"
        />
      )}

      {/* Filter Cells */}
      {headerGroup.headers.map((header, headerIndex) => {
        const isFrozen = frozenColumnsState.has(header.id)
        const isPinnedRight = header.column.getIsPinned() === 'right'
        const isLastColumn = headerIndex === headerGroup.headers.length - 1

        // Check if this is the last frozen column
        const isLastFrozen = isFrozen && (
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
          <FilterCell
            key={header.id}
            header={header}
            isFrozen={isFrozen}
            isPinnedRight={isPinnedRight}
            leftPosition={leftPosition}
            rightPosition={rightPosition}
            isLastFrozen={isLastFrozen}
            isFirstPinnedRight={isFirstPinnedRight}
            isLastColumn={isLastColumn}
            onColumnFilterChange={onColumnFilterChange}
          />
        )
      })}
    </tr>
  )
}
