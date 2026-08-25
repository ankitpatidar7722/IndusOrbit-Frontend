'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from 'indas-ui'
import { useMessaging } from '@/contexts/MessagingContext'
import { MessageBubble } from './message-bubble'
import { MessageInput } from './message-input'
import { parseParticipants } from '@/lib/messaging'
import type { ChatRoom, ChatAttachment } from '@/lib/messaging'

interface ThreadPanelProps {
  parentMessageId: number
  room: ChatRoom
  currentUserId: string
  onClose: () => void
  className?: string
}

export function ThreadPanel({
  parentMessageId,
  room,
  currentUserId,
  onClose,
  className
}: ThreadPanelProps) {
  const { t } = useLanguage()
  const { state, actions } = useMessaging()
  const endRef = useRef<HTMLDivElement>(null)

  const threadMessages = state.threadMessages[parentMessageId] || []
  const allRoomMessages = state.messages[room.RoomID] || []
  const parentMessage = allRoomMessages.find(m => m.MessageID === parentMessageId)

  const senderNames = useMemo(() => {
    const participants = parseParticipants(room.Participants)
    const map: Record<number, string> = {}
    for (const p of participants) {
      map[p.userId] = p.userName
    }
    return map
  }, [room.Participants])

  // Fetch thread on mount
  useEffect(() => {
    actions.fetchThreadReplies(parentMessageId)
  }, [parentMessageId, actions])

  // Scroll to bottom on new replies
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages.length])

  const handleSend = useCallback((content: string, attachments?: ChatAttachment[]) => {
    const request: any = { Content: content }
    if (attachments) {
      request.AttachmentsJson = JSON.stringify(attachments)
    }
    actions.replyToMessage(parentMessageId, request)
  }, [parentMessageId, actions])

  return (
    <div className={cn(
      'flex flex-col h-full border-l border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))]',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--bd-default))]">
        <h3 className="text-sm font-semibold text-[rgb(var(--fg-default))]">{t('Thread')}</h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent message */}
      {parentMessage && (
        <div className="border-b border-[rgb(var(--bd-default))] py-2">
          <MessageBubble
            message={parentMessage}
            isOwn={String(parentMessage.UserID) === currentUserId}
            senderName={senderNames[parentMessage.UserID] || `User ${parentMessage.UserID}`}
            showSender={true}
            onReply={() => {}} // no nested reply from parent
            onReact={(id, emoji) => actions.toggleReaction(id, emoji)}
            onEdit={(id, content) => actions.editMessage(id, content)}
            onDelete={(id) => actions.deleteMessage(id)}
            currentUserId={Number(currentUserId)}
          />
        </div>
      )}

      {/* Replies */}
      <div className="flex-1 overflow-y-auto py-2">
        {state.loadingThread ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[rgb(var(--color-primary))] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : threadMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[rgb(var(--fg-muted))]">
            <p className="text-sm">{t('No replies yet')}</p>
          </div>
        ) : (
          threadMessages.map((msg, idx) => {
            const prev = idx > 0 ? threadMessages[idx - 1] : null
            const showSender = !prev || prev.UserID !== msg.UserID
            const isOwn = String(msg.UserID) === currentUserId

            return (
              <div key={msg.MessageID} style={{ paddingLeft: Math.min(msg.ReplyDepth * 16, 48) }}>
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  senderName={senderNames[msg.UserID] || `User ${msg.UserID}`}
                  showSender={showSender}
                  onReply={() => {}} // TODO: nested reply within thread
                  onReact={(id, emoji) => actions.toggleReaction(id, emoji)}
                  onEdit={(id, content) => actions.editMessage(id, content)}
                  onDelete={(id) => actions.deleteMessage(id)}
                  currentUserId={Number(currentUserId)}
                />
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Reply input */}
      <MessageInput
        onSend={handleSend}
        onUploadFile={actions.uploadFile}
        disabled={state.sendingMessage}
        placeholder={t('Reply in thread...')}
      />
    </div>
  )
}
