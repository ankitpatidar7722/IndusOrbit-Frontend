'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { X, Search, Check, Users, UserPlus, LogOut, Trash2, Crown, Shield, MoreVertical, Lock, Pencil, Image as ImageIcon, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from 'indas-ui'
import { useMessaging } from '@/contexts/MessagingContext'
import { parseParticipants } from '@/lib/messaging'
import type { ChatRoom, ChatParticipant } from '@/lib/messaging'
import { getAvatarColor, getInitials } from './conversation-list'
import { MediaGalleryPanel } from './media-gallery-panel'

interface GroupInfoPanelProps {
  room: ChatRoom
  currentUserId: string
  onClose: () => void
  /** Called after the user leaves or the group is deleted, so the thread can deselect. */
  onExit: () => void
}

const isAdminRole = (r?: string | null) => r === 'Owner' || r === 'Admin'

/** Human "left …" label for past members: today / yesterday / N days ago. */
function leftAgo(iso?: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function GroupInfoPanel({ room, currentUserId, onClose, onExit }: GroupInfoPanelProps) {
  const { t } = useLanguage()
  const { state, actions } = useMessaging()
  const [confirm, setConfirm] = useState<null | 'leave' | 'delete' | 'assign-admin'>(null)
  const [successor, setSuccessor] = useState<number | null>(null)   // chosen new admin when the last admin leaves
  const [showMedia, setShowMedia] = useState(false)                 // "Media, docs & links" gallery
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [toAdd, setToAdd] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  // WhatsApp-style edit of the group name + description (admins/owner only)
  const [editingInfo, setEditingInfo] = useState(false)
  const [nameDraft, setNameDraft] = useState(room.Name || '')
  const [descDraft, setDescDraft] = useState(room.Description || '')
  const [savingInfo, setSavingInfo] = useState(false)

  const members = useMemo(() => parseParticipants(room.Participants), [room.Participants])
  // WhatsApp-style soft leave: a participant with `leftAt` has LEFT — no longer an active member,
  // but shows under "Past members" for 60 days.
  const activeMembers = useMemo(() => members.filter(m => !m.leftAt), [members])
  const pastMembers = useMemo(() => {
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000   // last 60 days
    return members
      .filter(m => m.leftAt && new Date(m.leftAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.leftAt!).getTime() - new Date(a.leftAt!).getTime())
  }, [members])
  const myRole = activeMembers.find(m => String(m.userId) === currentUserId)?.role
  const iAmActive = activeMembers.some(m => String(m.userId) === currentUserId)
  const iLeft = !iAmActive && members.some(m => String(m.userId) === currentUserId)   // I'm a past member (read-only)
  const iAmAdmin = isAdminRole(myRole)
  const iAmOwner = iAmActive && String(room.CreatedBy) === currentUserId

  // The LAST active admin can't just leave — the group would be left with no admin (and if "only
  // admins can send" is on, no one could ever post). We make them appoint a successor admin first.
  const otherActive = useMemo(() => activeMembers.filter(m => String(m.userId) !== currentUserId), [activeMembers, currentUserId])
  const iAmLastAdmin = iAmAdmin && otherActive.length > 0 && !otherActive.some(m => isAdminRole(m.role))

  useEffect(() => { if (adding && state.contacts.length === 0) actions.fetchContacts() }, [adding, state.contacts.length, actions])

  // Active members sorted: You FIRST (WhatsApp-style), then Owner → Admins → Members, alphabetical.
  const sortedMembers = useMemo(() => {
    const rank = (r?: string | null) => (r === 'Owner' ? 0 : r === 'Admin' ? 1 : 2)
    const self = (m: ChatParticipant) => (String(m.userId) === currentUserId ? 0 : 1)
    return [...activeMembers].sort((a, b) =>
      self(a) - self(b) || rank(a.role) - rank(b.role) || (a.userName || '').localeCompare(b.userName || ''))
  }, [activeMembers, currentUserId])

  const addableContacts = useMemo(() => {
    const inGroup = new Set(activeMembers.map(m => m.userId))
    const q = search.trim().toLowerCase()
    return state.contacts
      .filter(c => !inGroup.has(c.UserID) && String(c.UserID) !== currentUserId)
      .filter(c => !q || (c.UserName || '').toLowerCase().includes(q))
  }, [state.contacts, activeMembers, search, currentUserId])

  const doAddMembers = useCallback(async () => {
    if (toAdd.size === 0) return
    setBusy(true)
    try {
      const picked = state.contacts.filter(c => toAdd.has(c.UserID)).map(c => ({ UserID: c.UserID, UserName: c.UserName }))
      await actions.addMembers(room.RoomID, picked)
      setToAdd(new Set()); setAdding(false); setSearch('')
    } finally { setBusy(false) }
  }, [toAdd, state.contacts, actions, room.RoomID])

  const openEditInfo = useCallback(() => { setNameDraft(room.Name || ''); setDescDraft(room.Description || ''); setEditingInfo(true) }, [room.Name, room.Description])
  const saveInfo = useCallback(async () => {
    const name = nameDraft.trim()
    if (!name) return
    setSavingInfo(true)
    try {
      await actions.updateRoom(room.RoomID, { Name: name, Description: descDraft.trim() })
      setEditingInfo(false)
    } finally { setSavingInfo(false) }
  }, [actions, room.RoomID, nameDraft, descDraft])

  const doLeave = useCallback(async () => { setBusy(true); try { await actions.leaveGroup(room.RoomID); onExit() } finally { setBusy(false) } }, [actions, room.RoomID, onExit])
  const doDelete = useCallback(async () => { setBusy(true); try { await actions.deleteRoom(room.RoomID); onExit() } finally { setBusy(false) } }, [actions, room.RoomID, onExit])
  // "Delete group for me" — a left user removes the group from THEIR list only (stays for others).
  const doDeleteForMe = useCallback(async () => { setBusy(true); try { await actions.deleteRoomForMe(room.RoomID); onExit() } finally { setBusy(false) } }, [actions, room.RoomID, onExit])
  // Promote the chosen member to admin, THEN leave — so the group is never left admin-less.
  const doAssignAndLeave = useCallback(async () => {
    if (!successor) return
    setBusy(true)
    try {
      await actions.setMemberRole(room.RoomID, successor, 'Admin')
      await actions.leaveGroup(room.RoomID)
      onExit()
    } finally { setBusy(false) }
  }, [successor, actions, room.RoomID, onExit])

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md max-h-[86vh] flex flex-col rounded-2xl bg-[rgb(var(--bg-surface))] shadow-2xl overflow-hidden"
        onClick={e => { e.stopPropagation(); setMenuFor(null) }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[rgb(var(--bd-default))]">
          <span className="text-sm font-semibold text-[rgb(var(--fg-default))] flex-1">{t('Group info')}</span>
          <button onClick={onClose} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]"><X className="w-5 h-5" /></button>
        </div>

        {adding ? (
          /* ── Add members sub-view ── */
          <>
            <div className="flex-shrink-0 px-4 py-3 border-b border-[rgb(var(--bd-default))]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--fg-muted))]" />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search users')}
                  className="w-full h-10 pl-8 pr-3 rounded-full bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {addableContacts.length === 0 ? (
                <div className="py-8 text-center text-sm text-[rgb(var(--fg-muted))]">{t('No users found')}</div>
              ) : addableContacts.map(c => {
                const sel = toAdd.has(c.UserID)
                return (
                  <button key={c.UserID} onClick={() => setToAdd(p => { const n = new Set(p); n.has(c.UserID) ? n.delete(c.UserID) : n.add(c.UserID); return n })}
                    className={cn('w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors', sel ? 'bg-[rgb(var(--color-primary)/0.08)]' : 'hover:bg-[rgb(var(--bg-hover))]')}>
                    <span className={cn('w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0', sel ? 'bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]' : 'border-[rgb(var(--bd-default))]')}>
                      {sel && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                    <span className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium', getAvatarColor(c.UserID))}>{getInitials(c.UserName)}</span>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-[rgb(var(--fg-default))] truncate">{c.UserName}</p>{c.Designation && <p className="text-xs text-[rgb(var(--fg-muted))] truncate">{c.Designation}</p>}</div>
                  </button>
                )
              })}
            </div>
            <div className="flex-shrink-0 flex justify-end gap-2 px-4 py-3 border-t border-[rgb(var(--bd-default))]">
              <button onClick={() => { setAdding(false); setToAdd(new Set()); setSearch('') }} className="px-4 h-9 rounded-lg text-sm font-medium text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]">{t('Cancel')}</button>
              <button onClick={doAddMembers} disabled={toAdd.size === 0 || busy}
                className={cn('px-4 h-9 rounded-lg text-sm font-medium text-white', toAdd.size > 0 && !busy ? 'bg-[rgb(var(--color-primary))] hover:opacity-90' : 'bg-[rgb(var(--color-primary))]/40 cursor-not-allowed')}>
                {busy ? t('Adding...') : `${t('Add')} ${toAdd.size > 0 ? `(${toAdd.size})` : ''}`}
              </button>
            </div>
          </>
        ) : (
          /* ── Main info view ── */
          <>
            <div className="flex-1 overflow-y-auto">
              {/* Group identity */}
              <div className="flex flex-col items-center gap-2 py-5 border-b border-[rgb(var(--bd-subtle))]">
                <div className={cn('w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold', getAvatarColor(room.RoomID))}>
                  {room.Type === 'Channel' ? '#' : getInitials(room.Name || 'G')}
                </div>

                {editingInfo ? (
                  <div className="w-full max-w-xs px-4 flex flex-col gap-2">
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      autoFocus
                      maxLength={80}
                      placeholder={t('Group name')}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveInfo(); if (e.key === 'Escape') setEditingInfo(false) }}
                      className="w-full h-10 px-3 rounded-lg text-center text-base font-semibold bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
                    />
                    <textarea
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      rows={2}
                      maxLength={300}
                      placeholder={t('Add group description')}
                      className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
                    />
                    <div className="flex justify-center gap-2 pt-0.5">
                      <button onClick={() => setEditingInfo(false)} disabled={savingInfo}
                        className="px-3 h-8 rounded-lg text-xs font-medium text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]">{t('Cancel')}</button>
                      <button onClick={saveInfo} disabled={savingInfo || !nameDraft.trim()}
                        className={cn('px-4 h-8 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5', savingInfo || !nameDraft.trim() ? 'bg-[rgb(var(--color-primary))]/40 cursor-not-allowed' : 'bg-[rgb(var(--color-primary))] hover:opacity-90')}>
                        <Check className="w-3.5 h-3.5" /> {savingInfo ? t('Saving…') : t('Save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-lg font-semibold text-[rgb(var(--fg-default))]">{room.Name || t('Unnamed')}</h3>
                      {iAmAdmin && (
                        <button onClick={openEditInfo} title={t('Edit')} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--color-primary))] p-0.5">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {room.Description
                      ? <p className="text-xs text-[rgb(var(--fg-muted))] text-center px-6 whitespace-pre-wrap">{room.Description}</p>
                      : (iAmAdmin && <button onClick={openEditInfo} className="text-xs text-[rgb(var(--color-primary))] hover:underline">{t('Add group description')}</button>)}
                    <p className="text-xs text-[rgb(var(--fg-muted))]">{activeMembers.length} {t('members')}</p>
                    {iLeft && <p className="text-xs font-medium text-amber-600 mt-0.5">{t('You left this group')} · {t('Read-only')}</p>}
                  </>
                )}
              </div>

              {/* Only-admins-can-send toggle */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--bd-subtle))]">
                <Lock className="w-4.5 h-4.5 text-[rgb(var(--fg-muted))]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[rgb(var(--fg-default))]">{t('Only admins can send messages')}</p>
                  <p className="text-xs text-[rgb(var(--fg-muted))]">{room.IsReadOnly ? t('Members can only read') : t('All members can send')}</p>
                </div>
                <button
                  onClick={() => iAmAdmin && actions.setGroupReadOnly(room.RoomID, !room.IsReadOnly)}
                  disabled={!iAmAdmin}
                  className={cn('relative w-11 h-6 rounded-full transition-colors flex-shrink-0', room.IsReadOnly ? 'bg-[rgb(var(--color-primary))]' : 'bg-[rgb(var(--bd-default))]', !iAmAdmin && 'opacity-50 cursor-not-allowed')}
                  title={iAmAdmin ? '' : t('Only admins can change this')}
                >
                  <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', room.IsReadOnly ? 'left-[1.375rem]' : 'left-0.5')} />
                </button>
              </div>

              {/* Media, docs & links gallery */}
              <button onClick={() => setShowMedia(true)} className="w-full flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--bd-subtle))] hover:bg-[rgb(var(--bg-hover))] text-left">
                <ImageIcon className="w-4.5 h-4.5 text-[rgb(var(--fg-muted))]" />
                <span className="flex-1 text-sm font-medium text-[rgb(var(--fg-default))]">{t('Media, docs & links')}</span>
                <ChevronRight className="w-4 h-4 text-[rgb(var(--fg-muted))]" />
              </button>

              {/* Members header + add */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--fg-muted))]">{activeMembers.length} {t('members')}</span>
                {iAmAdmin && (
                  <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs font-medium text-[rgb(var(--color-primary))] hover:underline">
                    <UserPlus className="w-3.5 h-3.5" /> {t('Add members')}
                  </button>
                )}
              </div>

              {/* Members list */}
              <div className="px-1.5 pb-2">
                {sortedMembers.map((m: ChatParticipant) => {
                  const online = actions.isUserOnline(m.userId)
                  const isSelf = String(m.userId) === currentUserId
                  const isOwnerRow = m.role === 'Owner'
                  const canManage = iAmAdmin && !isSelf && !isOwnerRow
                  return (
                    <div key={m.userId} className="relative flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-[rgb(var(--bg-hover))]">
                      <div className="relative flex-shrink-0">
                        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium', getAvatarColor(m.userId))}>{getInitials(m.userName || '?')}</div>
                        {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[rgb(var(--bg-surface))]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[rgb(var(--fg-default))] truncate">{m.userName}{isSelf && <span className="text-[rgb(var(--fg-muted))] font-normal"> ({t('You')})</span>}</p>
                        {online && <p className="text-xs text-green-600">{t('Online')}</p>}
                      </div>
                      {isOwnerRow && <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-600"><Crown className="w-3 h-3" /> {t('Owner')}</span>}
                      {m.role === 'Admin' && <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold px-2 py-0.5 rounded-full bg-[rgb(var(--color-primary)/0.12)] text-[rgb(var(--color-primary))]"><Shield className="w-3 h-3" /> {t('Admin')}</span>}
                      {canManage && (
                        <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === m.userId ? null : m.userId) }} className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-subtle))]">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      )}
                      {canManage && menuFor === m.userId && (
                        <div className="absolute right-2 top-11 w-48 py-1 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-xl shadow-xl z-20">
                          <button onClick={() => { actions.setMemberRole(room.RoomID, m.userId, m.role === 'Admin' ? 'Member' : 'Admin'); setMenuFor(null) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--fg-default))]">
                            <Shield className="w-4 h-4" /> {m.role === 'Admin' ? t('Dismiss as admin') : t('Make group admin')}
                          </button>
                          <button onClick={() => { actions.removeMember(room.RoomID, m.userId); setMenuFor(null) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[rgb(var(--bg-hover))] text-red-600">
                            <Trash2 className="w-4 h-4" /> {t('Remove from group')}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Past members — those who left within the last 60 days (read-only, WhatsApp-style) */}
              {pastMembers.length > 0 && (
                <>
                  <div className="px-4 pt-2 pb-1 border-t border-[rgb(var(--bd-subtle))]">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--fg-muted))]">{t('Past members')}</span>
                  </div>
                  <div className="px-1.5 pb-2">
                    {pastMembers.map((m: ChatParticipant) => (
                      <div key={`past-${m.userId}`} className="flex items-center gap-3 px-2.5 py-2 rounded-xl">
                        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 opacity-60', getAvatarColor(m.userId))}>{getInitials(m.userName || '?')}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[rgb(var(--fg-muted))] truncate">{m.userName}</p>
                          <p className="text-xs text-[rgb(var(--fg-subtle))]">{t('Left')} {leftAgo(m.leftAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex-shrink-0 border-t border-[rgb(var(--bd-default))]">
              {iLeft ? (
                /* I already left → I can only remove the group from MY list (it stays for everyone else) */
                <button onClick={doDeleteForMe} disabled={busy} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50">
                  <Trash2 className="w-4.5 h-4.5" /> {t('Delete group')}
                  <span className="text-xs text-[rgb(var(--fg-muted))] font-normal">({t('remove from my list')})</span>
                </button>
              ) : (
                <>
                  <button onClick={() => { setSuccessor(null); setConfirm(iAmLastAdmin ? 'assign-admin' : 'leave') }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-500/5">
                    <LogOut className="w-4.5 h-4.5" /> {t('Leave group')}
                  </button>
                  {(iAmOwner || iAmAdmin) && (
                    <button onClick={() => setConfirm('delete')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-500/5 border-t border-[rgb(var(--bd-subtle))]">
                      <Trash2 className="w-4.5 h-4.5" /> {t('Delete group')}
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Confirm dialog (leave / delete) */}
        {(confirm === 'leave' || confirm === 'delete') && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/30" onClick={() => setConfirm(null)}>
            <div className="w-full max-w-xs rounded-xl bg-[rgb(var(--bg-surface))] shadow-2xl p-4" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-medium text-[rgb(var(--fg-default))]">
                {confirm === 'leave' ? t('Leave this group?') : t('Delete this group for everyone?')}
              </p>
              <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
                {confirm === 'leave' ? t('You will stop receiving messages from this group.') : t('This removes the group and its messages for all members.')}
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setConfirm(null)} className="px-3 h-8 rounded-lg text-sm text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]">{t('Cancel')}</button>
                <button onClick={confirm === 'leave' ? doLeave : doDelete} disabled={busy} className="px-3 h-8 rounded-lg text-sm font-medium bg-red-600 text-white hover:opacity-90 disabled:opacity-50">
                  {confirm === 'leave' ? t('Leave') : t('Delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Last admin leaving → must appoint a new admin first (so the group is never admin-less) */}
        {confirm === 'assign-admin' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/30" onClick={() => { setConfirm(null); setSuccessor(null) }}>
            <div className="w-full max-w-xs max-h-[80%] flex flex-col rounded-xl bg-[rgb(var(--bg-surface))] shadow-2xl p-4" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-[rgb(var(--fg-default))]">{t('Make someone admin before you leave')}</p>
              <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">{t("You're the only admin. Choose a member to become the new admin so the group can still be managed.")}</p>
              <div className="mt-3 flex-1 overflow-y-auto -mx-1 px-1">
                {otherActive.map(m => {
                  const sel = successor === m.userId
                  return (
                    <button key={m.userId} onClick={() => setSuccessor(m.userId)}
                      className={cn('w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors', sel ? 'bg-[rgb(var(--color-primary)/0.08)]' : 'hover:bg-[rgb(var(--bg-hover))]')}>
                      <span className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0', getAvatarColor(m.userId))}>{getInitials(m.userName || '?')}</span>
                      <span className="flex-1 min-w-0 text-sm font-medium text-[rgb(var(--fg-default))] truncate">{m.userName}</span>
                      <span className={cn('w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0', sel ? 'bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]' : 'border-[rgb(var(--bd-default))]')}>
                        {sel && <Check className="w-3.5 h-3.5 text-white" />}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-[rgb(var(--bd-subtle))]">
                <button onClick={() => { setConfirm(null); setSuccessor(null) }} className="px-3 h-8 rounded-lg text-sm text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]">{t('Cancel')}</button>
                <button onClick={doAssignAndLeave} disabled={!successor || busy}
                  className={cn('px-3 h-8 rounded-lg text-sm font-medium text-white', successor && !busy ? 'bg-[rgb(var(--color-primary))] hover:opacity-90' : 'bg-[rgb(var(--color-primary))]/40 cursor-not-allowed')}>
                  {busy ? t('Please wait…') : t('Make admin & leave')}
                </button>
              </div>
            </div>
          </div>
        )}

        {showMedia && <MediaGalleryPanel roomId={room.RoomID} roomName={room.Name || undefined} onClose={() => setShowMedia(false)} />}
      </div>
    </div>
  )
}
