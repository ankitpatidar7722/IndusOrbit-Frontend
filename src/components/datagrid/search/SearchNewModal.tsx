'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Search, X, Filter } from 'lucide-react'
import { Input } from 'indas-ui'
import { Button } from 'indas-ui'
import { SearchHighlighter, advancedSearch } from './SearchHighlighter'

interface SearchNewModalProps<TData> {
  data: TData[]
  columns: any[]
  mainColumns?: string
  onRowSelect?: (rowId: string) => void
  selectedRows?: Set<string>
  className?: string
  // Optional callback for intelligent search clearing
  onSearchClear?: () => void
}

export function SearchNewModal<TData>({
  data,
  columns,
  mainColumns,
  onRowSelect,
  selectedRows = new Set(),
  className = '',
  onSearchClear
}: SearchNewModalProps<TData>) {
  const [searchValue, setSearchValue] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [selectedDuringSearch, setSelectedDuringSearch] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<{
    matchingRows: TData[]
    rowIds: string[]
    columnMatches: Record<string, string[]>
  }>({
    matchingRows: [],
    rowIds: [],
    columnMatches: {}
  })

  const searchInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const highlightedItemRef = useRef<HTMLDivElement>(null)

  // Parse main columns for search - memoized to prevent infinite re-renders
  const searchColumns = useMemo(() => {
    return mainColumns ? mainColumns.split(',').map(col => col.trim()) : undefined
  }, [mainColumns])

  // Perform search when search value changes
  useEffect(() => {
    if (searchValue.trim()) {
      const results = advancedSearch(data, searchValue, columns, searchColumns)
      setSearchResults(results)
      setHighlightedIndex(0) // Reset highlighted index when search changes
    } else {
      setSearchResults({
        matchingRows: [],
        rowIds: [],
        columnMatches: {}
      })
      setHighlightedIndex(0)
    }
  }, [searchValue, data, columns, searchColumns])

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value)
  }, [])

  // Handle row selection
  const handleRowSelection = useCallback((rowId: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    // Mouse click - don't scroll (isKeyboardNav stays false)

    // Intelligent search clearing logic
    if (searchValue.trim()) {
      const newSelected = [...selectedDuringSearch, rowId]
      setSelectedDuringSearch(newSelected)

      // Clear search based on intelligent rules
      const shouldClearSearch =
        // Rule 1: If only 1 search result and user selects it
        (searchResults.matchingRows.length === 1) ||
        // Rule 2: If user selects ALL search results
        (newSelected.length >= searchResults.matchingRows.length)

      if (shouldClearSearch) {
        setShowModal(false)
        setSearchValue('')
        setSelectedDuringSearch([])
        onSearchClear?.()
        // Don't reset highlightedIndex to prevent scroll jump

        // Ensure input can be focused again
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus()
          }
          // Reset highlighted index after modal closes to prevent next search from starting at wrong position
          setHighlightedIndex(0)
        }, 100)
      }
    } else {
      // Normal selection without search
      setShowModal(false)
    }

    onRowSelect?.(rowId)
  }, [onRowSelect, searchValue, searchResults.matchingRows.length, selectedDuringSearch, onSearchClear])

  // Handle input focus
  const handleFocus = useCallback(() => {
    setShowModal(true)
  }, [])

  // Handle input blur
  const handleBlur = useCallback(() => {
    // Delay closing to allow for click interactions
    // Only close if not actively selecting
    setTimeout(() => {
      if (document.activeElement !== searchInputRef.current) {
        setShowModal(false)
      }
    }, 150)
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showModal || searchResults.matchingRows.length === 0) return

      switch (event.key) {
        case 'Escape':
          setShowModal(false)
          setSearchValue('')
          setHighlightedIndex(0)
          break

        case 'ArrowDown':
          event.preventDefault()
          setIsKeyboardNav(true) // Enable scroll for keyboard nav
          setHighlightedIndex(prev =>
            prev < searchResults.matchingRows.length - 1 ? prev + 1 : 0
          )
          break

        case 'ArrowUp':
          event.preventDefault()
          setIsKeyboardNav(true) // Enable scroll for keyboard nav
          setHighlightedIndex(prev =>
            prev > 0 ? prev - 1 : searchResults.matchingRows.length - 1
          )
          break

        case 'Enter':
          event.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < searchResults.matchingRows.length) {
            const row = searchResults.matchingRows[highlightedIndex]
            const rowId = getRowId(row, highlightedIndex)

            // Intelligent search clearing logic (same as click)
            if (searchValue.trim()) {
              const newSelected = [...selectedDuringSearch, rowId]
              setSelectedDuringSearch(newSelected)

              const shouldClearSearch =
                (searchResults.matchingRows.length === 1) ||
                (newSelected.length >= searchResults.matchingRows.length)

              if (shouldClearSearch) {
                setShowModal(false)
                setSearchValue('')
                setSelectedDuringSearch([])
                onSearchClear?.()
                // Don't reset highlightedIndex to prevent scroll jump

                setTimeout(() => {
                  if (searchInputRef.current) {
                    searchInputRef.current.focus()
                  }
                  // Reset highlighted index after modal closes to prevent next search from starting at wrong position
                  setHighlightedIndex(0)
                }, 100)
              }
            } else {
              setShowModal(false)
              setSearchValue('')
              setHighlightedIndex(0)

              setTimeout(() => {
                if (searchInputRef.current) {
                  searchInputRef.current.focus()
                }
              }, 100)
            }

            onRowSelect?.(rowId)
          }
          break
      }
    }

    if (showModal) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showModal, searchResults.matchingRows, highlightedIndex, onRowSelect, onSearchClear, searchValue, selectedDuringSearch])

  // Track if we're using keyboard navigation (to enable scroll) vs mouse clicks (no scroll)
  const [isKeyboardNav, setIsKeyboardNav] = React.useState(false)

  // Scroll highlighted item into view (only when using keyboard navigation)
  useEffect(() => {
    if (highlightedItemRef.current && showModal && isKeyboardNav) {
      highlightedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
      // Reset after scroll
      setIsKeyboardNav(false)
    }
  }, [highlightedIndex, showModal, isKeyboardNav])

  // Get display text for a row
  const getRowDisplayText = useCallback((row: TData) => {
    // Try to get a meaningful display name from the row
    const rowObj = row as any
    return rowObj.name || rowObj.title || rowObj.label ||
           rowObj.firstName || rowObj.email ||
           Object.values(rowObj).find(val => typeof val === 'string') ||
           'Row Item'
  }, [])

  // Get row ID
  const getRowId = useCallback((row: TData, index: number) => {
    const rowObj = row as any
    return rowObj.id || rowObj.ID || index.toString()
  }, [])

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-fg-subtle" />
        <Input
          ref={searchInputRef}
          placeholder="Search..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="pl-10 pr-10 h-8 text-sm bg-bg-surface border-bd-default focus:border-primary focus:ring-primary"
        />
        {searchValue && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchValue('')
              setShowModal(false)
            }}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
          >
            <X className="h-3 w-3 text-fg-subtle" />
          </Button>
        )}
      </div>

      {/* Search Modal - positioned below input */}
      {showModal && (
        <div
          ref={modalRef}
          className="absolute top-full left-0 right-0 mt-2 z-50 bg-bg-surface rounded-lg shadow-xl border border-bd-default overflow-hidden"
          style={{ minWidth: '320px' }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-fg-default">
                Search Results
                {searchResults.matchingRows.length > 0 && (
                  <span className="ml-2 text-xs text-fg-muted">
                    ({searchResults.matchingRows.length} found)
                  </span>
                )}
              </h3>
              {/* Navigation indicator */}
              {searchResults.matchingRows.length > 0 && (
                <div className="text-xs text-fg-muted">
                  {highlightedIndex + 1} of {searchResults.matchingRows.length}
                  <span className="ml-2 text-fg-subtle">↑↓ to navigate, Enter to select</span>
                </div>
              )}
            </div>

            {/* Search Results */}
            <div className="max-h-64 overflow-y-auto">
              {searchValue ? (
                searchResults.matchingRows.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.matchingRows.map((row, index) => {
                      const rowId = getRowId(row, index)
                      const isSelected = selectedRows.has(rowId)
                      const isHighlighted = index === highlightedIndex
                      const displayText = getRowDisplayText(row)

                      return (
                        <div
                          key={rowId}
                          ref={isHighlighted ? highlightedItemRef : null}
                          className={`flex items-center p-2.5 rounded-md transition-colors group cursor-pointer ${
                            isHighlighted
                              ? 'bg-primary-subtle border-2 border-primary/30'
                              : 'hover:bg-bg-hover'
                          }`}
                          onClick={(e) => handleRowSelection(rowId, e)}
                        >
                          {/* Selection Checkbox */}
                          <div className="flex items-center justify-center mr-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by parent click
                              className="w-4 h-4 border border-gray-300 rounded cursor-pointer focus:ring-2 focus:ring-primary"
                            />
                          </div>

                          {/* Row Icon */}
                          <div className="w-8 h-8 bg-primary-subtle rounded-lg flex items-center justify-center mr-3 group-hover:bg-primary-muted">
                            <span className="text-xs font-medium text-primary">
                              {displayText.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          {/* Row Content */}
                          <div className="flex-1">
                            <div className="font-medium text-fg-default text-sm">
                              <SearchHighlighter
                                text={displayText}
                                searchTerm={searchValue}
                                highlightClassName="border-2 border-primary rounded px-0.5"
                              />
                            </div>
                            <div className="text-xs text-fg-muted">
                              Row ID: {rowId}
                            </div>
                          </div>

                          {/* Selection Status */}
                          {isSelected && (
                            <div className="text-xs text-green-600 font-medium">
                              Selected
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-fg-muted text-sm">
                    No results found for &quot;{searchValue}&quot;
                  </div>
                )
              ) : (
                <div className="text-center py-6 text-fg-subtle text-sm">
                  Type to search...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}