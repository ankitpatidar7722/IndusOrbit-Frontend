'use client'

import { useState, memo, useCallback, useRef, useEffect, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'
import { Reply, Smile, Pencil, Trash2, Copy, Check, CheckCheck, MoreHorizontal, Forward, Pin, Star, Users2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from 'indas-ui'
import { parseReactions, parseAttachments } from '@/lib/messaging'
import type { ChatMessage, ChatReaction, ChatAttachment } from '@/lib/messaging'
import { getAvatarColor, getInitials, formatClockTime } from './conversation-list'

// ── Curated reaction emojis ───────────────────────────────────────────────

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '💯']

// Swipe-to-reply thresholds (px): SWIPE_MAX = how far the bubble follows the finger; SWIPE_TRIGGER = release past this fires the reply.
const SWIPE_MAX = 64, SWIPE_TRIGGER = 48

// ── Component ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage
  isOwn: boolean
  senderName: string
  showSender: boolean // false for consecutive messages from same sender
  onReply: (message: ChatMessage) => void
  onReact: (messageId: number, emoji: string) => void
  onEdit: (messageId: number, content: string) => void
  onDelete: (messageId: number) => void           // delete for everyone (own messages)
  onForward?: (message: ChatMessage) => void
  onPin?: (message: ChatMessage, pinned: boolean) => void
  onStar?: (message: ChatMessage, starred: boolean) => void
  onDeleteForMe?: (messageId: number) => void
  onThreadClick?: (messageId: number) => void
  currentUserId: number
  /** Delivery status for own messages (DM/Group). Undefined = don't render ticks. */
  status?: 'sent' | 'delivered' | 'read'
  /** Open an attachment in the in-app viewer (instead of a new browser tab). */
  onOpenAttachment?: (attachment: ChatAttachment) => void
  /** Group member names — used to highlight @mentions in the text. */
  mentionNames?: string[]
}

/** Render message text with @mentions of known members highlighted. */
function renderWithMentions(content: string, names: string[]): ReactNode {
  const valid = names.filter(Boolean)
  if (valid.length === 0) return content
  const escaped = [...valid].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`@(?:${escaped.join('|')})`, 'g')
  const out: ReactNode[] = []
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) out.push(content.slice(last, m.index))
    out.push(<span key={m.index} className="font-semibold text-[rgb(var(--color-primary))]">{m[0]}</span>)
    last = m.index + m[0].length
  }
  if (last < content.length) out.push(content.slice(last))
  return out
}

/**
 * WhatsApp-style delivery ticks for own outgoing messages:
 *   sent      → single gray tick (recipient offline / not yet delivered)
 *   delivered → double gray tick (recipient online)
 *   read      → double blue tick  (recipient has seen it)
 */
function DeliveryTicks({ status }: { status: 'sent' | 'delivered' | 'read' }) {
  if (status === 'sent') {
    return <Check className="w-3.5 h-3.5 opacity-60" aria-label="Sent" />
  }
  const blue = status === 'read'
  return (
    <CheckCheck
      className={cn('w-3.5 h-3.5', blue ? 'text-sky-400 opacity-100' : 'opacity-60')}
      aria-label={blue ? 'Read' : 'Delivered'}
    />
  )
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  senderName,
  showSender,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onForward,
  onPin,
  onStar,
  onDeleteForMe,
  onThreadClick,
  currentUserId,
  status,
  onOpenAttachment,
  mentionNames = []
}: MessageBubbleProps) {
  const { t } = useLanguage()
  const [showActions, setShowActions] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.Content || '')
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // ── Swipe-to-reply (WhatsApp-style): drag a message left → right to reply to it (touch only) ──
  const [swipeX, setSwipeX] = useState(0)
  const swipe = useRef({ x: 0, y: 0, active: false })
  const onSwipeStart = useCallback((e: ReactTouchEvent) => {
    const p = e.touches[0]; swipe.current = { x: p.clientX, y: p.clientY, active: false }
  }, [])
  const onSwipeMove = useCallback((e: ReactTouchEvent) => {
    const p = e.touches[0]
    const dx = p.clientX - swipe.current.x, dy = p.clientY - swipe.current.y
    if (!swipe.current.active) {
      // only start a swipe once the gesture is clearly horizontal — else let the list scroll vertically
      if (Math.abs(dx) < 10 || Math.abs(dy) > Math.abs(dx)) return
      swipe.current.active = true
    }
    setSwipeX(dx > 0 ? Math.min(dx, SWIPE_MAX) : 0)
  }, [])
  const onSwipeEnd = useCallback(() => {
    if (swipe.current.active && swipeX >= SWIPE_TRIGGER) { onReply(message); try { navigator.vibrate?.(12) } catch { /* no haptics */ } }
    swipe.current.active = false
    setSwipeX(0)
  }, [swipeX, onReply, message])

  const reactions = parseReactions(message.Reactions)
  const attachments = parseAttachments(message.Attachments)

  const handleCopy = useCallback(() => {
    if (message.Content) {
      navigator.clipboard.writeText(message.Content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [message.Content])

  const handleEditSubmit = useCallback(() => {
    if (editContent.trim() && editContent !== message.Content) {
      onEdit(message.MessageID, editContent.trim())
    }
    setIsEditing(false)
  }, [editContent, message.Content, message.MessageID, onEdit])

  // Close the context menu on outside click / Escape.
  useEffect(() => {
    if (!showMenu) return
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMenu(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [showMenu])

  if (message.IsDeleted) {
    return (
      <div className={cn('flex gap-2 px-4 py-1', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="px-3 py-1.5 rounded-lg bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-subtle))] text-[rgb(var(--fg-muted))] text-sm italic shadow-sm">
          {t('This message was deleted')}
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={onSwipeStart}
      onTouchMove={onSwipeMove}
      onTouchEnd={onSwipeEnd}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactionPicker(false) }}
    >
      {/* Swipe-to-reply hint — a reply arrow revealed on the left as the message slides right */}
      {swipeX > 3 && (
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ opacity: Math.min(1, swipeX / SWIPE_TRIGGER) }}
        >
          <div
            className="w-9 h-9 rounded-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-subtle))] shadow-sm flex items-center justify-center"
            style={{ transform: `scale(${0.5 + 0.5 * Math.min(1, swipeX / SWIPE_TRIGGER)})` }}
          >
            <Reply size={17} className={swipeX >= SWIPE_TRIGGER ? 'text-[rgb(var(--color-primary))]' : 'text-[rgb(var(--fg-muted))]'} />
          </div>
        </div>
      )}

      {/* Sliding message row */}
      <div
        className={cn(
          'group flex gap-2 px-4',
          showSender ? 'pt-2' : 'pt-0.5',
          isOwn ? 'justify-end' : 'justify-start'
        )}
        style={{
          transform: swipeX ? `translateX(${swipeX}px)` : undefined,
          transition: swipe.current.active ? 'none' : 'transform .2s ease',
        }}
      >
      {/* Avatar (only for others, only when showing sender) */}
      {!isOwn && (
        <div className="w-8 flex-shrink-0">
          {showSender && (
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium',
                getAvatarColor(message.UserID)
              )}
            >
              {getInitials(senderName)}
            </div>
          )}
        </div>
      )}

      {/* Bubble */}
      <div className={cn('max-w-[70%] min-w-[4rem]', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name */}
        {showSender && !isOwn && (
          <p className="text-xs font-medium text-[rgb(var(--fg-muted))] mb-0.5 ml-1">{senderName}</p>
        )}

        <div className="relative">
          {/* Quick action buttons + kebab menu (hover) */}
          {(showActions || showMenu) && !isEditing && (
            <div className={cn(
              'absolute -top-7 flex items-center gap-0.5 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-lg shadow-sm px-1 py-0.5 z-10',
              isOwn ? 'right-0' : 'left-0'
            )}>
              <ActionBtn icon={Smile} title={t('React')} onClick={() => { setShowReactionPicker(v => !v); setShowMenu(false) }} />
              <ActionBtn icon={Reply} title={t('Reply')} onClick={() => onReply(message)} />
              <div className="relative" ref={menuRef}>
                <ActionBtn icon={MoreHorizontal} title={t('More')} onClick={() => { setShowMenu(v => !v); setShowReactionPicker(false) }} />
                {showMenu && (
                  <div className={cn(
                    'absolute top-7 w-52 py-1 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-xl shadow-xl z-30',
                    isOwn ? 'right-0' : 'left-0'
                  )}>
                    <MenuItem icon={Reply} label={t('Reply')} onClick={() => { onReply(message); setShowMenu(false) }} />
                    {onForward && <MenuItem icon={Forward} label={t('Forward')} onClick={() => { onForward(message); setShowMenu(false) }} />}
                    {message.Content && <MenuItem icon={Copy} label={copied ? t('Copied') : t('Copy text')} onClick={() => { handleCopy(); setShowMenu(false) }} />}
                    {onPin && <MenuItem icon={Pin} label={message.IsPinned ? t('Unpin message') : t('Pin message')} onClick={() => { onPin(message, !message.IsPinned); setShowMenu(false) }} />}
                    {onStar && <MenuItem icon={Star} label={message.IsStarred ? t('Unstar message') : t('Star message')} onClick={() => { onStar(message, !message.IsStarred); setShowMenu(false) }} />}
                    {isOwn && (
                      <MenuItem icon={Pencil} label={t('Edit')} onClick={() => { setIsEditing(true); setEditContent(message.Content || ''); setShowMenu(false) }} />
                    )}
                    <div className="my-1 h-px bg-[rgb(var(--bd-subtle))]" />
                    {onDeleteForMe && <MenuItem icon={Trash2} label={t('Delete for me')} onClick={() => { onDeleteForMe(message.MessageID); setShowMenu(false) }} />}
                    {isOwn && (
                      <MenuItem icon={Users2} label={t('Delete for everyone')} danger onClick={() => { onDelete(message.MessageID); setShowMenu(false) }} />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reaction picker */}
          {showReactionPicker && (
            <div className={cn(
              'absolute -top-14 flex items-center gap-0.5 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-xl shadow-lg px-2 py-1.5 z-20',
              isOwn ? 'right-0' : 'left-0'
            )}>
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { onReact(message.MessageID, emoji); setShowReactionPicker(false) }}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[rgb(var(--bg-hover))] text-base transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Message content */}
          <div
            className={cn(
              'rounded-2xl px-3 py-2 text-sm shadow-sm',
              isOwn
                ? 'bg-[rgb(var(--color-primary))] text-white rounded-br-md'
                : 'bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] rounded-bl-md border border-[rgb(var(--bd-subtle))]'
            )}
          >
            {/* Quoted preview of the message this one replies to (WhatsApp-style) */}
            {message.ParentMessageID != null && <ReplyQuote message={message} isOwn={isOwn} />}
            {isEditing ? (
              <div className="space-y-1.5">
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full min-h-[2rem] bg-transparent text-sm resize-none focus:outline-none"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSubmit() }
                    if (e.key === 'Escape') setIsEditing(false)
                  }}
                />
                <div className="flex gap-1 justify-end">
                  <button onClick={() => setIsEditing(false)} className="text-xs opacity-70 hover:opacity-100 px-2 py-0.5">
                    {t('Cancel')}
                  </button>
                  <button onClick={handleEditSubmit} className="text-xs font-medium opacity-70 hover:opacity-100 px-2 py-0.5">
                    {t('Save')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="space-y-1 mb-1">
                    {attachments.map((att, i) => (
                      <AttachmentPreview key={i} attachment={att} isOwn={isOwn} onOpen={onOpenAttachment} />
                    ))}
                  </div>
                )}

                {/* Text content + inline time */}
                {message.Content && (
                  <p className="whitespace-pre-wrap break-words">
                    {renderWithMentions(message.Content, mentionNames)}
                    <span className="inline-flex items-center gap-1 ml-2 align-bottom translate-y-[1px]">
                      {message.IsStarred && <Star className="w-3 h-3 fill-current opacity-70" />}
                      {message.IsPinned && <Pin className="w-3 h-3 fill-current opacity-70" />}
                      {message.IsEdited && (
                        <span className="text-[0.625rem] opacity-60 italic">{t('edited')}</span>
                      )}
                      <span className="text-[0.625rem] opacity-50 whitespace-nowrap">
                        {formatClockTime(message.CreatedAt)}
                      </span>
                      {isOwn && status && <DeliveryTicks status={status} />}
                    </span>
                  </p>
                )}

                {/* Time only shown separately when there's no text (attachment-only) */}
                {!message.Content && (
                  <div className={cn(
                    'flex items-center gap-1 mt-0.5',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}>
                    {message.IsStarred && <Star className="w-3 h-3 fill-current opacity-70" />}
                    {message.IsPinned && <Pin className="w-3 h-3 fill-current opacity-70" />}
                    <span className="text-[0.625rem] opacity-50">
                      {formatClockTime(message.CreatedAt)}
                    </span>
                    {isOwn && status && <DeliveryTicks status={status} />}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Reactions bar */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 ml-1">
            {reactions.map(reaction => (
              <ReactionBadge
                key={reaction.emoji}
                reaction={reaction}
                currentUserId={currentUserId}
                onToggle={() => onReact(message.MessageID, reaction.emoji)}
              />
            ))}
          </div>
        )}

        {/* Thread indicator */}
        {message.ReplyCount > 0 && onThreadClick && (
          <button
            onClick={() => onThreadClick(message.MessageID)}
            className="flex items-center gap-1 mt-1 ml-1 text-xs text-[rgb(var(--color-primary))] hover:underline"
          >
            <Reply className="w-3 h-3" />
            {message.ReplyCount} {message.ReplyCount === 1 ? t('reply') : t('replies')}
          </button>
        )}
      </div>
      </div>
    </div>
  )
})

// ── Sub-components ────────────────────────────────────────────────────────

/** WhatsApp-style quoted preview of the message a reply replies to (rendered at the top of the reply bubble). */
function ReplyQuote({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const first = parseAttachments(message.ParentAttachments ?? null)[0]
  const mime = (first?.mimeType || '').toLowerCase()
  const text = (message.ParentContent || '').trim()
  const label = text || (
    mime.startsWith('image/') ? '📷 Photo' :
    mime.startsWith('audio/') ? '🎤 Voice message' :
    mime.startsWith('video/') ? '🎥 Video' :
    first ? `📄 ${first.fileName || 'Document'}` : 'Message'
  )
  const thumb = mime.startsWith('image/') ? first?.fileUrl : undefined
  return (
    <div className={cn(
      'mb-1.5 flex items-stretch gap-2 rounded-md overflow-hidden border-l-[3px] pl-2 pr-1.5 py-1',
      isOwn ? 'bg-black/15 border-white/80' : 'bg-[rgb(var(--bg-subtle))] border-[rgb(var(--color-primary))]'
    )}>
      <div className="flex-1 min-w-0 self-center">
        <div className={cn('text-xs font-semibold truncate', isOwn ? 'text-white' : 'text-[rgb(var(--color-primary))]')}>
          {message.ParentSenderName || 'Message'}
        </div>
        <div className={cn('text-xs truncate', isOwn ? 'text-white/85' : 'text-[rgb(var(--fg-muted))]')}>
          {label}
        </div>
      </div>
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0 self-center" />
      )}
    </div>
  )
}

function ActionBtn({ icon: Icon, title, onClick }: { icon: any; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--fg-muted))]"
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-[rgb(var(--bg-hover))] transition-colors',
        danger ? 'text-red-600' : 'text-[rgb(var(--fg-default))]'
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </button>
  )
}

function ReactionBadge({ reaction, currentUserId, onToggle }: { reaction: ChatReaction; currentUserId: number; onToggle: () => void }) {
  const isReacted = reaction.userIds.includes(currentUserId)
  return (
    <button
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
        isReacted
          ? 'bg-[rgb(var(--color-primary)/0.1)] border-[rgb(var(--color-primary)/0.3)] text-[rgb(var(--color-primary))]'
          : 'bg-[rgb(var(--bg-subtle))] border-[rgb(var(--bd-default))] text-[rgb(var(--fg-muted))]'
      )}
    >
      <span>{reaction.emoji}</span>
      <span>{reaction.userIds.length}</span>
    </button>
  )
}

function AttachmentPreview({ attachment, isOwn, onOpen }: { attachment: ChatAttachment; isOwn: boolean; onOpen?: (a: ChatAttachment) => void }) {
  const isImage = attachment.mimeType.startsWith('image/')
  const isAudio = attachment.mimeType.startsWith('audio/') || /\.(webm|ogg|m4a|mp3|wav)$/i.test(attachment.fileName || '')

  if (isAudio) {
    // Voice note / audio file — inline player.
    return (
      <div className={cn('rounded-lg px-1', isOwn ? 'bg-white/10' : 'bg-[rgb(var(--bg-subtle))]')}>
        <audio controls src={attachment.fileUrl} className="max-w-[15rem] h-9" />
      </div>
    )
  }

  if (isImage) {
    // Click opens the in-app viewer (not a new tab).
    return (
      <button type="button" onClick={() => onOpen?.(attachment)} className="block cursor-zoom-in">
        <img
          src={attachment.fileUrl}
          alt={attachment.fileName}
          className="max-w-[15rem] max-h-[12rem] rounded-lg object-cover"
        />
      </button>
    )
  }

  const sizeStr = attachment.fileSize < 1024 * 1024
    ? `${(attachment.fileSize / 1024).toFixed(0)} KB`
    : `${(attachment.fileSize / (1024 * 1024)).toFixed(1)} MB`

  return (
    <button
      type="button"
      onClick={() => onOpen?.(attachment)}
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border w-full text-left',
        isOwn ? 'border-white/20 hover:bg-white/10' : 'border-[rgb(var(--bd-default))] hover:bg-[rgb(var(--bg-hover))]'
      )}
    >
      <div className="w-8 h-8 rounded bg-[rgb(var(--bg-subtle))] flex items-center justify-center text-xs font-bold text-[rgb(var(--fg-muted))]">
        {attachment.fileName.split('.').pop()?.toUpperCase().slice(0, 3)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{attachment.fileName}</p>
        <p className={cn('text-[0.625rem]', isOwn ? 'opacity-60' : 'text-[rgb(var(--fg-muted))]')}>{sizeStr}</p>
      </div>
    </button>
  )
}
