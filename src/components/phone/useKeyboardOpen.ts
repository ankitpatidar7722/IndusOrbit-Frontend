'use client'

/**
 * Is the on-screen keyboard up?
 *
 * The app's viewport is `interactive-widget=resizes-content`, so the keyboard SHRINKS the layout viewport and every
 * `position: fixed; bottom: 0` bar rides up onto the keyboard. Native iOS / Android apps hide their tab bar while
 * typing; this tells the bar when to do the same.
 *
 * Open = a text-entry element has focus on a touch screen below desktop width, OR the viewport has shrunk well below
 * its tallest height for this orientation (keyboard opened by something we did not see focus). A <select>, checkbox,
 * button... never opens a keyboard and does not count. Phone only. Changes done by Shubham - 2026-10-24
 */

import * as React from 'react'

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image', 'hidden'])

function isTextEntry(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type) && !el.readOnly && !el.disabled
  return false
}

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse) and (max-width: 1023.98px)')
    let tallest = { portrait: 0, landscape: 0 }
    const key = () => (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait') as 'portrait' | 'landscape'

    /*
      The viewport size decides, focus only anticipates. Android closes the keyboard (back gesture, the keyboard's
      own down arrow) WITHOUT blurring the field - trusting focus left the bar hidden for good (user 2026-10-24).
      So: a text field gaining focus hides the bar at once (no jump while the keyboard rises); once the viewport has
      been seen shrunk, it growing back = keyboard closed, bar returns even though the field keeps focus; if no
      shrink arrives within 900ms (hardware keyboard), the bar returns too.
    */
    let sawShrink = false
    let waitTimer: ReturnType<typeof setTimeout> | null = null
    const clearWait = () => { if (waitTimer) { clearTimeout(waitTimer); waitTimer = null } }

    const measure = () => {
      const h = window.visualViewport?.height ?? window.innerHeight
      const k = key()
      if (h > tallest[k]) tallest = { ...tallest, [k]: h }
      return tallest[k] > 0 && h < tallest[k] * 0.78
    }

    const check = () => {
      if (!touch.matches) { setOpen(false); return }
      const shrunk = measure()
      const focused = isTextEntry(document.activeElement)
      if (shrunk) { sawShrink = true; clearWait(); setOpen(true); return }
      if (!focused) { sawShrink = false; clearWait(); setOpen(false); return }
      // focused, viewport full height
      if (sawShrink) { setOpen(false); return } // keyboard was up and has closed
      setOpen(true)                             // keyboard still rising - wait for it
      if (!waitTimer) waitTimer = setTimeout(() => { waitTimer = null; if (!measure()) setOpen(false) }, 900)
    }

    const onFocusIn = () => { sawShrink = false; clearWait(); check() }
    // focusout fires before the next element's focusin - wait a tick so moving between fields does not flash the bar.
    const onFocusOut = () => setTimeout(check, 60)
    check()
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    window.visualViewport?.addEventListener('resize', check)
    window.addEventListener('resize', check)
    touch.addEventListener?.('change', check)
    return () => {
      clearWait()
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      window.visualViewport?.removeEventListener('resize', check)
      window.removeEventListener('resize', check)
      touch.removeEventListener?.('change', check)
    }
  }, [])

  return open
}
