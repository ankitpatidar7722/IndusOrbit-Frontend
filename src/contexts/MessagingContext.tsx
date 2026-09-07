'use client'

import { createContext, useContext, useReducer, useCallback, useEffect, useRef, useMemo } from 'react'
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import { useSession } from 'next-auth/react'
import { MessagingAPI } from '@/lib/messaging'
import type {
  ChatRoom,
  ChatMessage,
  ChatContact,
  ChatReaction,
  CreateRoomRequest,
  CreateDMRequest,
  SendMessageRequest,
  UpdateRoomRequest
} from '@/lib/messaging'
import { parseReactions, parseParticipants } from '@/lib/messaging'

// ─── State ──────────────────────────────────────────────────────────────────

interface MessagingState {
  // Data
  conversations: ChatRoom[]
  activeRoomId: number | null
  messages: Record<number, ChatMessage[]> // roomId → messages
  threadMessages: Record<number, ChatMessage[]> // parentMessageId → replies
  contacts: ChatContact[]

  // Real-time
  onlineUsers: Set<string> // userId strings
  lastSeen: Record<string, string | null> // userId → last-seen ISO timestamp
  typingUsers: Record<number, string[]> // roomId → typing userIds
  readReceipts: Record<number, Record<string, number>> // roomId → userId → lastReadMessageId
  unreadCounts: Record<number, number> // roomId → count
  totalUnreadCount: number

  // Loading
  loadingConversations: boolean
  loadingMessages: boolean
  loadingThread: boolean
  sendingMessage: boolean

  // Pagination
  messagePagination: Record<number, { page: number; hasMore: boolean }>

  // Search
  searchQuery: string
  searchResults: ChatMessage[]
  searchLoading: boolean

  // Thread panel
  activeThreadId: number | null

  // Error
  error: string | null
}

// ─── Actions ────────────────────────────────────────────────────────────────

type MessagingAction =
  | { type: 'SET_CONVERSATIONS'; payload: ChatRoom[] }
  | { type: 'UPDATE_CONVERSATION'; payload: { roomId: number; updates: Partial<ChatRoom> } }
  | { type: 'ADD_CONVERSATION'; payload: ChatRoom }
  | { type: 'REMOVE_CONVERSATION'; payload: { roomId: number } }
  | { type: 'SET_ACTIVE_ROOM'; payload: number | null }
  | { type: 'SET_MESSAGES'; payload: { roomId: number; messages: ChatMessage[]; hasMore: boolean; page: number } }
  | { type: 'APPEND_MESSAGES'; payload: { roomId: number; messages: ChatMessage[]; hasMore: boolean; page: number } }
  | { type: 'ADD_MESSAGE'; payload: { roomId: number; message: ChatMessage } }
  | { type: 'UPDATE_MESSAGE'; payload: { messageId: number; roomId: number; updates: Partial<ChatMessage> } }
  | { type: 'DELETE_MESSAGE'; payload: { messageId: number; roomId: number } }
  | { type: 'REMOVE_MESSAGE'; payload: { messageId: number; roomId: number } }
  | { type: 'SET_THREAD_MESSAGES'; payload: { parentId: number; messages: ChatMessage[] } }
  | { type: 'ADD_THREAD_MESSAGE'; payload: { parentId: number; message: ChatMessage } }
  | { type: 'SET_CONTACTS'; payload: ChatContact[] }
  | { type: 'SET_ONLINE_USERS'; payload: Set<string> }
  | { type: 'SET_LAST_SEEN'; payload: { userId: string; lastSeenAt: string | null } }
  | { type: 'USER_ONLINE'; payload: string }
  | { type: 'USER_OFFLINE'; payload: string }
  | { type: 'SET_TYPING'; payload: { roomId: number; userId: string; isTyping: boolean } }
  | { type: 'SET_READ_RECEIPT'; payload: { roomId: number; userId: string; lastReadMessageId: number } }
  | { type: 'SET_UNREAD_COUNTS'; payload: Record<number, number> }
  | { type: 'CLEAR_UNREAD'; payload: number } // roomId
  | { type: 'INCREMENT_UNREAD'; payload: number } // roomId
  | { type: 'SET_LOADING_CONVERSATIONS'; payload: boolean }
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean }
  | { type: 'SET_LOADING_THREAD'; payload: boolean }
  | { type: 'SET_SENDING_MESSAGE'; payload: boolean }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: ChatMessage[] }
  | { type: 'SET_SEARCH_LOADING'; payload: boolean }
  | { type: 'SET_ACTIVE_THREAD'; payload: number | null }
  | { type: 'SET_ERROR'; payload: string | null }

// ─── Initial State ──────────────────────────────────────────────────────────

const initialState: MessagingState = {
  conversations: [],
  activeRoomId: null,
  messages: {},
  threadMessages: {},
  contacts: [],
  onlineUsers: new Set(),
  lastSeen: {},
  typingUsers: {},
  readReceipts: {},
  unreadCounts: {},
  totalUnreadCount: 0,
  loadingConversations: false,
  loadingMessages: false,
  loadingThread: false,
  sendingMessage: false,
  messagePagination: {},
  searchQuery: '',
  searchResults: [],
  searchLoading: false,
  activeThreadId: null,
  error: null
}

// ─── Reducer ────────────────────────────────────────────────────────────────

function messagingReducer(state: MessagingState, action: MessagingAction): MessagingState {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload }

    case 'UPDATE_CONVERSATION': {
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.RoomID === action.payload.roomId ? { ...c, ...action.payload.updates } : c
        )
      }
    }

    case 'ADD_CONVERSATION':
      return {
        ...state,
        conversations: [action.payload, ...state.conversations.filter(c => c.RoomID !== action.payload.RoomID)]
      }

    case 'REMOVE_CONVERSATION': {
      const { [action.payload.roomId]: _drop, ...restMessages } = state.messages
      return {
        ...state,
        conversations: state.conversations.filter(c => c.RoomID !== action.payload.roomId),
        messages: restMessages,
        activeRoomId: state.activeRoomId === action.payload.roomId ? null : state.activeRoomId,
      }
    }

    case 'SET_ACTIVE_ROOM':
      return { ...state, activeRoomId: action.payload }

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: { ...state.messages, [action.payload.roomId]: action.payload.messages },
        messagePagination: {
          ...state.messagePagination,
          [action.payload.roomId]: { page: action.payload.page, hasMore: action.payload.hasMore }
        }
      }

    case 'APPEND_MESSAGES': {
      const existing = state.messages[action.payload.roomId] || []
      const existingIds = new Set(existing.map(m => m.MessageID))
      const newMsgs = action.payload.messages.filter(m => !existingIds.has(m.MessageID))
      return {
        ...state,
        messages: { ...state.messages, [action.payload.roomId]: [...newMsgs, ...existing] },
        messagePagination: {
          ...state.messagePagination,
          [action.payload.roomId]: { page: action.payload.page, hasMore: action.payload.hasMore }
        }
      }
    }

    case 'ADD_MESSAGE': {
      const existing = state.messages[action.payload.roomId] || []
      // Avoid duplicates
      if (existing.some(m => m.MessageID === action.payload.message.MessageID)) return state
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.roomId]: [...existing, action.payload.message]
        }
      }
    }

    case 'UPDATE_MESSAGE': {
      const msgs = state.messages[action.payload.roomId]
      if (!msgs) return state
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.roomId]: msgs.map(m =>
            m.MessageID === action.payload.messageId ? { ...m, ...action.payload.updates } : m
          )
        }
      }
    }

    case 'DELETE_MESSAGE': {
      const msgs = state.messages[action.payload.roomId]
      if (!msgs) return state
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.roomId]: msgs.map(m =>
            m.MessageID === action.payload.messageId ? { ...m, IsDeleted: true, Content: null } : m
          )
        }
      }
    }

    case 'REMOVE_MESSAGE': {
      const msgs = state.messages[action.payload.roomId]
      if (!msgs) return state
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.roomId]: msgs.filter(m => m.MessageID !== action.payload.messageId)
        }
      }
    }

    case 'SET_THREAD_MESSAGES':
      return { ...state, threadMessages: { ...state.threadMessages, [action.payload.parentId]: action.payload.messages } }

    case 'ADD_THREAD_MESSAGE': {
      const existing = state.threadMessages[action.payload.parentId] || []
      if (existing.some(m => m.MessageID === action.payload.message.MessageID)) return state
      return {
        ...state,
        threadMessages: {
          ...state.threadMessages,
          [action.payload.parentId]: [...existing, action.payload.message]
        }
      }
    }

    case 'SET_CONTACTS':
      return { ...state, contacts: action.payload }

    case 'SET_ONLINE_USERS':
      return { ...state, onlineUsers: action.payload }

    case 'SET_LAST_SEEN':
      return { ...state, lastSeen: { ...state.lastSeen, [action.payload.userId]: action.payload.lastSeenAt } }

    case 'USER_ONLINE': {
      const next = new Set(state.onlineUsers)
      next.add(action.payload)
      return { ...state, onlineUsers: next }
    }

    case 'USER_OFFLINE': {
      const next = new Set(state.onlineUsers)
      next.delete(action.payload)
      return { ...state, onlineUsers: next }
    }

    case 'SET_TYPING': {
      const { roomId, userId, isTyping } = action.payload
      const current = state.typingUsers[roomId] || []
      const next = isTyping
        ? current.includes(userId) ? current : [...current, userId]
        : current.filter(id => id !== userId)
      return { ...state, typingUsers: { ...state.typingUsers, [roomId]: next } }
    }

    case 'SET_READ_RECEIPT': {
      const { roomId, userId, lastReadMessageId } = action.payload
      const room = state.readReceipts[roomId] || {}
      // Only advance — never move a read marker backwards.
      if ((room[userId] || 0) >= lastReadMessageId) return state
      return {
        ...state,
        readReceipts: { ...state.readReceipts, [roomId]: { ...room, [userId]: lastReadMessageId } }
      }
    }

    case 'SET_UNREAD_COUNTS': {
      const total = Object.values(action.payload).reduce((sum, c) => sum + c, 0)
      return { ...state, unreadCounts: action.payload, totalUnreadCount: total }
    }

    case 'CLEAR_UNREAD': {
      const prev = state.unreadCounts[action.payload] || 0
      const next = { ...state.unreadCounts, [action.payload]: 0 }
      return { ...state, unreadCounts: next, totalUnreadCount: Math.max(0, state.totalUnreadCount - prev) }
    }

    case 'INCREMENT_UNREAD': {
      const current = state.unreadCounts[action.payload] || 0
      const next = { ...state.unreadCounts, [action.payload]: current + 1 }
      return { ...state, unreadCounts: next, totalUnreadCount: state.totalUnreadCount + 1 }
    }

    case 'SET_LOADING_CONVERSATIONS':
      return { ...state, loadingConversations: action.payload }
    case 'SET_LOADING_MESSAGES':
      return { ...state, loadingMessages: action.payload }
    case 'SET_LOADING_THREAD':
      return { ...state, loadingThread: action.payload }
    case 'SET_SENDING_MESSAGE':
      return { ...state, sendingMessage: action.payload }

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload }
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload }
    case 'SET_SEARCH_LOADING':
      return { ...state, searchLoading: action.payload }

    case 'SET_ACTIVE_THREAD':
      return { ...state, activeThreadId: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload }

    default:
      return state
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

interface MessagingContextValue {
  state: MessagingState
  actions: {
    // Conversations
    fetchConversations: (type?: 'DM' | 'Group' | 'Channel') => Promise<void>
    createRoom: (request: CreateRoomRequest) => Promise<ChatRoom | null>
    getOrCreateDM: (request: CreateDMRequest) => Promise<ChatRoom | null>
    updateRoom: (roomId: number, request: UpdateRoomRequest) => Promise<void>
    addMembers: (roomId: number, members: { UserID: number; UserName: string }[]) => Promise<void>
    removeMember: (roomId: number, targetUserId: number) => Promise<void>
    setMemberRole: (roomId: number, targetUserId: number, role: 'Admin' | 'Member') => Promise<void>
    setGroupReadOnly: (roomId: number, isReadOnly: boolean) => Promise<void>
    leaveGroup: (roomId: number) => Promise<void>
    deleteRoom: (roomId: number) => Promise<void>
    deleteRoomForMe: (roomId: number) => Promise<void>
    setChatPrefs: (roomId: number, prefs: { mute?: boolean; pin?: boolean; archive?: boolean }) => Promise<void>
    fetchSharedMedia: (roomId: number) => Promise<ChatMessage[]>
    setActiveRoom: (roomId: number | null) => void

    // Messages
    fetchMessages: (roomId: number, page?: number) => Promise<void>
    fetchMoreMessages: (roomId: number) => Promise<void>
    sendMessage: (roomId: number, request: SendMessageRequest) => Promise<ChatMessage | null>
    editMessage: (messageId: number, content: string) => Promise<void>
    deleteMessage: (messageId: number) => Promise<void>
    pinMessage: (messageId: number, roomId: number, isPinned: boolean) => Promise<void>
    starMessage: (messageId: number, roomId: number, isStarred: boolean) => Promise<void>
    deleteForMe: (messageId: number, roomId: number) => Promise<void>

    // Threads
    fetchThreadReplies: (messageId: number) => Promise<void>
    replyToMessage: (parentMessageId: number, request: SendMessageRequest) => Promise<ChatMessage | null>
    openThread: (messageId: number) => void
    closeThread: () => void

    // Reactions
    toggleReaction: (messageId: number, emoji: string) => Promise<void>

    // Read status
    markAsRead: (roomId: number, lastReadMessageId: number) => Promise<void>
    fetchUnreadCounts: () => Promise<void>

    // Search
    searchMessages: (query: string) => Promise<void>
    clearSearch: () => void

    // Contacts
    fetchContacts: () => Promise<void>

    // File upload
    uploadFile: (file: File) => Promise<{ FileName: string; FileUrl: string; FileSize: number; MimeType: string } | null>

    // SignalR
    joinConversation: (roomId: number) => Promise<void>
    leaveConversation: (roomId: number) => Promise<void>
    sendTyping: (roomId: number, isTyping: boolean) => Promise<void>

    // Utility
    isUserOnline: (userId: number | string) => boolean
    getTypingUsers: (roomId: number) => string[]
    getReadReceipts: (roomId: number) => Record<string, number>
    fetchOnlineUsers: () => Promise<void>
    fetchLastSeen: (userId: number) => Promise<void>
    clearError: () => void
  }
}

const MessagingContext = createContext<MessagingContextValue | undefined>(undefined)

// ─── Provider ───────────────────────────────────────────────────────────────

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [state, dispatch] = useReducer(messagingReducer, initialState)
  const stateRef = useRef(state)
  stateRef.current = state

  // Keeps the header chat badge live app-wide: a chat message raises a "Notification"
  // (pushed to the user's group on every page), but ReceiveMessage only reaches the open
  // room. So on a Message notification we re-pull the authoritative unread counts (debounced).
  const fetchUnreadCountsRef = useRef<() => Promise<void>>(async () => {})
  const unreadRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentUserId = String(
    (session?.user as any)?.UserID || (session?.user as any)?.userID || ''
  )

  // ─── SignalR Callbacks ──────────────────────────────────────────────────

  const signalRCallbacks = {
    onReceiveMessage: useCallback((data: any) => {
      if (!data?.message) return
      const msg = data.message as ChatMessage
      const roomId = data.roomId

      // If I've LEFT this room, I no longer receive new messages (read-only history only).
      const room = stateRef.current.conversations.find(r => r.RoomID === roomId)
      if (room && currentUserId && parseParticipants(room.Participants).find(p => String(p.userId) === currentUserId)?.leftAt) return

      // Add to room messages
      dispatch({ type: 'ADD_MESSAGE', payload: { roomId, message: msg } })

      // Update conversation preview
      dispatch({
        type: 'UPDATE_CONVERSATION',
        payload: {
          roomId,
          updates: {
            LastMessageAt: msg.CreatedAt,
            LastMessagePreview: msg.Content?.substring(0, 100) || null,
            LastMessageBy: msg.UserID
          }
        }
      })

      // If thread reply, add to thread messages
      if (data.parentMessageId) {
        dispatch({ type: 'ADD_THREAD_MESSAGE', payload: { parentId: data.parentMessageId, message: msg } })
      }

      // Increment unread if not the active room or sender is not current user
      if (
        String(msg.UserID) !== currentUserId &&
        stateRef.current.activeRoomId !== roomId
      ) {
        dispatch({ type: 'INCREMENT_UNREAD', payload: roomId })
      }

      // Clear typing indicator for sender
      dispatch({ type: 'SET_TYPING', payload: { roomId, userId: String(msg.UserID), isTyping: false } })
    }, [currentUserId]),

    onMessageEdited: useCallback((data: any) => {
      if (!data) return
      // Find which room the message is in
      const s = stateRef.current
      for (const [roomIdStr, msgs] of Object.entries(s.messages)) {
        if (msgs.some(m => m.MessageID === data.messageId)) {
          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: { messageId: data.messageId, roomId: Number(roomIdStr), updates: { Content: data.content, IsEdited: true, EditedAt: data.editedAt } }
          })
          break
        }
      }
    }, []),

    onMessageDeleted: useCallback((data: any) => {
      if (!data) return
      dispatch({ type: 'DELETE_MESSAGE', payload: { messageId: data.messageId, roomId: data.roomId } })
    }, []),

    onMessagePinned: useCallback((data: any) => {
      if (!data || data.roomId == null || data.messageId == null) return
      dispatch({ type: 'UPDATE_MESSAGE', payload: { messageId: data.messageId, roomId: data.roomId, updates: { IsPinned: !!data.isPinned } } })
    }, []),

    onRoomUpdated: useCallback((data: any) => {
      if (!data || data.roomId == null || !data.room) return
      const r = data.room
      dispatch({ type: 'UPDATE_CONVERSATION', payload: { roomId: data.roomId, updates: {
        Participants: r.Participants, IsReadOnly: r.IsReadOnly, Name: r.Name, Description: r.Description,
      } } })
    }, []),

    onRoomDeleted: useCallback((data: any) => {
      if (!data || data.roomId == null) return
      dispatch({ type: 'REMOVE_CONVERSATION', payload: { roomId: data.roomId } })
    }, []),

    onReactionUpdated: useCallback((data: any) => {
      if (!data) return
      const s = stateRef.current
      for (const [roomIdStr, msgs] of Object.entries(s.messages)) {
        if (msgs.some(m => m.MessageID === data.messageId)) {
          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: { messageId: data.messageId, roomId: Number(roomIdStr), updates: { Reactions: data.reactions } }
          })
          break
        }
      }
    }, []),

    onTypingIndicator: useCallback((data: any) => {
      if (!data) return
      dispatch({ type: 'SET_TYPING', payload: { roomId: data.conversationId, userId: data.userId, isTyping: data.isTyping } })

      // Auto-clear typing after 5s
      if (data.isTyping) {
        setTimeout(() => {
          dispatch({ type: 'SET_TYPING', payload: { roomId: data.conversationId, userId: data.userId, isTyping: false } })
        }, 5000)
      }
    }, []),

    onPresenceChanged: useCallback((data: any) => {
      if (!data || data.userId == null) return
      // Backend broadcasts { userId, isOnline, lastSeenAt? }. Store as string to match
      // isUserOnline()'s Set lookup (which coerces with String(userId)).
      const uid = String(data.userId)
      if (data.isOnline) {
        dispatch({ type: 'USER_ONLINE', payload: uid })
      } else {
        dispatch({ type: 'USER_OFFLINE', payload: uid })
        if (data.lastSeenAt) dispatch({ type: 'SET_LAST_SEEN', payload: { userId: uid, lastSeenAt: data.lastSeenAt } })
      }
    }, []),

    onReadReceipt: useCallback((data: any) => {
      if (!data || data.roomId == null || data.userId == null) return
      // Ignore our own receipts — we already cleared unread locally on markAsRead.
      if (String(data.userId) === currentUserId) return
      dispatch({
        type: 'SET_READ_RECEIPT',
        payload: {
          roomId: data.roomId,
          userId: String(data.userId),
          lastReadMessageId: Number(data.lastReadMessageId) || 0
        }
      })
    }, [currentUserId]),

    // App-wide chat notification → keep the total unread badge fresh even when the room
    // isn't open. Skip the active room (it's continuously marked read while viewed).
    onNotification: useCallback((data: any) => {
      const n = data?.notification
      if (!n || n.Type !== 'Message') return
      const m = /conv=(\d+)/.exec(n.Link || '')
      const roomId = m ? Number(m[1]) : 0
      if (roomId && roomId === stateRef.current.activeRoomId) return
      if (unreadRefreshTimer.current) clearTimeout(unreadRefreshTimer.current)
      unreadRefreshTimer.current = setTimeout(() => { fetchUnreadCountsRef.current() }, 700)
    }, [])
  }

  // ─── Inline SignalR connection ────────────────────────────────────────────

  const signalRConnectionRef = useRef<HubConnection | null>(null)
  const signalRCallbacksRef = useRef(signalRCallbacks)
  signalRCallbacksRef.current = signalRCallbacks

  const hubJoin = useCallback(async (roomId: number) => {
    const conn = signalRConnectionRef.current
    if (conn?.state === HubConnectionState.Connected) {
      await conn.invoke('JoinConversation', roomId)
    }
  }, [])

  const hubLeave = useCallback(async (roomId: number) => {
    const conn = signalRConnectionRef.current
    if (conn?.state === HubConnectionState.Connected) {
      await conn.invoke('LeaveConversation', roomId)
    }
  }, [])

  const hubSendTyping = useCallback(async (roomId: number, isTyping: boolean) => {
    const conn = signalRConnectionRef.current
    if (conn?.state === HubConnectionState.Connected) {
      await conn.invoke('SendTyping', roomId, isTyping)
    }
  }, [])

  // Extract stable session values to avoid re-evaluating casted expressions in deps
  const sessionCompanyId = (session?.user as any)?.CompanyID || (session?.user as any)?.companyID || ''
  const sessionUserId = (session?.user as any)?.UserID || (session?.user as any)?.userID || ''
  const sessionCompanyUser = (session?.user as any)?.companyUsername || ''
  const sessionCompanyPass = (session?.user as any)?.companyPassword || ''

  // Called after a dropped connection is re-established: rejoin the active room's group
  // (group membership is lost server-side on disconnect) and refetch to recover any
  // messages/read-state missed while offline. Held in a ref so the connection effect
  // doesn't depend on actions defined further down.
  const onReconnectedRef = useRef<() => void>(() => {})

  useEffect(() => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5080'
    if (!sessionCompanyId || !sessionUserId) return

    // The hub reads userId/companyId from the query string (Indus 360 has no per-connection
    // auth token — WebSockets can't send custom headers).
    const hubUrl = `${API_BASE_URL}/messagingHub?companyId=${sessionCompanyId}&userId=${sessionUserId}`

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.None)
      .build()

    const cb = signalRCallbacksRef
    connection.on('ReceiveMessage', (data) => cb.current.onReceiveMessage?.(data))
    connection.on('MessageEdited', (data) => cb.current.onMessageEdited?.(data))
    connection.on('MessageDeleted', (data) => cb.current.onMessageDeleted?.(data))
    connection.on('MessagePinned', (data) => cb.current.onMessagePinned?.(data))
    connection.on('RoomUpdated', (data) => cb.current.onRoomUpdated?.(data))
    connection.on('RoomDeleted', (data) => cb.current.onRoomDeleted?.(data))
    connection.on('ReactionUpdated', (data) => cb.current.onReactionUpdated?.(data))
    connection.on('TypingIndicator', (data) => cb.current.onTypingIndicator?.(data))
    connection.on('PresenceChanged', (data) => cb.current.onPresenceChanged?.(data))
    connection.on('ReadReceipt', (data) => cb.current.onReadReceipt?.(data))
    connection.on('Notification', (data) => cb.current.onNotification?.(data))

    connection.onreconnected(() => onReconnectedRef.current())

    connection.start().catch(() => {})
    signalRConnectionRef.current = connection

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        connection.stop()
      }
    }
  }, [sessionCompanyId, sessionUserId, sessionCompanyUser, sessionCompanyPass])

  // ─── API Actions ────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async (type?: 'DM' | 'Group' | 'Channel') => {
    if (!session) return
    dispatch({ type: 'SET_LOADING_CONVERSATIONS', payload: true })
    try {
      const res = await MessagingAPI.getConversations(session, type)
      if (res.success && res.data) {
        dispatch({ type: 'SET_CONVERSATIONS', payload: res.data })
      }
    } finally {
      dispatch({ type: 'SET_LOADING_CONVERSATIONS', payload: false })
    }
  }, [session])

  const createRoom = useCallback(async (request: CreateRoomRequest): Promise<ChatRoom | null> => {
    if (!session) return null
    const res = await MessagingAPI.createRoom(request, session)
    if (res.success && res.data) {
      dispatch({ type: 'ADD_CONVERSATION', payload: res.data })
      return res.data
    }
    dispatch({ type: 'SET_ERROR', payload: res.error || null })
    return null
  }, [session])

  const getOrCreateDM = useCallback(async (request: CreateDMRequest): Promise<ChatRoom | null> => {
    if (!session) return null
    const res = await MessagingAPI.getOrCreateDM(request, session)
    if (res.success && res.data) {
      dispatch({ type: 'ADD_CONVERSATION', payload: res.data })
      return res.data
    }
    dispatch({ type: 'SET_ERROR', payload: res.error || null })
    return null
  }, [session])

  const updateRoom = useCallback(async (roomId: number, request: UpdateRoomRequest) => {
    if (!session) return
    const res = await MessagingAPI.updateRoom(roomId, request, session)
    if (res.success && res.data) {
      dispatch({ type: 'UPDATE_CONVERSATION', payload: { roomId, updates: res.data } })
    }
  }, [session])

  // ── Group management ──
  const refreshRoom = useCallback(async (roomId: number) => {
    // Re-fetch conversations so the updated Participants/IsReadOnly land in state.
    if (!session) return
    const res = await MessagingAPI.getConversations(session)
    if (res.success && res.data) {
      const room = res.data.find(r => r.RoomID === roomId)
      if (room) dispatch({ type: 'UPDATE_CONVERSATION', payload: { roomId, updates: room } })
    }
  }, [session])

  const addMembers = useCallback(async (roomId: number, members: { UserID: number; UserName: string }[]) => {
    if (!session) return
    await MessagingAPI.addMembers(roomId, members, session)
    await refreshRoom(roomId)
  }, [session, refreshRoom])

  const removeMember = useCallback(async (roomId: number, targetUserId: number) => {
    if (!session) return
    await MessagingAPI.removeMember(roomId, targetUserId, session)
    await refreshRoom(roomId)
  }, [session, refreshRoom])

  const setMemberRole = useCallback(async (roomId: number, targetUserId: number, role: 'Admin' | 'Member') => {
    if (!session) return
    await MessagingAPI.setMemberRole(roomId, targetUserId, role, session)
    await refreshRoom(roomId)
  }, [session, refreshRoom])

  const setGroupReadOnly = useCallback(async (roomId: number, isReadOnly: boolean) => {
    if (!session) return
    dispatch({ type: 'UPDATE_CONVERSATION', payload: { roomId, updates: { IsReadOnly: isReadOnly } } })
    await MessagingAPI.setGroupReadOnly(roomId, isReadOnly, session)
  }, [session])

  const leaveGroup = useCallback(async (roomId: number) => {
    if (!session) return
    await MessagingAPI.leaveGroup(roomId, session)
    // Soft-leave: the group STAYS in my list read-only (history up to now). Refresh it to pick up my
    // leftAt (which flips the thread to read-only) instead of removing it from the list.
    await refreshRoom(roomId)
  }, [session, refreshRoom])

  const deleteRoom = useCallback(async (roomId: number) => {
    if (!session) return
    await MessagingAPI.deleteRoom(roomId, session)
    dispatch({ type: 'REMOVE_CONVERSATION', payload: { roomId } })
  }, [session])

  // "Delete group for me": remove the room from MY list only (I've usually already left). It stays
  // for everyone else — nothing is deleted globally.
  const deleteRoomForMe = useCallback(async (roomId: number) => {
    if (!session) return
    await MessagingAPI.deleteRoomForMe(roomId, session)
    dispatch({ type: 'REMOVE_CONVERSATION', payload: { roomId } })
  }, [session])

  // Per-user chat prefs (WhatsApp-style): mute / pin / archive. Optimistic — refresh to reflect.
  const setChatPrefs = useCallback(async (roomId: number, prefs: { mute?: boolean; pin?: boolean; archive?: boolean }) => {
    if (!session) return
    await MessagingAPI.setChatPrefs(roomId, prefs, session)
    await refreshRoom(roomId)
  }, [session, refreshRoom])

  // Shared media/docs/links of a room (for the group's gallery).
  const fetchSharedMedia = useCallback(async (roomId: number) => {
    if (!session) return []
    const r = await MessagingAPI.getSharedMedia(roomId, session)
    return r.data || []
  }, [session])

  const setActiveRoom = useCallback((roomId: number | null) => {
    dispatch({ type: 'SET_ACTIVE_ROOM', payload: roomId })
  }, [])

  const fetchMessages = useCallback(async (roomId: number, page = 1) => {
    if (!session) return
    dispatch({ type: 'SET_LOADING_MESSAGES', payload: true })
    try {
      const pageSize = 50
      const res = await MessagingAPI.getMessages(roomId, session, page, pageSize)
      if (res.success && res.data) {
        const hasMore = res.data.length === pageSize
        // Backend already returns messages ascending (oldest → newest) for display —
        // GetMessagesAsync fetches DESC for paging then reverses server-side. Use as-is.
        const chronological = res.data
        if (page === 1) {
          dispatch({ type: 'SET_MESSAGES', payload: { roomId, messages: chronological, hasMore, page } })
        } else {
          // Older messages prepend to the start
          dispatch({ type: 'APPEND_MESSAGES', payload: { roomId, messages: chronological, hasMore, page } })
        }
      }
    } finally {
      dispatch({ type: 'SET_LOADING_MESSAGES', payload: false })
    }
  }, [session])

  const fetchMoreMessages = useCallback(async (roomId: number) => {
    const pagination = stateRef.current.messagePagination[roomId]
    if (!pagination?.hasMore) return
    await fetchMessages(roomId, pagination.page + 1)
  }, [fetchMessages])

  const sendMessage = useCallback(async (roomId: number, request: SendMessageRequest): Promise<ChatMessage | null> => {
    if (!session) return null
    dispatch({ type: 'SET_SENDING_MESSAGE', payload: true })
    try {
      const res = await MessagingAPI.sendMessage(roomId, request, session)
      if (res.success && res.data) {
        // Add locally (SignalR will deduplicate via MessageID check)
        dispatch({ type: 'ADD_MESSAGE', payload: { roomId, message: res.data } })
        dispatch({
          type: 'UPDATE_CONVERSATION',
          payload: {
            roomId,
            updates: {
              LastMessageAt: res.data.CreatedAt,
              LastMessagePreview: res.data.Content?.substring(0, 100) || null,
              LastMessageBy: res.data.UserID
            }
          }
        })
        return res.data
      }
      dispatch({ type: 'SET_ERROR', payload: res.error || null })
      return null
    } finally {
      dispatch({ type: 'SET_SENDING_MESSAGE', payload: false })
    }
  }, [session])

  const editMessage = useCallback(async (messageId: number, content: string) => {
    if (!session) return
    await MessagingAPI.editMessage(messageId, content, session)
    // Update will arrive via SignalR
  }, [session])

  const deleteMessage = useCallback(async (messageId: number) => {
    if (!session) return
    await MessagingAPI.deleteMessage(messageId, session)
    // Delete will arrive via SignalR
  }, [session])

  // Pin / unpin (visible to the whole room; broadcast → UPDATE_MESSAGE via MessagePinned).
  const pinMessage = useCallback(async (messageId: number, roomId: number, isPinned: boolean) => {
    if (!session) return
    dispatch({ type: 'UPDATE_MESSAGE', payload: { messageId, roomId, updates: { IsPinned: isPinned } } })
    await MessagingAPI.pinMessage(messageId, isPinned, session)
  }, [session])

  // Star / unstar (personal — local update only, no broadcast).
  const starMessage = useCallback(async (messageId: number, roomId: number, isStarred: boolean) => {
    if (!session) return
    dispatch({ type: 'UPDATE_MESSAGE', payload: { messageId, roomId, updates: { IsStarred: isStarred } } })
    await MessagingAPI.starMessage(messageId, isStarred, session)
  }, [session])

  // Delete for me — hides the message for the caller only (removed from the list, no tombstone).
  const deleteForMe = useCallback(async (messageId: number, roomId: number) => {
    if (!session) return
    dispatch({ type: 'REMOVE_MESSAGE', payload: { messageId, roomId } })
    await MessagingAPI.deleteForMe(messageId, session)
  }, [session])

  const fetchThreadReplies = useCallback(async (messageId: number) => {
    if (!session) return
    dispatch({ type: 'SET_LOADING_THREAD', payload: true })
    try {
      const res = await MessagingAPI.getThreadReplies(messageId, session)
      if (res.success && res.data) {
        dispatch({ type: 'SET_THREAD_MESSAGES', payload: { parentId: messageId, messages: res.data } })
      }
    } finally {
      dispatch({ type: 'SET_LOADING_THREAD', payload: false })
    }
  }, [session])

  const replyToMessage = useCallback(async (parentMessageId: number, request: SendMessageRequest): Promise<ChatMessage | null> => {
    if (!session) return null
    dispatch({ type: 'SET_SENDING_MESSAGE', payload: true })
    try {
      const res = await MessagingAPI.replyToMessage(parentMessageId, request, session)
      if (res.success && res.data) {
        dispatch({ type: 'ADD_THREAD_MESSAGE', payload: { parentId: parentMessageId, message: res.data } })
        return res.data
      }
      dispatch({ type: 'SET_ERROR', payload: res.error || null })
      return null
    } finally {
      dispatch({ type: 'SET_SENDING_MESSAGE', payload: false })
    }
  }, [session])

  const openThread = useCallback((messageId: number) => {
    dispatch({ type: 'SET_ACTIVE_THREAD', payload: messageId })
  }, [])

  const closeThread = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_THREAD', payload: null })
  }, [])

  const toggleReaction = useCallback(async (messageId: number, emoji: string) => {
    if (!session || !currentUserId) return

    // Find the message in any room
    const s = stateRef.current
    let foundRoomId: number | null = null
    let foundMsg: ChatMessage | null = null

    for (const [roomIdStr, msgs] of Object.entries(s.messages)) {
      const msg = msgs.find(m => m.MessageID === messageId)
      if (msg) {
        foundRoomId = Number(roomIdStr)
        foundMsg = msg
        break
      }
    }

    if (!foundMsg || foundRoomId === null) return

    // Parse existing reactions, toggle the user's reaction
    const reactions: ChatReaction[] = parseReactions(foundMsg.Reactions)
    const userIdNum = Number(currentUserId)
    const existing = reactions.find(r => r.emoji === emoji)

    if (existing) {
      if (existing.userIds.includes(userIdNum)) {
        existing.userIds = existing.userIds.filter(id => id !== userIdNum)
        if (existing.userIds.length === 0) {
          const idx = reactions.indexOf(existing)
          reactions.splice(idx, 1)
        }
      } else {
        existing.userIds.push(userIdNum)
      }
    } else {
      reactions.push({ emoji, userIds: [userIdNum] })
    }

    const reactionsJson = JSON.stringify(reactions)

    // Optimistic update
    dispatch({
      type: 'UPDATE_MESSAGE',
      payload: { messageId, roomId: foundRoomId, updates: { Reactions: reactionsJson } }
    })

    await MessagingAPI.updateReactions(messageId, reactionsJson, session)
    // Server will broadcast via SignalR
  }, [session, currentUserId])

  const markAsRead = useCallback(async (roomId: number, lastReadMessageId: number) => {
    if (!session) return
    dispatch({ type: 'CLEAR_UNREAD', payload: roomId })
    await MessagingAPI.markAsRead(roomId, lastReadMessageId, session)
  }, [session])

  const fetchUnreadCounts = useCallback(async () => {
    if (!session) return
    const res = await MessagingAPI.getUnreadCounts(session)
    if (res.success && res.data) {
      const counts: Record<number, number> = {}
      for (const item of res.data) {
        counts[item.RoomID] = item.UnreadCount
      }
      dispatch({ type: 'SET_UNREAD_COUNTS', payload: counts })
    }
  }, [session])

  const searchMessages = useCallback(async (query: string) => {
    if (!session || !query.trim()) return
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query })
    dispatch({ type: 'SET_SEARCH_LOADING', payload: true })
    try {
      const res = await MessagingAPI.searchMessages(query, session)
      if (res.success && res.data) {
        dispatch({ type: 'SET_SEARCH_RESULTS', payload: res.data })
      }
    } finally {
      dispatch({ type: 'SET_SEARCH_LOADING', payload: false })
    }
  }, [session])

  const clearSearch = useCallback(() => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] })
  }, [])

  const fetchContacts = useCallback(async () => {
    if (!session) return
    const res = await MessagingAPI.getContacts(session)
    if (res.success && res.data) {
      dispatch({ type: 'SET_CONTACTS', payload: res.data })
    }
  }, [session])

  const uploadFile = useCallback(async (file: File) => {
    if (!session) return null
    const res = await MessagingAPI.uploadFile(file, session)
    if (res.success && res.data) return res.data
    dispatch({ type: 'SET_ERROR', payload: res.error || null })
    return null
  }, [session])

  const isUserOnline = useCallback((userId: number | string) => {
    return stateRef.current.onlineUsers.has(String(userId))
  }, [])

  const getTypingUsers = useCallback((roomId: number) => {
    return stateRef.current.typingUsers[roomId] || []
  }, [])

  const getReadReceipts = useCallback((roomId: number) => {
    return stateRef.current.readReceipts[roomId] || {}
  }, [])

  const fetchOnlineUsers = useCallback(async () => {
    if (!session) return
    const res = await MessagingAPI.getOnlineUsers(session)
    if (res.success && res.data) {
      dispatch({ type: 'SET_ONLINE_USERS', payload: new Set(res.data.map(String)) })
    }
  }, [session])

  // WhatsApp "last seen": fetch a user's online state + last-seen time (for the DM header).
  const fetchLastSeen = useCallback(async (userId: number) => {
    if (!session) return
    const res = await MessagingAPI.getLastSeen(userId, session)
    if (res.success && res.data) {
      const uid = String(userId)
      if (res.data.isOnline) dispatch({ type: 'USER_ONLINE', payload: uid })
      else dispatch({ type: 'USER_OFFLINE', payload: uid })
      dispatch({ type: 'SET_LAST_SEEN', payload: { userId: uid, lastSeenAt: res.data.lastSeenAt } })
    }
  }, [session])

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null })
  }, [])

  // Keep the reconnect handler current. On reconnect, group membership is lost server-side,
  // so rejoin the active room and refetch to recover anything missed while offline.
  useEffect(() => {
    onReconnectedRef.current = () => {
      const activeRoomId = stateRef.current.activeRoomId
      if (activeRoomId != null) {
        hubJoin(activeRoomId)
        fetchMessages(activeRoomId, 1)
      }
      fetchUnreadCounts()
      fetchOnlineUsers()
    }
  }, [hubJoin, fetchMessages, fetchUnreadCounts, fetchOnlineUsers])

  // Keep the ref used by the app-wide "Notification" handler pointing at the latest fetch.
  useEffect(() => { fetchUnreadCountsRef.current = fetchUnreadCounts }, [fetchUnreadCounts])

  // ─── Initial data fetch ─────────────────────────────────────────────────

  const initializedRef = useRef(false)
  useEffect(() => {
    if (!session || initializedRef.current) return
    initializedRef.current = true
    fetchUnreadCounts()
    fetchOnlineUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // ─── Context value ──────────────────────────────────────────────────────

  const actions = useMemo(() => ({
    fetchConversations,
    createRoom,
    getOrCreateDM,
    updateRoom,
    addMembers,
    removeMember,
    setMemberRole,
    setGroupReadOnly,
    leaveGroup,
    deleteRoom,
    deleteRoomForMe,
    setChatPrefs,
    fetchSharedMedia,
    setActiveRoom,
    fetchMessages,
    fetchMoreMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    starMessage,
    deleteForMe,
    fetchThreadReplies,
    replyToMessage,
    openThread,
    closeThread,
    toggleReaction,
    markAsRead,
    fetchUnreadCounts,
    searchMessages,
    clearSearch,
    fetchContacts,
    uploadFile,
    joinConversation: hubJoin,
    leaveConversation: hubLeave,
    sendTyping: hubSendTyping,
    isUserOnline,
    getTypingUsers,
    getReadReceipts,
    fetchOnlineUsers,
    fetchLastSeen,
    clearError
  }), [
    fetchConversations, createRoom, getOrCreateDM, updateRoom,
    addMembers, removeMember, setMemberRole, setGroupReadOnly, leaveGroup, deleteRoom,
    setActiveRoom,
    fetchMessages, fetchMoreMessages, sendMessage, editMessage, deleteMessage,
    pinMessage, starMessage, deleteForMe,
    fetchThreadReplies, replyToMessage, openThread, closeThread, toggleReaction,
    markAsRead, fetchUnreadCounts, searchMessages, clearSearch, fetchContacts,
    uploadFile, hubJoin, hubLeave, hubSendTyping, isUserOnline, getTypingUsers,
    getReadReceipts, fetchOnlineUsers, fetchLastSeen, clearError
  ])

  const value = useMemo<MessagingContextValue>(() => ({
    state,
    actions
  }), [state, actions])

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  )
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useMessaging() {
  const context = useContext(MessagingContext)
  if (!context) {
    throw new Error('useMessaging must be used within a MessagingProvider')
  }
  return context
}
