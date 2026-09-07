'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import { ArrowLeft, Users, Pin, Star, Search, X, Inbox, Lock, MoreVertical, Bell, BellOff, Archive, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from 'indas-ui'
import { useMessaging } from '@/contexts/MessagingContext'
import { MessageBubble } from './message-bubble'
import { MessageInput } from './message-input'
import { ForwardModal } from './forward-modal'
import { GroupInfoPanel } from './group-info-panel'
import { MediaGalleryPanel } from './media-gallery-panel'
import { AttachmentViewer } from './attachment-viewer'
import { parseParticipants } from '@/lib/messaging'
import { getAvatarColor, getInitials, formatDaySeparator, isSameDay, formatLastSeen } from './conversation-list'
import { UserAvatar } from './UserAvatar'
import { UserProfileModal } from './UserProfileModal'
import type { ChatRoom, ChatMessage, ChatAttachment } from '@/lib/messaging'

interface MessageThreadProps {
  room: ChatRoom
  currentUserId: string
  onBack: () => void // mobile back
  onOpenThread: (messageId: number) => void
  className?: string
}

export function MessageThread({
  room,
  currentUserId,
  onBack,
  onOpenThread,
  className
}: MessageThreadProps) {
  const { t } = useLanguage()
  const { state, actions } = useMessaging()
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null)
  const [pinned, setPinned] = useState(false)
  const [starred, setStarred] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showChatMenu, setShowChatMenu] = useState(false)   // ⋮ header menu: mute / pin / archive
  const [showMedia, setShowMedia] = useState(false)         // "Media, docs & links" gallery (DM + group)
  const [viewerAttachment, setViewerAttachment] = useState<ChatAttachment | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef(0)

  const messages = state.messages[room.RoomID] || []
  const pagination = state.messagePagination[room.RoomID]
  const typingUsers = actions.getTypingUsers(room.RoomID)

  // Display name for header
  const displayName = useMemo(() => {
    if (room.Type === 'DM') {
      const participants = parseParticipants(room.Participants)
      const other = participants.find(p => String(p.userId) !== currentUserId)
      return other?.userName || room.Name || t('Direct Message')
    }
    return room.Name || t('Unnamed')
  }, [room, currentUserId, t])

  const participants = useMemo(() => parseParticipants(room.Participants), [room.Participants])
  const myPart = useMemo(() => participants.find(p => String(p.userId) === currentUserId), [participants, currentUserId])
  const iLeft = !!myPart?.leftAt                          // I'm a past member — read-only, history up to when I left
  const myMuted = !!myPart?.isMuted
  const myPinned = !!myPart?.isPinned
  const myArchived = !!myPart?.archivedAt
  const activeParticipants = useMemo(() => participants.filter(p => !p.leftAt), [participants])
  const memberCount = activeParticipants.length

  // "Only admins can send" gating (groups/channels) — plus: a member who LEFT can never send.
  const myRole = myPart?.role
  const canSend = !iLeft && (room.Type === 'DM' || !room.IsReadOnly || myRole === 'Owner' || myRole === 'Admin')
  const isGroup = room.Type !== 'DM'

  // Build sender name map
  const senderNames = useMemo(() => {
    const map: Record<number, string> = {}
    for (const p of participants) {
      map[p.userId] = p.userName
    }
    return map
  }, [participants])

  // DM partner + online / last-seen
  const dmPartner = useMemo(
    () => (room.Type === 'DM' ? participants.find(p => String(p.userId) !== currentUserId) : undefined),
    [room.Type, participants, currentUserId]
  )
  const isDMPartnerOnline = dmPartner ? state.onlineUsers.has(String(dmPartner.userId)) : false
  const partnerLastSeen = dmPartner ? state.lastSeen[String(dmPartner.userId)] : undefined

  // Fetch messages + join SignalR group on mount
  useEffect(() => {
    actions.fetchMessages(room.RoomID)
    actions.joinConversation(room.RoomID)

    return () => {
      actions.leaveConversation(room.RoomID)
    }
  }, [room.RoomID, actions])

  // Fetch the DM partner's last-seen when opening the chat (so the header can show it).
  useEffect(() => {
    if (dmPartner) actions.fetchLastSeen(dmPartner.userId)
  }, [dmPartner?.userId, actions])

  // Auto-scroll to bottom on new messages (only if already near bottom)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    const isNewMessage = messages.length > prevMessageCountRef.current

    if (isNearBottom || isNewMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: isNewMessage ? 'smooth' : 'auto' })
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length])

  // Mark as read when viewing
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      actions.markAsRead(room.RoomID, lastMsg.MessageID)
    }
  }, [room.RoomID, messages, actions])

  // Load more on scroll to top
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    if (container.scrollTop < 50 && pagination?.hasMore && !state.loadingMessages) {
      actions.fetchMoreMessages(room.RoomID)
    }
  }, [pagination, state.loadingMessages, room.RoomID, actions])

  const handleSend = useCallback((content: string, attachments?: ChatAttachment[], mentions?: number[]) => {
    const request: any = { Content: content }
    if (attachments) request.AttachmentsJson = JSON.stringify(attachments)
    if (mentions && mentions.length) request.Mentions = mentions
    if (replyTo) {
      actions.replyToMessage(replyTo.MessageID, request)
      setReplyTo(null)
    } else {
      actions.sendMessage(room.RoomID, request)
    }
  }, [replyTo, room.RoomID, actions])

  // Members offered for @mentions (groups only): active participants except me.
  const mentionables = useMemo(
    () => isGroup ? activeParticipants.filter(p => String(p.userId) !== currentUserId).map(p => ({ userId: p.userId, userName: p.userName || '' })) : [],
    [isGroup, activeParticipants, currentUserId]
  )
  // All active member names (incl. me) — used to highlight @mentions in the bubbles.
  const mentionNameList = useMemo(
    () => isGroup ? activeParticipants.map(p => p.userName || '').filter(Boolean) : [],
    [isGroup, activeParticipants]
  )


  const handleTyping = useCallback((isTyping: boolean) => {
    actions.sendTyping(room.RoomID, isTyping)
  }, [room.RoomID, actions])

  // WhatsApp-style delivery status for our own outgoing messages:
  //   read      → every other participant's last-read pointer has reached this message
  //   delivered → at least one other participant is currently online
  //   sent      → nobody online yet (single tick)
  // Combines live ReadReceipt events (state.readReceipts) with the last-read pointer
  // stored in the room's Participants JSON (covers state before any live event arrives).
  const otherParticipants = useMemo(
    () => participants.filter(p => String(p.userId) !== currentUserId),
    [participants, currentUserId]
  )
  const getMessageStatus = useCallback((msg: ChatMessage): 'sent' | 'delivered' | 'read' | undefined => {
    if (otherParticipants.length === 0) return undefined
    const liveReceipts = state.readReceipts[room.RoomID] || {}
    const allRead = otherParticipants.every(p => {
      const live = Number(liveReceipts[String(p.userId)] || 0)
      const initial = Number(p.lastReadMessageId || 0)
      return Math.max(live, initial) >= msg.MessageID
    })
    if (allRead) return 'read'
    const anyOnline = otherParticipants.some(p => state.onlineUsers.has(String(p.userId)))
    return anyOnline ? 'delivered' : 'sent'
  }, [otherParticipants, state.readReceipts, state.onlineUsers, room.RoomID])

  // In-thread search filters which messages render (logic like read/status still uses full list).
  const displayMessages = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return messages
    return messages.filter(m => (m.Content || '').toLowerCase().includes(q))
  }, [messages, searchText])

  const pinnedMessages = useMemo(() => messages.filter(m => m.IsPinned && !m.IsDeleted), [messages])

  return (
    <div className={cn('flex flex-col h-full bg-[rgb(var(--bg-app))]', className)}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 py-2.5 border-b border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))]">
        {/* Back button (mobile) */}
        <button
          onClick={onBack}
          className="lg:hidden flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--fg-muted))]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Room avatar */}
        <div className="relative flex-shrink-0">
          {room.Type === 'DM' ? (
            <span role="button" tabIndex={0} title={t('View profile')} onClick={() => setShowProfile(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') setShowProfile(true) }} className="block cursor-pointer">
              <UserAvatar userId={dmPartner?.userId} name={displayName} colorClass={getAvatarColor(room.RoomID)} sizeClass="w-9 h-9" />
            </span>
          ) : (
            <div
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium',
                getAvatarColor(room.RoomID)
              )}
            >
              {room.Type === 'Channel' ? '#' : getInitials(displayName)}
            </div>
          )}
          {room.Type === 'DM' && isDMPartnerOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[rgb(var(--bg-surface))] pointer-events-none" />
          )}
        </div>

        {/* Room info (DM: click to view profile · groups: click to open Group info) */}
        <button
          type="button"
          onClick={() => { if (isGroup) setShowGroupInfo(true); else setShowProfile(true) }}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <h3 className="text-sm font-semibold text-[rgb(var(--fg-default))] truncate">{displayName}</h3>
          <p className={cn('text-xs', isDMPartnerOnline ? 'text-green-600' : 'text-[rgb(var(--fg-muted))]')}>
            {room.Type === 'DM'
              ? (isDMPartnerOnline ? t('Online') : formatLastSeen(partnerLastSeen))
              : `${memberCount} ${t('members')}${room.IsReadOnly ? ` · ${t('Only admins')}` : ''}`}
          </p>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {isGroup && (
            <button onClick={() => setShowGroupInfo(true)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]" title={t('Group info')}>
              <Users className="w-4.5 h-4.5" />
            </button>
          )}
          <button
            onClick={() => setPinned(v => !v)}
            title={t('Pin')}
            className={cn('w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]',
              pinned ? 'text-[rgb(var(--color-primary))]' : 'text-[rgb(var(--fg-muted))]')}
          >
            <Pin className={cn('w-4 h-4', pinned && 'fill-current')} />
          </button>
          <button
            onClick={() => setStarred(v => !v)}
            title={t('Star')}
            className={cn('w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]',
              starred ? 'text-amber-500' : 'text-[rgb(var(--fg-muted))]')}
          >
            <Star className={cn('w-4 h-4', starred && 'fill-current')} />
          </button>
          <button
            onClick={() => { setShowSearch(v => !v); if (showSearch) setSearchText('') }}
            title={t('Search')}
            className={cn('w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]',
              showSearch ? 'text-[rgb(var(--color-primary))]' : 'text-[rgb(var(--fg-muted))]')}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* ⋮ overflow: mute / pin-to-top / archive (persisted per-user) */}
          <div className="relative">
            <button
              onClick={() => setShowChatMenu(v => !v)}
              title={t('More')}
              className={cn('w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]',
                showChatMenu ? 'text-[rgb(var(--color-primary))]' : 'text-[rgb(var(--fg-muted))]')}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showChatMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowChatMenu(false)} />
                <div className="absolute right-0 top-9 w-56 py-1 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-xl shadow-xl z-30">
                  <button onClick={() => { setShowMedia(true); setShowChatMenu(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--fg-default))]">
                    <ImageIcon className="w-4 h-4" /> {t('Media, docs & links')}
                  </button>
                  <button onClick={() => { actions.setChatPrefs(room.RoomID, { mute: !myMuted }); setShowChatMenu(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--fg-default))]">
                    {myMuted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />} {myMuted ? t('Unmute notifications') : t('Mute notifications')}
                  </button>
                  <button onClick={() => { actions.setChatPrefs(room.RoomID, { pin: !myPinned }); setShowChatMenu(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--fg-default))]">
                    <Pin className={cn('w-4 h-4', myPinned && 'fill-current')} /> {myPinned ? t('Unpin chat') : t('Pin to top')}
                  </button>
                  <button onClick={() => { actions.setChatPrefs(room.RoomID, { archive: !myArchived }); setShowChatMenu(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--fg-default))]">
                    <Archive className="w-4 h-4" /> {myArchived ? t('Unarchive chat') : t('Archive chat')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* In-thread search */}
      {showSearch && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))]">
          <Search className="w-4 h-4 text-[rgb(var(--fg-muted))] flex-shrink-0" />
          <input
            autoFocus
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder={t('Search in conversation...')}
            className="flex-1 h-7 bg-transparent text-sm text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] focus:outline-none"
          />
          <button onClick={() => { setShowSearch(false); setSearchText('') }} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pinned messages bar */}
      {pinnedMessages.length > 0 && (
        <div className="flex-shrink-0 border-b border-[rgb(var(--bd-default))] bg-[rgb(var(--color-primary)/0.06)]">
          {pinnedMessages.slice(0, 3).map(pm => (
            <div key={pm.MessageID} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <Pin className="w-3.5 h-3.5 text-[rgb(var(--color-primary))] flex-shrink-0" />
              <span className="font-medium text-[rgb(var(--color-primary))] flex-shrink-0">{t('Pinned')}</span>
              <span className="text-[rgb(var(--fg-muted))] truncate flex-1">
                {pm.Content || (pm.Attachments ? t('Attachment') : '')}
              </span>
              <button
                onClick={() => actions.pinMessage(pm.MessageID, room.RoomID, false)}
                className="flex-shrink-0 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]"
                title={t('Unpin')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-2"
        onScroll={handleScroll}
        style={{
          backgroundImage: 'radial-gradient(rgb(var(--bd-default) / 0.45) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        {/* Loading more indicator */}
        {state.loadingMessages && messages.length > 0 && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-[rgb(var(--color-primary))] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Loading initial */}
        {state.loadingMessages && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-[rgb(var(--color-primary))] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state — no messages yet */}
        {!state.loadingMessages && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--fg-muted))]">
            <Inbox className="w-12 h-12 mb-3 opacity-25" />
            <p className="text-sm">{t('No messages yet')} — {t('say hello')} 👋</p>
          </div>
        )}

        {/* Search: no results */}
        {!state.loadingMessages && messages.length > 0 && displayMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--fg-muted))]">
            <Search className="w-10 h-10 mb-2 opacity-25" />
            <p className="text-sm">{t('No messages found')}</p>
          </div>
        )}

        {/* Messages (with WhatsApp-style date separators between days) */}
        {displayMessages.map((msg, idx) => {
          const prev = idx > 0 ? displayMessages[idx - 1] : null
          const showSender = !prev || prev.UserID !== msg.UserID
          const isOwn = String(msg.UserID) === currentUserId
          const showDay = !prev || !isSameDay(prev.CreatedAt, msg.CreatedAt)

          return (
            <Fragment key={msg.MessageID}>
              {showDay && (
                <div className="flex justify-center my-2 sticky top-1 z-[1]">
                  <span className="text-[0.6875rem] font-medium text-[rgb(var(--fg-muted))] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-full px-3 py-1 shadow-sm">
                    {formatDaySeparator(msg.CreatedAt)}
                  </span>
                </div>
              )}
              <MessageBubble
                message={msg}
                isOwn={isOwn}
                senderName={senderNames[msg.UserID] || `User ${msg.UserID}`}
                showSender={showSender}
                onReply={setReplyTo}
                onReact={(id, emoji) => actions.toggleReaction(id, emoji)}
                onEdit={(id, content) => actions.editMessage(id, content)}
                onDelete={(id) => actions.deleteMessage(id)}
                onForward={(m) => setForwardMsg(m)}
                onPin={(m, pinnedNow) => actions.pinMessage(m.MessageID, room.RoomID, pinnedNow)}
                onStar={(m, starredNow) => actions.starMessage(m.MessageID, room.RoomID, starredNow)}
                onDeleteForMe={(id) => actions.deleteForMe(id, room.RoomID)}
                onThreadClick={onOpenThread}
                currentUserId={Number(currentUserId)}
                status={isOwn ? getMessageStatus(msg) : undefined}
                onOpenAttachment={setViewerAttachment}
                mentionNames={mentionNameList}
              />
            </Fragment>
          )
        })}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <TypingIndicator userIds={typingUsers} senderNames={senderNames} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input — or a read-only notice for "only admins can send" groups */}
      {canSend ? (
        <MessageInput
          onSend={handleSend}
          onUploadFile={actions.uploadFile}
          onTyping={handleTyping}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          disabled={state.sendingMessage}
          mentionables={mentionables}
        />
      ) : (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-4 border-t border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-muted))]">
          <Lock className="w-4 h-4" />
          <span className="text-sm">{iLeft ? t('You left this group — you can only view past messages') : t('Only admins can send messages')}</span>
        </div>
      )}

      {/* Forward picker */}
      {forwardMsg && (
        <ForwardModal
          message={forwardMsg}
          currentUserId={currentUserId}
          onClose={() => setForwardMsg(null)}
        />
      )}

      {/* Group info / management */}
      {showGroupInfo && isGroup && (
        <GroupInfoPanel
          room={room}
          currentUserId={currentUserId}
          onClose={() => setShowGroupInfo(false)}
          onExit={() => { setShowGroupInfo(false); onBack() }}
        />
      )}

      {/* Media, docs & links gallery (DM + group) */}
      {showMedia && (
        <MediaGalleryPanel roomId={room.RoomID} roomName={displayName} onClose={() => setShowMedia(false)} />
      )}

      {/* In-app attachment viewer */}
      {viewerAttachment && (
        <AttachmentViewer attachment={viewerAttachment} onClose={() => setViewerAttachment(null)} />
      )}

      {/* DM partner profile (WhatsApp-style contact info) */}
      {room.Type === 'DM' && (
        <UserProfileModal
          open={showProfile}
          userId={dmPartner?.userId != null ? Number(dmPartner.userId) : null}
          fallbackName={displayName}
          colorClass={getAvatarColor(room.RoomID)}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  )
}

// ── Typing Indicator ──────────────────────────────────────────────────────

function TypingIndicator({ userIds, senderNames }: { userIds: string[]; senderNames: Record<number, string> }) {
  const { t } = useLanguage()

  const names = userIds
    .map(id => senderNames[Number(id)] || `User ${id}`)
    .slice(0, 3)

  const text = names.length === 1
    ? `${names[0]} ${t('is typing')}`
    : names.length === 2
      ? `${names[0]} ${t('and')} ${names[1]} ${t('are typing')}`
      : `${names[0]} ${t('and')} ${names.length - 1} ${t('others are typing')}`

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 ml-10">
      <div className="flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--fg-muted))] animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--fg-muted))] animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--fg-muted))] animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-[rgb(var(--fg-muted))] italic">{text}</span>
    </div>
  )
}
