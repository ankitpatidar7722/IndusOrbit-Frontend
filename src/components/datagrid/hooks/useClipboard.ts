'use client'

import { useCallback, useEffect } from 'react'
import { Table, Row } from '@tanstack/react-table'

export interface ClipboardConfig {
  enableCopy?: boolean
  enablePaste?: boolean
  copyFormat?: 'csv' | 'tsv' | 'json'
  includeHeaders?: boolean
}

export function useClipboard<TData>(
  table: Table<TData>,
  config: ClipboardConfig = {}
) {
  const {
    enableCopy = true,
    enablePaste = false,
    copyFormat = 'csv',
    includeHeaders = true
  } = config

  const getSelectedData = useCallback(() => {
    const selectedRows = table.getSelectedRowModel().rows
    const visibleColumns = table.getAllColumns().filter(col =>
      col.getIsVisible() && col.id !== 'select'
    )

    return {
      rows: selectedRows,
      columns: visibleColumns
    }
  }, [table])

  const formatDataAsCsv = useCallback(
    (rows: Row<TData>[], columns: any[]) => {
      const lines: string[] = []

      // Add headers if enabled
      if (includeHeaders) {
        const headers = columns.map(col => {
          const header = typeof col.columnDef.header === 'string'
            ? col.columnDef.header
            : col.id
          return `"${header}"`
        })
        lines.push(headers.join(','))
      }

      // Add data rows
      rows.forEach(row => {
        const values = columns.map(col => {
          const value = row.getValue(col.id)
          if (value === null || value === undefined) return ''

          // Escape quotes and wrap in quotes
          const stringValue = String(value).replace(/"/g, '""')
          return `"${stringValue}"`
        })
        lines.push(values.join(','))
      })

      return lines.join('\n')
    },
    [includeHeaders]
  )

  const formatDataAsTsv = useCallback(
    (rows: Row<TData>[], columns: any[]) => {
      const lines: string[] = []

      // Add headers if enabled
      if (includeHeaders) {
        const headers = columns.map(col => {
          const header = typeof col.columnDef.header === 'string'
            ? col.columnDef.header
            : col.id
          return header
        })
        lines.push(headers.join('\t'))
      }

      // Add data rows
      rows.forEach(row => {
        const values = columns.map(col => {
          const value = row.getValue(col.id)
          return value === null || value === undefined ? '' : String(value)
        })
        lines.push(values.join('\t'))
      })

      return lines.join('\n')
    },
    [includeHeaders]
  )

  const formatDataAsJson = useCallback(
    (rows: Row<TData>[], columns: any[]) => {
      const data = rows.map(row => {
        const rowData: Record<string, any> = {}
        columns.forEach(col => {
          rowData[col.id] = row.getValue(col.id)
        })
        return rowData
      })
      return JSON.stringify(data, null, 2)
    },
    []
  )

  const copyToClipboard = useCallback(
    async (customData?: string) => {
      try {
        if (customData) {
          await navigator.clipboard.writeText(customData)
          return true
        }

        const { rows, columns } = getSelectedData()

        if (rows.length === 0) {
          return false
        }

        let formattedData: string

        switch (copyFormat) {
          case 'csv':
            formattedData = formatDataAsCsv(rows, columns)
            break
          case 'tsv':
            formattedData = formatDataAsTsv(rows, columns)
            break
          case 'json':
            formattedData = formatDataAsJson(rows, columns)
            break
          default:
            formattedData = formatDataAsCsv(rows, columns)
        }

        await navigator.clipboard.writeText(formattedData)
        return true
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
        return false
      }
    },
    [getSelectedData, copyFormat, formatDataAsCsv, formatDataAsTsv, formatDataAsJson]
  )

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      return text
    } catch (error) {
      console.error('Failed to paste from clipboard:', error)
      return null
    }
  }, [])

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      // Ctrl+C to copy
      if (enableCopy && event.key === 'c' && (event.ctrlKey || event.metaKey)) {
        // Only handle if not in an input field
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return
        }

        event.preventDefault()
        const success = await copyToClipboard()
        if (success) {
          // You can add a toast notification here
        }
      }

      // Ctrl+V to paste (if enabled)
      if (enablePaste && event.key === 'v' && (event.ctrlKey || event.metaKey)) {
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return
        }

        event.preventDefault()
        const data = await pasteFromClipboard()
        if (data) {
          // Handle paste logic here (emit event, update data, etc.)
        }
      }
    },
    [enableCopy, enablePaste, copyToClipboard, pasteFromClipboard]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    copyToClipboard,
    pasteFromClipboard,
    getSelectedData
  }
}
