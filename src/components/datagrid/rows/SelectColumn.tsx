'use client'

import { ColumnDef } from '@tanstack/react-table'

export function createSelectColumn<TData>(): ColumnDef<TData> {
  return {
    id: 'select',
    header: ({ table }) => {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => {
              e.stopPropagation()
              table.toggleAllPageRowsSelected(e.target.checked)
            }}
            className="w-4 h-4 border border-gray-300 rounded cursor-pointer focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )
    },
    cell: ({ row }) => {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={(e) => {
              e.stopPropagation()
              row.toggleSelected(e.target.checked)
            }}
            className="w-4 h-4 border border-gray-300 rounded cursor-pointer focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )
    },
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    size: 30,
    maxSize: 30,
    minSize: 30,
    meta: {
      isSelectColumn: true,
      skipSearch: true
    }
  }
}