'use client'

import React from 'react'

interface SearchHighlighterProps {
  text: string
  searchTerm: string
  className?: string
  highlightClassName?: string
}

export function SearchHighlighter({
  text,
  searchTerm,
  className = '',
  highlightClassName = 'border-2 border-primary rounded px-0.5'
}: SearchHighlighterProps) {
  // Don't highlight - just return plain text
  // User requested no yellow highlighting, keep it simple
  return <span className={className}>{text}</span>
}

// Utility function for fuzzy search matching
export function fuzzyMatch(text: string, searchTerm: string): boolean {
  if (!searchTerm || !text) return false

  const textLower = text.toLowerCase()
  const searchLower = searchTerm.toLowerCase()

  // Exact match
  if (textLower.includes(searchLower)) return true

  // Fuzzy match - check if all characters of searchTerm appear in order in text
  let searchIndex = 0
  for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
    if (textLower[i] === searchLower[searchIndex]) {
      searchIndex++
    }
  }

  return searchIndex === searchLower.length
}

// Utility function to get all text content from a cell value
export function getCellTextContent(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return ''

  if (typeof cellValue === 'string') return cellValue
  if (typeof cellValue === 'number') return cellValue.toString()
  if (typeof cellValue === 'boolean') return cellValue.toString()

  // Handle React elements or complex objects
  if (React.isValidElement(cellValue)) {
    // Try to extract text from React element
    const extractText = (element: any): string => {
      if (typeof element === 'string' || typeof element === 'number') {
        return element.toString()
      }
      if (React.isValidElement(element) && (element.props as any)?.children) {
        if (Array.isArray((element.props as any).children)) {
          return (element.props as any).children.map(extractText).join('')
        }
        return extractText((element.props as any).children)
      }
      return ''
    }
    return extractText(cellValue)
  }

  return JSON.stringify(cellValue)
}

// Simple search function - just search and return matches
export function advancedSearch(
  data: any[],
  searchTerm: string,
  columns: any[],
  mainColumns?: string[]
): {
  matchingRows: any[]
  rowIds: string[]
  columnMatches: Record<string, string[]>
} {
  if (!searchTerm.trim()) {
    return {
      matchingRows: data,
      rowIds: data.map((row, index) => row.id || index.toString()),
      columnMatches: {}
    }
  }

  const results: any[] = []
  const rowIds: string[] = []
  const columnMatches: Record<string, string[]> = {}

  // Define searchable columns
  const searchableColumns = columns.filter(col => {
    // Exclude select columns and any column marked to skip search
    if (col.meta?.isSelectColumn || col.meta?.skipSearch || col.id === 'select') {
      return false
    }

    if (mainColumns && mainColumns.length > 0) {
      return mainColumns.includes(col.accessorKey || col.id)
    }
    // Default: search in all text-based columns
    return col.accessorKey && typeof col.accessorKey === 'string'
  })

  data.forEach((row, index) => {
    let isMatch = false
    const rowId = row.id || index.toString()
    const matchingColumns: string[] = []

    // Search in specified columns
    for (const column of searchableColumns) {
      const columnKey = column.accessorKey || column.id
      const cellValue = row[columnKey]
      const textContent = getCellTextContent(cellValue)

      if (fuzzyMatch(textContent, searchTerm)) {
        isMatch = true
        matchingColumns.push(columnKey)
      }
    }

    // If no main columns specified, search all columns as fallback
    if (!isMatch && (!mainColumns || mainColumns.length === 0)) {
      for (const column of columns) {
        // Skip select columns in fallback search too
        if (column.meta?.isSelectColumn || column.meta?.skipSearch || column.id === 'select') {
          continue
        }

        const columnKey = column.accessorKey || column.id
        if (!columnKey) continue

        const cellValue = row[columnKey]
        const textContent = getCellTextContent(cellValue)

        if (fuzzyMatch(textContent, searchTerm)) {
          isMatch = true
          matchingColumns.push(columnKey)
          break
        }
      }
    }

    if (isMatch) {
      results.push(row)
      rowIds.push(rowId)
      columnMatches[rowId] = matchingColumns
    }
  })

  return {
    matchingRows: results,
    rowIds,
    columnMatches
  }
}