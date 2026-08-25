import React from 'react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from 'indas-ui'
import { Download, FileSpreadsheet, FileText, File, FileJson } from 'lucide-react'
import { exportData } from './export'

interface ExportSectionProps<TData> {
  data: TData[]
  filename?: string
}

export function ExportSection<TData>({ data, filename = 'data-export' }: ExportSectionProps<TData>) {
  const handleExport = async (format: 'excel' | 'csv' | 'pdf' | 'json') => {
    try {
      await exportData(data, format, filename)
    } catch (error) {
      console.error('❌ [DataGrid Export] Export failed:', error)
    }
  }

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Download className="mr-2 h-4 w-4" />
          <span>Export to...</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => handleExport('excel')}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            <span>Excel (.xlsx)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('csv')}>
            <FileText className="mr-2 h-4 w-4" />
            <span>CSV (.csv)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('pdf')}>
            <File className="mr-2 h-4 w-4" />
            <span>PDF (.pdf)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('json')}>
            <FileJson className="mr-2 h-4 w-4" />
            <span>JSON (.json)</span>
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
    </>
  )
}
