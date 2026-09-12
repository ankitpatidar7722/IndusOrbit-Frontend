'use client'

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Input } from 'indas-ui'
import { Dropdown } from 'indas-ui'
import { cn } from '@/lib/utils'

export interface EditableCellProps {
  value: any
  rowId?: string // Optional for backward compatibility with cost table
  columnId?: string // Optional for backward compatibility with cost table
  onSave: ((rowId: string, columnId: string, newValue: any) => void) | ((newValue: any) => void) // Support both signatures
  onCancel?: () => void
  onNavigate?: (direction: 'next' | 'previous') => void
  editable?: boolean
  type?: 'text' | 'number' | 'date' | 'email' | 'dropdown'
  options?: Array<{ label: string; value: any }> // For dropdown type
  className?: string
  formatDisplay?: (value: number) => string // For cost table formatting
  currencySymbol?: string // For cost table
  // Edit tracking props
  trackEdits?: boolean // Enable edit tracking and highlighting
  originalValue?: any // Original value from database/API (for comparison)
  isEdited?: boolean // External control: mark as edited (overrides internal tracking)
}

export function EditableCell({
  value,
  rowId,
  columnId,
  onSave,
  onCancel,
  onNavigate,
  editable = true,
  type = 'number',
  options = [],
  className = '',
  formatDisplay = (val: number) => val.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
  currencySymbol = '',
  trackEdits = false,
  originalValue,
  isEdited: externalIsEdited
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value?.toString() || '')
  const [hasBeenEdited, setHasBeenEdited] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const savedRef = useRef(false) // Guard against double-save (Enter + blur)

  // Determine if field is edited
  const isEdited = React.useMemo(() => {
    // If external control is provided, use that
    if (externalIsEdited !== undefined) return externalIsEdited

    // If tracking is enabled and we have an original value
    if (trackEdits && originalValue !== undefined) {
      // Compare values (handle type conversion)
      return String(value) !== String(originalValue) || hasBeenEdited
    }

    return hasBeenEdited
  }, [trackEdits, originalValue, value, externalIsEdited, hasBeenEdited])

  // Update editValue when value prop changes (for cost table compatibility)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value?.toString() || '')
    }
  }, [value, isEditing])

  // Focus input/select when editing starts
  useEffect(() => {
    if (isEditing) {
      if (type === 'dropdown' && selectRef.current) {
        selectRef.current.focus()
      } else if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }
  }, [isEditing, type])

  const handleDoubleClick = () => {
    if (editable) {
      setEditValue(value?.toString() || '')
      savedRef.current = false
      setIsEditing(true)
    }
  }

  const handleSave = () => {
    // Prevent double-save: Enter sets isEditing=false → input unmounts → blur fires → save called again with stale value
    if (savedRef.current) return
    savedRef.current = true

    const processedValue = type === 'number' ? (parseFloat(editValue) || 0) : editValue

    // Mark as edited if value changed
    if (trackEdits && String(processedValue) !== String(value)) {
      setHasBeenEdited(true)
    }

    // Support both callback signatures (cost table vs DataGrid)
    if (rowId !== undefined && columnId !== undefined) {
      // DataGrid signature
      (onSave as (rowId: string, columnId: string, newValue: any) => void)(rowId, columnId, processedValue)
    } else {
      // Cost table signature
      (onSave as (newValue: any) => void)(processedValue)
    }

    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value?.toString() || '')
    setIsEditing(false)
    onCancel?.()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
      // Move to next cell on Enter (DataGrid feature)
      onNavigate?.('next')
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      handleSave()
      // Move to next/previous cell on Tab (DataGrid feature)
      if (e.shiftKey) {
        onNavigate?.('previous')
      } else {
        onNavigate?.('next')
      }
    }
  }

  const handleBlur = () => {
    // Save on blur
    handleSave()
  }

  if (!editable) {
    // Cost table format with currency
    if (type === 'number' && currencySymbol) {
      return <span className={className}>{currencySymbol}{formatDisplay(Number(value))}</span>
    }
    return <span className={className}>{value}</span>
  }

  if (isEditing) {
    return (
      <div
        className="flex items-center gap-1 w-full"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {type === 'dropdown' ? (
          <Dropdown
            options={options}
            value={editValue}
            onValueChange={(val) => {
              setEditValue(val as string)
              // Auto-save on selection
              const processedValue = val
              if (rowId !== undefined && columnId !== undefined) {
                (onSave as (rowId: string, columnId: string, newValue: any) => void)(rowId, columnId, processedValue)
              } else {
                (onSave as (newValue: any) => void)(processedValue)
              }
              setIsEditing(false)
            }}
            placeholder="Select..."
            searchable={true}
            className="w-full"
          />
        ) : (
          <Input
            ref={inputRef}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="w-full h-9 text-sm px-2"
            step={type === 'number' ? '0.01' : undefined}
          />
        )}
      </div>
    )
  }

  // Get display value
  let displayValue: string
  if (type === 'dropdown' && options.length > 0) {
    displayValue = options.find(opt => opt.value === value)?.label || value
  } else if (type === 'number' && currencySymbol) {
    // Cost table format with currency
    displayValue = `${currencySymbol}${formatDisplay(Number(value))}`
  } else {
    displayValue = value
  }

  // Native `title` hint instead of a floating-ui Tooltip: at bulk-import scale (thousands of editable
  // cells) a Tooltip per cell made every click/focus re-render janky. A title attribute is free.
  return (
    <div
      onDoubleClick={handleDoubleClick}
      title={isEdited ? "Manually edited \u2014 double-click to edit" : "Double-click to edit"}
      className={cn(
        'cursor-pointer px-2 py-0.5 rounded transition-colors h-6',
        isEdited
          ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-400 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-950/40'
          : 'hover:bg-[rgb(var(--color-primary-subtle))]',
        type === 'number' ? 'text-right' : '',
        className
      )}
      data-editable-cell="true"
      data-is-edited={isEdited}
    >
      {displayValue || '\u00A0'}
    </div>
  )
}

// Alias for backward compatibility with cost table
export const EditableTableCell = EditableCell

// Hook for managing cell editing state
export function useCellEditing<TData>() {
  const [editingCell, setEditingCell] = useState<{
    rowId: string
    columnId: string
  } | null>(null)

  const [data, setData] = useState<TData[]>([])

  const handleCellSave = (rowId: string, columnId: string, newValue: any) => {
    setData((prevData) =>
      prevData.map((row: any) => {
        if (row.id === rowId || prevData.indexOf(row).toString() === rowId) {
          return {
            ...row,
            [columnId]: newValue
          }
        }
        return row
      })
    )
    setEditingCell(null)
  }

  const handleCellCancel = () => {
    setEditingCell(null)
  }

  const startEditing = (rowId: string, columnId: string) => {
    setEditingCell({ rowId, columnId })
  }

  const isEditing = (rowId: string, columnId: string) => {
    return (
      editingCell?.rowId === rowId && editingCell?.columnId === columnId
    )
  }

  return {
    data,
    setData,
    editingCell,
    startEditing,
    isEditing,
    handleCellSave,
    handleCellCancel
  }
}
