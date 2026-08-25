'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Row } from '@tanstack/react-table'
import { CellRenderer } from '../cells/CellRenderer'

interface DraggableRowProps<TData> {
  row: Row<TData>
  rowIndex: number
  enableBacchaSearch?: boolean
  mainColumnsArray?: string[]
  frozenColumnsState?: Set<string>
  isHighlighted?: boolean
  isSelected?: boolean
  onRowClick?: (e: React.MouseEvent) => void
  onRowDoubleClick?: () => void
  onRowContextMenu?: (e: React.MouseEvent) => void
  showDragHandle?: boolean
  // Search features
  navigationState?: { searchTerm?: string }
  columnSearches?: Record<string, string>
  isColumnSearchActive?: Record<string, boolean>
  onColumnSearch?: (columnId: string, rowId: string, value: string) => void
  onClearColumnSearch?: (columnId: string) => void
  SearchHighlighter?: React.ComponentType<{ text: string; searchTerm: string }>
  InlineSearchCell?: React.ComponentType<any>
}

export function DraggableRow<TData>({
  row,
  rowIndex,
  enableBacchaSearch = false,
  mainColumnsArray = [],
  frozenColumnsState = new Set(),
  isHighlighted = false,
  isSelected = false,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  showDragHandle = true,
  // Search features
  navigationState = {},
  columnSearches = {},
  isColumnSearchActive = {},
  onColumnSearch,
  onClearColumnSearch,
  SearchHighlighter,
  InlineSearchCell,
}: DraggableRowProps<TData>) {
  const rowId = (row.original as any).id || row.id

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: rowId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`
        cursor-pointer group
        transition-colors duration-150 ease-out
        ${isDragging ? 'shadow-lg z-50' : ''}
        ${isHighlighted
          ? 'border-2 border-[rgb(var(--color-primary))] bg-gradient-to-r from-[rgb(var(--color-primary))]/10 to-[rgb(var(--color-primary))]/20 shadow-lg relative'
          : isSelected
          ? 'bg-[color-mix(in_srgb,rgb(var(--color-primary))_8%,rgb(var(--bg-surface)))] shadow-sm hover:bg-[color-mix(in_srgb,rgb(var(--color-primary))_15%,rgb(var(--bg-surface)))]'
          : 'hover:bg-[color-mix(in_srgb,rgb(var(--color-primary))_5%,rgb(var(--bg-surface)))]'
        }
      `}
      onClick={onRowClick}
      onDoubleClick={onRowDoubleClick}
      onContextMenu={onRowContextMenu}
    >
      {/* Drag Handle Column — listeners scoped here so drag only activates from the handle */}
      {showDragHandle && (
        <td
          className="text-center align-middle cursor-grab active:cursor-grabbing"
          style={{ width: '1.875rem', minWidth: '1.875rem', maxWidth: '1.875rem' }}
          {...attributes}
          {...listeners}
        >
          <div className="w-full h-full flex items-center justify-center">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        </td>
      )}

      {/* Regular Cells */}
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
          onColumnSearch={onColumnSearch}
          onClearColumnSearch={onClearColumnSearch}
          SearchHighlighter={SearchHighlighter}
          InlineSearchCell={InlineSearchCell}
          isSelected={isSelected}
        />
      ))}
    </tr>
  )
}
