import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatNumber(num: number, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

export function formatPercentage(value: number, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Converts a Date object to YYYY-MM-DD string using local timezone
 * Avoids UTC conversion issues that occur with toISOString()
 * @param date - Date object to convert
 * @returns Date string in YYYY-MM-DD format (local timezone)
 */
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Convert module name to route path.
 * ModuleName from DB is already a path (e.g. /home, /enquiry).
 * Fallback handles legacy display names by converting to kebab-case.
 */
export function getModuleRoutePath(moduleName: string): string {
  if (moduleName.startsWith('/')) return moduleName
  if (moduleName.includes('.aspx')) return '#'
  const normalizedModuleName = moduleName.toLowerCase().trim()
  if (['rapid estimation', 'rapid-estimation', 'rapid', 'estimation-steps', 'estimation steps', 'step estimation', 'estimation-mobile', 'estimation mobile', 'dynamic fill', 'dynamic fill costing'].includes(normalizedModuleName)) return '/costing/estimation/rapid'
  return `/${moduleName.toLowerCase().trim().replace(/\s+/g, '-')}`
}

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

// Numeric-aware string compare so "10" sorts after "9", not after "1".
export function naturalCompare(a: unknown, b: unknown): number {
  return naturalCollator.compare(String(a ?? ''), String(b ?? ''))
}
