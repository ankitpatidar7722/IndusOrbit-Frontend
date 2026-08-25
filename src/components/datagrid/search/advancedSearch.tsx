'use client'

import { useState, useEffect, useCallback } from 'react'
import { advancedSearch as advancedSearchFn } from './SearchHighlighter'

interface AdvancedSearchProps {
  data: any[]
  columns: any[]
  mainColumnsArray: string[]
  enableSearch: boolean
  totalSearchResults: number
  updateSearchResults: (searchTerm: string, rowIds: string[]) => void
  clearNavigation: () => void
  setGlobalFilter: (value: string) => void
}

export function advancedSearch({
  data,
  columns,
  mainColumnsArray,
  enableSearch,
  totalSearchResults,
  updateSearchResults,
  clearNavigation,
  setGlobalFilter
}: AdvancedSearchProps) {
  const [searchValue, setSearchValue] = useState('')
  const [currentSearchTerm, setCurrentSearchTerm] = useState('')
  const [selectedDuringSearch, setSelectedDuringSearch] = useState<string[]>([])

  // Debounce search for better performance (300ms delay)
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue])

  // Enhanced global search with navigation (immediate UI update)
  const handleGlobalSearchChange = useCallback((searchTerm: string) => {
    // Update search value immediately for instant UI feedback
    setSearchValue(searchTerm)

    // Update current search term immediately for navigation to work
    setCurrentSearchTerm(searchTerm)

    // Reset selected during search when search changes
    if (searchTerm !== currentSearchTerm) {
      setSelectedDuringSearch([])
    }

    // If search is cleared, clear navigation immediately
    if (!searchTerm.trim()) {
      clearNavigation()
      setSelectedDuringSearch([])
      setGlobalFilter('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSearchTerm])

  // Perform actual search with debounced value for performance
  useEffect(() => {
    if (!enableSearch) return

    if (debouncedSearchValue.trim()) {
      // Set global filter to actually filter the table rows
      setGlobalFilter(debouncedSearchValue)

      // Find matching rows using advanced search
      const searchResults = advancedSearchFn(data, debouncedSearchValue, columns, mainColumnsArray)
      updateSearchResults(debouncedSearchValue, searchResults.rowIds)
    } else {
      // Clear global filter when search is empty
      setGlobalFilter('')
      clearNavigation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue])

  // Full search reset — also clears the DEBOUNCED value, which otherwise
  // re-applies the old filter 300ms after an external clear.
  const clearSearch = useCallback(() => {
    setSearchValue('')
    setDebouncedSearchValue('')
    setCurrentSearchTerm('')
    setSelectedDuringSearch([])
    setGlobalFilter('')
    clearNavigation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setGlobalFilter, clearNavigation])

  // Track row selection and auto-clear search when all results selected
  const handleRowSelectionChange = useCallback((rowId: string, isSelected: boolean) => {

    if (currentSearchTerm.trim()) {
      if (isSelected) {
        // Track this selection during search
        setSelectedDuringSearch(prev => {
          if (!prev.includes(rowId)) {
            const newSelected = [...prev, rowId]

            // Auto-clear search when ALL search results are selected
            if (newSelected.length >= totalSearchResults && totalSearchResults > 0) {
              // Clear search after a short delay to allow selection to complete
              setTimeout(() => {
                setSearchValue('')
                setGlobalFilter('')
                setCurrentSearchTerm('')
                clearNavigation()
                setSelectedDuringSearch([])
              }, 100)
            }

            return newSelected
          }
          return prev
        })
      } else {
        // Track deselection - remove from tracking but don't clear search
        setSelectedDuringSearch(prev => {
          const filtered = prev.filter(id => id !== rowId)
          return filtered
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSearchTerm, totalSearchResults])

  return {
    searchValue,
    setSearchValue,
    currentSearchTerm,
    setCurrentSearchTerm,
    selectedDuringSearch,
    setSelectedDuringSearch,
    debouncedSearchValue,
    handleGlobalSearchChange,
    handleRowSelectionChange,
    clearSearch
  }
}
