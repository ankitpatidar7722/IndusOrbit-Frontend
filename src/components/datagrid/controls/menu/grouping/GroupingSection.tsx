'use client'

import React from 'react'
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from 'indas-ui'
import { Layers, X } from 'lucide-react'
import type { Column } from '@tanstack/react-table'

interface GroupingSectionProps<TData> {
  columns: Column<TData, unknown>[]
  grouping: string[]
  onGroupingChange: (columnId: string) => void
  onClearGrouping: () => void
}

export function GroupingSection<TData>({
  columns,
  grouping,
  onGroupingChange,
  onClearGrouping,
}: GroupingSectionProps<TData>) {
  // Filter columns that can be grouped (exclude select, actions, etc.)
  const groupableColumns = columns.filter(
    (col) =>
      col.id !== 'select' &&
      col.id !== 'actions' &&
      col.id !== 'expand' &&
      col.getCanGroup?.() !== false
  )

  if (groupableColumns.length === 0) return null

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="cursor-pointer">
          <Layers className="mr-2 h-4 w-4" />
          <span>Group By</span>
          {grouping.length > 0 && (
            <span className="ml-auto text-xs bg-[rgb(var(--color-primary))] text-white px-1.5 py-0.5 rounded">
              {grouping.length}
            </span>
          )}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-48">
          {groupableColumns.map((column) => {
            const isGrouped = grouping.includes(column.id)
            const header = typeof column.columnDef.header === 'string'
              ? column.columnDef.header
              : column.id

            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={isGrouped}
                onCheckedChange={() => onGroupingChange(column.id)}
                className="cursor-pointer"
              >
                {header}
              </DropdownMenuCheckboxItem>
            )
          })}

          {grouping.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onClearGrouping}
                className="cursor-pointer text-[rgb(var(--color-danger))]"
              >
                <X className="mr-2 h-4 w-4" />
                Clear Grouping
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}
