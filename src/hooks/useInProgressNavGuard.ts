"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Guard against leaving the page while a critical operation is in flight (e.g. a client
 * database is being provisioned in the Company Setup wizard).
 *
 * While `active` is true:
 *   • Closing / refreshing the browser tab — or any full-page unload (URL bar, external link) —
 *     triggers the browser's native "Leave site?" confirmation via `beforeunload`.
 *   • Clicking a sidebar / in-app link to another route is intercepted in the capture phase
 *     (before Next's router runs), so nothing navigates: `blocked` flips to true and the caller
 *     shows a Leave / Cancel popup. `confirmLeave()` then re-dispatches that exact click so the
 *     navigation proceeds; `cancelLeave()` dismisses the popup and stays put.
 *
 * Re-dispatching the original element's click (rather than guessing its href) works whether the
 * sidebar renders a real <a> or a <button> that calls router.push internally.
 *
 * The caller must mark its OWN page / modal content with `data-navguard-safe` so clicks on its own
 * controls are ignored — only interactive elements OUTSIDE that subtree (sidebar, header) are treated
 * as "leaving". (The Leave/Cancel popup carries `data-leave-guard` and is always ignored.)
 */
export function useInProgressNavGuard(active: boolean) {
  const [blocked, setBlocked] = useState(false);
  const pendingElRef = useRef<HTMLElement | null>(null);
  const bypassRef = useRef(false);         // lets the confirmed navigation pass our own guards
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!active) {
      setBlocked(false);
      pendingElRef.current = null;
      return;
    }

    // 1) tab close / refresh / hard navigation → native browser prompt
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypassRef.current) return;
      e.preventDefault();
      e.returnValue = "";                  // Chrome requires a returnValue to show the prompt
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    // 2) in-app link / sidebar click. Capture phase runs BEFORE React/Next's own handlers, so
    //    preventing it here stops the route change from ever happening. We match ANY interactive
    //    element OUTSIDE the wizard (sidebar / header) — selector-independent, so it catches the
    //    sidebar whether it renders real <a>s or <button>s that call router.push internally.
    const INTERACTIVE = 'a[href], a, button, [role="button"], [role="link"], [role="menuitem"], [role="tab"]';
    const onClickCapture = (e: MouseEvent) => {
      if (bypassRef.current || !activeRef.current) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== "function") return;
      if (t.closest("[data-navguard-safe]") || t.closest("[data-leave-guard]")) return; // inside the caller's own content / our popup
      const el = t.closest(INTERACTIVE) as HTMLElement | null;
      if (!el) return;
      if (el.tagName === "A") {                                                       // skip new-tab / download / non-route anchors
        const a = el as HTMLAnchorElement;
        if (a.target === "_blank" || a.hasAttribute("download")) return;
        const href = a.getAttribute("href") || "";
        if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        if (href) { try { if (new URL(a.href, window.location.href).origin !== window.location.origin) return; } catch { return; } }
      }
      e.preventDefault();
      e.stopPropagation();
      (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
      pendingElRef.current = el;
      setBlocked(true);
    };
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [active]);

  const cancelLeave = useCallback(() => {
    pendingElRef.current = null;
    setBlocked(false);
  }, []);

  const confirmLeave = useCallback(() => {
    const el = pendingElRef.current;
    pendingElRef.current = null;
    setBlocked(false);
    bypassRef.current = true;              // allow the re-dispatched click through the guard
    el?.click();                          // replay the exact sidebar / link click → it navigates now
    // If it didn't navigate (page still mounted), re-arm the guard shortly after.
    window.setTimeout(() => { bypassRef.current = false; }, 500);
  }, []);

  return { blocked, confirmLeave, cancelLeave };
}
