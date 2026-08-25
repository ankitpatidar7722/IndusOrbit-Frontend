import React from 'react'

interface FilterSectionProps {
  enableDateFilter?: boolean
  dateFrom?: Date | null
  dateTo?: Date | null
  onDateFromChange?: (date: Date | null) => void
  onDateToChange?: (date: Date | null) => void
  enableFiltering?: boolean
  onOpenAdvancedFilter: () => void
  activeFiltersCount?: number
}

export function FilterSection({
  enableDateFilter = false,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  enableFiltering = true,
  onOpenAdvancedFilter,
  activeFiltersCount = 0
}: FilterSectionProps) {
  // Date Filter and Advanced Filters removed from menu
  // These features are still available via DataGrid props but not shown in ActionsMenu
  return null
}
