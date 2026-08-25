import { ColumnSummary, SummaryAggregationType } from '../utils/grid-types'

/**
 * Calculate summary value for a column based on aggregation type
 */
export function calculateSummary<TData>(
  data: TData[],
  columnKey: string,
  config: ColumnSummary<TData>
): string | number {
  // Handle custom aggregation with customFn (receives data array)
  if (config.type === 'custom' && config.customFn) {
    return config.customFn(data)
  }

  // Handle custom value (no data dependency - just returns value)
  if (config.type === 'custom' && config.customValue) {
    return config.customValue()
  }

  // Extract values from data for the column
  const values = data
    .map((row: any) => row[columnKey])
    .filter((val) => val !== null && val !== undefined && val !== '')
    .map((val) => {
      // Try to convert to number
      const num = typeof val === 'number' ? val : parseFloat(val)
      return isNaN(num) ? null : num
    })
    .filter((val): val is number => val !== null)

  if (values.length === 0) {
    return config.type === 'count' ? 0 : ''
  }

  let result: number

  switch (config.type) {
    case 'sum':
      result = values.reduce((sum, val) => sum + val, 0)
      break

    case 'avg':
      result = values.reduce((sum, val) => sum + val, 0) / values.length
      break

    case 'count':
      result = values.length
      break

    case 'min':
      result = Math.min(...values)
      break

    case 'max':
      result = Math.max(...values)
      break

    default:
      return ''
  }

  // Apply custom formatting if provided
  if (config.format) {
    return config.format(result)
  }

  // Default formatting
  return result
}

/**
 * Calculate all summaries for the grid
 */
export function calculateAllSummaries<TData>(
  data: TData[],
  summaryConfig: Record<string, ColumnSummary<TData>>
): Record<string, string | number> {
  const summaries: Record<string, string | number> = {}

  for (const [columnKey, config] of Object.entries(summaryConfig)) {
    summaries[columnKey] = calculateSummary(data, columnKey, config)
  }

  return summaries
}
