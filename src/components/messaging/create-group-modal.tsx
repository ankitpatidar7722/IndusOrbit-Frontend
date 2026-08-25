'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, X, Check, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from 'indas-ui'
import { useMessaging } from '@/contexts/MessagingContext'
import { getAvatarColor, getInitials } from './conversation-list'
import type { ChatContact, ChatRoom } from '@/lib/messaging'

interface CreateGroupModalProps {
  open: boolean
  onClose: () => void
  onCreated: (room: ChatRoom) => void
  currentUserId: string
}

/** WhatsApp-style "New Group" modal: name + searchable member checklist. */
export function CreateGroupModal({ open, onClose, onCreated, currentUserId }: CreateGroupModalProps) {
  const { t } = useLanguage()
  const { state, actions } = useMessaging()

  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) {
      actions.fetchContacts()
      setName(''); setSearch(''); setSelected(new Set()); setCreating(false)
    }
  }, [open, actions])

  const contacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.contacts
      .filter(c => String(c.UserID) !== currentUserId)
      .filter(c => !q || (c.UserName || '').toLowerCase().includes(q) || (c.Designation || '').toLowerCase().includes(q))
  }, [state.contacts, search, currentUserId])

  const selectedContacts = useMemo(
    () => state.contacts.filter(c => selected.has(c.UserID)),
    [state.contacts, selected]
  )

  const toggle = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const canCreate = name.trim().length > 0 && selected.size > 0 && !creating

  const handleCreate = useCallback(async () => {
    if (!canCreate) return
    setCreating(true)
    try {
      const participantsJson = JSON.stringify(
        selectedContacts.map((u: ChatContact) => ({
          userId: u.UserID, userName: u.UserName, role: 'Member',
          lastReadMessageId: null, lastReadAt: null, isMuted: false, joinedAt: new Date().toISOString(),
        }))
      )
      const room = await actions.createRoom({
        Type: 'Group',
        Name: name.trim(),
        IsPublic: false,
        ParticipantsJson: participantsJson,
      })
      if (room) { onCreated(room); onClose() }
    } finally {
      setCreating(false)
    }
  }, [canCreate, name, selectedContacts, actions, onCreated, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl bg-[rgb(var(--bg-surface))] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-5 py-4 border-b border-[rgb(var(--bd-default))]">
          <Users className="w-5 h-5 text-[rgb(var(--color-primary))]" />
          <h3 className="text-base font-semibold text-[rgb(var(--fg-default))] flex-1">{t('New Group')}</h3>
          <button onClick={onClose} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Group name */}
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('Group name')}
            autoFocus
            className="w-full h-11 px-3.5 rounded-xl bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
          />

          {/* Selected member chips */}
          {selectedContacts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedContacts.map(u => (
                <span key={u.UserID} className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full bg-[rgb(var(--color-primary)/0.1)] text-xs text-[rgb(var(--color-primary))]">
                  <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-white text-[0.5rem] font-bold', getAvatarColor(u.UserID))}>
                    {getInitials(u.UserName)}
                  </span>
                  {u.UserName}
                  <button onClick={() => toggle(u.UserID)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          {/* Select members label */}
          <div className="text-xs font-medium text-[rgb(var(--fg-muted))]">
            {t('Select members')} ({selected.size} {t('selected')})
          </div>

          {/* Search users */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--fg-muted))]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('Search users')}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              className="w-full h-10 pl-8 pr-3 rounded-full bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
            />
          </div>

          {/* Member checklist */}
          <div className="max-h-64 overflow-y-auto -mx-1">
            {contacts.length === 0 ? (
              <div className="py-8 text-center text-sm text-[rgb(var(--fg-muted))]">{t('No users found')}</div>
            ) : (
              contacts.map(c => {
                const isSel = selected.has(c.UserID)
                return (
                  <button
                    key={c.UserID}
                    onClick={() => toggle(c.UserID)}
                    className={cn(
                      'w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors',
                      isSel ? 'bg-[rgb(var(--color-primary)/0.08)]' : 'hover:bg-[rgb(var(--bg-hover))]'
                    )}
                  >
                    <span className={cn(
                      'w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0',
                      isSel ? 'bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]' : 'border-[rgb(var(--bd-default))]'
                    )}>
                      {isSel && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                    <span className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0', getAvatarColor(c.UserID))}>
                      {getInitials(c.UserName)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[rgb(var(--fg-default))] truncate">{c.UserName}</p>
                      {c.Designation && <p className="text-xs text-[rgb(var(--fg-muted))] truncate">{c.Designation}</p>}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex justify-end gap-2 px-5 py-3 border-t border-[rgb(var(--bd-default))]">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-lg text-sm font-medium text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))] transition-colors"
          >
            {t('Cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className={cn(
              'px-4 h-9 rounded-lg text-sm font-medium text-white transition-opacity',
              canCreate ? 'bg-[rgb(var(--color-primary))] hover:opacity-90' : 'bg-[rgb(var(--color-primary))]/40 cursor-not-allowed'
            )}
          >
            {creating ? t('Creating...') : t('Create Group')}
          </button>
        </div>
      </div>
    </div>
  )
}
