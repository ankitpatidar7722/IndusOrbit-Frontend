'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { flexRender, Header } from '@tanstack/react-table'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical, Plus, RefreshCw, ListFilter } from 'lucide-react'

import { Button } from 'indas-ui'
import { cn } from '@/lib/utils'

interface DraggableColumnHeaderProps<TData> {
  header: Header<TData, unknown>
  enableReordering?: boolean
  enableResizing?: boolean
  enableFreezing?: boolean
  enableGrouping?: boolean
  isGrouped?: boolean
  isFrozen?: boolean
  isLastFrozen?: boolean
  isFirstPinnedRight?: boolean
  isLastColumn?: boolean
  onRightClick?: (header: Header<TData, unknown>, event: React.MouseEvent) => void
  onFilterClick?: (header: Header<TData, unknown>, event: React.MouseEvent) => void
  style?: React.CSSProperties
}

export function DraggableColumnHeader<TData>({
  header,
  enableReordering = true,
  enableResizing = true,
  enableFreezing = true,
  enableGrouping = false,
  isGrouped = false,
  isFrozen = false,
  isLastFrozen = false,
  isFirstPinnedRight = false,
  isLastColumn = false,
  onRightClick,
  onFilterClick,
  style,
}: DraggableColumnHeaderProps<TData>) {
  // Prevent hydration mismatch by using client-side only rendering for dynamic widths
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Check if this is a utility column (select, expand) — no drag/sort/resize
  const isSelectColumn = (header.column.columnDef.meta as any)?.isSelectColumn ||
    (header.column.columnDef.meta as any)?.skipSearch ||
    header.column.id === 'select' ||
    header.column.id === 'expand'

  // Check for header actions in column meta
  const headerActions = (header.column.columnDef.meta as any)?.headerActions

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: header.column.id,
    disabled: !enableReordering || isSelectColumn, // Disable dragging for select columns
  })

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const sortDirection = header.column.getIsSorted()

  // Render select column differently - no drag/sort features
  if (isSelectColumn) {
    // Background gradient for shortened vertical separator (only if not last column)
    const selectSeparatorGradient = !isLastColumn
      ? 'linear-gradient(to bottom, transparent 0%, transparent 20%, rgb(var(--bd-medium)) 20%, rgb(var(--bd-medium)) 80%, transparent 80%, transparent 100%)'
      : undefined

    return (
      <th
        style={{
          width: `${header.getSize()}px`,
          height: '2.75rem', // Fixed height matching regular columns
          position: 'relative',
          // Bottom border only
          boxShadow: 'inset 0 -1px 0 rgb(var(--bd-default))',
          // Shortened vertical separator via background gradient
          backgroundImage: selectSeparatorGradient,
          backgroundPosition: 'right',
          backgroundSize: '1px 100%',
          backgroundRepeat: 'no-repeat',
        }}
        className="relative select-none px-1 py-2 text-center text-xs font-medium text-[rgb(var(--fg-default))] overflow-hidden align-middle"
      >
        <div className="flex items-center justify-center w-full h-full">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </div>
      </th>
    )
  }

  // Build box-shadow for consistent rendering across zoom levels
  const headerBoxShadow = [
    // Bottom border
    'inset 0 -1px 0 rgb(var(--bd-default))',
    // Left shadow for first pinned right column
    ...(isFirstPinnedRight ? ['-2px 0 5px -2px rgba(0,0,0,0.1)'] : [])
  ].join(', ')

  // Background gradient for shortened vertical separator (only if not last column)
  const separatorGradient = !isLastColumn
    ? 'linear-gradient(to bottom, transparent 0%, transparent 20%, rgb(var(--bd-medium)) 20%, rgb(var(--bd-medium)) 80%, transparent 80%, transparent 100%)'
    : undefined

  // Handle HTML5 drag start for grouping
  const handleDragStart = (e: React.DragEvent) => {
    if (enableGrouping) {
      e.dataTransfer.setData('text/plain', header.column.id)
      e.dataTransfer.effectAllowed = 'copy'
    }
  }

  return (
    <th
      ref={setNodeRef}
      style={{
        width: isClient ? `${header.getSize()}px` : '120px', // Use default width during SSR
        height: '2.75rem', // Fixed height for consistency (44px = 2 lines + reduced padding)
        position: 'relative',
        boxShadow: headerBoxShadow,
        backgroundImage: separatorGradient,
        backgroundPosition: 'right',
        backgroundSize: '1px 100%',
        backgroundRepeat: 'no-repeat',
        ...dragStyle, // Apply drag styles for transform/transition
        ...style, // Apply custom styles last to allow overriding
      }}
      className={cn(
        'relative select-none px-1 py-1 text-center text-xs font-medium text-[rgb(var(--fg-default))] overflow-hidden align-top',
        isDragging && 'opacity-50 z-50',
        header.column.getCanSort() && 'cursor-pointer',
        enableReordering && 'group',
        isGrouped && 'bg-[rgb(var(--color-primary))]/5 border-b-2 border-[rgb(var(--color-primary))]'
      )}
      draggable={enableGrouping}
      onDragStart={handleDragStart}
      onContextMenu={(e) => {
        e.preventDefault()
        onRightClick?.(header, e)
      }}
    >
      <div className="flex items-center justify-between h-full">
        <div className="flex items-center space-x-1 flex-1 min-w-0 relative">
          {/* Column Header Content - clickable for sorting */}
          <div
            className="flex-1 min-w-0 cursor-pointer relative"
            onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
            title={typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : undefined}
            style={{
              maxHeight: '2.25rem', // ~2 lines with reduced spacing
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: '1.125rem', // Tighter line height for more compact text
              wordBreak: 'break-word',
              textOverflow: 'ellipsis'
            }}
          >
            {header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext())}

            {/* Drag Handle - Overlays on top left of text (Google Sheets style) */}
            {enableReordering && (
              <div
                {...(attributes && { ...attributes, 'aria-describedby': undefined })}
                {...listeners}
                className="absolute top-0 left-0 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 bg-white/90 hover:bg-[rgb(var(--color-primary))]/10 border border-[rgb(var(--bd-default))] hover:border-[rgb(var(--color-primary))] rounded shadow-sm hover:shadow-md transition-all duration-200 z-10 sm:block hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-3 w-3 text-[rgb(var(--color-icon))]" />
              </div>
            )}

            {/* Filter Icon - Overlays on top right of text (Google Sheets style) */}
            {onFilterClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onFilterClick(header, e)
                }}
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 bg-white/90 hover:bg-[rgb(var(--color-primary))]/10 border border-[rgb(var(--bd-default))] hover:border-[rgb(var(--color-primary))] rounded shadow-sm hover:shadow-md transition-all duration-200 z-10 sm:block hidden"
                tabIndex={-1}
              >
                <ListFilter className="h-3 w-3 text-[rgb(var(--color-icon))]" />
              </button>
            )}
          </div>

          {/* Header Action Buttons - Add/Refresh */}
          {headerActions && (
            <div className="flex items-center gap-1 ml-1 flex-shrink-0">
              {headerActions.onAdd && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    headerActions.onAdd()
                  }}
                  className="p-0.5 hover:bg-[rgb(var(--bg-hover))] rounded transition-colors"
                  tabIndex={-1}
                >
                  <Plus className="h-3.5 w-3.5 text-[rgb(var(--color-icon))]" />
                </button>
              )}
              {headerActions.onRefresh && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    headerActions.onRefresh()
                  }}
                  className="p-0.5 hover:bg-[rgb(var(--bg-hover))] rounded transition-colors"
                  tabIndex={-1}
                >
                  <RefreshCw className="h-3.5 w-3.5 text-[rgb(var(--color-icon))]" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sort indicator - right side, shows when sorted */}
        {header.column.getCanSort() && sortDirection && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 ml-1"
          >
            {sortDirection === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-[rgb(var(--color-primary))]" />
            ) : (
              <ArrowDown className="h-3 w-3 text-[rgb(var(--color-primary))]" />
            )}
          </motion.div>
        )}
      </div>

      {/* Column Resizer */}
      {enableResizing && header.column.getCanResize() && (
        <div
          className={cn(
            'absolute -right-1 top-0 w-3 h-full select-none touch-none z-30 flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-all duration-200',
            header.column.getIsResizing() && 'opacity-100'
          )}
          style={{
            cursor: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect x=\'7\' y=\'2\' width=\'2\' height=\'12\' rx=\'1\' fill=\'%231f2937\'/%3E%3Cpath d=\'M4 8l2-2v4l-2-2zm8 0l-2-2v4l2-2z\' fill=\'%231f2937\'/%3E%3C/svg%3E") 8 8, col-resize'
          }}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // Toggle between original width and max content width (like Excel/Google Sheets)
            const currentSize = header.column.getSize()
            const originalSize = header.column.columnDef.size || 150 // Original/optimal width from intelligent sizing

            // Calculate max content width by measuring actual cell content
            const table = header.getContext().table
            const rows = table.getRowModel().rows
            const columnId = header.column.id

            // Measure max content width from all visible cells
            let maxContentWidth = originalSize
            rows.forEach(row => {
              const cell = row.getAllCells().find(c => c.column.id === columnId)
              if (cell) {
                const value = cell.getValue()
                if (value !== null && value !== undefined) {
                  // Estimate width: ~7px per character + padding
                  const textLength = String(value).length
                  const estimatedWidth = (textLength * 7) + 24 // 24px for padding
                  maxContentWidth = Math.max(maxContentWidth, estimatedWidth)
                }
              }
            })

            // Cap at reasonable maximum
            maxContentWidth = Math.min(maxContentWidth, 800)

            // If close to original, expand to max content; otherwise collapse to original
            const isAtOriginal = Math.abs(currentSize - originalSize) < 30 // 30px tolerance

            if (isAtOriginal) {
              // Expand to maximum content width
              table.setColumnSizing((prev) => ({
                ...prev,
                [columnId]: maxContentWidth
              }))
            } else {
              // Collapse to original/default width
              header.column.resetSize()
            }
          }}
        >
          <div
            className={cn(
              'w-1 h-full rounded-sm transition-all duration-200 shadow-sm',
              'bg-[rgb(var(--bd-medium))]',
              'hover:bg-[rgb(var(--bd-strong))] hover:shadow-md',
              header.column.getIsResizing() && 'bg-[rgb(var(--color-primary))] shadow-lg scale-110'
            )}
          />
        </div>
      )}

      {/* Sorting Indicator */}
      {sortDirection && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-0 left-0 h-0.5 bg-[rgb(var(--color-primary))]"
        />
      )}
    </th>
  )
}