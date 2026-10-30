'use client'

/**
 * ONE back stack for every dismissible layer in the app.
 *
 * WHAT THIS REPLACED. Each overlay used to manage history for itself - Modal.tsx pushed a
 * `__modal` sentinel with a deferred `history.back()` on cleanup, useBackToClose pushed an
 * `__overlay` one. Both are the per-layer model, and it is wrong in a way only a real browser
 * shows: `history.back()` is asynchronous, so when React unmounts one layer and mounts another in
 * the same commit the back queued by the first pops the entry the second had just pushed. The
 * second layer is then in the stack with no entry to consume, for ever. Neither handled a RELOAD
 * with a sheet open either, which leaves that sheet's entry sitting in history with nothing to
 * close - press back and nothing happens, so the user presses it again, and again.
 *
 * With a single guard entry owned by the stack there is nothing to mismatch: the entry either
 * exists or it does not, and every path checks that one flag. Nested layers unwind one at a time,
 * in the order they were opened - dropdown sheet before modal, modal before page.
 *
 * WHY THE RAW HISTORY API AND NOT router.push. `router.push` re-renders the whole routed tree.
 * Doing that the instant a sheet opens lands in the middle of its opening transition.
 * `pushState` adds the entry without telling the router anything, which it can afford to skip
 * precisely because the url is unchanged - the router's idea of where it is stays correct either
 * way, and its own popstate listener re-renders to the identical url, which is a no-op on screen.
 *
 * Ported from the Indus ERP mobile PWA (Frontend/src/lib/back-stack.tsx).
 * Changes done by Priyanshu Sharma - 2026-09-23
 *
 * Indus360: copied unchanged from IndusFlexoERP (2026-10-30). Radix dialogs are registered
 * automatically by components/phone/DialogBackGuard; sheets call useBackGuard themselves.
 */

import * as React from 'react'

/**
 * One dismissible layer - a sheet, a dialog, a full-screen form, a search overlay.
 * `close` is what the Android back gesture should invoke.
 */
export interface BackLayer {
  id: number
  close: () => void
}

/** Marks the history entries this stack pushes, so it can recognise its own. */
const LAYER_KEY = '__backLayer'
/** Distinguishes entries pushed by THIS page load from ones a reload left. */
const SESSION_KEY = '__backSession'

/**
 * Remove a layer by id, and say whether it was the top of the stack.
 *
 * Only the top layer owns the history entry that back would consume, so the caller uses `wasTop`
 * to decide whether closing it should also step history back. Pure, so the bookkeeping is
 * testable without a browser.
 */
export function removeLayer(
  layers: BackLayer[],
  id: number,
): { next: BackLayer[]; wasTop: boolean; found: boolean } {
  const index = layers.findIndex((layer) => layer.id === id)
  if (index === -1) return { next: layers, wasTop: false, found: false }
  return {
    next: [...layers.slice(0, index), ...layers.slice(index + 1)],
    wasTop: index === layers.length - 1,
    found: true,
  }
}

/**
 * Was this history entry left behind by a previous page load?
 *
 * A reload while a sheet is open leaves the entry that sheet pushed sitting in history with
 * nothing to close: React state started fresh, so the layer is already gone. Pressing back then
 * does nothing visible - the url never changed.
 *
 * The entry cannot simply be recognised by the marker, because the entries this page load pushes
 * carry it too. Each load stamps its own token, so "mine" and "someone else's" stay
 * distinguishable.
 */
export function isOrphanEntry(state: unknown, session: string): boolean {
  if (typeof state !== 'object' || state === null) return false
  const record = state as Record<string, unknown>
  return record[LAYER_KEY] !== undefined && record[SESSION_KEY] !== session
}

/** The topmost layer, which is the one a back gesture should close first. */
export const topLayer = (layers: BackLayer[]): BackLayer | undefined => layers[layers.length - 1]

/**
 * Whether the entry currently on top of history is the one opened for `id`.
 *
 * A layer usually closes while its own entry is still current, but not always: choosing a record
 * from a picker NAVIGATES and the picker then closes as a consequence. Stepping back there would
 * undo the navigation the user just made.
 */
export function ownsCurrentEntry(state: unknown, id: number, session?: string): boolean {
  if (typeof state !== 'object' || state === null) return false
  const record = state as Record<string, unknown>
  if (record[LAYER_KEY] !== id) return false
  // A RELOAD with a sheet open leaves an entry carrying this same marker. Without the token
  // pushGuard reads it as "already guarded" and pushes nothing, so the stack holds a guard that
  // belongs to a page load which no longer exists - and the first back press falls straight
  // through to the previous route with a sheet still on screen. Callers that only ask "is this
  // shape ours" may omit the token. Changes done by Claude Code - 2026-09-24
  return session === undefined || record[SESSION_KEY] === session
}

/** The slice of `window.history` this needs, so it can be driven in a test. */
export interface HistoryLike {
  readonly state: unknown
  pushState: (state: unknown, unused: string) => void
  back: () => void
}

/**
 * The stack's decision-making, with no React and no DOM.
 *
 * Extracted because this is where the bugs live - the ordering between a layer closing, a
 * navigation happening and a popstate arriving is what breaks, and none of it is reachable from a
 * unit test while it is tangled up in a component.
 */
export class BackStackController {
  private layers: BackLayer[] = []
  private nextId = 1
  /**
   * Is our guard entry sitting on top of history right now?
   *
   * ONE entry for the whole stack, not one per layer - see the file header for why the per-layer
   * model cannot be made to work.
   */
  private guarded = false
  /**
   * Entries this controller removed itself, awaiting their popstate - one timer each.
   *
   * A plain count was not safe. `history.back()` only fires popstate when there was somewhere to
   * go; at the very first entry of a tab it does nothing at all, and the count would then sit at
   * one for the life of the page and swallow the user's next REAL back press. Each expected pop
   * carries a deadline instead, so an answer that never comes expires on its own.
   * Changes done by Claude Code - 2026-09-24
   */
  private pendingPops: Array<ReturnType<typeof setTimeout>> = []

  private readonly history: HistoryLike
  /** This page load's token, stamped on the guard entry. */
  private readonly session: string = Math.random().toString(36).slice(2)

  /**
   * The reclaim `popGuard` scheduled, cancelled when a layer opens before it runs.
   *
   * It is deferred rather than immediate because React unmounts one layer and mounts the next in a
   * SINGLE commit - StrictMode's mount/cleanup/mount, and any `{a ? <ModalA/> : <ModalB/>}` swap.
   * An immediate `history.back()` there is asynchronous, so it lands after the second layer has
   * already looked at history, found our entry still sitting on top and therefore pushed nothing.
   * The stack would then believe it holds an entry that the in-flight traversal is about to eat,
   * and the user's next back press would close the layer AND leave the page in one gesture. A
   * deferred reclaim can simply be called off, which is the defence Modal.tsx carried before this
   * stack replaced it. Changes done by Claude Code - 2026-09-24
   */
  private reclaimTimer: ReturnType<typeof setTimeout> | null = null

  /** How long to wait for a popstate we caused before assuming it is never coming. */
  private readonly popGrace: number

  constructor(history: HistoryLike, popGraceMs = 400) {
    this.history = history
    this.popGrace = popGraceMs
  }

  /** Step history back, and remember that the popstate it causes is ours and not the user's. */
  private expectPop(): void {
    const timer = setTimeout(() => {
      this.pendingPops = this.pendingPops.filter((pending) => pending !== timer)
    }, this.popGrace)
    this.pendingPops.push(timer)
    this.history.back()
  }

  /** For assertions: the ids currently open, bottom to top. */
  get openIds(): number[] {
    return this.layers.map((layer) => layer.id)
  }

  /** For assertions: whether an entry is currently held for the stack. */
  get isGuarded(): boolean {
    return this.guarded
  }

  /**
   * Put the guard entry on history, if it is not there already.
   *
   * Same url, so the pop is invisible; the router's own state is carried through so its
   * bookkeeping survives.
   */
  private pushGuard(): void {
    // The QUESTION is whether the guard is on top of history right now - not whether we once
    // pushed one. A router navigation lands its own entry above ours, and `replaceState`
    // overwrites ours outright; either way the flag would still say "guarded" while the entry that
    // back would actually consume belongs to someone else. Asking history cannot go stale.
    // A layer opening in the same commit as the last one closed: call off the reclaim that close
    // scheduled, and the entry it would have taken back is still there to be reused.
    if (this.reclaimTimer !== null) {
      clearTimeout(this.reclaimTimer)
      this.reclaimTimer = null
    }
    if (ownsCurrentEntry(this.history.state, 1, this.session)) {
      this.guarded = true
      return
    }
    this.history.pushState(
      {
        ...(this.history.state as object | null),
        [LAYER_KEY]: 1,
        [SESSION_KEY]: this.session,
      },
      '',
    )
    this.guarded = true
  }

  /** Take the guard entry back, if we still own the current one. */
  private popGuard(): void {
    if (!this.guarded) return
    this.guarded = false
    if (this.reclaimTimer !== null) return
    this.reclaimTimer = setTimeout(() => {
      this.reclaimTimer = null
      // Re-read history rather than trusting the decision made a tick ago: a back gesture may have
      // consumed the entry in between, and stepping back again would eat the screen beneath.
      if (ownsCurrentEntry(this.history.state, 1, this.session)) this.expectPop()
    }, 0)
  }

  open(close: () => void): number {
    const id = this.nextId++
    this.layers.push({ id, close })
    this.pushGuard()
    return id
  }

  /** How many layers are open. Read by a layer's close, after the pop removed it = the index it sat at. */
  get depth(): number {
    return this.layers.length
  }

  /**
   * Put back a layer that Back popped but that REFUSED to close ("Discard changes?" -> Keep editing).
   * It goes back where it was - beneath anything its own close opened (that question sheet), so the next
   * Back closes the question first and then the form again. Changes done by Shubham - 2026-10-26
   */
  restore(close: () => void, index: number): number {
    const id = this.nextId++
    const at = Math.min(Math.max(index, 0), this.layers.length)
    this.layers.splice(at, 0, { id, close })
    this.pushGuard()
    return id
  }

  close(id: number): void {
    const { next, found } = removeLayer(this.layers, id)
    if (!found) return
    this.layers = next
    // The guard belongs to the STACK, so it is only given back once the last layer has gone.
    // Closing an inner one leaves it exactly where it is.
    if (this.layers.length === 0) this.popGuard()
  }

  /**
   * Step off an entry a previous page load left behind.
   *
   * Called once on mount. Returns true when it went back, and the popstate that follows is
   * swallowed like any other reclaim - so the user never sees it and never has to press back
   * through a dead entry.
   */
  discardOrphanEntry(): boolean {
    if (!isOrphanEntry(this.history.state, this.session)) return false
    this.expectPop()
    return true
  }

  /**
   * A popstate arrived. Returns true when it was consumed by closing a layer, false to let the
   * router navigate as it normally would.
   */
  handlePop(): boolean {
    const expected = this.pendingPops.shift()
    if (expected !== undefined) {
      clearTimeout(expected)
      return true
    }
    if (this.layers.length === 0) return false

    /*
      Did this pop consume OUR entry?

      The guard sits directly under nothing - so once it is popped, the entry now current does not
      carry our marker. If it still does, the browser went back over something else entirely (a
      route pushed above us), and swallowing that press would strand the user on a screen they
      asked to leave. Blindly closing a layer on every popstate closes the layer AND navigates,
      both from one press.
    */
    if (ownsCurrentEntry(this.history.state, 1, this.session)) return false

    // The gesture consumed the guard entry. Anything still open needs another one, or the next
    // press would leave the page with a sheet still up.
    this.guarded = false
    if (this.reclaimTimer !== null) {
      clearTimeout(this.reclaimTimer)
      this.reclaimTimer = null
    }
    const top = this.layers.pop()
    if (!top) return false
    top.close()
    if (this.layers.length > 0) this.pushGuard()
    return true
  }
}

interface BackStack {
  /** Register an opened layer; returns its id. Pushes a history entry. */
  open: (close: () => void) => number
  /** Deregister a layer closed by the UI itself (a Cancel tap, a backdrop). */
  close: (id: number) => void
  /** Layers open right now. */
  depth: () => number
  /** Re-register a layer that refused a Back close, at the index it had. */
  restore: (close: () => void, index: number) => number
}

const BackStackContext = React.createContext<BackStack | null>(null)

/**
 * Capacitor's native back event, if the app is running inside a shell.
 *
 * Read off `window.Capacitor` rather than imported, so nothing here depends on `@capacitor/app`
 * being installed - in a browser the whole thing is absent and this returns undefined. This is
 * what makes the Play Store build's hardware back button behave, so it is worth carrying before
 * that build exists.
 */
interface CapacitorApp {
  addListener: (
    event: 'backButton',
    handler: (event: { canGoBack?: boolean }) => void,
  ) => Promise<{ remove: () => void }>
  exitApp?: () => void
}

function capacitorApp(): CapacitorApp | undefined {
  const cap = (
    window as unknown as {
      Capacitor?: { Plugins?: { App?: CapacitorApp } }
    }
  ).Capacitor
  return cap?.Plugins?.App
}

export function BackStackProvider({ children }: { children: React.ReactNode }) {
  // Indus360: created once via a useState initializer (the React Compiler lint forbids writing a ref
  // during render); the ref is only read from effects and callbacks.
  const [instance] = React.useState<BackStackController | null>(() =>
    typeof window === 'undefined'
      ? null
      : new BackStackController({
          get state() {
            return window.history.state
          },
          pushState: (state) => window.history.pushState(state, '', window.location.href),
          back: () => window.history.back(),
        })
  )
  const controller = React.useRef<BackStackController | null>(instance)

  React.useEffect(() => {
    // Returning false leaves the event alone, so the router's own listener navigates exactly as it
    // would have.
    const onPopState = () => void controller.current?.handlePop()
    window.addEventListener('popstate', onPopState)
    // A reload with a sheet open leaves that sheet's entry behind; step off it now rather than
    // making the user press back through it.
    controller.current?.discardOrphanEntry()
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  /*
    Wrapped as an APK.

    Capacitor's BridgeActivity handles the hardware button and the edge gesture itself: with no JS
    listener it calls webView.goBack(), which fires popstate and everything above works untouched.
    But the moment ANY listener is registered - by us, or by @capacitor/app if someone installs it
    later - Capacitor stops calling goBack() and expects JS to decide. Registering our own is what
    makes that a decision rather than an accident.

    Inert in a browser: window.Capacitor does not exist, so this never runs.
  */
  React.useEffect(() => {
    const app = capacitorApp()
    if (!app) return

    let subscription: { remove: () => void } | undefined
    void app
      .addListener('backButton', (event) => {
        // Anything open is a step of its own, whatever the shell thinks about the WebView history.
        const hasLayer = (controller.current?.openIds.length ?? 0) > 0
        if (hasLayer || event.canGoBack !== false) {
          window.history.back()
          return
        }
        // Nothing open and nowhere to go: leaving the app IS the right answer, and on Android that
        // means the home screen, not a closed browser.
        app.exitApp?.()
      })
      .then((handle) => {
        subscription = handle
      })

    return () => subscription?.remove()
  }, [])

  const open = React.useCallback((close: () => void) => controller.current?.open(close) ?? -1, [])
  const close = React.useCallback((id: number) => controller.current?.close(id), [])
  const depth = React.useCallback(() => controller.current?.depth ?? 0, [])
  const restore = React.useCallback(
    (close: () => void, index: number) => controller.current?.restore(close, index) ?? -1,
    [],
  )

  const value = React.useMemo(() => ({ open, close, depth, restore }), [open, close, depth, restore])

  return <BackStackContext.Provider value={value}>{children}</BackStackContext.Provider>
}

/**
 * Give one dismissible layer its own step in the back stack.
 *
 * Pass the layer's own open state and its close handler - the SAME handler the on-screen close
 * control uses, so the gesture and the button cannot drift apart. Any confirmation the close path
 * already performs (an unsaved-changes guard, say) still runs, because this calls that handler
 * rather than dismissing anything itself.
 *
 * A no-op outside a `BackStackProvider`, so a component using it stays usable in isolation.
 */
export function useBackGuard(open: boolean, onClose: () => void): void {
  const stack = React.useContext(BackStackContext)

  /*
    Kept in a ref so a handler that changes identity every render does not re-register the layer -
    which would push a history entry per render.

    Synced in an effect rather than during render: a render-body assignment makes the render
    impure, and React may render without committing. It is only ever read from the popstate
    handler, long after effects have flushed.
  */
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  })

  React.useEffect(() => {
    if (!stack || !open) return

    let consumedByHistory = false
    let rearm: ReturnType<typeof setTimeout> | null = null
    let id = -1
    /*
      A close can be REFUSED: a Create form asks "Discard changes?" and the user keeps editing. The
      gesture already took this layer's step off the stack, so the form stayed open with no step of its
      own and the next Back left the page (or, in the Android app, went Home) under it. If the layer is
      still open a moment later it is put back at the depth it had. A close that went through unmounts
      or flips `open`, which runs the cleanup below and cancels this. Changes done by Shubham - 2026-10-26
    */
    const onBack = () => {
      consumedByHistory = true
      const at = stack.depth()
      onCloseRef.current()
      rearm = setTimeout(() => {
        rearm = null
        consumedByHistory = false
        id = stack.restore(onBack, at)
      }, 250)
    }
    id = stack.open(onBack)

    return () => {
      if (rearm !== null) clearTimeout(rearm)
      // Closed by the UI rather than by the gesture: its history entry may still be there and has
      // to be taken back. When the gesture closed it the entry is already gone, so touching
      // history again would eat the screen beneath.
      if (!consumedByHistory) stack.close(id)
    }
  }, [open, stack])
}
