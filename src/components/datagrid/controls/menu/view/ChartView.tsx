'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { ColumnDef } from '@tanstack/react-table'
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Activity,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from 'indas-ui'
import { Button } from 'indas-ui'
import { Dropdown } from 'indas-ui'
import { Badge } from 'indas-ui'

interface DataVisualizationProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  title?: string
}

type ChartType = 'bar' | 'line' | 'pie' | 'area'

const CHART_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6b7280', // Gray
]

export function DataVisualization<TData>({
  data,
  columns,
  title = "Data Insights"
}: DataVisualizationProps<TData>) {
  const [selectedChart, setSelectedChart] = useState<ChartType>('bar')
  const [xAxisColumn, setXAxisColumn] = useState<string>('')
  const [yAxisColumn, setYAxisColumn] = useState<string>('')
  const [groupByColumn, setGroupByColumn] = useState<string>('')

  // Extract numeric and categorical columns
  const numericColumns = useMemo(() => {
    return columns
      .filter((col) => (col as any).accessorKey || col.id)
      .filter((col) => {
        const key = (col as any).accessorKey as string || col.id!
        const sampleValues = data.slice(0, 10).map(row => (row as any)[key]).filter(val => val != null)
        return sampleValues.some(val => typeof val === 'number' && !isNaN(val))
      })
      .map((col) => ({
        key: (col as any).accessorKey as string || col.id!,
        label: (col.header as string) || (col as any).accessorKey as string || col.id!,
      }))
  }, [columns, data])

  const categoricalColumns = useMemo(() => {
    return columns
      .filter((col) => (col as any).accessorKey || col.id)
      .filter((col) => {
        const key = (col as any).accessorKey as string || col.id!
        const sampleValues = data.slice(0, 10).map(row => (row as any)[key]).filter(val => val != null)
        return sampleValues.some(val => typeof val === 'string' || typeof val === 'boolean')
      })
      .map((col) => ({
        key: (col as any).accessorKey as string || col.id!,
        label: (col.header as string) || (col as any).accessorKey as string || col.id!,
      }))
  }, [columns, data])

  // Set default columns
  React.useEffect(() => {
    if (!xAxisColumn && categoricalColumns.length > 0) {
      setXAxisColumn(categoricalColumns[0].key)
    }
    if (!yAxisColumn && numericColumns.length > 0) {
      setYAxisColumn(numericColumns[0].key)
    }
  }, [categoricalColumns, numericColumns, xAxisColumn, yAxisColumn])

  // Process data for charts
  const chartData = useMemo(() => {
    if (!xAxisColumn || !yAxisColumn || data.length === 0) return []

    if (groupByColumn) {
      // Group data by both x-axis and group columns
      const grouped = data.reduce((acc, item: any) => {
        const xValue = String(item[xAxisColumn] || 'Unknown')
        const groupValue = String(item[groupByColumn] || 'Unknown')
        const yValue = Number(item[yAxisColumn]) || 0

        if (!acc[xValue]) acc[xValue] = { [xAxisColumn]: xValue }
        if (!acc[xValue][groupValue]) acc[xValue][groupValue] = 0
        acc[xValue][groupValue] += yValue

        return acc
      }, {} as Record<string, any>)

      return Object.values(grouped)
    } else {
      // Simple aggregation by x-axis
      const grouped = data.reduce((acc, item: any) => {
        const xValue = String(item[xAxisColumn] || 'Unknown')
        const yValue = Number(item[yAxisColumn]) || 0

        if (!acc[xValue]) {
          acc[xValue] = { [xAxisColumn]: xValue, [yAxisColumn]: 0, count: 0 }
        }
        acc[xValue][yAxisColumn] += yValue
        acc[xValue].count += 1

        return acc
      }, {} as Record<string, any>)

      return Object.values(grouped).map((item: any) => ({
        ...item,
        [yAxisColumn]: item[yAxisColumn] / item.count, // Average
      }))
    }
  }, [data, xAxisColumn, yAxisColumn, groupByColumn])

  // Process data specifically for pie chart
  const pieChartData = useMemo(() => {
    if (!xAxisColumn || data.length === 0) return []

    const counts = data.reduce((acc, item: any) => {
      const value = String(item[xAxisColumn] || 'Unknown')
      acc[value] = (acc[value] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(counts).map(([name, value], index) => ({
      name,
      value,
      itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] }
    }))
  }, [data, xAxisColumn])

  // Get unique group values for legend
  const groupValues = useMemo(() => {
    if (!groupByColumn) return []
    return [...new Set(data.map((item: any) => String(item[groupByColumn] || 'Unknown')))]
  }, [data, groupByColumn])

  // ECharts options for Bar Chart
  const barChartOption = useMemo(() => {
    const categoryData = chartData.map((item: any) => item[xAxisColumn])

    const series = groupByColumn
      ? groupValues.map((groupValue, index) => ({
          name: groupValue,
          type: 'bar' as const,
          barMaxWidth: 40,
          itemStyle: {
            color: CHART_COLORS[index % CHART_COLORS.length],
            borderRadius: [4, 4, 0, 0]
          },
          data: chartData.map((item: any) => item[groupValue] || 0)
        }))
      : [{
          name: yAxisColumn,
          type: 'bar' as const,
          barMaxWidth: 40,
          itemStyle: {
            color: '#3b82f6',
            borderRadius: [4, 4, 0, 0]
          },
          data: chartData.map((item: any) => item[yAxisColumn])
        }]

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: '#344767', fontSize: 12 },
        axisPointer: { type: 'shadow' }
      },
      legend: groupByColumn ? { bottom: 0, left: 'center' } : undefined,
      grid: { top: 20, right: 20, bottom: groupByColumn ? 40 : 20, left: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: categoryData,
        axisLine: { lineStyle: { color: '#dee2e6' } },
        axisLabel: { color: '#666', fontSize: 12 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#666', fontSize: 12 },
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } }
      },
      series
    }
  }, [chartData, xAxisColumn, yAxisColumn, groupByColumn, groupValues])

  // ECharts options for Line Chart
  const lineChartOption = useMemo(() => {
    const categoryData = chartData.map((item: any) => item[xAxisColumn])

    const series = groupByColumn
      ? groupValues.map((groupValue, index) => ({
          name: groupValue,
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: CHART_COLORS[index % CHART_COLORS.length] },
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
          data: chartData.map((item: any) => item[groupValue] || 0)
        }))
      : [{
          name: yAxisColumn,
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
          data: chartData.map((item: any) => item[yAxisColumn])
        }]

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: '#344767', fontSize: 12 }
      },
      legend: groupByColumn ? { bottom: 0, left: 'center' } : undefined,
      grid: { top: 20, right: 20, bottom: groupByColumn ? 40 : 20, left: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: categoryData,
        axisLine: { lineStyle: { color: '#dee2e6' } },
        axisLabel: { color: '#666', fontSize: 12 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#666', fontSize: 12 },
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } }
      },
      series
    }
  }, [chartData, xAxisColumn, yAxisColumn, groupByColumn, groupValues])

  // ECharts options for Area Chart
  const areaChartOption = useMemo(() => {
    const categoryData = chartData.map((item: any) => item[xAxisColumn])

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: '#344767', fontSize: 12 }
      },
      grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categoryData,
        axisLine: { lineStyle: { color: '#dee2e6' } },
        axisLabel: { color: '#666', fontSize: 12 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#666', fontSize: 12 },
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } }
      },
      series: [{
        name: yAxisColumn,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#3b82f6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' }
            ]
          }
        },
        data: chartData.map((item: any) => item[yAxisColumn])
      }]
    }
  }, [chartData, xAxisColumn, yAxisColumn])

  // ECharts options for Pie Chart
  const pieChartOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: '#344767', fontSize: 12 },
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        bottom: 0,
        left: 'center',
        itemWidth: 12,
        itemHeight: 12
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}: {d}%'
        },
        emphasis: {
          scale: true,
          scaleSize: 5,
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        data: pieChartData
      }]
    }
  }, [pieChartData])

  const getChartOption = () => {
    switch (selectedChart) {
      case 'bar':
        return barChartOption
      case 'line':
        return lineChartOption
      case 'pie':
        return pieChartOption
      case 'area':
        return areaChartOption
      default:
        return barChartOption
    }
  }

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!yAxisColumn || data.length === 0) return null

    const values = data
      .map((item: any) => Number(item[yAxisColumn]))
      .filter(val => !isNaN(val))

    if (values.length === 0) return null

    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)

    return { sum, avg, min, max, count: values.length }
  }, [data, yAxisColumn])

  if (data.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-gray-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Data Available</h3>
          <p className="text-sm">Add some data to view visualizations</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Visual analysis of {data.length} records
          </p>
        </div>

        {/* Chart Type Selector */}
        <div className="flex items-center space-x-2">
          <Button
            variant={selectedChart === 'bar' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedChart('bar')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Bar
          </Button>
          <Button
            variant={selectedChart === 'line' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedChart('line')}
          >
            <LineChartIcon className="h-4 w-4 mr-2" />
            Line
          </Button>
          <Button
            variant={selectedChart === 'area' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedChart('area')}
          >
            <Activity className="h-4 w-4 mr-2" />
            Area
          </Button>
          <Button
            variant={selectedChart === 'pie' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedChart('pie')}
          >
            <PieChartIcon className="h-4 w-4 mr-2" />
            Pie
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      {summaryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {summaryStats.sum.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {summaryStats.avg.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">Average</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                {summaryStats.min.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Minimum</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">
                {summaryStats.max.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Maximum</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Chart Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                X-Axis ({selectedChart === 'pie' ? 'Category' : 'Categories'})
              </label>
              <Dropdown
                options={categoricalColumns.map((col) => ({
                  value: col.key,
                  label: col.label,
                }))}
                value={xAxisColumn}
                onValueChange={(value) => setXAxisColumn(Array.isArray(value) ? (value[0] || '') : String(value))}
                placeholder="Select column"
              />
            </div>

            {selectedChart !== 'pie' && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Y-Axis (Values)
                </label>
                <Dropdown
                  options={numericColumns.map((col) => ({
                    value: col.key,
                    label: col.label,
                  }))}
                  value={yAxisColumn}
                  onValueChange={(value) => setYAxisColumn(Array.isArray(value) ? (value[0] || '') : String(value))}
                  placeholder="Select column"
                />
              </div>
            )}

            {selectedChart !== 'pie' && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Group By (Optional)
                </label>
                <Dropdown
                  options={[
                    { value: '', label: 'None' },
                    ...categoricalColumns
                      .filter(col => col.key !== xAxisColumn)
                      .map((col) => ({
                        value: col.key,
                        label: col.label,
                      }))
                  ]}
                  value={groupByColumn}
                  onValueChange={(value) => setGroupByColumn(Array.isArray(value) ? (value[0] || '') : String(value))}
                  placeholder="None"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <motion.div
        key={selectedChart}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {selectedChart === 'pie'
                  ? `Distribution by ${categoricalColumns.find(col => col.key === xAxisColumn)?.label || 'Category'}`
                  : `${numericColumns.find(col => col.key === yAxisColumn)?.label || 'Value'} by ${categoricalColumns.find(col => col.key === xAxisColumn)?.label || 'Category'}`
                }
              </span>
              {groupByColumn && (
                <Badge variant="outline">
                  Grouped by {categoricalColumns.find(col => col.key === groupByColumn)?.label}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts
              option={getChartOption()}
              style={{ height: 400, width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// Export alias for cleaner naming
export { DataVisualization as ChartView }
