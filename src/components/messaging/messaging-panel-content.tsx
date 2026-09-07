'use client'

import { useEffect, useCallback, useMemo, useState } from 'react'
import { Search, Users, MessageSquare, Plus, ArrowLeft, Pin, BellOff, Archive, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage, useDevice } from 'indas-ui'
import { useSession } from 'next-auth/react'
import { useMessaging } from '@/contexts/MessagingContext'
import { parseParticipants } from '@/lib/messaging'
import type { ChatRoom, ChatContact } from '@/lib/messaging'
import { getAvatarColor, getInitials, formatRelativeTime } from './conversation-list'
import { UserAvatar } from './UserAvatar'
import { UserProfileModal } from './UserProfileModal'
import { MessageThread } from './message-thread'
import { CreateGroupModal } from './create-group-modal'

type Tab = 'Chats' | 'Groups'

interface MessagingPanelContentProps {
  onClose: () => void
}

/**
 * WhatsApp-style two-pane messenger for the header slide-in panel:
 *   left  → Chats (every user — click to DM) / Groups, with search
 *   right → the selected conversation (reuses MessageThread)
 */
export function MessagingPanelContent({ onClose }: MessagingPanelContentProps) {
  const { t } = useLanguage()
  const { isMobile } = useDevice()
  const { data: session } = useSession()
  const { state, actions } = useMessaging()

  const currentUserId = String(
    (session?.user as any)?.UserID || (session?.user as any)?.userID || ''
  )

  const [tab, setTab] = useState<Tab>('Chats')
  const [search, setSearch] = useState('')
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [opening, setOpening] = useState<number | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [profileContact, setProfileContact] = useState<ChatContact | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // My per-user chat flags (mute / pin / archive) for a room.
  const myFlags = useCallback((room?: ChatRoom | null) => {
    if (!room) return { muted: false, pinned: false, archived: false }
    const me = parseParticipants(room.Participants).find(p => String(p.userId) === currentUserId)
    return { muted: !!me?.isMuted, pinned: !!me?.isPinned, archived: !!me?.archivedAt }
  }, [currentUserId])

  useEffect(() => {
    actions.fetchConversations()
    actions.fetchContacts()
    actions.fetchUnreadCounts()
  }, [actions])

  // Map each other-user → their existing DM room (for previews / reuse).
  const dmByUser = useMemo(() => {
    const m = new Map<number, ChatRoom>()
    for (const r of state.conversations) {
      if (r.Type === 'DM') {
        const other = parseParticipants(r.Participants).find(p => String(p.userId) !== currentUserId)
        if (other) m.set(Number(other.userId), r)
      }
    }
    return m
  }, [state.conversations, currentUserId])

  // Chats = every user (people), sorted by most-recent DM then name.
  const peopleSort = useCallback((a: { contact: ChatContact; room?: ChatRoom }, b: { contact: ChatContact; room?: ChatRoom }) => {
    const pa = myFlags(a.room).pinned ? 1 : 0
    const pb = myFlags(b.room).pinned ? 1 : 0
    if (pa !== pb) return pb - pa                           // pinned DMs first
    const at = a.room?.LastMessageAt ? new Date(a.room.LastMessageAt).getTime() : 0
    const bt = b.room?.LastMessageAt ? new Date(b.room.LastMessageAt).getTime() : 0
    if (at !== bt) return bt - at
    return (a.contact.UserName || '').localeCompare(b.contact.UserName || '')
  }, [myFlags])
  const allPeople = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.contacts
      .filter(c => String(c.UserID) !== currentUserId)
      .filter(c => !q || (c.UserName || '').toLowerCase().includes(q))
      .map(c => ({ contact: c, room: dmByUser.get(c.UserID) }))
  }, [state.contacts, search, currentUserId, dmByUser])
  const people = useMemo(() => allPeople.filter(p => !myFlags(p.room).archived).sort(peopleSort), [allPeople, myFlags, peopleSort])
  const archivedPeople = useMemo(() => allPeople.filter(p => myFlags(p.room).archived).sort(peopleSort), [allPeople, myFlags, peopleSort])
  const shownPeople = showArchived ? archivedPeople : people

  // Groups = group / channel conversations. Pinned first, then most-recent. Archived split out.
  const groupSort = useCallback((a: ChatRoom, b: ChatRoom) => {
    const pa = myFlags(a).pinned ? 1 : 0
    const pb = myFlags(b).pinned ? 1 : 0
    if (pa !== pb) return pb - pa
    const at = a.LastMessageAt ? new Date(a.LastMessageAt).getTime() : 0
    const bt = b.LastMessageAt ? new Date(b.LastMessageAt).getTime() : 0
    return bt - at
  }, [myFlags])
  const allGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.conversations
      .filter(r => r.Type === 'Group' || r.Type === 'Channel')
      .filter(r => !q || (r.Name || '').toLowerCase().includes(q))
  }, [state.conversations, search])
  const groups = useMemo(() => allGroups.filter(r => !myFlags(r).archived).sort(groupSort), [allGroups, myFlags, groupSort])
  const archivedGroups = useMemo(() => allGroups.filter(r => myFlags(r).archived).sort(groupSort), [allGroups, myFlags, groupSort])
  const shownGroups = showArchived ? archivedGroups : groups   // Groups tab shows active OR (toggled) archived

  const selectRoom = useCallback((room: ChatRoom) => {
    setSelectedRoom(room)
    actions.setActiveRoom(room.RoomID)
  }, [actions])

  const openPerson = useCallback(async (contact: ChatContact) => {
    const existing = dmByUser.get(contact.UserID)
    if (existing) { selectRoom(existing); return }
    setOpening(contact.UserID)
    const room = await actions.getOrCreateDM({ TargetUserID: contact.UserID, TargetUserName: contact.UserName })
    setOpening(null)
    if (room) selectRoom(room)
  }, [dmByUser, actions, selectRoom])

  // Keep the open room synced with conversation updates (previews, etc.).
  useEffect(() => {
    if (!selectedRoom) return
    const updated = state.conversations.find(c => c.RoomID === selectedRoom.RoomID)
    if (updated && updated !== selectedRoom) setSelectedRoom(updated)
  }, [state.conversations, selectedRoom])

  const handleBack = useCallback(() => {
    setSelectedRoom(null)
    actions.setActiveRoom(null)
  }, [actions])

  const handleGroupCreated = useCallback((room: ChatRoom) => {
    setShowCreateGroup(false)
    setTab('Groups')
    selectRoom(room)
  }, [selectRoom])

  // On phone widths, show one pane at a time.
  const showList = !isMobile || !selectedRoom
  const showThread = !isMobile || !!selectedRoom

  return (
    <div className="flex h-full">
      {/* ── LEFT: people / groups list ─────────────────────────────── */}
      {showList && (
        <div className={cn(
          'flex flex-col border-r border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))]',
          isMobile ? 'w-full' : 'w-[300px] flex-shrink-0'
        )}>
          {/* Tabs */}
          <div className="flex-shrink-0 flex gap-1 p-2">
            {(['Chats', 'Groups'] as Tab[]).map(tk => (
              <button
                key={tk}
                onClick={() => { setTab(tk); setShowArchived(false) }}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  tab === tk
                    ? 'bg-[rgb(var(--color-primary))] text-white'
                    : 'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]'
                )}
              >
                {t(tk)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-shrink-0 px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--fg-muted))]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tab === 'Chats' ? t('Search people') : t('Search groups')}
                className="w-full h-9 pl-8 pr-3 rounded-full bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-1.5 pb-2">
            {tab === 'Chats' ? (
              <>
                {showArchived ? (
                  <button onClick={() => setShowArchived(false)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-sm font-medium text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]">
                    <ChevronLeft className="w-4 h-4" /> {t('Back')}
                  </button>
                ) : archivedPeople.length > 0 ? (
                  <button onClick={() => setShowArchived(true)} className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-[rgb(var(--bg-hover))]">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-muted))]"><Archive className="w-4.5 h-4.5" /></div>
                    <span className="text-sm font-medium text-[rgb(var(--fg-default))]">{t('Archived')}</span>
                    <span className="ml-auto text-xs font-semibold text-[rgb(var(--fg-muted))]">{archivedPeople.length}</span>
                  </button>
                ) : null}
                {state.loadingConversations && state.contacts.length === 0 ? (
                  <ListSkeleton />
                ) : shownPeople.length === 0 ? (
                  <Empty text={showArchived ? t('No archived chats') : (search ? t('No people found') : t('No people'))} />
                ) : (
                  shownPeople.map(({ contact, room }) => {
                  const online = actions.isUserOnline(contact.UserID)
                  const unread = room ? (state.unreadCounts[room.RoomID] || 0) : 0
                  const isActive = !!room && selectedRoom?.RoomID === room.RoomID
                  return (
                    <button
                      key={contact.UserID}
                      onClick={() => openPerson(contact)}
                      disabled={opening === contact.UserID}
                      className={cn(
                        'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors',
                        isActive ? 'bg-[rgb(var(--color-primary))]/10' : 'hover:bg-[rgb(var(--bg-hover))]'
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <span
                          role="button" tabIndex={0} title="View profile"
                          onClick={(e) => { e.stopPropagation(); setProfileContact(contact) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setProfileContact(contact) } }}
                          className="block cursor-pointer"
                        >
                          <UserAvatar userId={contact.UserID} name={contact.UserName || '?'} colorClass={getAvatarColor(contact.UserID)} />
                        </span>
                        {online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[rgb(var(--bg-surface))] pointer-events-none" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 min-w-0">
                            <span className="text-sm font-medium text-[rgb(var(--fg-default))] truncate">{contact.UserName}</span>
                            {myFlags(room).pinned && <Pin className="w-3 h-3 text-[rgb(var(--fg-muted))] flex-shrink-0 fill-current" />}
                            {myFlags(room).muted && <BellOff className="w-3 h-3 text-[rgb(var(--fg-muted))] flex-shrink-0" />}
                          </span>
                          {room?.LastMessageAt && (
                            <span className="text-[0.6875rem] text-[rgb(var(--fg-muted))] flex-shrink-0">{formatRelativeTime(room.LastMessageAt)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-xs text-[rgb(var(--fg-muted))] truncate">
                            {room?.LastMessagePreview || contact.Designation || (online ? t('Online') : t('Tap to chat'))}
                          </span>
                          {unread > 0 && (
                            <span className="flex-shrink-0 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-green-500 text-white text-[0.625rem] font-bold flex items-center justify-center shadow-sm">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
                )}
              </>
            ) : (
              /* Groups tab */
              <>
                {!showArchived && (
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-[rgb(var(--bg-hover))] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[rgb(var(--color-primary))]/12 text-[rgb(var(--color-primary))]">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-[rgb(var(--color-primary))]">{t('New Group')}</span>
                  </button>
                )}

                {/* Archived chats toggle */}
                {showArchived ? (
                  <button onClick={() => setShowArchived(false)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-sm font-medium text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]">
                    <ChevronLeft className="w-4 h-4" /> {t('Back')}
                  </button>
                ) : archivedGroups.length > 0 ? (
                  <button onClick={() => setShowArchived(true)} className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-[rgb(var(--bg-hover))]">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-muted))]">
                      <Archive className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-sm font-medium text-[rgb(var(--fg-default))]">{t('Archived')}</span>
                    <span className="ml-auto text-xs font-semibold text-[rgb(var(--fg-muted))]">{archivedGroups.length}</span>
                  </button>
                ) : null}

                {shownGroups.length === 0 ? (
                  <Empty text={showArchived ? t('No archived chats') : (search ? t('No groups found') : t('No groups yet'))} />
                ) : (
                  shownGroups.map(room => {
                    const unread = state.unreadCounts[room.RoomID] || 0
                    const isActive = selectedRoom?.RoomID === room.RoomID
                    const count = parseParticipants(room.Participants).length
                    const f = myFlags(room)
                    return (
                      <button
                        key={room.RoomID}
                        onClick={() => selectRoom(room)}
                        className={cn(
                          'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors',
                          isActive ? 'bg-[rgb(var(--color-primary))]/10' : 'hover:bg-[rgb(var(--bg-hover))]'
                        )}
                      >
                        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0', getAvatarColor(room.RoomID))}>
                          {room.Type === 'Channel' ? '#' : getInitials(room.Name || 'G')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1 min-w-0">
                              <span className="text-sm font-medium text-[rgb(var(--fg-default))] truncate">{room.Name || t('Unnamed')}</span>
                              {f.pinned && <Pin className="w-3 h-3 text-[rgb(var(--fg-muted))] flex-shrink-0 fill-current" />}
                              {f.muted && <BellOff className="w-3 h-3 text-[rgb(var(--fg-muted))] flex-shrink-0" />}
                            </span>
                            {room.LastMessageAt && <span className="text-[0.6875rem] text-[rgb(var(--fg-muted))] flex-shrink-0">{formatRelativeTime(room.LastMessageAt)}</span>}
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-xs text-[rgb(var(--fg-muted))] truncate">{room.LastMessagePreview || `${count} ${t('members')}`}</span>
                            {unread > 0 && (
                              <span className="flex-shrink-0 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-green-500 text-white text-[0.625rem] font-bold flex items-center justify-center shadow-sm">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── RIGHT: conversation ────────────────────────────────────── */}
      {showThread && (
        <div className="flex-1 min-w-0 flex flex-col bg-[rgb(var(--bg-app))]">
          {selectedRoom ? (
            <MessageThread
              room={selectedRoom}
              currentUserId={currentUserId}
              onBack={handleBack}
              onOpenThread={() => {}}
              className="flex-1"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[rgb(var(--fg-muted))] px-6 text-center">
              <MessageSquare className="w-14 h-14 mb-3 opacity-25" />
              <p className="text-base font-medium text-[rgb(var(--fg-default))]">{t('Your messages')}</p>
              <p className="text-sm mt-1">{t('Select a person to start chatting')}</p>
            </div>
          )}
        </div>
      )}

      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={handleGroupCreated}
        currentUserId={currentUserId}
      />

      <UserProfileModal
        open={!!profileContact}
        userId={profileContact?.UserID ?? null}
        fallbackName={profileContact?.UserName}
        colorClass={profileContact ? getAvatarColor(profileContact.UserID) : undefined}
        onClose={() => setProfileContact(null)}
        onMessage={() => { if (profileContact) openPerson(profileContact) }}
      />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2 px-1.5 pt-1">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="flex items-center gap-3 py-1.5 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-[rgb(var(--bg-subtle))]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 rounded bg-[rgb(var(--bg-subtle))]" />
            <div className="h-2.5 w-36 rounded bg-[rgb(var(--bg-subtle))]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-[rgb(var(--fg-muted))]">
      <Users className="w-9 h-9 mb-2 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  )
}
