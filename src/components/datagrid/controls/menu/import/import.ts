import Papa from 'papaparse'
import ExcelJS from 'exceljs'

/**
 * Result of import operation
 */
export interface ImportResult<TData> {
  success: boolean
  data: TData[]
  errors: string[]
  warnings: string[]
  totalRows: number
  validRows: number
}

/**
 * Import data from CSV file
 */
export function importFromCSV<TData>(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ImportResult<TData>> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        onProgress?.(100)

        const errors: string[] = []
        const warnings: string[] = []
        const validData: TData[] = []

        results.data.forEach((row: any, index: number) => {
          try {
            // Basic validation - skip empty rows
            if (Object.values(row).every(value => !value)) {
              warnings.push(`Row ${index + 1}: Empty row skipped`)
              return
            }

            validData.push(row as TData)
          } catch (error) {
            errors.push(`Row ${index + 1}: ${(error as Error).message}`)
          }
        })

        resolve({
          success: errors.length === 0,
          data: validData,
          errors,
          warnings,
          totalRows: results.data.length,
          validRows: validData.length,
        })
      },
      error: (error) => {
        resolve({
          success: false,
          data: [],
          errors: [error.message],
          warnings: [],
          totalRows: 0,
          validRows: 0,
        })
      }
    })
  })
}

/**
 * Import data from Excel file
 */
export async function importFromExcel<TData>(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ImportResult<TData>> {
  try {
    const workbook = new ExcelJS.Workbook()
    const buffer = await file.arrayBuffer()
    await workbook.xlsx.load(buffer)

    onProgress?.(100)

    const worksheet = workbook.getWorksheet(1) // Get first worksheet
    const jsonData: any[] = []
    const errors: string[] = []
    const warnings: string[] = []
    const validData: TData[] = []

    if (!worksheet) {
      throw new Error('No worksheet found in Excel file')
    }

    // Get headers from first row
    const headerRow = worksheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`
    })

    // Process data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header row

      const rowData: any = {}
      let hasData = false

      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1]
        if (header) {
          rowData[header] = cell.value
          if (cell.value) hasData = true
        }
      })

      if (hasData) {
        jsonData.push(rowData)
      }
    })

    jsonData.forEach((row: any, index: number) => {
      try {
        if (Object.values(row).every(value => !value)) {
          warnings.push(`Row ${index + 2}: Empty row skipped`) // +2 because index starts at 0 and we skip header
          return
        }

        validData.push(row as TData)
      } catch (error) {
        errors.push(`Row ${index + 2}: ${(error as Error).message}`)
      }
    })

    return {
      success: errors.length === 0,
      data: validData,
      errors,
      warnings,
      totalRows: jsonData.length,
      validRows: validData.length,
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [(error as Error).message],
      warnings: [],
      totalRows: 0,
      validRows: 0,
    }
  }
}

/**
 * Import data from JSON file
 */
export function importFromJSON<TData>(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ImportResult<TData>> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        onProgress?.(100)

        const jsonData = JSON.parse(e.target?.result as string)
        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData]

        const errors: string[] = []
        const warnings: string[] = []
        const validData: TData[] = []

        dataArray.forEach((item: any, index: number) => {
          try {
            validData.push(item as TData)
          } catch (error) {
            errors.push(`Item ${index + 1}: ${(error as Error).message}`)
          }
        })

        resolve({
          success: errors.length === 0,
          data: validData,
          errors,
          warnings,
          totalRows: dataArray.length,
          validRows: validData.length,
        })
      } catch (error) {
        resolve({
          success: false,
          data: [],
          errors: ['Invalid JSON format'],
          warnings: [],
          totalRows: 0,
          validRows: 0,
        })
      }
    }
    reader.readAsText(file)
  })
}

/**
 * Unified import function that handles all formats
 */
export async function importData<TData>(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ImportResult<TData>> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase()

  switch (fileExtension) {
    case 'csv':
      return await importFromCSV<TData>(file, onProgress)
    case 'xlsx':
    case 'xls':
      return await importFromExcel<TData>(file, onProgress)
    case 'json':
      return await importFromJSON<TData>(file, onProgress)
    default:
      return {
        success: false,
        data: [],
        errors: ['Unsupported file format. Please use CSV, Excel, or JSON files.'],
        warnings: [],
        totalRows: 0,
        validRows: 0,
      }
  }
}
