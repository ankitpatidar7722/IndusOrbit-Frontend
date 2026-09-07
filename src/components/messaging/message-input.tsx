'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Paperclip, X, FileIcon, Reply, Mic, Trash2, Smile, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from 'indas-ui'
import type { ChatMessage, ChatAttachment } from '@/lib/messaging'

// Curated emoji set for the picker (WhatsApp-style grid).
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
  '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
  '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💯', '✨', '🔥',
  '👋', '🤚', '✋', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '👍', '👎', '✊', '👊', '👏', '🙏',
]

interface MessageInputProps {
  onSend: (content: string, attachments?: ChatAttachment[], mentions?: number[]) => void
  onUploadFile: (file: File) => Promise<{ FileName: string; FileUrl: string; FileSize: number; MimeType: string } | null>
  onTyping?: (isTyping: boolean) => void
  replyTo?: ChatMessage | null
  onCancelReply?: () => void
  disabled?: boolean
  placeholder?: string
  /** Group members to offer for @mentions (usually active participants except me). */
  mentionables?: { userId: number; userName: string }[]
}

export function MessageInput({
  onSend,
  onUploadFile,
  onTyping,
  replyTo,
  onCancelReply,
  disabled,
  placeholder,
  mentionables = []
}: MessageInputProps) {
  const { t } = useLanguage()
  const [text, setText] = useState('')
  // @mentions: the trailing "@query" being typed + which users have been tagged.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAnchor, setMentionAnchor] = useState(0)
  const [mentionedIds, setMentionedIds] = useState<Set<number>>(new Set())
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview?: string }[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [text])

  // Focus on reply
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus()
  }, [replyTo])

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return
    const onDown = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showEmoji])

  // Cleanup recorder/stream/timer on unmount
  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach(tr => tr.stop())
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    }
  }, [])

  const handleTyping = useCallback(() => {
    if (!onTyping) return
    onTyping(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 3000)
  }, [onTyping])

  const insertEmoji = useCallback((emoji: string) => {
    const el = textareaRef.current
    if (!el) { setText(prev => prev + emoji); return }
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    setText(text.slice(0, start) + emoji + text.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
    })
  }, [text])

  // ── @mentions ─────────────────────────────────────────────────────────
  const mentionMatches = mentionQuery === null ? [] :
    mentionables.filter(u => (u.userName || '').toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)

  const pickMention = useCallback((u: { userId: number; userName: string }) => {
    const q = mentionQuery ?? ''
    const before = text.slice(0, mentionAnchor)
    const after = text.slice(mentionAnchor + 1 + q.length)   // skip '@' + the typed query
    const inserted = `@${u.userName} `
    setText(before + inserted + after)
    setMentionedIds(prev => new Set(prev).add(u.userId))
    setMentionQuery(null)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) { const pos = (before + inserted).length; el.focus(); el.setSelectionRange(pos, pos) }
    })
  }, [mentionQuery, mentionAnchor, text])

  const handleSubmit = useCallback(async () => {
    const content = text.trim()
    if (!content && pendingFiles.length === 0) return

    // Upload pending files
    let attachments: ChatAttachment[] = []
    if (pendingFiles.length > 0) {
      setUploading(true)
      try {
        const results = await Promise.all(pendingFiles.map(f => onUploadFile(f.file)))
        attachments = results
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .map(r => ({ fileName: r.FileName, fileUrl: r.FileUrl, fileSize: r.FileSize, mimeType: r.MimeType }))
      } finally {
        setUploading(false)
      }
    }

    // Only send mentions whose "@Name" still survives in the final text.
    const mentions = mentionables.filter(u => mentionedIds.has(u.userId) && content.includes('@' + u.userName)).map(u => u.userId)
    onSend(content, attachments.length > 0 ? attachments : undefined, mentions.length ? mentions : undefined)
    setText('')
    setMentionedIds(new Set())
    setMentionQuery(null)
    setPendingFiles([])
    onTyping?.(false)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [text, pendingFiles, onSend, onUploadFile, onTyping, mentionables, mentionedIds])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // While the @mention list is open, Enter/Tab picks the first match instead of sending.
    if (mentionQuery !== null && mentionMatches.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault(); pickMention(mentionMatches[0]); return
    }
    if (e.key === 'Escape' && mentionQuery !== null) { setMentionQuery(null); return }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit, mentionQuery, mentionMatches, pickMention])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newFiles = Array.from(files).map(file => {
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      return { file, preview }
    })
    setPendingFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }, [])

  const removeFile = useCallback((idx: number) => {
    setPendingFiles(prev => {
      const item = prev[idx]
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  const clearPending = useCallback(() => {
    setPendingFiles(prev => { prev.forEach(f => f.preview && URL.revokeObjectURL(f.preview)); return [] })
    setText('')
    setActiveIdx(0)
    setShowEmoji(false)
  }, [])

  // Keep the active preview index in range as files are added/removed.
  useEffect(() => {
    setActiveIdx(i => Math.min(i, Math.max(0, pendingFiles.length - 1)))
  }, [pendingFiles.length])

  // ── Voice notes (record → upload → send as an audio attachment) ──────────
  const sendVoiceNote = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const r = await onUploadFile(file)
      if (r) onSend('', [{ fileName: r.FileName, fileUrl: r.FileUrl, fileSize: r.FileSize, mimeType: r.MimeType || file.type }])
    } finally {
      setUploading(false)
    }
  }, [onUploadFile, onSend])

  const startRecording = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      chunksRef.current = []
      cancelledRef.current = false
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        mediaStreamRef.current?.getTracks().forEach(tr => tr.stop())
        mediaStreamRef.current = null
        if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null }
        setRecording(false)
        setRecordSecs(0)
        if (cancelledRef.current) return
        const type = mr.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        if (blob.size === 0) return
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm'
        // Force an audio/* mime so the bubble renders an inline player.
        const audioType = type.startsWith('audio/') ? type : 'audio/webm'
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: audioType })
        await sendVoiceNote(file)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordSecs(0)
      recordTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
    } catch {
      setRecording(false)
      mediaStreamRef.current?.getTracks().forEach(tr => tr.stop())
      mediaStreamRef.current = null
    }
  }, [sendVoiceNote])

  const stopRecording = useCallback((cancel: boolean) => {
    cancelledRef.current = cancel
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    mediaRecorderRef.current = null
  }, [])

  const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const hasContent = text.trim().length > 0 || pendingFiles.length > 0

  return (
    <div className="flex-shrink-0 border-t border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))]">
      {/* Reply indicator */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--bd-default))]">
          <Reply className="w-4 h-4 text-[rgb(var(--color-primary))] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[rgb(var(--color-primary))]">{t('Replying to message')}</p>
            <p className="text-xs text-[rgb(var(--fg-muted))] truncate">{replyTo.Content}</p>
          </div>
          <button onClick={onCancelReply} className="flex-shrink-0 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment compose overlay — WhatsApp-style preview + caption + Send */}
      {pendingFiles.length > 0 && (() => {
        const active = pendingFiles[activeIdx] || pendingFiles[0]
        const fmtB = (b: number) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} kB` : `${(b / (1024 * 1024)).toFixed(1)} MB`)
        const ext = active?.file.name.split('.').pop()?.toUpperCase() || ''
        return (
          <div className="fixed inset-0 z-[85] flex flex-col bg-[rgb(var(--bg-app))]">
            {/* Top bar: close + filename */}
            <div className="flex-shrink-0 flex items-center gap-3 h-14 px-4 border-b border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))]">
              <button onClick={clearPending} title={t('Close')} className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))]"><X className="w-5 h-5" /></button>
              <p className="flex-1 text-center text-sm font-medium text-[rgb(var(--fg-default))] truncate">{active?.file.name}</p>
              <div className="w-9" />
            </div>

            {/* Preview */}
            <div className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-auto">
              {active?.preview ? (
                <img src={active.preview} alt={active.file.name} className="max-w-full max-h-full object-contain rounded-lg" />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 w-full max-w-md aspect-square max-h-[26rem] rounded-2xl bg-[rgb(var(--bg-subtle))]">
                  <FileIcon className="w-16 h-16 text-[rgb(var(--fg-muted))] opacity-30" />
                  <p className="text-base text-[rgb(var(--fg-muted))]">{t('No preview available')}</p>
                  <p className="text-xs text-[rgb(var(--fg-muted))]">{active ? fmtB(active.file.size) : ''}{ext ? ` · ${ext}` : ''}</p>
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="flex-shrink-0 px-4 pb-1">
              <div className="relative max-w-2xl mx-auto">
                <button onClick={() => setShowEmoji(v => !v)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]"><Smile className="w-5 h-5" /></button>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
                  placeholder={t('Type a message...')}
                  className="w-full h-11 pl-11 pr-4 rounded-full bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] border border-[rgb(var(--bd-default))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
                />
                {showEmoji && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 max-h-52 overflow-y-auto p-2 rounded-xl border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] shadow-xl z-20">
                    <div className="grid grid-cols-8 gap-0.5">
                      {EMOJIS.map((e, i) => (
                        <button key={i} onClick={() => setText(prev => prev + e)} className="w-8 h-8 rounded-lg text-xl leading-none hover:bg-[rgb(var(--bg-hover))] flex items-center justify-center">{e}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails + add-more + Send (round, bottom-right) */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3">
              <div className="flex-1 flex items-center gap-2 overflow-x-auto">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <button onClick={() => setActiveIdx(i)} className={cn('w-12 h-12 rounded-lg border-2 overflow-hidden flex items-center justify-center bg-[rgb(var(--bg-subtle))]', i === activeIdx ? 'border-[rgb(var(--color-primary))]' : 'border-[rgb(var(--bd-default))]')}>
                      {f.preview ? <img src={f.preview} alt="" className="w-full h-full object-cover" /> : <span className="text-[0.5rem] font-bold text-[rgb(var(--fg-muted))]">{f.file.name.split('.').pop()?.toUpperCase().slice(0, 4)}</span>}
                    </button>
                    <button onClick={() => removeFile(i)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                  </div>
                ))}
                <button onClick={() => fileInputRef.current?.click()} title={t('Add')} className="w-12 h-12 rounded-lg border-2 border-dashed border-[rgb(var(--bd-default))] flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))] flex-shrink-0"><Plus className="w-5 h-5" /></button>
              </div>
              <button onClick={handleSubmit} disabled={uploading} title={t('Send')} className="flex-shrink-0 w-12 h-12 rounded-full bg-[rgb(var(--color-primary))] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )
      })()}

      {/* Input area */}
      {recording ? (
        /* Recording bar */
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => stopRecording(true)}
            title={t('Cancel')}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-[rgb(var(--fg-default))] tabular-nums">{fmtSecs(recordSecs)}</span>
            <span className="text-xs text-[rgb(var(--fg-muted))]">{t('Recording…')}</span>
          </div>
          <button
            onClick={() => stopRecording(false)}
            title={t('Send')}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-[rgb(var(--color-primary))] text-white hover:opacity-90 transition-opacity"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="relative flex items-end gap-1.5 px-3 py-2.5">
          {/* @mention picker */}
          {mentionQuery !== null && mentionMatches.length > 0 && (
            <div className="absolute left-3 right-3 bottom-full mb-1 max-h-52 overflow-y-auto bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-xl shadow-xl z-30 py-1">
              {mentionMatches.map((u, i) => (
                <button key={u.userId} type="button" onMouseDown={e => { e.preventDefault(); pickMention(u) }}
                  className={cn('w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[rgb(var(--bg-hover))]', i === 0 && 'bg-[rgb(var(--bg-subtle))]')}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[0.65rem] font-semibold flex-shrink-0 bg-[rgb(var(--color-primary))]">
                    {(u.userName || '?').trim().slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-[rgb(var(--fg-default))] truncate">{u.userName}</span>
                </button>
              ))}
            </div>
          )}
          {/* Emoji picker */}
          <div className="relative flex-shrink-0" ref={emojiRef}>
            <button
              onClick={() => setShowEmoji(v => !v)}
              disabled={disabled || uploading}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-50',
                showEmoji ? 'text-[rgb(var(--color-primary))] bg-[rgb(var(--bg-hover))]' : 'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]'
              )}
              title={t('Emoji')}
            >
              <Smile className="w-5 h-5" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-full left-0 mb-2 w-72 max-h-60 overflow-y-auto p-2 rounded-xl border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] shadow-xl z-20">
                <div className="grid grid-cols-8 gap-0.5">
                  {EMOJIS.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => insertEmoji(e)}
                      className="w-8 h-8 rounded-lg text-xl leading-none hover:bg-[rgb(var(--bg-hover))] flex items-center justify-center"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* File attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))] transition-colors disabled:opacity-50"
            title={t('Attach')}
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar"
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => {
              const val = e.currentTarget.value
              setText(val); handleTyping()
              // Detect a trailing "@query" at the caret → open the mention picker.
              const caret = e.currentTarget.selectionStart ?? val.length
              const m = val.slice(0, caret).match(/@([^\s@]*)$/)
              if (m && mentionables.length > 0) { setMentionQuery(m[1]); setMentionAnchor(caret - m[0].length) }
              else setMentionQuery(null)
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled || uploading}
            placeholder={placeholder || t('Type a message...')}
            rows={1}
            className="flex-1 min-h-[2.25rem] max-h-[7.5rem] px-3.5 py-2 rounded-full bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] border border-[rgb(var(--bd-default))] resize-none focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))] disabled:opacity-50"
          />

          {/* Right button — WhatsApp-style toggle: Send when typing, Mic (voice) when empty.
              Always a solid, prominent round button. */}
          {hasContent ? (
            <button
              onClick={handleSubmit}
              disabled={disabled || uploading}
              className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-[rgb(var(--color-primary))] text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              title={t('Send')}
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={disabled || uploading}
              className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-[rgb(var(--color-primary))] text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              title={t('Record voice message')}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
