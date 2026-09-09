"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Native-app "pull down to refresh" for touch devices. Mounted once, globally (inside the app shell).
 * When the current scroll area is at the top and the user drags down, a spinner appears; releasing
 * past the threshold reloads the page (the most reliable "refresh everything" — the app fetches most
 * data client-side, so a soft router.refresh() wouldn't re-run those). Desktop/mouse: never engages.
 */
const THRESHOLD = 70;   // px of pull (after resistance) needed to trigger a refresh
const MAX_PULL = 110;   // visual cap
const RESIST = 0.5;     // drag resistance

function scrollableAncestor(node: EventTarget | null): HTMLElement | Element {
  let el = node as HTMLElement | null;
  while (el && el !== document.body) {
    const s = getComputedStyle(el);
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

export default function PullToRefresh() {
  const [enabled, setEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const smallish = window.matchMedia("(max-width: 1023px)").matches;
    if (touch && smallish) setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let startY = 0;
    let pull = 0;
    let engaged = false;
    let scroller: HTMLElement | Element | null = null;

    const setIndicator = (dist: number, spinning: boolean) => {
      const el = indicatorRef.current;
      if (!el) return;
      const shown = dist > 2 || spinning;
      el.style.opacity = shown ? "1" : "0";
      const y = spinning ? MAX_PULL * 0.55 : Math.min(dist, MAX_PULL);
      el.style.transform = `translateX(-50%) translateY(${y}px)`;
      const icon = el.firstElementChild as HTMLElement | null;
      if (icon && !spinning) icon.style.transform = `rotate(${dist * 2.6}deg)`;
    };

    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1) return;
      // Don't hijack pulls inside an open modal/dialog.
      if (document.querySelector('[role="dialog"]')) { scroller = null; return; }
      startY = e.touches[0].clientY;
      pull = 0;
      engaged = false;
      scroller = scrollableAncestor(e.target);
    };

    const onMove = (e: TouchEvent) => {
      if (refreshing || !scroller || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      if (!engaged) {
        if (dy > 6 && scroller.scrollTop <= 0) engaged = true;
        else return;
      }
      if (dy <= 0 || scroller.scrollTop > 0) { engaged = false; pull = 0; setIndicator(0, false); return; }
      // We're actively pulling from the top — take over from native scroll.
      e.preventDefault();
      pull = dy * RESIST;
      setIndicator(pull, false);
    };

    const onEnd = () => {
      if (refreshing) return;
      if (engaged && pull >= THRESHOLD) {
        setRefreshing(true);
        setIndicator(pull, true);
        window.setTimeout(() => { window.location.reload(); }, 450);
      } else {
        setIndicator(0, false);
      }
      engaged = false;
      pull = 0;
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, refreshing]);

  if (!enabled) return null;

  return (
    <div
      ref={indicatorRef}
      aria-hidden={!refreshing}
      style={{
        position: "fixed",
        top: 8,
        left: "50%",
        transform: "translateX(-50%) translateY(0px)",
        opacity: 0,
        zIndex: 70,
        width: 38,
        height: 38,
        borderRadius: 999,
        background: "rgb(var(--bg-surface))",
        border: "1px solid rgb(var(--bd-subtle))",
        boxShadow: "0 6px 20px rgba(15,23,42,.22)",
        display: "grid",
        placeItems: "center",
        color: "rgb(var(--color-primary))",
        pointerEvents: "none",
        transition: "opacity .15s ease",
      }}
    >
      <RefreshCw size={19} className={refreshing ? "animate-spin" : undefined} />
    </div>
  );
}
