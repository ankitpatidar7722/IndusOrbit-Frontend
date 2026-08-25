'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, X, Check, Users, Hash, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from 'indas-ui'
import { useMessaging } from '@/contexts/MessagingContext'
import { Modal, ModalContent, ModalHeader, ModalTitle } from 'indas-ui'
import { getAvatarColor, getInitials } from './conversation-list'
import type { ChatContact, ChatRoom } from '@/lib/messaging'

interface CreateConversationModalProps {
  open: boolean
  onClose: () => void
  onCreated: (room: ChatRoom) => void
  currentUserId: string
}

type ConvType = 'DM' | 'Group' | 'Channel'

export function CreateConversationModal({
  open,
  onClose,
  onCreated,
  currentUserId
}: CreateConversationModalProps) {
  const { t } = useLanguage()
  const { state, actions } = useMessaging()

  const [type, setType] = useState<ConvType>('DM')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<ChatContact[]>([])
  const [creating, setCreating] = useState(false)

  // Fetch contacts on open
  useEffect(() => {
    if (open) {
      actions.fetchContacts()
      // Reset form
      setType('DM')
      setName('')
      setDescription('')
      setIsPublic(true)
      setSearchText('')
      setSelectedUsers([])
    }
  }, [open, actions])

  const filteredContacts = useMemo(() => {
    const q = searchText.toLowerCase()
    return state.contacts
      .filter(c => String(c.UserID) !== currentUserId)
      .filter(c =>
        !q ||
        c.UserName.toLowerCase().includes(q) ||
        c.Email?.toLowerCase().includes(q) ||
        c.Designation?.toLowerCase().includes(q)
      )
  }, [state.contacts, searchText, currentUserId])

  const toggleUser = useCallback((contact: ChatContact) => {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.UserID === contact.UserID)
      if (exists) return prev.filter(u => u.UserID !== contact.UserID)
      // For DM, only allow 1 user
      if (type === 'DM') return [contact]
      return [...prev, contact]
    })
  }, [type])

  const handleCreate = useCallback(async () => {
    if (selectedUsers.length === 0) return
    setCreating(true)

    try {
      let room: ChatRoom | null = null

      if (type === 'DM') {
        const target = selectedUsers[0]
        room = await actions.getOrCreateDM({
          TargetUserID: target.UserID,
          TargetUserName: target.UserName
        })
      } else {
        if (!name.trim()) return

        const participantsJson = JSON.stringify(
          selectedUsers.map(u => ({
            userId: u.UserID,
            userName: u.UserName,
            role: 'Member',
            lastReadMessageId: null,
            lastReadAt: null,
            isMuted: false,
            joinedAt: new Date().toISOString()
          }))
        )

        room = await actions.createRoom({
          Type: type,
          Name: name.trim(),
          Description: description.trim() || undefined,
          IsPublic: isPublic,
          ParticipantsJson: participantsJson
        })
      }

      if (room) {
        onCreated(room)
        onClose()
      }
    } finally {
      setCreating(false)
    }
  }, [type, name, description, isPublic, selectedUsers, actions, onCreated, onClose])

  const typeOptions: { key: ConvType; icon: any; label: string; desc: string }[] = [
    { key: 'DM', icon: MessageSquare, label: t('Direct Message'), desc: t('1-on-1 conversation') },
    { key: 'Group', icon: Users, label: t('Group'), desc: t('Private group chat') },
    { key: 'Channel', icon: Hash, label: t('Channel'), desc: t('Public or private channel') },
  ]

  const canCreate = type === 'DM'
    ? selectedUsers.length === 1
    : selectedUsers.length > 0 && name.trim()

  return (
    <Modal open={open} onOpenChange={onClose}>
      <ModalContent size="md" hideCloseButton disableOutsideClick className="p-0 flex flex-col overflow-hidden max-h-[85vh]">
        <ModalHeader className="px-5 py-4 border-b border-[rgb(var(--bd-default))]">
          <ModalTitle>{t('New Conversation')}</ModalTitle>
        </ModalHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Type selection */}
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => { setType(opt.key); setSelectedUsers([]) }}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors',
                  type === opt.key
                    ? 'border-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary)/0.05)]'
                    : 'border-[rgb(var(--bd-default))] hover:bg-[rgb(var(--bg-hover))]'
                )}
              >
                <opt.icon className={cn(
                  'w-5 h-5',
                  type === opt.key ? 'text-[rgb(var(--color-primary))]' : 'text-[rgb(var(--fg-muted))]'
                )} />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Group/Channel name */}
          {type !== 'DM' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-[rgb(var(--fg-muted))]">{t('Name')}</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={type === 'Group' ? t('Group name') : t('Channel name')}
                className="w-full h-9 px-3 rounded-lg bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-default))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
              />
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('Description (optional)')}
                className="w-full h-9 px-3 rounded-lg bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-default))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
              />
              {type === 'Channel' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-[rgb(var(--fg-default))]">{t('Public channel')}</span>
                </label>
              )}
            </div>
          )}

          {/* Selected users chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map(user => (
                <span
                  key={user.UserID}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[rgb(var(--color-primary)/0.1)] text-xs text-[rgb(var(--color-primary))]"
                >
                  {user.UserName}
                  <button onClick={() => toggleUser(user)} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* User search */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[rgb(var(--fg-muted))]">
              {type === 'DM' ? t('Select person') : t('Add members')}
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--fg-muted))]" />
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder={t('Search by name or email...')}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="w-full h-9 pl-8 pr-3 rounded-lg bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-default))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
              />
            </div>
          </div>

          {/* Contact list */}
          <div className="max-h-48 overflow-y-auto rounded-lg border border-[rgb(var(--bd-default))]">
            {filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-sm text-[rgb(var(--fg-muted))]">{t('No contacts found')}</div>
            ) : (
              filteredContacts.map(contact => {
                const isSelected = selectedUsers.some(u => u.UserID === contact.UserID)
                return (
                  <button
                    key={contact.UserID}
                    onClick={() => toggleUser(contact)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 hover:bg-[rgb(var(--bg-hover))] transition-colors',
                      isSelected && 'bg-[rgb(var(--color-primary)/0.05)]'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0',
                        getAvatarColor(contact.UserID)
                      )}
                    >
                      {getInitials(contact.UserName)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-[rgb(var(--fg-default))] truncate">{contact.UserName}</p>
                      {contact.Designation && (
                        <p className="text-xs text-[rgb(var(--fg-muted))] truncate">{contact.Designation}</p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[rgb(var(--color-primary))] flex-shrink-0" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[rgb(var(--bd-default))]">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-lg text-sm font-medium text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))] transition-colors"
          >
            {t('Cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || creating}
            className="px-4 h-9 rounded-lg text-sm font-medium bg-[rgb(var(--color-primary))] text-white hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {creating ? t('Creating...') : type === 'DM' ? t('Start Chat') : t('Create')}
          </button>
        </div>
      </ModalContent>
    </Modal>
  )
}
