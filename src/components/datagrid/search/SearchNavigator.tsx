'use client'

import React, { useEffect, useCallback } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface SearchNavigationState {
  currentIndex: number
  totalResults: number
  highlightedRowId: string | null
  searchTerm: string
}

interface SearchNavigatorProps {
  navigationState: SearchNavigationState
  onNavigate: (direction: 'up' | 'down') => void
  onSelect: (rowId: string) => void
  onClear: () => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
  enabled: boolean
}

export function SearchNavigator({
  navigationState,
  onNavigate,
  onSelect,
  onClear,
  searchInputRef,
  enabled
}: SearchNavigatorProps) {
  const { currentIndex, totalResults, highlightedRowId, searchTerm } = navigationState

  // Keyboard navigation handler - only for arrow keys and special keys
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled || !searchTerm || totalResults === 0) {
      return
    }

    // ONLY handle arrow keys and special navigation keys
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        event.stopPropagation()
        onNavigate('down')
        break
      case 'ArrowUp':
        event.preventDefault()
        event.stopPropagation()
        onNavigate('up')
        break
      case 'Enter':
        event.preventDefault()
        event.stopPropagation()
        if (highlightedRowId) {
          onSelect(highlightedRowId)
          // Return focus to search input after selection
          if (searchInputRef?.current) {
            setTimeout(() => {
              searchInputRef.current?.focus()
            }, 100)
          }
        }
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        onClear()
        break
      default:
        // Do nothing for other keys - let them type normally
        return
    }
  }, [enabled, searchTerm, totalResults, highlightedRowId, onNavigate, onSelect, onClear, searchInputRef])

  // Attach keyboard event listeners ONLY to search input
  useEffect(() => {
    const searchInput = searchInputRef?.current
    if (!searchInput) return

    searchInput.addEventListener('keydown', handleKeyDown)
    return () => {
      searchInput.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, searchInputRef])

  // Scroll handling is now done in useSearchNavigation hook with proper grid scoping
  // No need to handle scroll here - removed to prevent cross-grid search issues

  // Don't render visual navigator - just handle keyboard events
  return null
}

// Hook for managing search navigation state
export function useSearchNavigation(scrollContainerRef?: React.RefObject<HTMLDivElement>) {
  const [navigationState, setNavigationState] = React.useState<SearchNavigationState>({
    currentIndex: -1,
    totalResults: 0,
    highlightedRowId: null,
    searchTerm: ''
  })

  const [filteredRowIds, setFilteredRowIds] = React.useState<string[]>([])

  const updateSearchResults = useCallback((searchTerm: string, matchingRowIds: string[]) => {
    setFilteredRowIds(matchingRowIds)
    setNavigationState(prev => ({
      ...prev,
      searchTerm,
      totalResults: matchingRowIds.length,
      currentIndex: matchingRowIds.length > 0 ? 0 : -1,
      highlightedRowId: matchingRowIds.length > 0 ? matchingRowIds[0] : null
    }))
  }, [])

  const navigate = useCallback((direction: 'up' | 'down') => {
    if (filteredRowIds.length === 0) {
      return
    }

    setNavigationState(prev => {
      let newIndex = prev.currentIndex

      if (direction === 'down') {
        newIndex = (prev.currentIndex + 1) % prev.totalResults
      } else {
        newIndex = prev.currentIndex <= 0 ? prev.totalResults - 1 : prev.currentIndex - 1
      }

      const nextRowId = filteredRowIds[newIndex]

      // Auto-scroll to the new highlighted row - ONLY within THIS grid container
      if (nextRowId && scrollContainerRef?.current) {
        requestAnimationFrame(() => {
          const scrollContainer = scrollContainerRef.current
          if (!scrollContainer) return

          // CRITICAL FIX: Search within THIS grid only, not globally
          const rowElement = scrollContainer.querySelector(`[data-row-id="${nextRowId}"]`) as HTMLElement

          if (rowElement) {
            // Use getBoundingClientRect for accurate positioning
            const containerRect = scrollContainer.getBoundingClientRect()
            const rowRect = rowElement.getBoundingClientRect()

            // Check if row is fully visible within container
            const isRowAboveViewport = rowRect.top < containerRect.top
            const isRowBelowViewport = rowRect.bottom > containerRect.bottom

            if (isRowAboveViewport) {
              // Row is above visible area - scroll up
              const scrollOffset = rowRect.top - containerRect.top
              scrollContainer.scrollTop += scrollOffset - 10 // 10px padding
            } else if (isRowBelowViewport) {
              // Row is below visible area - scroll down
              const scrollOffset = rowRect.bottom - containerRect.bottom
              scrollContainer.scrollTop += scrollOffset + 10 // 10px padding
            }
            // If row is fully visible, don't scroll
          }
        })
      }

      return {
        ...prev,
        currentIndex: newIndex,
        highlightedRowId: nextRowId || null
      }
    })
  }, [filteredRowIds, scrollContainerRef])

  const selectRow = useCallback((rowId: string) => {
    // This will be handled by the parent component
    return rowId
  }, [])

  const clearNavigation = useCallback(() => {
    setNavigationState({
      currentIndex: -1,
      totalResults: 0,
      highlightedRowId: null,
      searchTerm: ''
    })
    setFilteredRowIds([])
  }, [])

  return {
    navigationState,
    updateSearchResults,
    navigate,
    selectRow,
    clearNavigation
  }
}