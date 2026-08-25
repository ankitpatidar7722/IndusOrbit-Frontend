'use client'
import { useState, useEffect } from 'react'
import { photoUrl } from '@/lib/users'
import { cn } from '@/lib/utils'

function initialsOf(name: string) {
  return (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

/**
 * Round user avatar — shows the user's profile photo (served from the backend) and
 * falls back to coloured initials when there's no photo (404) or no userId. Reused
 * across the messaging UI so people appear WhatsApp-style everywhere.
 */
export function UserAvatar({ userId, name, colorClass, sizeClass = 'w-10 h-10', textClass = 'text-sm', className }: {
  userId?: number | string | null
  name: string
  colorClass: string          // tailwind bg-* used for the initials fallback
  sizeClass?: string
  textClass?: string
  className?: string
}) {
  const [ok, setOk] = useState(true)
  // reset the error state if the user changes (list re-uses the same node)
  useEffect(() => { setOk(true) }, [userId])
  const idNum = userId != null && userId !== '' ? Number(userId) : null
  const showImg = idNum != null && !Number.isNaN(idNum) && ok

  return (
    <div className={cn(sizeClass, 'rounded-full flex items-center justify-center text-white font-medium overflow-hidden', !showImg && colorClass, className)}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl(idNum!)} alt="" onError={() => setOk(false)} className="w-full h-full object-cover" />
      ) : (
        <span className={textClass}>{initialsOf(name)}</span>
      )}
    </div>
  )
}
