'use client'

import React from 'react'
import { Table } from '@tanstack/react-table'
import { SummaryConfig } from '../utils/grid-types'
import { calculateAllSummaries } from './summary'

interface SummaryRowProps<TData> {
  table: Table<TData>
  data: TData[]
  config: SummaryConfig<TData> | SummaryConfig<TData>[]
  enableRowSelection?: boolean
  showDragHandle?: boolean
}

export function SummaryRow<TData>({
  table,
  data,
  config,
  enableRowSelection = false,
  showDragHandle = false
}: SummaryRowProps<TData>) {
  const visibleColumns = table.getVisibleLeafColumns()

  // Support both single config and array of configs
  const configs = Array.isArray(config) ? config : [config]

  return (
    <tfoot className="sticky bottom-0 z-10 bg-[rgb(var(--bg-surface))]">
      {configs.map((cfg, configIndex) => {
        // Calculate summary values for this row
        const summaries = calculateAllSummaries(data, cfg.columns)

        return (
          <tr
            key={configIndex}
            className={`${configIndex > 0 ? 'border-t border-[rgb(var(--bd-default))]' : ''} ${cfg.className || 'bg-[rgb(var(--bg-muted))] font-semibold'} [text-decoration:none]`}
            style={{...cfg.style, textDecoration: 'none'}}
          >
            {/* Drag handle cell when row reordering is active */}
            {showDragHandle && (
              <td
                className="text-center"
                style={{ width: '1.875rem', minWidth: '1.875rem', maxWidth: '1.875rem' }}
              >
              </td>
            )}

            {/* Render cells for all visible columns */}
            {visibleColumns.map((column, index) => {
              const columnKey = column.id
              const summaryConfig = cfg.columns[columnKey]
              const columnSize = column.getSize()

              // If this column has no summary, render empty cell
              if (!summaryConfig) {
                return (
                  <td
                    key={columnKey}
                    className="px-2 py-1 text-xs"
                    style={{ width: `${columnSize}px`, maxWidth: `${columnSize}px` }}
                    suppressHydrationWarning
                  >
                  </td>
                )
              }

              // Get calculated value
              const value = summaries[columnKey]

              return (
                <td
                  key={columnKey}
                  className={`px-2 py-1 text-xs ${summaryConfig.className || 'text-right'} [text-decoration:none]`}
                  style={{ width: `${columnSize}px`, maxWidth: `${columnSize}px`, textDecoration: 'none' }}
                  suppressHydrationWarning
                >
                  <div
                    className="line-clamp-2 [text-decoration:none]"
                    style={{
                      textDecoration: 'none',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      wordBreak: 'break-word'
                    }}
                  >
                    {summaryConfig.label && (
                      <span className="mr-1 [text-decoration:none]" style={{ textDecoration: 'none' }}>{summaryConfig.label}</span>
                    )}
                    <span className="font-bold text-[rgb(var(--color-primary))] [text-decoration:none]" style={{ textDecoration: 'none' }}>
                      {value}
                    </span>
                  </div>
                </td>
              )
            })}
          </tr>
        )
      })}
    </tfoot>
  )
}
