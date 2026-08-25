import React from 'react'
import { DropdownMenuItem, DropdownMenuSeparator } from 'indas-ui'
import { Columns3, Maximize2 } from 'lucide-react'

interface ColumnSectionProps {
  enableColumnVisibility?: boolean
  onOpenColumnChooser: () => void
  enableAutoResize?: boolean
  onAutoResize?: () => void
}

export function ColumnSection({
  enableColumnVisibility = true,
  onOpenColumnChooser,
  enableAutoResize = true,
  onAutoResize
}: ColumnSectionProps) {
  return (
    <>
      {enableColumnVisibility && (
        <DropdownMenuItem onClick={onOpenColumnChooser}>
          <Columns3 className="mr-2 h-4 w-4" />
          <span>Manage Columns</span>
        </DropdownMenuItem>
      )}

      {enableAutoResize && (
        <DropdownMenuItem onClick={onAutoResize}>
          <Maximize2 className="mr-2 h-4 w-4" />
          <span>Auto-resize All</span>
        </DropdownMenuItem>
      )}
    </>
  )
}
