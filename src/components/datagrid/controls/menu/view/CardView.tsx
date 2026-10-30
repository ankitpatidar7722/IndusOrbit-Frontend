'use client'

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ColumnDef } from '@tanstack/react-table'
import { Check, LayoutGrid, MoreHorizontal, MoreVertical } from 'lucide-react'

import { Skeleton } from 'indas-ui'
import { useBackGuard } from '@/lib/back-stack'
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
  /** Kept for API compatibility — the record card's pick circle is always round. */
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

/** A column's raw value for a row (accessorFn first, else accessorKey). */
function rawValue<TData>(item: TData, column: ColumnDef<TData>): unknown {
  const fn = (column as any).accessorFn
  if (typeof fn === 'function') { try { return fn(item, 0) } catch { return undefined } }
  const key = (column as any).accessorKey as string | undefined
  return key ? (item as any)?.[key] : undefined
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|\s|$)/

/** The value as card text: '' when empty / a placeholder dash (so the row is skipped), dates as "28 Oct 2026". */
function cellText<TData>(item: TData, column: ColumnDef<TData>): string {
  const v = rawValue(item, column)
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ''
    // Ids / codes / numbers stay as typed ("1234", not "1,234"); amounts and counts get grouping.
    const k = `${(column as any).accessorKey ?? column.id ?? ''}`
    return /(id|code|no|number)$/i.test(k) ? String(v) : v.toLocaleString('en-IN')
  }
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  if (typeof v !== 'string') return ''
  const s = v.trim()
  if (!s || s === '—' || s === '-' || s === '–') return ''
  if (ISO_DATE.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return s
}

/** An id-only column with its own cell (a toggle, an icon button) — no data value, so render its cell. */
const isInteractiveCell = <TData,>(column: ColumnDef<TData>) =>
  typeof (column as any).cell === 'function' && !(column as any).accessorKey && typeof (column as any).accessorFn !== 'function'

export function CardView<TData>({
  data,
  columns,
  onRowClick,
  selectedRows,
  onRowSelect,
  isLoading = false,
  cardSize = 'normal',
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
    const key = (c: ColumnDef<TData>) => ((c as any).accessorKey as string) || (c.id as string)
    if (cardColumns && cardColumns.length) {
      return cardColumns.map(k => usable.find(c => key(c) === k)).filter(Boolean) as ColumnDef<TData>[]
    }
    // Auto: a "title" / "name" column reads better as the card title than an id — it goes first and
    // the original first column (e.g. Ticket ID) becomes the reference line under it.
    const named = usable.find((c) => key(c) === 'title' || key(c) === 'name')
    const ordered = named && usable[0] !== named ? [named, ...usable.filter((c) => c !== named)] : usable
    return ordered.slice(0, cfg.fields)
  }, [columns, cfg.fields, cardColumns])

  // Card actions: a createActionsColumn cell is a single ⋮ dropdown on a phone → stays inline in the corner.
  // Anything wider (custom action cells, Send To / Send-to-Tracker) goes into the card's action sheet.
  const inlineActions = !!actionsColumn && !!(actionsColumn.meta as any)?.phoneSingleMenu
  const sheetActionCols = useMemo(
    () => [...actionAreaColumns, ...(actionsColumn && !inlineActions ? [actionsColumn] : [])],
    [actionAreaColumns, actionsColumn, inlineActions]
  )
  // A card tap opens the record in VIEW mode: the actions column's View handler when the page has one
  // (createActionsColumn → meta.onView), else the grid's onRowClick.
  const viewHandler = (actionsColumn?.meta as any)?.onView as ((row: TData) => void) | undefined
  const openRecord = (item: TData) => { if (viewHandler) viewHandler(item); else handleCardClick(item) }
  const [sheetItem, setSheetItem] = useState<{ item: TData; title: string } | null>(null)
  const closeSheet = useCallback(() => setSheetItem(null), [])
  useBackGuard(!!sheetItem, closeSheet)   // Android / browser Back closes the action sheet

  // The card's status pill: the first column whose id/key says "status" — among the chosen card columns
  // when `cardColumns` is given, else among all data columns (so e.g. /clients' ERP Status still shows).
  const statusColumn = useMemo(() => {
    const isStatus = (c: ColumnDef<TData>) => /status/i.test(`${c.id ?? ''} ${(c as any).accessorKey ?? ''}`)
    const pool = cardColumns && cardColumns.length
      ? displayColumns
      : columns.filter(c => c.id !== 'select' && c.id !== 'actions' && !(c.id && ACTION_AREA_IDS.includes(c.id as string)))
    return pool.find((c, i) => isStatus(c) && !(pool === displayColumns && i === 0)) ?? null
  }, [columns, displayColumns, cardColumns])

  // Call a column's own cell renderer outside the table. The fake row MUST implement getValue(colId):
  // DataGrid's enhancedColumns wraps bare date columns with a cell that calls row.getValue().
  const renderCell = (item: TData, column: ColumnDef<TData>) => {
    const raw = rawValue(item, column)
    return (column as any).cell?.({
      row: { original: item, getValue: (colId: string) => (item as any)?.[colId] },
      getValue: () => raw,
      renderValue: () => raw,
    }) ?? null
  }

  // Long-press (~450ms) a card → start picking (select it); the click that ends the hold is swallowed.
  // A touch long-press often sends no click at all, so the "fired" flag is reset by the NEXT press
  // (startHold replaces it) — a stale flag can never eat the user's next real tap.
  const hold = useRef<{ timer: number; x: number; y: number; fired: boolean }>(null)
  const cancelHold = () => { if (hold.current) window.clearTimeout(hold.current.timer) }
  const startHold = (e: React.PointerEvent, item: TData) => {
    if (!onRowSelect || e.button !== 0) return
    cancelHold()
    const h = { timer: 0, x: e.clientX, y: e.clientY, fired: false }
    h.timer = window.setTimeout(() => {
      h.fired = true
      try { navigator.vibrate?.(18) } catch { /* no vibration */ }
      handleCheckboxChange(item, !isSelected(item))
    }, 450)
    hold.current = h
  }
  const moveHold = (e: React.PointerEvent) => {
    const h = hold.current
    if (h && !h.fired && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) cancelHold()
  }
  const swallowClick = () => {
    const h = hold.current
    hold.current = null
    return !!h?.fired
  }


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

              // RECORD CARD (IndusFlexoERP master-list style, e.g. /master/ledger), read top to bottom:
              //   TITLE        1st card column, bold in the brand colour, wraps in full      ⋮ actions
              //   REFERENCE    2nd card column (code / number), brand colour     [status pill]
              //   Label: value, Label: value, …   ← grey, two ellipsised lines (the other columns;
              //   Label: value, …                    empty / "—" values skipped)
              // The status pill = the first column whose id/key says "status" (its own cell renderer).
              // A tap opens the record in VIEW mode (the actions column's onView, else onRowClick).
              // Selection: no checkbox until picking starts — long-press a card (or tap its check once any
              // card is picked).
              const titleCol = displayColumns[0]
              const refCol = displayColumns[1]
              const restCols = displayColumns.slice(2).filter((c) => c !== statusColumn)
              const reference = refCol && refCol !== statusColumn ? cellText(item, refCol) : ''
              const title = titleCol ? cellText(item, titleCol) : ''
              const statusNode = statusColumn ? renderCell(item, statusColumn) : null
              const hasActions = inlineActions || sheetActionCols.length > 0
              const actionSlots = (inlineActions ? 1 : 0) + (sheetActionCols.length > 0 ? 1 : 0)
              const picking = !!onRowSelect && selectedRows.length > 0

              return (
                <motion.div
                  key={(item as any).id || index}
                  ref={(el) => { cardRefs.current[index] = el }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12, delay: Math.min(index * 0.015, 0.15) }}
                  className={`rc-card${itemSelected ? ' rc-selected' : ''}${isFocused ? ' rc-focused' : ''}`}
                  tabIndex={-1}
                  onPointerDown={(e) => startHold(e, item)}
                  onPointerMove={moveHold}
                  onPointerUp={cancelHold}
                  onPointerCancel={cancelHold}
                  onPointerLeave={cancelHold}
                  onContextMenu={(e) => { if (onRowSelect) e.preventDefault() }}
                  onClick={() => {
                    if (swallowClick()) return
                    setFocusedIndex(index)
                    if (picking) handleCheckboxChange(item, !itemSelected)
                    else openRecord(item)
                  }}
                >
                  {/* Actions in the top-right corner (always visible — touch has no hover). Includes the
                      Send To / Send-to-Tracker icon columns so they're reachable on a card. */}
                  {hasActions && (
                    <div className="rc-actions" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                      {/* Several buttons (Send To, Verify / Reject, Reassign / Close …) don't fit the card's
                          corner — they open together in an action sheet instead of covering the title. */}
                      {sheetActionCols.length > 0 && (
                        <button type="button" className="rc-more" aria-label="More actions"
                          onClick={() => setSheetItem({ item, title })}>
                          {inlineActions ? <MoreHorizontal size={20} strokeWidth={2.2} /> : <MoreVertical size={20} strokeWidth={2.2} />}
                        </button>
                      )}
                      {inlineActions && renderCell(item, actionsColumn!)}
                    </div>
                  )}

                  <div className="rc-body">
                    {picking && (
                      <span className="rc-check" data-on={itemSelected || undefined} aria-hidden>
                        {itemSelected && <Check size={14} strokeWidth={3} />}
                      </span>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className={`rc-title${cardSize === 'expanded' ? ' rc-title-lg' : ''}`}>
                        {hasActions && <span className="rc-title-float" style={{ width: actionSlots * 36 }} aria-hidden />}
                        {title || '—'}
                      </div>
                      {(reference || statusNode) && (
                        <div className="rc-ref-row">
                          <span className="rc-ref">{reference}</span>
                          {statusNode && (
                            <span className="rc-status" onClick={(e) => e.stopPropagation()}>{statusNode}</span>
                          )}
                        </div>
                      )}

                      {restCols.length > 0 && (() => {
                        // Plain values → "Label: value" text, split over two grey lines (ellipsis);
                        // id-only cells (a toggle, an icon) can't be text → their own row, still tappable.
                        const texts: string[] = []
                        const cells: React.ReactNode[] = []
                        for (const column of restCols) {
                          const text = cellText(item, column)
                          if (text) { texts.push(`${getFieldLabel(column)}: ${text}`); continue }
                          if (isInteractiveCell(column)) {
                            const fieldKey = ((column as any).accessorKey as string) || (column.id as string)
                            cells.push(
                              <span key={fieldKey} className="rc-meta-cell" onClick={(e) => e.stopPropagation()}>
                                <span>{getFieldLabel(column)}:</span> {renderCell(item, column)}
                              </span>
                            )
                          }
                        }
                        const half = Math.ceil(texts.length / 2)
                        const lines = texts.length > 1 ? [texts.slice(0, half), texts.slice(half)] : [texts]
                        return (
                          <>
                            {lines.filter((l) => l.length).map((l, i) => (
                              <div key={i} className="rc-meta" title={l.join(', ')}>{l.join(', ')}</div>
                            ))}
                            {cells.length > 0 && <div className="rc-meta-cells">{cells}</div>}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Card action sheet: the row's action cells, enlarged for a thumb. Any tap on an action closes it
          (the action itself — open a modal, send, verify — then runs as on desktop). */}
      {sheetItem && (
        <div className="rc-sheet-backdrop" onClick={() => setSheetItem(null)}>
          <div className="rc-sheet" role="menu" aria-label="Actions" onClick={(e) => e.stopPropagation()}>
            <div className="rc-sheet-handle" aria-hidden />
            <div className="rc-sheet-title">{sheetItem.title || t('Actions')}</div>
            <div className="rc-sheet-actions"
              onClickCapture={(e) => { if ((e.target as HTMLElement).closest('button')) setTimeout(() => setSheetItem(null), 0) }}>
              {sheetActionCols.map((col) => (
                <div key={(col.id as string) || 'actions'} className="rc-sheet-group">{renderCell(sheetItem.item, col)}</div>
              ))}
            </div>
            <button type="button" className="rc-sheet-cancel" onClick={() => setSheetItem(null)}>{t('Cancel')}</button>
          </div>
        </div>
      )}

      {/* Keyboard hints — desktop only */}
      <div className="hidden md:flex items-center justify-center gap-4 py-2 text-[0.65rem] text-[rgb(var(--fg-muted))]">
        <span><kbd className="px-1 py-0.5 bg-[rgb(var(--bg-subtle))] rounded border border-[rgb(var(--bd-default))] text-[0.6rem]">←→↑↓</kbd> {t('Navigate')}</span>
        <span><kbd className="px-1 py-0.5 bg-[rgb(var(--bg-subtle))] rounded border border-[rgb(var(--bd-default))] text-[0.6rem]">Enter</kbd> {t('Open')}</span>
        <span><kbd className="px-1 py-0.5 bg-[rgb(var(--bg-subtle))] rounded border border-[rgb(var(--bd-default))] text-[0.6rem]">Space</kbd> {t('Select')}</span>
      </div>
    </div>
  )
}
