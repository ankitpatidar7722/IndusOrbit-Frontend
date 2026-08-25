'use client'

import React from 'react'

interface BooleanCellProps {
  value: boolean
  variant?: 'success' | 'info' | 'warning' | 'danger'
}

/**
 * Standardized Boolean Cell Component for DataGrid
 * Displays a compact checkmark or X icon in a colored circle
 * Matches the Die availability column style from machine planning grid
 */
export function BooleanCell({ value, variant = 'success' }: BooleanCellProps) {
  // Color mapping based on variant
  const colors = {
    success: {
      bg: 'bg-[rgb(var(--color-success-subtle))]',
      text: 'text-[rgb(var(--color-success))]',
      falseBg: 'bg-[rgb(var(--bg-hover))]',
      falseText: 'text-[rgb(var(--fg-muted))]'
    },
    info: {
      bg: 'bg-[rgb(var(--color-primary-subtle))]',
      text: 'text-[rgb(var(--color-primary))]',
      falseBg: 'bg-[rgb(var(--bg-hover))]',
      falseText: 'text-[rgb(var(--fg-muted))]'
    },
    warning: {
      bg: 'bg-[rgb(var(--color-warning-subtle))]',
      text: 'text-[rgb(var(--color-warning))]',
      falseBg: 'bg-[rgb(var(--bg-hover))]',
      falseText: 'text-[rgb(var(--fg-muted))]'
    },
    danger: {
      bg: 'bg-[rgb(var(--color-error-subtle))]',
      text: 'text-[rgb(var(--color-error))]',
      falseBg: 'bg-[rgb(var(--bg-hover))]',
      falseText: 'text-[rgb(var(--fg-muted))]'
    }
  }

  const colorScheme = colors[variant]

  return value ? (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${colorScheme.bg} ${colorScheme.text}`}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
      </svg>
    </span>
  ) : (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${colorScheme.falseBg} ${colorScheme.falseText}`}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
      </svg>
    </span>
  )
}

BooleanCell.displayName = 'BooleanCell'
