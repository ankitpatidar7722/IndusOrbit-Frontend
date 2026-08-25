'use client'

import React from 'react'
import { useDevice } from 'indas-ui'
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react'
import { calculatePaginationInfo, generatePageNumbers, formatNumber } from '../utils/grid-helpers'
import { Dropdown } from 'indas-ui'

// Default pagination configuration
export const DEFAULT_PAGE_SIZE = 100
export const DEFAULT_PAGE_SIZE_OPTIONS = [100, 200, 500, 1000]

interface PaginationControlsProps {
  pageIndex: number
  pageSize: number
  totalRows: number
  pageSizeOptions?: number[]
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function PaginationControls({
  pageIndex,
  pageSize,
  totalRows,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const { startRow, endRow, totalPages, hasNextPage, hasPreviousPage } =
    calculatePaginationInfo(totalRows, pageIndex, pageSize)

  const pageNumbers = generatePageNumbers(pageIndex, totalPages)
  const { isMobile } = useDevice()

  if (totalRows === 0) {
    return null
  }

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-[rgb(var(--bg-subtle))] border-t border-[rgb(var(--bd-default))] gap-2">
      {/* Left: Showing X - Y of Z */}
      <div className="text-xs text-[rgb(var(--fg-muted))] flex-shrink-0">
        Showing <span className="font-medium">{formatNumber(startRow)}</span>{' - '}<span className="font-medium">{formatNumber(endRow)}</span>{' of '}<span className="font-medium">{formatNumber(totalRows)}</span>
      </div>

      {/* Center: Page navigation */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          onClick={() => onPageChange(0)}
          disabled={!hasPreviousPage}
          className="p-1.5 rounded hover:bg-[rgb(var(--bd-default))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="First Page"
        >
          <ChevronsLeft className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
        </button>

        {/* Previous Page */}
        <button
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={!hasPreviousPage}
          className="p-1.5 rounded hover:bg-[rgb(var(--bd-default))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous Page"
        >
          <ChevronLeft className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-2">
          {pageNumbers.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-[rgb(var(--fg-muted))]">
                  ...
                </span>
              )
            }

            const isCurrentPage = page === pageIndex

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`
                  min-w-[32px] h-8 px-2 rounded text-sm font-medium transition-colors
                  ${isCurrentPage
                    ? 'border border-[rgb(var(--color-primary))] text-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary)/0.08)]'
                    : 'text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bd-default))]'
                  }
                `}
              >
                {page + 1}
              </button>
            )
          })}
        </div>

        {/* Next Page */}
        <button
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={!hasNextPage}
          className="p-1.5 rounded hover:bg-[rgb(var(--bd-default))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next Page"
        >
          <ChevronRight className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(totalPages - 1)}
          disabled={!hasNextPage}
          className="p-1.5 rounded hover:bg-[rgb(var(--bd-default))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Last Page"
        >
          <ChevronsRight className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
        </button>
      </div>

      {/* Right: Page size selector (hidden on mobile) */}
      {!isMobile && (
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--fg-default))] flex-shrink-0">
          <span className="hidden sm:inline">Show:</span>
          <Dropdown
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            options={pageSizeOptions.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            placeholder="Rows"
            className="w-[6rem] h-[1.75rem] text-sm"
            searchable={false}
          />
          <span className="hidden sm:inline">rows</span>
        </div>
      )}
    </div>
  )
}