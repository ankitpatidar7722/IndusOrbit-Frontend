'use client'

import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectionCellProps {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  circular?: boolean
  mode?: 'checkbox' | 'radio' // checkbox = multi-select, radio = single-select
}

export function SelectionCell({
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  circular = false,
  mode = 'checkbox',
}: SelectionCellProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!disabled) {
      onChange(!checked)
    }
  }

  // Radio button mode (single selection) - always circular. Shows a check mark when selected.
  if (mode === 'radio') {
    return (
      <div
        onClick={handleClick}
        className={`
          relative rounded-full border-2 cursor-pointer transition-all duration-150
          flex items-center justify-center flex-shrink-0
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${
            checked
              ? 'border-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary))]'
              : 'border-gray-300 bg-white hover:border-gray-400'
          }
        `}
        style={{
          boxShadow: checked ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
          width: '16px',
          height: '16px',
          minWidth: '16px',
          minHeight: '16px',
        }}
      >
        {/* Round selector with a check mark when selected */}
        {checked && (
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
        )}
      </div>
    )
  }

  // Square checkbox (multi-select) - matches dropdown multi-select style
  if (!circular) {
    return (
      <div className="relative flex items-center justify-center flex-shrink-0" onClick={handleClick}>
        <input
          type="checkbox"
          checked={checked}
          ref={(el) => {
            if (el) el.indeterminate = indeterminate
          }}
          onChange={(e) => {
            e.stopPropagation()
            onChange(e.target.checked)
          }}
          disabled={disabled}
          className="peer sr-only"
        />
        <div className={cn(
          "w-4 h-4 rounded border-2 transition-all duration-150 flex items-center justify-center cursor-pointer",
          checked || indeterminate
            ? "bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]"
            : "border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] hover:border-[rgb(var(--color-primary))]",
          disabled && "opacity-50 cursor-not-allowed"
        )}>
          {checked && !indeterminate && (
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          )}
          {indeterminate && (
            <div className="w-2 h-0.5 bg-white rounded" />
          )}
        </div>
      </div>
    )
  }

  // Circular checkbox (AG Grid style, multi-select with circular prop)
  return (
    <div
      onClick={handleClick}
      className={`
        relative rounded-full border-2 cursor-pointer transition-all duration-150
        flex items-center justify-center flex-shrink-0
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${
          checked || indeterminate
            ? 'border-primary bg-primary'
            : 'border-gray-300 bg-white hover:border-gray-400'
        }
      `}
      style={{
        boxShadow: checked || indeterminate ? '0 0 0 2px rgba(59, 130, 246, 0.1)' : 'none',
        width: '14px',
        height: '14px',
        minWidth: '14px',
        minHeight: '14px',
      }}
    >
      {/* Inner dot */}
      {checked && !indeterminate && (
        <div className="w-1.5 h-1.5 rounded-full bg-white transition-all duration-150" />
      )}

      {/* Indeterminate line */}
      {indeterminate && (
        <div className="w-2 h-0.5 bg-white rounded transition-all duration-150" />
      )}
    </div>
  )
}

// Backward compatibility
export { SelectionCell as SelectionCheckbox }
