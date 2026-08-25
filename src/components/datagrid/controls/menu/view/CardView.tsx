'use client'

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ColumnDef } from '@tanstack/react-table'
import { LayoutGrid } from 'lucide-react'

import { Badge } from 'indas-ui'
import { SelectionCheckbox } from '@/components/datagrid/cells/SelectionCell'
import { Skeleton } from 'indas-ui'
import { useLanguage } from 'indas-ui'

export type CardSize = 'compact' | 'normal' | 'expanded'

interface CardViewProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  onRowClick?: (item: TData) => void
  selectedRows: TData[]
  onRowSelect?: (item: TData, selected: boolean) => void
  isLoading?: boolean
  cardSize?: CardSize
  circularCheckboxes?: boolean
}

const sizeConfig = {
  compact: {
    grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    gap: 'gap-2.5',
    pad: 'p-2.5',
    fields: 5,
    titleText: 'text-sm',
    subtitleText: 'text-xs',
    valueText: 'text-xs',
  },
  normal: {
    grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    gap: 'gap-3',
    pad: 'p-3',
    fields: 6,
    titleText: 'text-sm',
    subtitleText: 'text-xs',
    valueText: 'text-xs',
  },
  expanded: {
    grid: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    gap: 'gap-4',
    pad: 'p-4',
    fields: 8,
    titleText: 'text-base',
    subtitleText: 'text-sm',
    valueText: 'text-sm',
  },
}

function CardSkeleton({ size = 'normal' }: { size?: CardSize }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] overflow-hidden">
      <div className="p-3.5 space-y-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <div className="space-y-2 pt-1.5 border-t border-[rgb(var(--bd-default))]/30">
          {Array.from({ length: size === 'expanded' ? 4 : 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-3 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CardView<TData>({
  data,
  columns,
  onRowClick,
  selectedRows,
  onRowSelect,
  isLoading = false,
  cardSize = 'normal',
  circularCheckboxes = false,
}: CardViewProps<TData>) {
  const { t } = useLanguage()
  const cfg = sizeConfig[cardSize]
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  const isSelected = useCallback((item: TData) => {
    return selectedRows.some(selected => (selected as any).id === (item as any).id)
  }, [selectedRows])

  const handleCardClick = useCallback((item: TData) => {
    onRowClick?.(item)
  }, [onRowClick])

  const handleCheckboxChange = useCallback((item: TData, checked: boolean) => {
    onRowSelect?.(item, checked)
  }, [onRowSelect])

  // Keyboard navigation
  const getGridColumns = useCallback(() => {
    if (typeof window === 'undefined') return 4
    const w = window.innerWidth
    if (cardSize === 'expanded') {
      if (w >= 1024) return 3
      if (w >= 768) return 2
      return 1
    }
    if (w >= 1280) return 4
    if (w >= 1024) return 3
    if (w >= 640) return 2
    return 1
  }, [cardSize])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (data.length === 0) return
    const cols = getGridColumns()
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        setFocusedIndex(prev => Math.min(prev + 1, data.length - 1))
        break
      case 'ArrowLeft':
        e.preventDefault()
        setFocusedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev => Math.min(prev + cols, data.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev => Math.max(prev - cols, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < data.length) handleCardClick(data[focusedIndex])
        break
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < data.length) {
          const item = data[focusedIndex]
          handleCheckboxChange(item, !isSelected(item))
        }
        break
      case 'Home':
        e.preventDefault()
        setFocusedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setFocusedIndex(data.length - 1)
        break
    }
  }, [data, focusedIndex, getGridColumns, handleCardClick, handleCheckboxChange, isSelected])

  useEffect(() => {
    if (focusedIndex >= 0 && cardRefs.current[focusedIndex]) {
      cardRefs.current[focusedIndex]?.focus()
    }
  }, [focusedIndex])

  const getDisplayValue = useCallback((item: TData, columnKey: string) => {
    const value = (item as any)[columnKey]
    if (typeof value === 'boolean') {
      return value ? (
        <Badge variant="default" className="h-4.5 text-[0.6rem] px-1.5 py-0 bg-[rgb(var(--color-success))]/10 text-[rgb(var(--color-success))] border-0 font-medium">
          {t('Yes')}
        </Badge>
      ) : (
        <Badge variant="secondary" className="h-4.5 text-[0.6rem] px-1.5 py-0 bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-muted))] border-0 font-medium">
          {t('No')}
        </Badge>
      )
    }
    if (typeof value === 'number') return value.toLocaleString()
    return value?.toString() || '—'
  }, [t])

  const getFieldLabel = useCallback((column: ColumnDef<TData>) => {
    if (typeof column.header === 'string') return t(column.header)
    return (column as any).accessorKey as string || column.id || t('Field')
  }, [t])

  // Extract the actions column (has id='actions') — we'll render its cell in card
  const actionsColumn = useMemo(() =>
    columns.find(col => col.id === 'actions'),
    [columns]
  )

  // Display columns — exclude select and actions
  const displayColumns = useMemo(() =>
    columns.filter(col =>
      col.id !== 'select' &&
      col.id !== 'actions' &&
      (col as any).accessorKey !== 'actions'
    ).slice(0, cfg.fields),
    [columns, cfg.fields]
  )


  if (isLoading) {
    return (
      <div className={cfg.pad}>
        <div className={`grid ${cfg.grid} ${cfg.gap}`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} size={cardSize} />
          ))}
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-[rgb(var(--fg-muted))]">
          <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">{t('No Data Available')}</p>
          <p className="text-xs mt-1 opacity-70">{t('No records to display')}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Cards Grid */}
      <div className={cfg.pad}>
        <div className={`grid ${cfg.grid} ${cfg.gap}`}>
          <AnimatePresence initial={false}>
            {data.map((item, index) => {
              const isFocused = focusedIndex === index
              const itemSelected = isSelected(item)

              return (
                <motion.div
                  key={(item as any).id || index}
                  ref={(el) => { cardRefs.current[index] = el }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12, delay: Math.min(index * 0.015, 0.15) }}
                  className="group/card outline-none"
                  tabIndex={-1}
                  onClick={() => setFocusedIndex(index)}
                  onDoubleClick={() => handleCardClick(item)}
                >
                  <div className={`
                    relative rounded-lg border bg-[rgb(var(--bg-surface))] overflow-hidden h-full
                    transition-all duration-150
                    ${itemSelected
                      ? 'border-[rgb(var(--color-primary))] shadow-sm'
                      : 'border-[rgb(var(--bd-default))] hover:border-[rgb(var(--color-primary))]/40 hover:shadow-sm'
                    }
                    ${isFocused ? 'ring-2 ring-[rgb(var(--color-primary))]/30 ring-offset-1' : ''}
                  `}>
                    {/* Left accent bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[2px] transition-colors duration-150 ${
                      itemSelected ? 'bg-[rgb(var(--color-primary))]' : 'bg-transparent group-hover/card:bg-[rgb(var(--color-primary))]/30'
                    }`} />

                    {/* Card Content */}
                    <div className="pl-3 pr-2.5 py-2.5">
                      {/* Header: checkbox + title/subtitle + actions */}
                      <div className="flex items-center gap-2">
                        {/* Checkbox */}
                        {onRowSelect && (
                          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <SelectionCheckbox
                              checked={itemSelected}
                              onChange={(checked) => handleCheckboxChange(item, checked)}
                              circular={circularCheckboxes}
                              mode="checkbox"
                            />
                          </div>
                        )}

                        {/* Title + subtitle */}
                        <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
                          <p className={`${cfg.titleText} font-semibold text-[rgb(var(--fg-default))] truncate leading-tight`}>
                            {displayColumns.length > 0 && getDisplayValue(item, (displayColumns[0] as any).accessorKey as string)}
                          </p>
                          {displayColumns.length > 1 && (
                            <p className={`${cfg.subtitleText} text-[rgb(var(--color-primary))] font-medium truncate flex-shrink-0`}>
                              {getDisplayValue(item, (displayColumns[1] as any).accessorKey as string)}
                            </p>
                          )}
                        </div>

                        {/* Actions — render the actual actions column cell if available */}
                        <div
                          className="flex-shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {actionsColumn && (actionsColumn as any).cell?.({
                            row: { original: item },
                            getValue: () => null,
                            renderValue: () => null,
                          })}
                        </div>
                      </div>

                      {/* Field rows — clean label:value pairs */}
                      {displayColumns.length > 2 && (
                        <div className="mt-2 pt-2 border-t border-[rgb(var(--bd-default))]/40 space-y-1">
                          {displayColumns.slice(2).map((column) => {
                            const fieldKey = (column as any).accessorKey as string
                            const fieldValue = getDisplayValue(item, fieldKey)
                            const fieldLabel = getFieldLabel(column)

                            return (
                              <div key={fieldKey} className="flex items-center justify-between gap-2">
                                <span className="text-[0.65rem] text-[rgb(var(--fg-muted))] truncate flex-shrink-0 max-w-[40%]">
                                  {fieldLabel}
                                </span>
                                <span className={`${cfg.valueText} font-medium text-[rgb(var(--fg-default))] text-right truncate`}>
                                  {fieldValue}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Keyboard hints — desktop only */}
      <div className="hidden md:flex items-center justify-center gap-4 py-2 text-[0.65rem] text-[rgb(var(--fg-muted))]">
        <span><kbd className="px-1 py-0.5 bg-[rgb(var(--bg-subtle))] rounded border border-[rgb(var(--bd-default))] text-[0.6rem]">←→↑↓</kbd> {t('Navigate')}</span>
        <span><kbd className="px-1 py-0.5 bg-[rgb(var(--bg-subtle))] rounded border border-[rgb(var(--bd-default))] text-[0.6rem]">Enter</kbd> {t('Open')}</span>
        <span><kbd className="px-1 py-0.5 bg-[rgb(var(--bg-subtle))] rounded border border-[rgb(var(--bd-default))] text-[0.6rem]">Space</kbd> {t('Select')}</span>
      </div>
    </div>
  )
}
