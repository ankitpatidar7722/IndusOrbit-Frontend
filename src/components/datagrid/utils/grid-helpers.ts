/**
 * Grid utility functions and helpers
 */

/**
 * Calculate pagination info
 */
export function calculatePaginationInfo(
  totalRows: number,
  pageIndex: number,
  pageSize: number
): {
  startRow: number
  endRow: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
} {
  const totalPages = Math.ceil(totalRows / pageSize)
  const startRow = pageIndex * pageSize + 1
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows)

  return {
    startRow,
    endRow,
    totalPages,
    hasNextPage: pageIndex < totalPages - 1,
    hasPreviousPage: pageIndex > 0,
  }
}

/**
 * Generate page numbers for pagination display
 * Shows: 1 ... 5 6 7 ... 20 (current page in middle)
 */
export function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): (number | 'ellipsis')[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i)
  }

  const pages: (number | 'ellipsis')[] = []
  const leftEdge = 1
  const rightEdge = 1
  const aroundCurrent = 2

  // Always show first page
  pages.push(0)

  // Calculate range around current page
  const rangeStart = Math.max(leftEdge, currentPage - aroundCurrent)
  const rangeEnd = Math.min(totalPages - rightEdge - 1, currentPage + aroundCurrent)

  // Add ellipsis after first page if needed
  if (rangeStart > leftEdge) {
    pages.push('ellipsis')
  }

  // Add pages around current
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i)
  }

  // Add ellipsis before last page if needed
  if (rangeEnd < totalPages - rightEdge - 1) {
    pages.push('ellipsis')
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages - 1)
  }

  return pages
}

/**
 * Debounce function for search
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Get row ID safely
 */
export function getRowId<TData>(
  row: TData,
  index: number,
  getRowIdFn?: (row: TData) => string
): string {
  if (getRowIdFn) {
    return getRowIdFn(row)
  }
  if (typeof row === 'object' && row !== null && 'id' in row) {
    return String((row as any).id)
  }
  return String(index)
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Check if value matches search term
 */
export function matchesSearch(value: any, searchTerm: string): boolean {
  if (!searchTerm) return true
  if (value == null) return false

  const valueStr = String(value).toLowerCase()
  const searchStr = searchTerm.toLowerCase()

  return valueStr.includes(searchStr)
}