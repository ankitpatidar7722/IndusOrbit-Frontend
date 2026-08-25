'use client'

import React from 'react'
import { Table } from '@tanstack/react-table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'indas-ui'
import { Button } from 'indas-ui'
import { Pin, PinOff } from 'lucide-react'

interface ColumnChooserModalProps<TData> {
  isOpen: boolean
  onClose: () => void
  table: Table<TData>
  frozenColumnsState: Set<string>
  setFrozenColumnsState: (columns: Set<string>) => void
  enableColumnFreezing?: boolean
  autoResizeAllColumns?: (table: Table<TData>) => void
}

export function ColumnChooserModal<TData>({
  isOpen,
  onClose,
  table,
  frozenColumnsState,
  setFrozenColumnsState,
  enableColumnFreezing = false,
  autoResizeAllColumns
}: ColumnChooserModalProps<TData>) {
  const allColumns = table.getAllColumns().filter((column) => column.getCanHide())
  const frozenColumns = allColumns.filter((column) =>
    frozenColumnsState.has(column.id) && column.id !== 'select'
  )
  const availableColumns = allColumns.filter((column) =>
    !frozenColumnsState.has(column.id)
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Columns</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          <div className="space-y-1">
            {/* Bulk Actions Header */}
            <div className="px-3 py-2 border-b border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-subtle))] -mx-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[rgb(var(--fg-default))]">Column Management</span>
                <div className="flex items-center space-x-1">
                  {frozenColumns.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setFrozenColumnsState(new Set())}
                      aria-label="Unfreeze all columns"
                    >
                      Unfreeze All
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => autoResizeAllColumns?.(table)}
                    aria-label="Auto-size all columns to fit content"
                  >
                    Auto-size
                  </Button>
                </div>
              </div>
            </div>

            {/* Frozen Columns Section */}
            {enableColumnFreezing && frozenColumns.length > 0 && (
              <div className="px-2 py-2">
                <div className="text-xs font-medium text-[rgb(var(--fg-muted))] mb-1 px-2">
                  Frozen Columns
                </div>
                <div className="bg-[rgb(var(--color-primary-subtle)_/_0.1)] rounded-md p-1 space-y-0.5">
                  {frozenColumns.map((column) => (
                    <div
                      key={column.id}
                      className="flex items-center justify-between px-2 py-1.5 hover:bg-[rgb(var(--bg-hover))] rounded group"
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        <input
                          type="checkbox"
                          checked={column.getIsVisible()}
                          onChange={(e) => column.toggleVisibility(e.target.checked)}
                          className="w-3 h-3 rounded border-[rgb(var(--bd-default))] text-[rgb(var(--color-primary))]"
                        />
                        <span className="text-sm text-[rgb(var(--fg-default))] capitalize truncate">
                          {column.id}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-70 group-hover:opacity-100"
                        onClick={() => {
                          const newFrozen = new Set(frozenColumnsState)
                          newFrozen.delete(column.id)
                          setFrozenColumnsState(newFrozen)
                        }}
                        aria-label="Unfreeze this column"
                      >
                        <PinOff className="h-4 w-4 text-[rgb(var(--color-primary))]" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Columns Section */}
            {availableColumns.length > 0 && (
              <div className="px-2 py-2">
                {frozenColumns.length > 0 && (
                  <div className="text-xs font-medium text-[rgb(var(--fg-muted))] mb-1 px-2">
                    Available Columns
                  </div>
                )}
                <div className="space-y-0.5">
                  {availableColumns.map((column) => {
                    const isSelectColumn = column.id === 'select'
                    return (
                      <div
                        key={column.id}
                        className="flex items-center justify-between px-2 py-1.5 hover:bg-[rgb(var(--bg-hover))] rounded group"
                      >
                        <div className="flex items-center space-x-2 flex-1">
                          <input
                            type="checkbox"
                            checked={column.getIsVisible()}
                            onChange={(e) => column.toggleVisibility(e.target.checked)}
                            disabled={isSelectColumn}
                            className="w-3 h-3 rounded border-[rgb(var(--bd-default))] text-[rgb(var(--color-primary))]"
                          />
                          <span className="text-sm text-[rgb(var(--fg-default))] capitalize truncate">
                            {column.id}
                          </span>
                        </div>
                        {enableColumnFreezing && !isSelectColumn && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                            onClick={() => {
                              const newFrozen = new Set(frozenColumnsState)
                              newFrozen.add(column.id)
                              setFrozenColumnsState(newFrozen)
                            }}
                            aria-label="Freeze this column"
                          >
                            <Pin className="h-4 w-4 text-[rgb(var(--color-icon))]" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
