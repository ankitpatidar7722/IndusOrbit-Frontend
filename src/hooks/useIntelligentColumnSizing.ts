import { useMemo, useCallback } from 'react'
import { ColumnDef } from '@tanstack/react-table'

export interface ColumnSizingConfig {
  // Global intelligent settings
  globalMinWidth?: number // Absolute minimum (default: 30px)
  globalMaxWidth?: number // Absolute maximum (default: 500px)
  paddingBuffer?: number // Extra padding around content
  sampleSize?: number // How many rows to analyze (default: 100)
  enableIntelligentSizing?: boolean
}

export interface ColumnSizeConstraints {
  minWidth: number
  maxWidth: number
  contentWidth: number
  optimalWidth: number
  dataType?: 'text' | 'number' | 'date' | 'boolean' | 'array' | 'badge' | 'action'
  variance?: number // How much content varies in width
}

const DEFAULT_CONFIG: Required<ColumnSizingConfig> = {
  globalMinWidth: 30, // Very small - will be overridden by content
  globalMaxWidth: 300, // Maximum column width
  paddingBuffer: 4, // Extra padding buffer
  sampleSize: 100, // Sample first 100 rows for performance
  enableIntelligentSizing: true
}

// Internal defaults for calculations
const CALCULATION_DEFAULTS = {
  characterWidth: 7, // Average character width for 12px font (text-xs)
  headerPadding: 8, // 4px left + 4px right (matches px-1 in CSS)
  cellPadding: 8,   // 4px left + 4px right (matches px-1 in CSS)
}

/**
 * Hook for intelligent column sizing based on content analysis
 * Automatically calculates optimal column widths based on content
 * MERGED: Best features from useAutoIntelligentSizing + useIntelligentColumnSizing
 */
export function useIntelligentColumnSizing<TData>(
  data: TData[],
  columns: ColumnDef<TData>[],
  config: ColumnSizingConfig = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  // Smart content analyzer - detects data type and calculates optimal width
  const analyzeContent = useCallback((columnId: string, sampleData: TData[]) => {
    const values = sampleData.map(row => (row as any)[columnId]).filter(v => v !== null && v !== undefined)

    if (values.length === 0) {
      return {
        dataType: 'text' as 'text' | 'number' | 'date' | 'boolean' | 'array' | 'badge' | 'action',
        widths: [80], // Default fallback
        avgLength: 0
      }
    }

    // Smart type detection
    let dataType: 'text' | 'number' | 'date' | 'boolean' | 'array' | 'badge' | 'action' = 'text'
    const widths: number[] = []

    values.forEach(value => {
      let displayText = ''
      let detectedType: typeof dataType = 'text'

      if (typeof value === 'number') {
        detectedType = 'number'
        // Smart number formatting detection
        const formattedNumber = value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        if (columnId.toLowerCase().includes('salary') || columnId.toLowerCase().includes('price')) {
          displayText = `$${formattedNumber}`
        } else if (columnId.toLowerCase().includes('percent') || columnId.toLowerCase().includes('performance')) {
          displayText = `${value}%`
        } else {
          displayText = formattedNumber
        }
      } else if (typeof value === 'boolean') {
        detectedType = 'boolean'
        displayText = value ? 'Yes' : 'No'
      } else if (Array.isArray(value)) {
        detectedType = 'array'
        displayText = value.length > 2 ? `${value.slice(0, 2).join(', ')} +${value.length - 2}` : value.join(', ')
      } else if (typeof value === 'string') {
        // Smart string type detection
        if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
          detectedType = 'date'
        } else if (value.length < 20 && ['active', 'inactive', 'pending', 'approved', 'rejected', 'admin', 'user', 'manager'].includes(value.toLowerCase())) {
          detectedType = 'badge'
        }
        displayText = String(value)
      } else {
        displayText = String(value)
      }

      // Calculate display width (8px per character average + smart type-based adjustments)
      let pixelWidth = displayText.length * CALCULATION_DEFAULTS.characterWidth

      // Smart adjustments based on content type
      if (detectedType === 'number') pixelWidth += 10 // Numbers need extra space for formatting
      if (detectedType === 'badge') pixelWidth += 20 // Badges have padding and borders
      if (detectedType === 'array') pixelWidth += 15 // Arrays have spacing between items
      if (detectedType === 'date') pixelWidth += 5 // Dates are consistent but need slight buffer

      widths.push(pixelWidth)

      // Set the most common type
      if (dataType === 'text' || detectedType !== 'text') {
        dataType = detectedType
      }
    })

    return {
      dataType,
      widths,
      avgLength: widths.reduce((sum, w) => sum + w, 0) / widths.length
    }
  }, [])

  // Intelligent analysis of all columns
  const columnAnalysis = useMemo(() => {
    if (!finalConfig.enableIntelligentSizing || !data.length) {
      return new Map<string, ColumnSizeConstraints>()
    }

    const analysis = new Map<string, ColumnSizeConstraints>()
    const sampleData = data.slice(0, Math.min(finalConfig.sampleSize, data.length))

    columns.forEach(column => {
      const columnId = column.id || (column as any).accessorKey
      if (!columnId || columnId === 'select' || columnId === 'actions') return

      // Get column configuration from meta
      const columnMeta = column.meta as any
      const metaMinWidth = columnMeta?.minWidth
      const metaMaxWidth = columnMeta?.maxWidth

      // Calculate header text width
      const headerText = typeof column.header === 'string' ? column.header : columnId
      const headerWidth = (headerText.length * CALCULATION_DEFAULTS.characterWidth) + CALCULATION_DEFAULTS.headerPadding

      // Analyze content with smart type detection
      const contentAnalysis = analyzeContent(columnId, sampleData)

      // Calculate content statistics
      const maxContentWidth = Math.max(...contentAnalysis.widths, 0)
      const avgContentWidth = contentAnalysis.avgLength
      const minContentWidth = Math.min(...contentAnalysis.widths, 0)

      // Calculate variance (how much content size varies)
      const variance = contentAnalysis.widths.length > 1
        ? Math.sqrt(contentAnalysis.widths.reduce((sum, w) => sum + Math.pow(w - avgContentWidth, 2), 0) / contentAnalysis.widths.length)
        : 0

      // BALANCED LOGIC: Compare header vs content, use intelligent rules
      // Calculate header-to-content ratio
      const headerToContentRatio = headerWidth / Math.max(maxContentWidth, 1)

      // Dynamic buffer based on content type
      let contentBuffer: number
      if (contentAnalysis.dataType === 'badge' || contentAnalysis.dataType === 'boolean') {
        contentBuffer = 15
      } else if (contentAnalysis.dataType === 'number') {
        contentBuffer = 25
      } else if (contentAnalysis.dataType === 'date') {
        contentBuffer = 20
      } else if (variance > avgContentWidth * 0.5) {
        contentBuffer = 35
      } else {
        contentBuffer = 30
      }

      // Optimal width calculation with intelligent rules
      let optimalWidth: number

      // Calculate base width from content
      const baseContentWidth = variance > avgContentWidth * 0.5
        ? avgContentWidth + contentBuffer
        : maxContentWidth + contentBuffer

      // Rule 1: If header is much wider than content (ratio > 1.8), use compromise
      if (headerToContentRatio > 1.8) {
        // Use 60% content + 40% header (let header wrap significantly)
        optimalWidth = (baseContentWidth * 0.6) + (headerWidth * 0.4)
      }
      // Rule 2: If header is moderately wider (ratio 1.2-1.8), use balanced approach
      else if (headerToContentRatio > 1.2) {
        // Use 50% content + 50% header (balanced)
        optimalWidth = (baseContentWidth * 0.5) + (headerWidth * 0.5)
      }
      // Rule 3: If content is wider or similar to header, use content
      else {
        // Use content width (header fits comfortably)
        optimalWidth = baseContentWidth
      }

      // Minimum width = reasonable minimum, not too cramped
      const actualMinWidth = Math.max(
        minContentWidth + 20,
        finalConfig.globalMinWidth
      )

      // Apply meta overrides if present
      const finalMinWidth = metaMinWidth || actualMinWidth
      const finalMaxWidth = metaMaxWidth || finalConfig.globalMaxWidth

      // Final optimal width = content-based but capped at max
      const finalWidth = Math.min(
        Math.max(finalMinWidth, optimalWidth), // At least minimum, prefer optimal
        finalMaxWidth // But never exceed maximum
      )

      analysis.set(columnId, {
        minWidth: finalMinWidth,
        maxWidth: finalMaxWidth,
        contentWidth: maxContentWidth,
        optimalWidth: finalWidth,
        dataType: contentAnalysis.dataType,
        variance
      })
    })

    return analysis
  }, [data, columns, finalConfig, analyzeContent])

  // Get optimal width for a specific column
  const getColumnWidth = useCallback((columnId: string): number => {
    const analysis = columnAnalysis.get(columnId)
    return analysis?.optimalWidth || finalConfig.globalMinWidth
  }, [columnAnalysis, finalConfig.globalMinWidth])

  // Get sizing constraints for a column
  const getColumnConstraints = useCallback((columnId: string): ColumnSizeConstraints | null => {
    return columnAnalysis.get(columnId) || null
  }, [columnAnalysis])

  // Get sizing summary for debugging/monitoring
  const getSizingSummary = useCallback(() => {
    const summary: Record<string, any> = {}
    columnAnalysis.forEach((constraints, columnId) => {
      summary[columnId] = {
        optimal: constraints.optimalWidth,
        min: constraints.minWidth,
        max: constraints.maxWidth,
        content: constraints.contentWidth,
        type: constraints.dataType,
        variance: constraints.variance
      }
    })
    return summary
  }, [columnAnalysis])

  // Recalculate widths (useful when data changes)
  const recalculateWidths = useCallback(() => {
    return getSizingSummary()
  }, [getSizingSummary])

  // Auto-resize all columns to optimal width
  const autoResizeAllColumns = useCallback((table: any) => {
    if (!table?.getAllColumns) return

    const allColumns = table.getAllColumns()
    allColumns.forEach((column: any) => {
      const columnId = column.id
      const optimalWidth = getColumnWidth(columnId)
      if (column.setSize) {
        column.setSize(optimalWidth)
      }
    })
  }, [getColumnWidth])

  // Smart resize based on content changes (single column)
  const smartResize = useCallback((columnId: string, table: any) => {
    const column = table?.getColumn?.(columnId)
    if (!column?.setSize) return

    const optimalWidth = getColumnWidth(columnId)
    column.setSize(optimalWidth)
  }, [getColumnWidth])

  // Apply intelligent sizing to column definitions
  const enhancedColumns = useMemo(() => {
    if (!finalConfig.enableIntelligentSizing) {
      return columns
    }

    return columns.map(column => {
      const columnId = column.id || (column as any).accessorKey
      if (!columnId) return column

      const constraints = columnAnalysis.get(columnId)
      if (!constraints) return column

      return {
        ...column,
        size: constraints.optimalWidth,
        minSize: constraints.minWidth,
        // maxSize intentionally not set here - allows users to drag columns wider than calculated optimal
        // The calculated maxWidth is only used for auto-sizing, not for limiting manual resize
        enableResizing: true
      }
    })
  }, [columns, columnAnalysis, finalConfig])

  return {
    // Enhanced columns with intelligent sizing
    enhancedColumns,

    // Utilities
    getColumnWidth,
    getColumnConstraints,
    getSizingSummary,
    recalculateWidths,
    autoResizeAllColumns,
    smartResize,

    // Analysis data
    columnAnalysis: Object.fromEntries(columnAnalysis),

    // Configuration
    config: finalConfig,

    // Statistics
    stats: {
      totalColumns: columnAnalysis.size,
      avgOptimalWidth: Array.from(columnAnalysis.values()).reduce((sum, c) => sum + c.optimalWidth, 0) / columnAnalysis.size || 0,
      minWidth: Math.min(...Array.from(columnAnalysis.values()).map(c => c.optimalWidth), finalConfig.globalMaxWidth),
      maxWidth: Math.max(...Array.from(columnAnalysis.values()).map(c => c.optimalWidth), finalConfig.globalMinWidth)
    }
  }
}

/**
 * Helper function to create a column with intelligent sizing options
 */
export function createIntelligentColumn<TData>(
  columnDef: ColumnDef<TData>,
  sizingOptions?: {
    minWidth?: number
    maxWidth?: number
    priority?: 'compact' | 'comfortable' | 'spacious'
  }
): ColumnDef<TData> {
  return {
    ...columnDef,
    meta: {
      ...columnDef.meta,
      minWidth: sizingOptions?.minWidth,
      maxWidth: sizingOptions?.maxWidth,
      priority: sizingOptions?.priority
    }
  }
}

/**
 * Preset configurations for common use cases
 */
export const COLUMN_SIZING_PRESETS = {
  compact: {
    globalMinWidth: 20,
    globalMaxWidth: 200,
    paddingBuffer: 4,
    sampleSize: 50
  },
  standard: {
    globalMinWidth: 30,
    globalMaxWidth: 300,
    paddingBuffer: 4,
    sampleSize: 100
  }
} as const
