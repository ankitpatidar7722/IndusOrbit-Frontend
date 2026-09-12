'use client'

/**
 * ActionsColumn Component
 *
 * A comprehensive, flexible actions column for DataGrid with STANDARDIZED button sizing.
 * All action buttons use consistent inline style (p-1, h-4 w-4 icons) to ensure uniform
 * row heights across ALL grids in the application.
 *
 * Features:
 * - Basic CRUD operations (View, Edit, Delete, Duplicate)
 * - Advanced actions (Pin, Favorite, Archive, Restore, Export, Copy)
 * - Multiple display modes (buttons, dropdown, mixed)
 * - Conditional action visibility
 * - Row state management (pinned, favorited, archived, protected)
 * - Confirmation dialogs for destructive actions
 * - Standardized inline buttons (4px padding, 16px icons)
 * - Optional status badges (disabled by default to maintain row height)
 *
 * @example
 * // Simple usage with buttons (most common)
 * const actionsColumn = createActionsColumn({
 *   onEdit: (row) => handleEdit(row),
 *   onDelete: (row) => handleDelete(row.id),
 *   showEdit: true,
 *   showDelete: true,
 *   mode: 'buttons',
 *   primaryActions: ['edit', 'delete']
 * })
 *
 * @example
 * // Advanced usage with conditional display
 * const actionsColumn = createActionsColumn({
 *   onEdit: (row) => handleEdit(row),
 *   onDelete: (row) => handleDelete(row.id),
 *   onArchive: (row) => handleArchive(row.id),
 *   showEdit: (row) => !row.isLocked,
 *   showDelete: (row) => row.canDelete,
 *   isProtected: (row) => row.isSystem,
 *   mode: 'mixed',
 *   primaryActions: ['edit', 'delete']
 * })
 */

import React, { useState, useCallback, useMemo } from 'react'
import { usePageAccess } from '@/contexts/ModuleAuthContext'
import {
  Edit,
  Trash2,
  Eye,
  Copy,
  MoreVertical,
  Pin,
  PinOff,
  Star,
  StarOff,
  Download,
  Printer,
  AlertTriangle,
  Archive,
  RotateCcw,
  Files,
  Share2,
  Lock,
  Ban,
  CheckCircle,
  Settings,
  Target,
} from 'lucide-react'

import { Button } from 'indas-ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from 'indas-ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'indas-ui'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'indas-ui'
import { Badge } from 'indas-ui'
import { useGlobalAlert } from 'indas-ui'
import { useDevice } from 'indas-ui'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ActionsColumnConfig<TData = any> {
  /**
   * Module-level permissions. When provided, actions that require a permission
   * the user lacks are automatically hidden — no need to set showEdit/showDelete manually.
   *
   * canEdit   → controls: edit button (modify existing records)
   * canSave   → controls: duplicate (creates a new record)
   * canDelete → controls: delete, archive (destructive operations)
   * canExport → controls: export
   * canPrint  → controls: print
   * canCancel → controls: block (cancel/block operations)
   *
   * Individual show* props still work as a further per-row override on top of permissions.
   */
  permissions?: {
    canEdit?: boolean
    canSave?: boolean
    canDelete?: boolean
    canExport?: boolean
    canPrint?: boolean
    canCancel?: boolean
  }

  // Basic CRUD Actions
  onView?: (row: TData) => void
  onEdit?: (row: TData) => void
  onDelete?: (row: TData) => void
  onDuplicate?: (row: TData) => void
  onTarget?: (row: TData) => void

  // Advanced Actions
  onPin?: (row: TData, pinned: boolean) => void
  onFavorite?: (row: TData, favorited: boolean) => void
  onArchive?: (row: TData) => void
  onRestore?: (row: TData) => void
  onExport?: (row: TData) => void
  onPrint?: (row: TData) => void
  onCopy?: (row: TData) => void
  onShare?: (row: TData) => void
  onBlock?: (row: TData, blocked: boolean) => void

  // Conditional Display - can be boolean or function
  showView?: boolean | ((row: TData) => boolean)
  showEdit?: boolean | ((row: TData) => boolean)
  showDelete?: boolean | ((row: TData) => boolean)
  showDuplicate?: boolean | ((row: TData) => boolean)
  showTarget?: boolean | ((row: TData) => boolean)
  showPin?: boolean | ((row: TData) => boolean)
  showFavorite?: boolean | ((row: TData) => boolean)
  showArchive?: boolean | ((row: TData) => boolean)
  showRestore?: boolean | ((row: TData) => boolean)
  showExport?: boolean | ((row: TData) => boolean)
  showPrint?: boolean | ((row: TData) => boolean)
  showCopy?: boolean | ((row: TData) => boolean)
  showShare?: boolean | ((row: TData) => boolean)
  showBlock?: boolean | ((row: TData) => boolean)

  // Row State Accessors
  isPinned?: (row: TData) => boolean
  isFavorited?: (row: TData) => boolean
  isArchived?: (row: TData) => boolean
  isProtected?: (row: TData) => boolean
  isBlocked?: (row: TData) => boolean

  // Display Options
  mode?: 'buttons' | 'dropdown' | 'mixed'
  primaryActions?: ActionType[]
  maxVisibleActions?: number
  // Optional per-action icon override (e.g. use a Send icon for the 'share' action).
  icons?: Partial<Record<ActionType, React.ComponentType<{ className?: string; size?: number }>>>
  confirmDelete?: boolean // Default: true
  confirmArchive?: boolean // Default: true
  showStatusBadges?: boolean // Default: false (status badges can increase row height)

  // Custom Labels
  labels?: {
    view?: string
    edit?: string
    delete?: string
    duplicate?: string
    target?: string
    pin?: string
    unpin?: string
    favorite?: string
    unfavorite?: string
    archive?: string
    restore?: string
    export?: string
    print?: string
    copy?: string
    share?: string
    block?: string
    unblock?: string
  }

  // Confirmation Dialog Customization
  // title/description may be a plain string, or a function of the row so the
  // confirm dialog can name the exact record being deleted (e.g. the employee).
  deleteConfirmation?: {
    title?: string | ((row: TData) => string)
    description?: string | ((row: TData) => string)
  }
  archiveConfirmation?: {
    title?: string
    description?: string
  }
  blockConfirmation?: {
    title?: string
    description?: string
  }
}

type ActionType = 'view' | 'edit' | 'delete' | 'duplicate' | 'target' | 'pin' | 'favorite' | 'archive' | 'restore' | 'export' | 'print' | 'copy' | 'share' | 'block'

interface ActionDefinition {
  id: ActionType
  label: string
  // Concrete component type (not React.ElementType) — ElementType includes string intrinsics, whose
  // JSX prop-intersection collapses `size`/`className` to `never` under the app's React types.
  icon: React.ComponentType<{ className?: string; size?: number }>
  action: () => void
  show: boolean
  className: string
  requiresConfirmation?: boolean
  isDestructive?: boolean
}

interface ActionsColumnProps<TData> {
  row: { original: TData }
  config: ActionsColumnConfig<TData>
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ActionsColumn<TData>({
  row,
  config,
}: ActionsColumnProps<TData>) {
  const alerts = useGlobalAlert()
  const pageAccess = usePageAccess()
  const { isMobile } = useDevice()
  const data = row.original

  // Copy feedback: the copy button's icon flips to a check for 2s after copying.
  const [justCopied, setJustCopied] = useState(false)

  const {
    mode: configMode = 'buttons',
    primaryActions = ['edit', 'delete'],
    maxVisibleActions = 3,
    confirmDelete = true,
    confirmArchive = true,
    showStatusBadges = false, // Changed default to false to prevent row height increase
    labels = {},
  } = config

  // On mobile always use dropdown to save horizontal space
  const mode = isMobile ? 'dropdown' : configMode

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Check if an action should be shown based on config
   */
  const shouldShow = useCallback(
    (condition: boolean | ((row: TData) => boolean) | undefined, hasCallback: boolean): boolean => {
      if (condition === undefined) return hasCallback
      if (typeof condition === 'boolean') return condition
      return condition(data)
    },
    [data]
  )

  /**
   * Copy row data to clipboard as JSON
   */
  const copyRowData = useCallback(() => {
    const rowText = JSON.stringify(data, null, 2)
    navigator.clipboard.writeText(rowText)
    config.onCopy?.(data)
    setJustCopied(true)
    window.setTimeout(() => setJustCopied(false), 2000)
  }, [data, config])

  /**
   * Export row as CSV
   */
  const exportRow = useCallback(() => {
    const csvContent = Object.entries(data as any)
      .map(([key, value]) => `${key},${value}`)
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `row-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)

    config.onExport?.(data)
  }, [data, config])

  /**
   * Handle delete with optional confirmation using GlobalAlert (warning style)
   */
  const handleDelete = useCallback(() => {
    if (confirmDelete) {
      // Resolve title/description — each may be a string or a (row) => string,
      // so the dialog can name the exact record (e.g. "Delete Ankit Patidar?").
      const dc = config.deleteConfirmation
      const dcTitle = (typeof dc?.title === 'function' ? dc.title(data) : dc?.title) || 'Delete Item'
      const dcDescription = (typeof dc?.description === 'function' ? dc.description(data) : dc?.description)
        || 'Are you sure you want to delete this item? This action cannot be undone.'
      alerts.showWarning(
        dcTitle,
        dcDescription,
        [
          {
            label: 'Cancel',
            onClick: () => alerts.hideAlert(),
            variant: 'secondary'
          },
          {
            label: 'Delete',
            onClick: () => {
              config.onDelete?.(data)
              alerts.hideAlert()
            },
            variant: 'primary'
          }
        ]
      )
    } else {
      config.onDelete?.(data)
    }
  }, [confirmDelete, config, data, alerts])

  /**
   * Handle archive with optional confirmation using GlobalAlert (warning style)
   */
  const handleArchive = useCallback(() => {
    if (confirmArchive) {
      alerts.showWarning(
        config.archiveConfirmation?.title || 'Archive Item',
        config.archiveConfirmation?.description || 'Are you sure you want to archive this item? It can be restored later.',
        [
          {
            label: 'Cancel',
            onClick: () => alerts.hideAlert(),
            variant: 'secondary'
          },
          {
            label: 'Archive',
            onClick: () => {
              config.onArchive?.(data)
              alerts.hideAlert()
            },
            variant: 'primary'
          }
        ]
      )
    } else {
      config.onArchive?.(data)
    }
  }, [confirmArchive, config, data, alerts])

  // ============================================================================
  // ACTION DEFINITIONS
  // ============================================================================

  const actions = useMemo<ActionDefinition[]>(() => {
    const isProtected = config.isProtected?.(data) || false
    const isPinned = config.isPinned?.(data) || false
    const isFavorited = config.isFavorited?.(data) || false
    const isArchived = config.isArchived?.(data) || false
    const isBlocked = config.isBlocked?.(data) || false

    // Permission gates — use explicit config.permissions if provided, else fall back to usePageAccess()
    // undefined means "no restriction from this permission" (allow)
    const permCanEdit = config.permissions?.canEdit ?? pageAccess.canEdit
    const permCanSave = config.permissions?.canSave ?? pageAccess.canSave
    const permCanDelete = config.permissions?.canDelete ?? pageAccess.canDelete
    const permCanExport = config.permissions?.canExport ?? pageAccess.canExport
    const permCanPrint = config.permissions?.canPrint ?? pageAccess.canPrint
    const permCanCancel = config.permissions?.canCancel ?? pageAccess.canCancel

    return [
      {
        id: 'view' as ActionType,
        label: labels.view || 'View',
        icon: Eye,
        action: () => config.onView?.(data),
        show: shouldShow(config.showView, !!config.onView),
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-info))] hover:bg-[rgb(var(--color-info-subtle))]',
      },
      {
        id: 'edit' as ActionType,
        label: labels.edit || 'Edit',
        icon: Edit,
        action: () => config.onEdit?.(data),
        show: shouldShow(config.showEdit, !!config.onEdit) && !isProtected && (permCanEdit !== false),
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-orange))] hover:bg-[rgb(var(--color-orange-subtle))]',
      },
      {
        id: 'duplicate' as ActionType,
        label: labels.duplicate || 'Duplicate',
        icon: Files,
        action: () => config.onDuplicate?.(data),
        show: shouldShow(config.showDuplicate, !!config.onDuplicate) && (permCanSave !== false),
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-success))] hover:bg-[rgb(var(--color-success-subtle))]',
      },
      {
        id: 'target' as ActionType,
        label: labels.target || 'Target Price',
        icon: Target,
        action: () => config.onTarget?.(data),
        show: shouldShow(config.showTarget, !!config.onTarget),
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary-subtle))]',
      },
      {
        id: 'pin' as ActionType,
        label: isPinned ? (labels.unpin || 'Unpin') : (labels.pin || 'Pin'),
        icon: isPinned ? PinOff : Pin,
        action: () => config.onPin?.(data, !isPinned),
        show: shouldShow(config.showPin, !!config.onPin),
        className: isPinned
          ? 'text-[rgb(var(--color-warning))] hover:text-[rgb(var(--color-warning-hover))] hover:bg-[rgb(var(--color-warning-subtle))]'
          : 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-warning))] hover:bg-[rgb(var(--color-warning-subtle))]',
      },
      {
        id: 'favorite' as ActionType,
        label: isFavorited ? (labels.unfavorite || 'Unfavorite') : (labels.favorite || 'Favorite'),
        icon: isFavorited ? StarOff : Star,
        action: () => config.onFavorite?.(data, !isFavorited),
        show: shouldShow(config.showFavorite, !!config.onFavorite),
        className: isFavorited
          ? 'text-[rgb(var(--color-warning))] hover:text-[rgb(var(--color-warning-hover))] hover:bg-[rgb(var(--color-warning-subtle))]'
          : 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-warning))] hover:bg-[rgb(var(--color-warning-subtle))]',
      },
      {
        id: 'copy' as ActionType,
        label: labels.copy || 'Copy Data',
        icon: Copy,
        action: copyRowData,
        show: shouldShow(config.showCopy, !!config.onCopy),
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary-subtle))]',
      },
      {
        id: 'share' as ActionType,
        label: labels.share || 'Share',
        icon: Share2,
        action: () => config.onShare?.(data),
        show: shouldShow(config.showShare, !!config.onShare),
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary-subtle))]',
      },
      {
        id: 'export' as ActionType,
        label: labels.export || 'Export',
        icon: Download,
        action: exportRow,
        show: shouldShow(config.showExport, !!config.onExport) && (permCanExport !== false),
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-tertiary))] hover:bg-[rgb(var(--color-tertiary-subtle))]',
      },
      {
        id: 'print' as ActionType,
        label: labels.print || 'Print',
        icon: Printer,
        action: () => config.onPrint?.(data),
        show: shouldShow(config.showPrint, !!config.onPrint) && (permCanPrint !== false),
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary-subtle))]',
      },
      {
        id: 'archive' as ActionType,
        label: labels.archive || 'Archive',
        icon: Archive,
        action: handleArchive,
        show: shouldShow(config.showArchive, !!config.onArchive) && !isArchived && (permCanDelete !== false),
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-warning))] hover:bg-[rgb(var(--color-warning-subtle))]',
        requiresConfirmation: confirmArchive,
      },
      {
        id: 'restore' as ActionType,
        label: labels.restore || 'Restore',
        icon: RotateCcw,
        action: () => config.onRestore?.(data),
        show: shouldShow(config.showRestore, !!config.onRestore) && isArchived,
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-success))] hover:bg-[rgb(var(--color-success-subtle))]',
      },
      {
        id: 'block' as ActionType,
        label: isBlocked ? (labels.unblock || 'Unblock') : (labels.block || 'Block'),
        icon: isBlocked ? CheckCircle : Ban,
        action: () => config.onBlock?.(data, !isBlocked),
        show: shouldShow(config.showBlock, !!config.onBlock) && (permCanCancel !== false),
        className: isBlocked
          ? 'text-[rgb(var(--color-success))] hover:text-[rgb(var(--color-success-hover))] hover:bg-[rgb(var(--color-success-subtle))]'
          : 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-error))] hover:bg-[rgb(var(--color-error-subtle))]',
      },
      {
        id: 'delete' as ActionType,
        label: labels.delete || 'Delete',
        icon: Trash2,
        action: handleDelete,
        show: shouldShow(config.showDelete, !!config.onDelete) && !isProtected && (permCanDelete !== false),
        className: 'text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-error))] hover:bg-[rgb(var(--color-error-subtle))]',
        requiresConfirmation: confirmDelete,
        isDestructive: true,
      },
    ]
      .map(action => config.icons?.[action.id] ? { ...action, icon: config.icons[action.id]! } : action)
      .filter(action => action.show)
  }, [config, data, labels, shouldShow, copyRowData, exportRow, handleDelete, handleArchive, pageAccess])

  // ============================================================================
  // LAYOUT LOGIC
  // ============================================================================

  const visibleActions = useMemo(() => {
    if (mode === 'dropdown') return []

    return actions
      .filter(action => primaryActions.includes(action.id))
      .slice(0, maxVisibleActions)
  }, [mode, actions, primaryActions, maxVisibleActions])

  const dropdownActions = useMemo(() => {
    if (mode === 'buttons') return []

    if (mode === 'dropdown') return actions

    // Mixed mode: show non-primary actions in dropdown
    return actions.filter(action =>
      !visibleActions.some(v => v.id === action.id)
    )
  }, [mode, actions, visibleActions])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="flex items-center justify-center gap-1">
        {/* Status Badges */}
        {showStatusBadges && (
          <div className="flex items-center gap-1 mr-1">
            {config.isPinned?.(data) && (
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <Badge variant="outline" className="h-5 px-1.5 py-0">
                <Pin className="h-3 w-3 text-orange-500" />
              </Badge>
              </TooltipTrigger><TooltipContent>Pinned</TooltipContent></Tooltip></TooltipProvider>
            )}
            {config.isFavorited?.(data) && (
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <Badge variant="outline" className="h-5 px-1.5 py-0">
                <Star className="h-3 w-3 text-yellow-500 fill-current" />
              </Badge>
              </TooltipTrigger><TooltipContent>Favorite</TooltipContent></Tooltip></TooltipProvider>
            )}
            {config.isArchived?.(data) && (
              <Badge variant="secondary" className="h-5 px-2 py-0 text-xs">
                Archived
              </Badge>
            )}
            {config.isProtected?.(data) && (
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <Badge variant="outline" className="h-5 px-1.5 py-0">
                <Lock className="h-3 w-3 text-[rgb(var(--color-warning))]" />
              </Badge>
              </TooltipTrigger><TooltipContent>Protected</TooltipContent></Tooltip></TooltipProvider>
            )}
            {config.isBlocked?.(data) && (
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <Badge variant="outline" className="h-5 px-1.5 py-0">
                <Ban className="h-3 w-3 text-[rgb(var(--color-error))]" />
              </Badge>
              </TooltipTrigger><TooltipContent>Blocked</TooltipContent></Tooltip></TooltipProvider>
            )}
          </div>
        )}

        {/* Visible Action Buttons - Gray by default, colored text + background on hover */}
        {visibleActions.map((action) => {
          const isCopied = action.id === 'copy' && justCopied
          const Icon = isCopied ? CheckCircle : action.icon

          return (
            <TooltipProvider key={action.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      action.action()
                    }}
                    className={`p-1 rounded transition-colors ${
                      isCopied ? 'text-[rgb(var(--color-success))] bg-[rgb(var(--color-success-subtle))]' : action.className
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isCopied ? 'Copied' : action.label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}

        {/* Dropdown Menu */}
        {dropdownActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 rounded transition-colors text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-subtle))]"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {mode === 'dropdown' && (
                <>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              {dropdownActions.map((action, index) => {
                const Icon = action.icon
                const needsSeparator = action.isDestructive && index < dropdownActions.length - 1

                // Get hover background color only - text stays default until hover
                const getDropdownHoverBg = (actionId: string) => {
                  switch (actionId) {
                    case 'delete':
                      return 'hover:bg-[rgb(var(--color-error-subtle))] focus:bg-[rgb(var(--color-error-subtle))]'
                    case 'view':
                      return 'hover:bg-[rgb(var(--color-primary-subtle))] focus:bg-[rgb(var(--color-primary-subtle))]'
                    case 'duplicate':
                      return 'hover:bg-[rgb(var(--color-success-subtle))] focus:bg-[rgb(var(--color-success-subtle))]'
                    case 'archive':
                      return 'hover:bg-[rgb(var(--color-warning-subtle))] focus:bg-[rgb(var(--color-warning-subtle))]'
                    case 'restore':
                      return 'hover:bg-[rgb(var(--color-success-subtle))] focus:bg-[rgb(var(--color-success-subtle))]'
                    case 'pin':
                      return 'hover:bg-[rgb(var(--color-warning-subtle))] focus:bg-[rgb(var(--color-warning-subtle))]'
                    case 'favorite':
                      return 'hover:bg-[rgb(var(--color-warning-subtle))] focus:bg-[rgb(var(--color-warning-subtle))]'
                    case 'copy':
                      return 'hover:bg-[rgb(var(--color-primary-subtle))] focus:bg-[rgb(var(--color-primary-subtle))]'
                    case 'share':
                      return 'hover:bg-[rgb(var(--color-primary-subtle))] focus:bg-[rgb(var(--color-primary-subtle))]'
                    case 'export':
                      return 'hover:bg-[rgb(var(--color-primary-subtle))] focus:bg-[rgb(var(--color-primary-subtle))]'
                    default:
                      return ''
                  }
                }

                return (
                  <React.Fragment key={action.id}>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        action.action()
                      }}
                      className={`cursor-pointer ${getDropdownHoverBg(action.id)}`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {action.label}
                    </DropdownMenuItem>
                    {needsSeparator && <DropdownMenuSeparator />}
                  </React.Fragment>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  )
}

// ============================================================================
// HELPER FUNCTION TO CREATE ACTIONS COLUMN
// ============================================================================

/**
 * Helper function to create an actions column definition for DataGrid
 *
 * @example
 * const columns = [
 *   { accessorKey: 'name', header: 'Name' },
 *   { accessorKey: 'email', header: 'Email' },
 *   createActionsColumn({
 *     onEdit: handleEdit,
 *     onDelete: handleDelete,
 *     showEdit: true,
 *     showDelete: true,
 *     mode: 'buttons'
 *   })
 * ]
 */
export function createActionsColumn<TData>(config: ActionsColumnConfig<TData>) {
  // Apply defaults: all actions enabled by default, mixed mode, View/Edit/Delete visible
  const defaultConfig: ActionsColumnConfig<TData> = {
    // Show all actions by default (user can override to false)
    showView: config.showView !== false && !!config.onView,
    showEdit: config.showEdit !== false && !!config.onEdit,
    showDelete: config.showDelete !== false && !!config.onDelete,
    showDuplicate: config.showDuplicate !== false && !!config.onDuplicate,
    showPin: config.showPin !== false && !!config.onPin,
    showFavorite: config.showFavorite !== false && !!config.onFavorite,
    showArchive: config.showArchive !== false && !!config.onArchive,
    showRestore: config.showRestore !== false && !!config.onRestore,
    showCopy: config.showCopy !== false && !!config.onCopy,
    showShare: config.showShare !== false && !!config.onShare,
    showExport: config.showExport !== false && !!config.onExport,

    // Default display mode: mixed (View, Edit, Delete visible, rest in dropdown)
    mode: config.mode || 'mixed',
    primaryActions: config.primaryActions || ['view', 'edit', 'delete'],
    maxVisibleActions: config.maxVisibleActions || 3,

    // Default confirmations
    confirmDelete: config.confirmDelete !== false,
    confirmArchive: config.confirmArchive !== false,

    // Default status badges off (to maintain row height)
    showStatusBadges: config.showStatusBadges || false,

    // Merge with user config
    ...config,
  }

  return {
    id: 'actions',
    header: () => (
      <span className="inline-flex items-center gap-1.5" style={{ display: 'inline-flex' }}>
        <Settings className="h-3.5 w-3.5 flex-shrink-0 text-[rgb(var(--fg-muted))]" />
        <span className="hidden sm:inline">Actions</span>
      </span>
    ),
    cell: ({ row }: { row: { original: TData } }) => (
      <ActionsColumn row={row} config={defaultConfig} />
    ),
    enableSorting: false,
    enableHiding: true,
    enableColumnFilter: false,
    size: (() => {
      if (defaultConfig.mode === 'dropdown') return 50
      if (defaultConfig.mode === 'buttons') {
        // Count actions that will actually render: must be in primaryActions
        // AND have a corresponding show* flag that isn't explicitly false.
        // (Row-level function show flags are treated as visible for sizing.)
        const showMap: Record<string, boolean | ((row: any) => boolean) | undefined> = {
          view: defaultConfig.showView,
          edit: defaultConfig.showEdit,
          delete: defaultConfig.showDelete,
          duplicate: defaultConfig.showDuplicate,
          target: defaultConfig.showTarget,
          pin: defaultConfig.showPin,
          favorite: defaultConfig.showFavorite,
          archive: defaultConfig.showArchive,
          restore: defaultConfig.showRestore,
          export: defaultConfig.showExport,
          print: defaultConfig.showPrint,
          copy: defaultConfig.showCopy,
          share: defaultConfig.showShare,
          block: defaultConfig.showBlock,
        }
        const primary = defaultConfig.primaryActions ?? []
        const visibleCount = primary.filter(a => showMap[a] !== false).length
        const cap = defaultConfig.maxVisibleActions ?? visibleCount
        const btnCount = Math.min(visibleCount, cap)
        // 30px per button, 60px minimum for at least one button + padding.
        return Math.max(60, btnCount * 30)
      }
      return 90
    })(),
  }
}
