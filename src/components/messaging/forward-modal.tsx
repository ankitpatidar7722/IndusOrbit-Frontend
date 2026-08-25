'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { X, Search, Forward, Check, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from 'indas-ui'
import { useMessaging } from '@/contexts/MessagingContext'
import { parseParticipants } from '@/lib/messaging'
import type { ChatMessage } from '@/lib/messaging'
import { getAvatarColor, getInitials } from './conversation-list'

interface ForwardModalProps {
  message: ChatMessage
  currentUserId: string
  onClose: () => void
}

type Target =
  | { kind: 'person'; key: string; userId: number; name: string }
  | { kind: 'room'; key: string; roomId: number; name: string }

/** WhatsApp-style "Forward to…" picker: choose one or more people/groups, then forward. */
export function ForwardModal({ message, currentUserId, onClose }: ForwardModalProps) {
  const { t } = useLanguage()
  const { state, actions } = useMessaging()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (state.contacts.length === 0) actions.fetchContacts()
  }, [state.contacts.length, actions])

  // Existing DM room for each other-user (to reuse instead of creating a new one).
  const dmByUser = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of state.conversations) {
      if (r.Type === 'DM') {
        const other = parseParticipants(r.Participants).find(p => String(p.userId) !== currentUserId)
        if (other) m.set(Number(other.userId), r.RoomID)
      }
    }
    return m
  }, [state.conversations, currentUserId])

  const targets: Target[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    const people: Target[] = state.contacts
      .filter(c => String(c.UserID) !== currentUserId)
      .filter(c => !q || (c.UserName || '').toLowerCase().includes(q))
      .map(c => ({ kind: 'person', key: `p${c.UserID}`, userId: c.UserID, name: c.UserName }))
    const groups: Target[] = state.conversations
      .filter(r => r.Type === 'Group' || r.Type === 'Channel')
      .filter(r => !q || (r.Name || '').toLowerCase().includes(q))
      .map(r => ({ kind: 'room', key: `r${r.RoomID}`, roomId: r.RoomID, name: r.Name || t('Group') }))
    return [...groups, ...people]
  }, [state.contacts, state.conversations, search, currentUserId, t])

  const toggle = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  const handleForward = useCallback(async () => {
    if (selected.size === 0) return
    setSending(true)
    const payload = { Content: message.Content || undefined, AttachmentsJson: message.Attachments || undefined }
    try {
      for (const target of targets) {
        if (!selected.has(target.key)) continue
        let roomId: number | null = null
        if (target.kind === 'room') {
          roomId = target.roomId
        } else {
          roomId = dmByUser.get(target.userId) ?? null
          if (roomId == null) {
            const room = await actions.getOrCreateDM({ TargetUserID: target.userId, TargetUserName: target.name })
            roomId = room?.RoomID ?? null
          }
        }
        if (roomId != null) await actions.sendMessage(roomId, payload)
      }
    } finally {
      setSending(false)
      onClose()
    }
  }, [selected, targets, dmByUser, message, actions, onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl bg-[rgb(var(--bg-surface))] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[rgb(var(--bd-default))]">
          <Forward className="w-5 h-5 text-[rgb(var(--color-primary))]" />
          <h3 className="text-base font-semibold text-[rgb(var(--fg-default))] flex-1">{t('Forward to')}</h3>
          <button onClick={onClose} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Forwarded-message preview */}
        <div className="flex-shrink-0 mx-4 mt-3 px-3 py-2 rounded-lg bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-muted))] border border-[rgb(var(--bd-default))]">
          <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[rgb(var(--color-primary))]">{t('Message')}</span>
          <p className="truncate mt-0.5">{message.Content || (message.Attachments ? `📎 ${t('Attachment')}` : '')}</p>
        </div>

        {/* Search */}
        <div className="flex-shrink-0 px-4 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--fg-muted))]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('Search people or groups')}
              className="w-full h-9 pl-8 pr-3 rounded-full bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
            />
          </div>
        </div>

        {/* Target list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-[10rem]">
          {targets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-[rgb(var(--fg-muted))]">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">{t('No results')}</p>
            </div>
          ) : (
            targets.map(target => {
              const isSel = selected.has(target.key)
              const avatarId = target.kind === 'person' ? target.userId : target.roomId
              return (
                <button
                  key={target.key}
                  onClick={() => toggle(target.key)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-[rgb(var(--bg-hover))] transition-colors text-left"
                >
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0', getAvatarColor(avatarId))}>
                    {target.kind === 'room' ? <Users className="w-4 h-4" /> : getInitials(target.name)}
                  </div>
                  <span className="flex-1 text-sm text-[rgb(var(--fg-default))] truncate">{target.name}</span>
                  <span className={cn(
                    'w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0',
                    isSel ? 'bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]' : 'border-[rgb(var(--bd-default))]'
                  )}>
                    {isSel && <Check className="w-3.5 h-3.5 text-white" />}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-[rgb(var(--bd-default))]">
          <span className="text-xs text-[rgb(var(--fg-muted))]">
            {selected.size > 0 ? `${selected.size} ${t('selected')}` : t('Select recipients')}
          </span>
          <button
            onClick={handleForward}
            disabled={selected.size === 0 || sending}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium transition-opacity',
              selected.size > 0 && !sending
                ? 'bg-[rgb(var(--color-primary))] text-white hover:opacity-90'
                : 'bg-[rgb(var(--color-primary))]/40 text-white cursor-not-allowed'
            )}
          >
            <Forward className="w-4 h-4" />
            {sending ? t('Sending…') : t('Forward')}
          </button>
        </div>
      </div>
    </div>
  )
}
