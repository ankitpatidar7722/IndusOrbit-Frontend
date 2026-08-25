import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/** Format any cell value into a clean string. Avoids "[object Object]" and stray nulls. */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

/**
 * Build headers + rows for export. The DataGrid already hands us rows keyed by their
 * visible column header labels (in display order), so the object keys ARE the headers.
 */
function buildExportRows<TData>(
  data: TData[]
): { headers: string[]; keys: string[]; rows: string[][] } {
  if (data.length === 0) return { headers: [], keys: [], rows: [] }

  const keys = Object.keys(data[0] as any)
  const rows = data.map(item => keys.map(key => formatCellValue((item as any)[key])))

  return { headers: keys, keys, rows }
}

/**
 * Export data to CSV format
 */
export function exportToCSV<TData>(data: TData[], filename: string = 'data-export') {
  try {
    const { headers, rows } = buildExportRows(data)
    const csv = Papa.unparse({ fields: headers, data: rows })
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    saveAs(blob, `${filename}.csv`)
  } catch (error) {
    console.error('❌ [DataGrid Export] CSV export failed:', error)
    throw error
  }
}

/**
 * Export data to Excel format
 */
export async function exportToExcel<TData>(data: TData[], filename: string = 'data-export') {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data')

    const { headers, rows } = buildExportRows(data)

    if (headers.length > 0) {
      worksheet.addRow(headers)

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF003366' } // brand primary (#003366)
      }

      rows.forEach(row => worksheet.addRow(row))

      // Auto-size columns from header + cell content length
      worksheet.columns.forEach((column, index) => {
        let maxLength = headers[index]?.length || 10
        rows.forEach(row => {
          const cell = row[index]
          if (cell) maxLength = Math.max(maxLength, cell.length)
        })
        column.width = Math.min(maxLength + 2, 50)
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    saveAs(blob, `${filename}.xlsx`)
  } catch (error) {
    console.error('❌ [DataGrid Export] Excel export failed:', error)
    throw error
  }
}

/**
 * Export data to PDF format.
 * Landscape, auto-fit columns, line-wrapped cells, repeated headers, page numbers.
 */
export function exportToPDF<TData>(data: TData[], filename: string = 'data-export') {
  try {
    const { headers, rows } = buildExportRows(data)

    // Landscape fits wide grids; switch to portrait only for very narrow tables.
    const orientation = headers.length <= 4 ? 'portrait' : 'landscape'
    const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()

    const title = filename.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    doc.setFontSize(14)
    doc.text(title, 40, 40)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(`Date and Time: ${new Date().toLocaleString()}`, 40, 56)
    doc.setTextColor(0)

    if (headers.length > 0) {
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 70,
        theme: 'striped',
        headStyles: {
          fillColor: [0, 51, 102], // brand primary (#003366)
          textColor: 255,
          fontStyle: 'bold',
          halign: 'left',
        },
        styles: {
          fontSize: 7,
          cellPadding: 3,
          overflow: 'linebreak',  // wrap long cells instead of overflowing the page
          valign: 'middle',
        },
        // Let autoTable distribute width across the page, capping any single column.
        tableWidth: 'auto',
        margin: { top: 70, left: 40, right: 40, bottom: 40 },
        didDrawPage: (hookData) => {
          const pageCount = doc.getNumberOfPages()
          const pageCurrent = hookData.pageNumber
          doc.setFontSize(8)
          doc.setTextColor(120)
          doc.text(
            `Page ${pageCurrent} of ${pageCount}`,
            pageWidth - 40,
            doc.internal.pageSize.getHeight() - 20,
            { align: 'right' }
          )
          doc.setTextColor(0)
        },
      })
    } else {
      doc.setFontSize(11)
      doc.text('No data to export.', 40, 80)
    }

    doc.save(`${filename}.pdf`)
  } catch (error) {
    console.error('❌ [DataGrid Export] PDF export failed:', error)
    throw error
  }
}

/**
 * Export data to JSON format
 */
export function exportToJSON<TData>(data: TData[], filename: string = 'data-export') {
  try {
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    saveAs(blob, `${filename}.json`)
  } catch (error) {
    console.error('❌ [DataGrid Export] JSON export failed:', error)
    throw error
  }
}

/**
 * Unified export function that handles all formats.
 */
export async function exportData<TData>(
  data: TData[],
  format: 'excel' | 'csv' | 'pdf' | 'json',
  filename: string = 'data-export'
) {
  switch (format) {
    case 'excel':
      return await exportToExcel(data, filename)
    case 'csv':
      return exportToCSV(data, filename)
    case 'pdf':
      return exportToPDF(data, filename)
    case 'json':
      return exportToJSON(data, filename)
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}
