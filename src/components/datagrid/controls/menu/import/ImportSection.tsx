'use client'

import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { DropdownMenuItem, DropdownMenuSeparator } from 'indas-ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'indas-ui'
import { Card, CardContent, CardHeader, CardTitle } from 'indas-ui'
import { Progress } from 'indas-ui'
import { Alert, AlertDescription } from 'indas-ui'
import { Button } from 'indas-ui'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  File,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react'
import { importData, ImportResult } from './import'

interface ImportSectionProps<TData> {
  onImport: (data: TData[]) => void
}

export function ImportSection<TData>({ onImport }: ImportSectionProps<TData>) {
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult<TData> | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file import
  const handleFileImport = async (file: File) => {
    setIsImporting(true)
    setUploadProgress(0)
    setImportResult(null)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 100)

    try {
      const result = await importData<TData>(file, (progress) => {
        clearInterval(progressInterval)
        setUploadProgress(progress)
      })
      setImportResult(result)
    } catch (error) {
      console.error('❌ [DataGrid Import] Import failed:', error)
      setImportResult({
        success: false,
        data: [],
        errors: [(error as Error).message],
        warnings: [],
        totalRows: 0,
        validRows: 0,
      })
    }
    setIsImporting(false)
  }

  const handleImportConfirm = () => {
    if (importResult && importResult.data.length > 0) {
      onImport(importResult.data)
      setShowImportDialog(false)
      setImportResult(null)
    }
  }

  const handleImportCancel = () => {
    setShowImportDialog(false)
    setImportResult(null)
    setIsImporting(false)
    setUploadProgress(0)
  }

  return (
    <>
      <DropdownMenuItem onClick={() => setShowImportDialog(true)}>
        <Upload className="mr-2 h-4 w-4" />
        <span>Import Data</span>
      </DropdownMenuItem>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl bg-[rgb(var(--bg-surface))]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Import Data</span>
              <Button variant="ghost" size="sm" onClick={handleImportCancel}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {!importResult && !isImporting && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select File</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-[rgb(var(--bd-default))] border-dashed rounded-lg cursor-pointer bg-[rgb(var(--bg-muted))] hover:bg-[rgb(var(--bg-hover))]">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-4 text-[rgb(var(--color-icon))]" />
                          <p className="mb-2 text-sm text-[rgb(var(--fg-default))]">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-[rgb(var(--fg-muted))]">
                            CSV, Excel, or JSON files
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".csv,.xlsx,.xls,.json"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileImport(file)
                          }}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center text-xs text-[rgb(var(--fg-muted))]">
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>CSV</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Excel</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <File className="h-4 w-4" />
                        <span>JSON</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isImporting && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="text-center">
                        <Upload className="h-8 w-8 mx-auto mb-4 text-[rgb(var(--color-primary))] animate-bounce" />
                        <h3 className="text-lg font-medium">Processing file...</h3>
                        <p className="text-sm text-[rgb(var(--fg-muted))]">Please wait while we import your data</p>
                      </div>
                      <Progress value={uploadProgress} className="w-full" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {importResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      {importResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span>Import Results</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {importResult.totalRows}
                          </div>
                          <div className="text-sm text-blue-600 dark:text-blue-400">Total Rows</div>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {importResult.validRows}
                          </div>
                          <div className="text-sm text-green-600 dark:text-green-400">Valid Rows</div>
                        </div>
                      </div>

                      {/* Errors */}
                      {importResult.errors.length > 0 && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="font-medium mb-2">Errors found:</div>
                            <ul className="text-sm space-y-1">
                              {importResult.errors.slice(0, 5).map((error, index) => (
                                <li key={index} className="text-red-600 dark:text-red-400">• {error}</li>
                              ))}
                              {importResult.errors.length > 5 && (
                                <li className="text-[rgb(var(--fg-muted))]">
                                  ... and {importResult.errors.length - 5} more errors
                                </li>
                              )}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Warnings */}
                      {importResult.warnings.length > 0 && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="font-medium mb-2">Warnings:</div>
                            <ul className="text-sm space-y-1">
                              {importResult.warnings.slice(0, 3).map((warning, index) => (
                                <li key={index} className="text-yellow-600 dark:text-yellow-400">• {warning}</li>
                              ))}
                              {importResult.warnings.length > 3 && (
                                <li className="text-[rgb(var(--fg-muted))]">
                                  ... and {importResult.warnings.length - 3} more warnings
                                </li>
                              )}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Actions */}
          {importResult && (
            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-[rgb(var(--bd-default))]">
              <Button variant="outline" onClick={handleImportCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleImportConfirm}
                disabled={importResult.validRows === 0}
              >
                Import {importResult.validRows} Records
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
