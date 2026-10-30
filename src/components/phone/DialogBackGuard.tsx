"use client";
import { useEffect, useState } from "react";
import { useBackGuard } from "@/lib/back-stack";

/**
 * Android back / browser back closes the TOP open dialog instead of leaving the page.
 *
 * Every indas-ui StandardModal / Modal / ModalAlert is a Radix dialog that marks itself
 * `[role=dialog|alertdialog][data-state=open]`. Rather than adding useBackGuard to 50+ modals, this
 * watches the DOM and gives each open dialog its own step in the shared back stack (lib/back-stack).
 * Back then closes it through the dialog's OWN close control — the phone page's ‹, the header X, or
 * Escape — so any "unsaved changes?" logic behind that control still runs.
 */
const OPEN_DIALOG = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

function closeDialog(el: HTMLElement) {
  if (!el.isConnected) return;
  // Phone full-page modal: the header's first button is the ‹ (Radix Close).
  const chevron = el.classList.contains("inset-0") ? el.firstElementChild?.querySelector("button") : null;
  const btn = (chevron as HTMLButtonElement | null)
    ?? el.querySelector<HTMLButtonElement>('button[aria-label="Close modal"], button[aria-label="Close"], button[aria-label="Close dialog"]');
  if (btn) { btn.click(); return; }
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
}

function DialogLayer({ el }: { el: HTMLElement }) {
  useBackGuard(true, () => closeDialog(el));
  return null;
}

const ids = new WeakMap<HTMLElement, number>();
let nextId = 1;
const idOf = (el: HTMLElement) => { let id = ids.get(el); if (!id) { id = nextId++; ids.set(el, id); } return id; };

export default function DialogBackGuard() {
  const [open, setOpen] = useState<HTMLElement[]>([]);

  useEffect(() => {
    let frame = 0;
    const scan = () => {
      frame = 0;
      const now = Array.from(document.querySelectorAll<HTMLElement>(OPEN_DIALOG));
      setOpen((prev) => (prev.length === now.length && prev.every((e, i) => e === now[i]) ? prev : now));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(scan); };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    schedule();
    return () => { mo.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);

  return <>{open.map((el) => <DialogLayer key={idOf(el)} el={el} />)}</>;
}
