'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Image as ImageIcon, FileText, Link2, Download, Film, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from 'indas-ui'
import { useMessaging } from '@/contexts/MessagingContext'
import { parseAttachments } from '@/lib/messaging'
import type { ChatMessage, ChatAttachment } from '@/lib/messaging'
import { AttachmentViewer } from './attachment-viewer'

type Tab = 'media' | 'docs' | 'links'
const URL_RE = /(https?:\/\/[^\s<>"']+)/g

function humanSize(n?: number) {
  if (!n || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
function shortDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}
const isMediaType = (mt?: string) => !!mt && (mt.startsWith('image/') || mt.startsWith('video/'))

/**
 * WhatsApp-style "Media, Docs & Links" gallery for a room — every image/video, file, and shared
 * link across the whole conversation history. Opened from the Group info panel.
 */
export function MediaGalleryPanel({ roomId, roomName, onClose }: { roomId: number; roomName?: string; onClose: () => void }) {
  const { t } = useLanguage()
  const { actions } = useMessaging()
  const [tab, setTab] = useState<Tab>('media')
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null)
  const [viewer, setViewer] = useState<ChatAttachment | null>(null)

  useEffect(() => { actions.fetchSharedMedia(roomId).then(setMsgs).catch(() => setMsgs([])) }, [roomId, actions])

  const { media, docs, links } = useMemo(() => {
    const media: { att: ChatAttachment; msg: ChatMessage }[] = []
    const docs: { att: ChatAttachment; msg: ChatMessage }[] = []
    const links: { url: string; msg: ChatMessage }[] = []
    for (const m of msgs || []) {
      for (const a of parseAttachments(m.Attachments)) {
        (isMediaType(a.mimeType) ? media : docs).push({ att: a, msg: m })
      }
      const found = (m.Content || '').match(URL_RE)
      if (found) for (const url of found) links.push({ url, msg: m })
    }
    return { media, docs, links }
  }, [msgs])

  const counts = { media: media.length, docs: docs.length, links: links.length }
  const loading = msgs === null

  return (
    <div className="fixed inset-0 z-[74] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md max-h-[86vh] flex flex-col rounded-2xl bg-[rgb(var(--bg-surface))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[rgb(var(--bd-default))]">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[rgb(var(--fg-default))] truncate">{t('Media, docs & links')}</p>
            {roomName && <p className="text-xs text-[rgb(var(--fg-muted))] truncate">{roomName}</p>}
          </div>
          <button onClick={onClose} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex gap-1 p-2 border-b border-[rgb(var(--bd-subtle))]">
          {([['media', t('Media'), ImageIcon], ['docs', t('Docs'), FileText], ['links', t('Links'), Link2]] as [Tab, string, typeof ImageIcon][]).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                tab === k ? 'bg-[rgb(var(--color-primary))] text-white' : 'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-hover))]')}>
              <Icon className="w-3.5 h-3.5" /> {label} ({counts[k]})
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="py-12 text-center text-sm text-[rgb(var(--fg-muted))]">{t('Loading…')}</div>
          ) : tab === 'media' ? (
            media.length === 0 ? <Empty text={t('No media shared yet')} /> : (
              <div className="grid grid-cols-3 gap-1.5">
                {media.map(({ att }, i) => (
                  <button key={i} onClick={() => setViewer(att)} className="relative aspect-square rounded-lg overflow-hidden bg-[rgb(var(--bg-subtle))] group">
                    {(att.mimeType || '').startsWith('image/')
                      ? <img src={att.fileUrl} alt={att.fileName || ''} className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center text-[rgb(var(--fg-muted))]"><Film className="w-7 h-7" /></div>}
                    {(att.mimeType || '').startsWith('video/') && (
                      <span className="absolute inset-0 flex items-center justify-center"><Play className="w-6 h-6 text-white drop-shadow" /></span>
                    )}
                  </button>
                ))}
              </div>
            )
          ) : tab === 'docs' ? (
            docs.length === 0 ? <Empty text={t('No documents shared yet')} /> : (
              <div className="space-y-1">
                {docs.map(({ att, msg }, i) => (
                  <a key={i} href={att.fileUrl} download={att.fileName || undefined} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[rgb(var(--bg-hover))]">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))] flex-shrink-0"><FileText className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[rgb(var(--fg-default))] truncate">{att.fileName || t('File')}</p>
                      <p className="text-xs text-[rgb(var(--fg-muted))] truncate">{[humanSize(att.fileSize), msg.UserName, shortDate(msg.CreatedAt)].filter(Boolean).join(' · ')}</p>
                    </div>
                    <Download className="w-4 h-4 text-[rgb(var(--fg-muted))] flex-shrink-0" />
                  </a>
                ))}
              </div>
            )
          ) : (
            links.length === 0 ? <Empty text={t('No links shared yet')} /> : (
              <div className="space-y-1">
                {links.map(({ url, msg }, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[rgb(var(--bg-hover))]">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[rgb(var(--bg-subtle))] text-[rgb(var(--color-primary))] flex-shrink-0"><Link2 className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[rgb(var(--color-primary))] truncate">{url}</p>
                      <p className="text-xs text-[rgb(var(--fg-muted))] truncate">{[msg.UserName, shortDate(msg.CreatedAt)].filter(Boolean).join(' · ')}</p>
                    </div>
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {viewer && <AttachmentViewer attachment={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="flex flex-col items-center justify-center py-12 text-[rgb(var(--fg-muted))]"><ImageIcon className="w-9 h-9 mb-2 opacity-30" /><p className="text-sm">{text}</p></div>
}
