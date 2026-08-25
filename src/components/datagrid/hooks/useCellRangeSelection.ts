'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface CellPosition {
  rowIndex: number
  columnIndex: number
}

export interface CellRange {
  start: CellPosition
  end: CellPosition
}

export function useCellRangeSelection() {
  const [range, setRange] = useState<CellRange | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const startCellRef = useRef<CellPosition | null>(null)

  const handleMouseDown = useCallback((rowIndex: number, columnIndex: number, event: React.MouseEvent) => {
    // Only start selection on left click without modifiers (except shift)
    if (event.button !== 0) return

    const start = { rowIndex, columnIndex }
    startCellRef.current = start

    if (event.shiftKey && range) {
      // Extend existing range
      setRange({
        start: range.start,
        end: start
      })
    } else {
      // Start new range
      setRange({
        start,
        end: start
      })
      setIsSelecting(true)
    }
  }, [range])

  const handleMouseEnter = useCallback((rowIndex: number, columnIndex: number) => {
    if (isSelecting && startCellRef.current) {
      setRange({
        start: startCellRef.current,
        end: { rowIndex, columnIndex }
      })
    }
  }, [isSelecting])

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false)
  }, [])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsSelecting(false)
    }

    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [])

  const isCellInRange = useCallback((rowIndex: number, columnIndex: number): boolean => {
    if (!range) return false

    const { start, end } = range
    const minRow = Math.min(start.rowIndex, end.rowIndex)
    const maxRow = Math.max(start.rowIndex, end.rowIndex)
    const minCol = Math.min(start.columnIndex, end.columnIndex)
    const maxCol = Math.max(start.columnIndex, end.columnIndex)

    return (
      rowIndex >= minRow &&
      rowIndex <= maxRow &&
      columnIndex >= minCol &&
      columnIndex <= maxCol
    )
  }, [range])

  const getCellClassName = useCallback((rowIndex: number, columnIndex: number): string => {
    if (!range) return ''

    if (isCellInRange(rowIndex, columnIndex)) {
      const { start, end } = range
      const minRow = Math.min(start.rowIndex, end.rowIndex)
      const maxRow = Math.max(start.rowIndex, end.rowIndex)
      const minCol = Math.min(start.columnIndex, end.columnIndex)
      const maxCol = Math.max(start.columnIndex, end.columnIndex)

      let className = 'bg-blue-100 '

      // Add border classes for range edges
      if (rowIndex === minRow) className += 'border-t-2 border-t-blue-500 '
      if (rowIndex === maxRow) className += 'border-b-2 border-b-blue-500 '
      if (columnIndex === minCol) className += 'border-l-2 border-l-blue-500 '
      if (columnIndex === maxCol) className += 'border-r-2 border-r-blue-500 '

      return className.trim()
    }

    return ''
  }, [range, isCellInRange])

  const clearRange = useCallback(() => {
    setRange(null)
    startCellRef.current = null
    setIsSelecting(false)
  }, [])

  const getSelectedCells = useCallback((): CellPosition[] => {
    if (!range) return []

    const { start, end } = range
    const minRow = Math.min(start.rowIndex, end.rowIndex)
    const maxRow = Math.max(start.rowIndex, end.rowIndex)
    const minCol = Math.min(start.columnIndex, end.columnIndex)
    const maxCol = Math.max(start.columnIndex, end.columnIndex)

    const cells: CellPosition[] = []

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        cells.push({ rowIndex: row, columnIndex: col })
      }
    }

    return cells
  }, [range])

  const selectAll = useCallback((rowCount: number, columnCount: number) => {
    setRange({
      start: { rowIndex: 0, columnIndex: 0 },
      end: { rowIndex: rowCount - 1, columnIndex: columnCount - 1 }
    })
  }, [])

  return {
    range,
    isSelecting,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    isCellInRange,
    getCellClassName,
    clearRange,
    getSelectedCells,
    selectAll
  }
}
