'use client'
import { useEffect, useState } from 'react'
import { StandardModal } from 'indas-ui'
import { Mail, Phone, BadgeCheck, IdCard, MessageSquare } from 'lucide-react'
import { usersApi, photoUrl, type UserCard } from '@/lib/users'
import { UserAvatar } from './UserAvatar'

/** WhatsApp-style "contact info" popup — big photo + name/role/email/mobile for any user. */
export function UserProfileModal({ open, userId, fallbackName, colorClass, onClose, onMessage }: {
  open: boolean
  userId: number | null
  fallbackName?: string
  colorClass?: string
  onClose: () => void
  onMessage?: (userId: number) => void   // optional "Message" action
}) {
  const [card, setCard] = useState<UserCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [imgOk, setImgOk] = useState(true)

  useEffect(() => {
    if (!open || !userId) return
    setCard(null); setLoading(true); setImgOk(true)
    usersApi.card(userId).then(r => setCard(r.success ? r.data : null)).catch(() => setCard(null)).finally(() => setLoading(false))
  }, [open, userId])

  const name = card?.fullName || fallbackName || 'User'
  const color = colorClass || 'bg-slate-500'

  const row = (icon: React.ReactNode, label: string, value?: string | null) => (
    value ? (
      <div className="flex items-start gap-3 px-1 py-2.5 border-t border-[rgb(var(--bd-default))]">
        <div className="text-[rgb(var(--fg-muted))] mt-0.5">{icon}</div>
        <div className="min-w-0">
          <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[rgb(var(--fg-muted))]">{label}</div>
          <div className="text-sm text-[rgb(var(--fg-default))] break-words">{value}</div>
        </div>
      </div>
    ) : null
  )

  return (
    <StandardModal isOpen={open} onClose={onClose} title="Profile" size="sm">
      <div className="flex flex-col items-center text-center pt-1 pb-2">
        {/* big round photo */}
        {userId && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl(userId)} alt="" onError={() => setImgOk(false)}
            className="w-28 h-28 rounded-full object-cover border border-[rgb(var(--bd-default))]" />
        ) : (
          <UserAvatar userId={userId ?? undefined} name={name} colorClass={color} sizeClass="w-28 h-28" textClass="text-3xl" />
        )}
        <div className="mt-3 text-lg font-bold text-[rgb(var(--fg-default))]">{name}</div>
        {card?.role && <div className="text-sm text-[rgb(var(--fg-muted))] capitalize">{card.role}</div>}
      </div>

      <div className="mt-1">
        {row(<Mail size={16} />, 'Email', card?.email)}
        {row(<Phone size={16} />, 'Mobile', card?.mobile)}
        {row(<BadgeCheck size={16} />, 'Role', card?.role)}
        {row(<IdCard size={16} />, 'Employee Code', card?.employeeCode)}
      </div>

      {loading && <div className="text-center text-sm text-[rgb(var(--fg-muted))] py-3">Loading…</div>}

      {onMessage && userId && (
        <button
          onClick={() => { onMessage(userId); onClose() }}
          className="mt-4 w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[rgb(var(--color-primary))] text-white text-sm font-semibold hover:opacity-90"
        >
          <MessageSquare size={16} /> Message
        </button>
      )}
    </StandardModal>
  )
}
