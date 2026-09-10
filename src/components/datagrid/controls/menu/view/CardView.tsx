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
  /** Restrict the card to these columns (by accessorKey/id), in this order. First two become the
   *  card title + subtitle; the rest render as label:value rows. Omit → auto (first N columns). */
  cardColumns?: string[]
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
  cardColumns,
}: CardViewProps<TData>) {
  const { t } = useLanguage()
  const cfg = sizeConfig[cardSize]
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  const isSelected = useCallback((item: TData) => {
    // Match by object reference first (selectedRows are the same row.original refs as `data`).
    // Fall back to `id` ONLY when both ids exist — otherwise rows without an `.id` field
    // (points use pointID, clients use companyUserID, …) all compared undefined===undefined
    // and every card showed selected once any one was picked.
    return selectedRows.some((selected) => {
      if (selected === item) return true
      const sid = (selected as any).id
      const iid = (item as any).id
      return sid != null && iid != null && sid === iid
    })
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
    const metaTitle = (column.meta as any)?.title
    if (typeof metaTitle === 'string') return t(metaTitle)
    if (typeof column.header === 'string') return t(column.header)
    return (column as any).accessorKey as string || column.id || t('Field')
  }, [t])

  // Extract the actions column (has id='actions') — we'll render its cell in card
  const actionsColumn = useMemo(() =>
    columns.find(col => col.id === 'actions'),
    [columns]
  )

  // Other icon-button columns (Send To / Send to Tracker) — these have no data value, only tappable
  // icons, so on a card they'd render blank. Show their cell alongside the actions instead.
  const ACTION_AREA_IDS = ['sendto', 'sendtracker']
  const actionAreaColumns = useMemo(() =>
    columns.filter(col => col.id && ACTION_AREA_IDS.includes(col.id as string)),
    [columns]
  )

  // Display columns — exclude select, actions and the action-area icon columns. When `cardColumns`
  // is given, show exactly those (by accessorKey/id), in that order; else the first N real columns.
  const displayColumns = useMemo(() => {
    const usable = columns.filter(col =>
      col.id !== 'select' && col.id !== 'actions' && (col as any).accessorKey !== 'actions' &&
      !(col.id && ACTION_AREA_IDS.includes(col.id as string))
    )
    if (cardColumns && cardColumns.length) {
      const key = (c: ColumnDef<TData>) => ((c as any).accessorKey as string) || (c.id as string)
      return cardColumns.map(k => usable.find(c => key(c) === k)).filter(Boolean) as ColumnDef<TData>[]
    }
    return usable.slice(0, cfg.fields)
  }, [columns, cfg.fields, cardColumns])


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
                  onClick={() => { setFocusedIndex(index); handleCardClick(item); }}
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
                          <p className={`${cfg.titleText} font-semibold text-[rgb(var(--fg-default))] truncate leading-tight min-w-0`}>
                            {displayColumns.length > 0 && getDisplayValue(item, (displayColumns[0] as any).accessorKey as string)}
                          </p>
                          {displayColumns.length > 1 && (
                            <p className={`${cfg.subtitleText} dg-card-subtitle font-medium truncate min-w-0`}>
                              {getDisplayValue(item, (displayColumns[1] as any).accessorKey as string)}
                            </p>
                          )}
                        </div>

                        {/* Actions — always visible (mobile has no hover, so the opacity-on-hover
                            trick would leave the View/Edit buttons untappable on touch). Includes the
                            Send To / Send-to-Tracker icon columns so they're reachable on a card. */}
                        <div
                          className="flex-shrink-0 flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {actionAreaColumns.map((col) => (
                            <span key={col.id as string}>
                              {(col as any).cell?.({ row: { original: item, getValue: (colId: string) => (item as any)?.[colId] }, getValue: () => null, renderValue: () => null })}
                            </span>
                          ))}
                          {actionsColumn && (actionsColumn as any).cell?.({
                            row: { original: item, getValue: (colId: string) => (item as any)?.[colId] },
                            getValue: () => null,
                            renderValue: () => null,
                          })}
                        </div>
                      </div>

                      {/* Field rows — clean label:value pairs */}
                      {displayColumns.length > 2 && (
                        <div className="mt-2 pt-2 border-t border-[rgb(var(--bd-default))]/40 space-y-1">
                          {displayColumns.slice(2).map((column) => {
                            const fieldKey = ((column as any).accessorKey as string) || (column.id as string)
                            const hasCell = typeof (column as any).cell === "function"
                            const raw = fieldKey ? (item as any)[fieldKey] : undefined
                            // Columns with a custom cell (toggles, status pills, badges) always render —
                            // their value may be falsy (an "off" switch) yet still needs to show, and the
                            // cell carries the real formatting. Plain columns skip when empty so cards
                            // aren't full of "—" rows.
                            if (!hasCell && (raw == null || (typeof raw !== "boolean" && String(raw).trim() === ""))) return null
                            const fieldLabel = getFieldLabel(column)
                            const cellNode = hasCell
                              ? (column as any).cell({ row: { original: item, getValue: (colId: string) => (item as any)?.[colId] }, getValue: () => raw, renderValue: () => raw })
                              : null

                            return (
                              <div key={fieldKey} className="flex items-center justify-between gap-2"
                                {...(hasCell ? { onClick: (e: React.MouseEvent) => e.stopPropagation() } : {})}>
                                <span className="text-[0.65rem] text-[rgb(var(--fg-muted))] truncate flex-shrink-0 max-w-[45%]">
                                  {fieldLabel}
                                </span>
                                {hasCell ? (
                                  <span className={`${cfg.valueText} font-medium text-[rgb(var(--fg-default))] min-w-0 flex items-center justify-end`}>
                                    {cellNode}
                                  </span>
                                ) : (
                                  <span className={`${cfg.valueText} font-medium text-[rgb(var(--fg-default))] text-right truncate`}>
                                    {getDisplayValue(item, fieldKey)}
                                  </span>
                                )}
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
