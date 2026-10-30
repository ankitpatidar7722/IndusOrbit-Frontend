'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide, Plus, RefreshCw, Search, X } from 'lucide-react'

/**
 * Phone list header for a DataGrid in card view (IndusFlexoERP master-list style):
 *
 *   Ledger Master                ⇅   🔍   ⟳
 *   [ 🔍 Search…                       ✕ ]   ← only while search is open
 *
 * ⇅ cycles the card title column: ascending → descending → original order. 🔍 opens a 16px search
 * field (no iOS zoom) bound to the grid's global search. ⟳ = the page's onRefresh.
 */
export function PhoneListHeader({
  title, sortDir, onToggleSort, searchValue, onSearchChange, onRefresh, refreshing,
}: {
  title?: React.ReactNode
  sortDir: 'asc' | 'desc' | null
  onToggleSort: () => void
  searchValue: string
  onSearchChange: (v: string) => void
  onRefresh: () => void
  refreshing?: boolean
}) {
  const [searchOpen, setSearchOpen] = useState(!!searchValue)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (searchOpen) inputRef.current?.focus() }, [searchOpen])

  const SortIcon = sortDir === 'asc' ? ArrowUpNarrowWide : sortDir === 'desc' ? ArrowDownWideNarrow : ArrowUpDown
  const sortLabel = sortDir === 'asc' ? 'Sorted A to Z — tap for Z to A' : sortDir === 'desc' ? 'Sorted Z to A — tap to clear' : 'Sort A to Z'

  return (
    <div className="pl-header">
      <div className="pl-row">
        <h3 className="pl-title">{title}</h3>
        <button type="button" className="pl-btn" data-on={sortDir ? '' : undefined} onClick={onToggleSort} aria-label={sortLabel} title={sortLabel}>
          <SortIcon size={22} strokeWidth={2} />
        </button>
        <button type="button" className="pl-btn" data-on={searchOpen ? '' : undefined} aria-label="Search" aria-expanded={searchOpen}
          onClick={() => { if (searchOpen && searchValue) onSearchChange(''); setSearchOpen((o) => !o) }}>
          <Search size={22} strokeWidth={2} />
        </button>
        <button type="button" className="pl-btn" onClick={onRefresh} aria-label="Refresh" disabled={refreshing}>
          <RefreshCw size={21} strokeWidth={2} className={refreshing ? 'today-spin' : undefined} />
        </button>
      </div>
      {searchOpen && (
        <label className="pl-search">
          <Search size={18} style={{ flexShrink: 0, opacity: 0.55 }} />
          <input ref={inputRef} value={searchValue} onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…" aria-label="Search list" enterKeyHint="search" autoComplete="off" />
          {searchValue && (
            <button type="button" className="pl-clear" onClick={() => onSearchChange('')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>
      )}
    </div>
  )
}

/** Round "+" create button floating above the bottom bar (phone only). Portaled to <body> so no
 *  transformed ancestor (the grid's entry animation) can break its fixed position. */
export function PhoneFab({ onClick, label }: { onClick: () => void; label: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t) }, [])
  if (!mounted) return null
  return createPortal(
    <button type="button" className="pl-fab" onClick={onClick} aria-label={label} title={label}>
      <Plus size={28} strokeWidth={2.4} />
    </button>,
    document.body
  )
}
