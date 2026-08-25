'use client'

import { useEffect } from 'react'
import { X, Download, FileText, FileIcon } from 'lucide-react'
import { useLanguage } from 'indas-ui'
import type { ChatAttachment } from '@/lib/messaging'

interface AttachmentViewerProps {
  attachment: ChatAttachment
  onClose: () => void
}

const fmtBytes = (b: number) => (!b ? '' : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} kB` : `${(b / (1024 * 1024)).toFixed(1)} MB`)

/** Full-screen, in-app attachment viewer (image / PDF / audio / video) with a close button —
 *  opens over the chat instead of a new browser tab (WhatsApp-style). */
export function AttachmentViewer({ attachment, onClose }: AttachmentViewerProps) {
  const { t } = useLanguage()
  const { fileName, fileUrl, fileSize, mimeType } = attachment
  const name = (fileName || '').toLowerCase()
  const isImage = mimeType?.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(name)
  const isPdf = mimeType?.includes('pdf') || /\.pdf$/i.test(name)
  const isAudio = mimeType?.startsWith('audio/') || /\.(webm|ogg|m4a|mp3|wav)$/i.test(name)
  const isVideo = mimeType?.startsWith('video/') || /\.(mp4|mov|mkv|avi)$/i.test(name)
  const ext = (fileName?.split('.').pop() || '').toUpperCase()

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[rgb(var(--bg-app))]">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-3 h-14 px-4 border-b border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))]">
        <button onClick={onClose} title={t('Close')} className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))]">
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-medium text-[rgb(var(--fg-default))] truncate">{fileName || t('Attachment')}</p>
          {fileSize > 0 && <p className="text-[0.6875rem] text-[rgb(var(--fg-muted))]">{fmtBytes(fileSize)}{ext ? ` · ${ext}` : ''}</p>}
        </div>
        <a href={fileUrl} download={fileName || undefined} title={t('Download')} className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))]">
          <Download className="w-5 h-5" />
        </a>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-auto">
        {isImage ? (
          <img src={fileUrl} alt={fileName || ''} className="max-w-full max-h-full object-contain rounded-lg" />
        ) : isPdf ? (
          <iframe src={fileUrl} title={fileName || 'PDF'} className="w-full h-full rounded-lg bg-white" />
        ) : isVideo ? (
          <video src={fileUrl} controls autoPlay className="max-w-full max-h-full rounded-lg" />
        ) : isAudio ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-[rgb(var(--color-primary)/0.1)] flex items-center justify-center">
              <FileText className="w-10 h-10 text-[rgb(var(--color-primary))]" />
            </div>
            <audio src={fileUrl} controls autoPlay className="w-72" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 w-full max-w-md aspect-square max-h-[26rem] rounded-2xl bg-[rgb(var(--bg-subtle))]">
            <FileIcon className="w-16 h-16 text-[rgb(var(--fg-muted))] opacity-40" />
            <p className="text-base text-[rgb(var(--fg-muted))]">{t('No preview available')}</p>
            <p className="text-xs text-[rgb(var(--fg-muted))]">{fmtBytes(fileSize)}{ext ? ` · ${ext}` : ''}</p>
            <a href={fileUrl} download={fileName || undefined} className="mt-1 inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium bg-[rgb(var(--color-primary))] text-white hover:opacity-90">
              <Download className="w-4 h-4" /> {t('Download')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
