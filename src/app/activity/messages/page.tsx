'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from 'indas-ui'
import { useSession } from 'next-auth/react'
import { useDevice } from 'indas-ui'
import { useMessaging } from '@/contexts/MessagingContext'
import { ConversationList } from '@/components/messaging/conversation-list'
import { MessageThread } from '@/components/messaging/message-thread'
import { ThreadPanel } from '@/components/messaging/thread-panel'
import { CreateConversationModal } from '@/components/messaging/create-conversation-modal'
import type { ChatRoom } from '@/lib/messaging'

export default function MessagesPage() {
  const { t } = useLanguage()
  const { data: session } = useSession()
  const { isMobile } = useDevice()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, actions } = useMessaging()

  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')

  const currentUserId = String(
    (session?.user as any)?.UserID || (session?.user as any)?.userID || ''
  )


  // Fetch conversations on mount
  useEffect(() => {
    actions.fetchConversations()
  }, [actions])

  // Handle URL param: ?conv=123 (only on initial load)
  const urlHandledRef = useRef(false)
  useEffect(() => {
    const convId = searchParams?.get('conv')
    if (convId && state.conversations.length > 0 && !urlHandledRef.current) {
      urlHandledRef.current = true
      const room = state.conversations.find(c => c.RoomID === Number(convId))
      if (room) {
        setSelectedRoom(room)
        actions.setActiveRoom(room.RoomID)
        if (isMobile) setMobileView('chat')
      }
    }
  }, [searchParams, state.conversations, isMobile, actions])

  const handleSelectRoom = useCallback((room: ChatRoom) => {
    setSelectedRoom(room)
    actions.setActiveRoom(room.RoomID)
    if (isMobile) setMobileView('chat')
  }, [isMobile, actions])

  const handleBack = useCallback(() => {
    setMobileView('list')
    setSelectedRoom(null)
    actions.setActiveRoom(null)
    actions.closeThread()
  }, [actions])

  const handleCreated = useCallback((room: ChatRoom) => {
    setSelectedRoom(room)
    actions.setActiveRoom(room.RoomID)
    if (isMobile) setMobileView('chat')
  }, [isMobile, actions])

  // Keep selectedRoom in sync with conversations state (e.g., after LastMessagePreview updates)
  useEffect(() => {
    if (selectedRoom) {
      const updated = state.conversations.find(c => c.RoomID === selectedRoom.RoomID)
      if (updated && updated !== selectedRoom) {
        setSelectedRoom(updated)
      }
    }
  }, [state.conversations, selectedRoom])

  const handleOpenThread = useCallback((messageId: number) => {
    actions.openThread(messageId)
  }, [actions])

  // ─── Mobile: Single pane navigation ─────────────────────────────────

  if (isMobile) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        {mobileView === 'list' ? (
          <ConversationList
            currentUserId={currentUserId}
            onSelectRoom={handleSelectRoom}
            onNewConversation={() => setShowCreateModal(true)}
            activeRoomId={state.activeRoomId}
          />
        ) : selectedRoom ? (
          <div className="h-full flex flex-col relative">
            <MessageThread
              room={selectedRoom}
              currentUserId={currentUserId}
              onBack={handleBack}
              onOpenThread={handleOpenThread}
              className="flex-1"
            />
            {/* Thread panel as overlay on mobile */}
            {state.activeThreadId && (
              <div className="absolute inset-0 z-40 bg-[rgb(var(--bg-surface))]">
                <ThreadPanel
                  parentMessageId={state.activeThreadId}
                  room={selectedRoom}
                  currentUserId={currentUserId}
                  onClose={() => actions.closeThread()}
                />
              </div>
            )}
          </div>
        ) : null}

        <CreateConversationModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
          currentUserId={currentUserId}
        />
      </div>
    )
  }

  // ─── Desktop / Tablet: Multi-pane layout ────────────────────────────

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Conversation list — fixed width */}
      <div className="w-80 flex-shrink-0 border-r border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))]">
        <ConversationList
          currentUserId={currentUserId}
          onSelectRoom={handleSelectRoom}
          onNewConversation={() => setShowCreateModal(true)}
          activeRoomId={state.activeRoomId}
        />
      </div>

      {/* Message area */}
      <div className="flex-1 flex">
        {selectedRoom ? (
          <>
            <MessageThread
              room={selectedRoom}
              currentUserId={currentUserId}
              onBack={handleBack}
              onOpenThread={handleOpenThread}
              className="flex-1"
            />
            {/* Thread panel */}
            {state.activeThreadId && (
              <ThreadPanel
                parentMessageId={state.activeThreadId}
                room={selectedRoom}
                currentUserId={currentUserId}
                onClose={() => actions.closeThread()}
                className="w-80 flex-shrink-0"
              />
            )}
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-[rgb(var(--fg-muted))]">
            <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-[rgb(var(--fg-default))]">{t('Your messages')}</h3>
            <p className="text-sm mt-1">{t('Select a conversation or start a new one')}</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 h-9 rounded-lg text-sm font-medium bg-[rgb(var(--color-primary))] text-white hover:opacity-90 transition-colors"
            >
              {t('New conversation')}
            </button>
          </div>
        )}
      </div>

      <CreateConversationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
        currentUserId={currentUserId}
      />
    </div>
  )
}
