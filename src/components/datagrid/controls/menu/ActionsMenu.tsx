'use client'

import React from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from 'indas-ui'
import { Settings2 } from 'lucide-react'
import { ViewSection } from './view/ViewSection'
import { ExportSection } from './export/ExportSection'
import { ImportSection } from './import/ImportSection'
import { ColumnSection } from './column/ColumnSection'
import { FilterSection } from './filter/FilterSection'
import { GroupingSection } from './grouping/GroupingSection'
import type { Column } from '@tanstack/react-table'

interface ActionsMenuProps<TData> {
  // View options
  enableVisualization?: boolean
  currentView: 'grid' | 'chart' | 'cards'
  onViewChange: (view: 'grid' | 'chart' | 'cards') => void

  // Export/Import
  enableExport?: boolean
  enableImport?: boolean
  data: TData[]
  filename?: string
  onImportComplete: (data: TData[]) => void

  // Column management
  enableColumnVisibility?: boolean
  onOpenColumnChooser: () => void

  // Auto-resize
  enableAutoResize?: boolean
  onAutoResize?: () => void

  // Date filter
  enableDateFilter?: boolean
  dateFrom?: Date | null
  dateTo?: Date | null
  onDateFromChange?: (date: Date | null) => void
  onDateToChange?: (date: Date | null) => void

  // Advanced filter
  enableFiltering?: boolean
  onOpenAdvancedFilter: () => void
  activeFiltersCount?: number

  // Grouping
  enableGrouping?: boolean
  columns?: Column<TData, unknown>[]
  grouping?: string[]
  onGroupingChange?: (columnId: string) => void
  onClearGrouping?: () => void
}

export function ActionsMenu<TData>({
  enableVisualization = true,
  currentView,
  onViewChange,
  enableExport = true,
  enableImport = true,
  data,
  filename,
  onImportComplete,
  enableColumnVisibility = true,
  onOpenColumnChooser,
  enableAutoResize = true,
  onAutoResize,
  enableDateFilter = false,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  enableFiltering = true,
  onOpenAdvancedFilter,
  activeFiltersCount = 0,
  enableGrouping = false,
  columns = [],
  grouping = [],
  onGroupingChange,
  onClearGrouping
}: ActionsMenuProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 [&_[role=menuitem]]:cursor-pointer">
        {/* View Options */}
        {enableVisualization && (
          <ViewSection currentView={currentView} onViewChange={onViewChange} />
        )}

        {/* Export */}
        {enableExport && <ExportSection data={data} filename={filename} />}

        {/* Import */}
        {enableImport && <ImportSection onImport={onImportComplete} />}

        {/* Column Management & Auto-resize */}
        <ColumnSection
          enableColumnVisibility={enableColumnVisibility}
          onOpenColumnChooser={onOpenColumnChooser}
          enableAutoResize={enableAutoResize}
          onAutoResize={onAutoResize}
        />

        {/* Date Filter & Advanced Filters */}
        <FilterSection
          enableDateFilter={enableDateFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
          enableFiltering={enableFiltering}
          onOpenAdvancedFilter={onOpenAdvancedFilter}
          activeFiltersCount={activeFiltersCount}
        />

        {/* Grouping */}
        {enableGrouping && columns.length > 0 && onGroupingChange && onClearGrouping && (
          <GroupingSection
            columns={columns}
            grouping={grouping}
            onGroupingChange={onGroupingChange}
            onClearGrouping={onClearGrouping}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
