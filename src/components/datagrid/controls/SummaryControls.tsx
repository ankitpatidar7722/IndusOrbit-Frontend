'use client'

import React from 'react'
import { Table } from '@tanstack/react-table'
import { SummaryConfig, ColumnSummary } from '../utils/grid-types'
import { calculateAllSummaries } from '../rows/summary'

interface SummaryControlsProps<TData> {
  table: Table<TData>
  data: TData[]
  config: SummaryConfig<TData>
}

export function SummaryControls<TData>({
  table,
  data,
  config
}: SummaryControlsProps<TData>) {
  if (!config || !config.columns || Object.keys(config.columns).length === 0) {
    return null
  }

  // Calculate summary values
  const summaries = calculateAllSummaries(data, config.columns)
  const visibleColumns = table.getVisibleLeafColumns()

  // Get columns that have summary config
  const summaryEntries = Object.entries(config.columns).filter(([columnKey]) => {
    // Check if the column is visible
    return visibleColumns.some(col => col.id === columnKey)
  })

  if (summaryEntries.length === 0) {
    return null
  }

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-[rgb(var(--bg-subtle))] border-t border-[rgb(var(--bd-default))] gap-4 flex-wrap">
      {/* Summary Items */}
      <div className="flex items-center gap-6 flex-wrap">
        {summaryEntries.map(([columnKey, columnConfig]) => {
          const value = summaries[columnKey]
          const summaryConfig = columnConfig as ColumnSummary<TData>

          // Find column header name
          const column = visibleColumns.find(col => col.id === columnKey)
          const columnName = column?.columnDef.header as string || columnKey

          return (
            <div key={columnKey} className="flex items-center gap-1.5 text-sm">
              {summaryConfig.label ? (
                <span className="text-[rgb(var(--fg-muted))]">{summaryConfig.label}</span>
              ) : (
                <span className="text-[rgb(var(--fg-muted))]">{columnName}:</span>
              )}
              <span className="font-semibold text-[rgb(var(--color-primary))]">
                {value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
