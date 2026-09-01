'use client'

import { useEffect, useCallback, useState } from 'react'
import { Table } from '@tanstack/react-table'

export interface KeyboardNavigationConfig {
  enableArrowKeys?: boolean
  enableTabNavigation?: boolean
  enableEnterToEdit?: boolean
  enableSpaceToSelect?: boolean
  enableCtrlA?: boolean
}

export function useKeyboardNavigation<TData>(
  table: Table<TData>,
  config: KeyboardNavigationConfig = {}
) {
  const {
    enableArrowKeys = true,
    enableTabNavigation = true,
    enableEnterToEdit = true,
    enableSpaceToSelect = true,
    enableCtrlA = true
  } = config

  const [focusedCell, setFocusedCell] = useState<{
    rowIndex: number
    columnIndex: number
  } | null>(null)

  const rows = table.getRowModel().rows
  // Use the VISUAL leaf-column order (left-pinned → center → right-pinned) — the same order the
  // renderer maps cells with (row.getVisibleCells()). getAllColumns() is DEFINITION order, which
  // diverges from the visual order once any column is frozen/pinned/reordered, so arrow ←/→ would
  // land the highlight on the wrong cell. getVisibleLeafColumns() keeps nav in sync with the render.
  const columns = table.getVisibleLeafColumns()

  const moveFocus = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!focusedCell) {
        // Start at first cell
        setFocusedCell({ rowIndex: 0, columnIndex: 0 })
        return
      }

      let { rowIndex, columnIndex } = focusedCell

      switch (direction) {
        case 'up':
          rowIndex = Math.max(0, rowIndex - 1)
          break
        case 'down':
          rowIndex = Math.min(rows.length - 1, rowIndex + 1)
          break
        case 'left':
          columnIndex = Math.max(0, columnIndex - 1)
          break
        case 'right':
          columnIndex = Math.min(columns.length - 1, columnIndex + 1)
          break
      }

      setFocusedCell({ rowIndex, columnIndex })
    },
    [focusedCell, rows.length, columns.length]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Grid arrow-navigation only activates once the user has CLICKED a cell
      // (focusedCell set) and isn't typing in a field. This keeps the global
      // keydown listener from ever hijacking page scroll or search/filter inputs.
      if (!focusedCell) return
      const el = (event.target as HTMLElement) || (document.activeElement as HTMLElement)
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return

      // Arrow keys navigation (Up / Down / Left / Right)
      if (enableArrowKeys) {
        if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus('up'); return }
        if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus('down'); return }
        if (event.key === 'ArrowLeft') { event.preventDefault(); moveFocus('left'); return }
        if (event.key === 'ArrowRight') { event.preventDefault(); moveFocus('right'); return }
      }

      // Escape clears the active cell → arrow keys return to normal page behaviour
      if (event.key === 'Escape') { setFocusedCell(null); return }

      // Tab navigation (optional)
      if (enableTabNavigation && event.key === 'Tab') {
        event.preventDefault()
        moveFocus(event.shiftKey ? 'left' : 'right')
        return
      }

      // Space toggles the focused row's selection
      if (enableSpaceToSelect && event.key === ' ') {
        event.preventDefault()
        const row = rows[focusedCell.rowIndex]
        if (row) row.toggleSelected()
      }
    },
    [
      enableArrowKeys,
      enableTabNavigation,
      enableSpaceToSelect,
      focusedCell,
      moveFocus,
      rows
    ]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  const getCellClassName = useCallback(
    (rowIndex: number, columnIndex: number) => {
      if (
        focusedCell &&
        focusedCell.rowIndex === rowIndex &&
        focusedCell.columnIndex === columnIndex
      ) {
        return 'ring-2 ring-blue-500 bg-blue-50'
      }
      return ''
    },
    [focusedCell]
  )

  const setFocus = useCallback((rowIndex: number, columnIndex: number) => {
    setFocusedCell({ rowIndex, columnIndex })
  }, [])

  const clearFocus = useCallback(() => {
    setFocusedCell(null)
  }, [])

  return {
    focusedCell,
    setFocus,
    clearFocus,
    getCellClassName,
    moveFocus
  }
}
