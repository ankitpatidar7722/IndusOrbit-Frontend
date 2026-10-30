"use client";
import { useSyncExternalStore } from "react";

/**
 * The phone gestures a person can turn off (idea + wording from IndusFlexoERP's GesturePrefsContext),
 * limited to the gestures Indus360 actually has. Only ones a reasonable person might not want: a sloppy
 * pull can reload, a slow tap can start a selection, some people dislike the buzz.
 *
 * The Android back gesture is deliberately NOT here — closing the top sheet/dialog is the platform's
 * contract, and switching it off would make one back press leave the screen from three layers deep.
 *
 * A tiny external store (no provider): read with useGesturePrefs() / getGesture(), saved per device in
 * localStorage. Everything ships ON — a gesture nobody knows about is worth nothing.
 */
export type GestureId = "pullToRefresh" | "longPress" | "swipeReply" | "haptics";
export type GesturePrefs = Record<GestureId, boolean>;

export const DEFAULT_GESTURE_PREFS: GesturePrefs = { pullToRefresh: true, longPress: true, swipeReply: true, haptics: true };

export const GESTURE_OPTIONS: { id: GestureId; label: string; description: string }[] = [
  { id: "pullToRefresh", label: "Pull down to refresh", description: "Pull a screen down from the top to reload it." },
  { id: "longPress", label: "Press and hold to select", description: "Holding a card starts a selection instead of opening it; holding a chat message opens its menu." },
  { id: "swipeReply", label: "Swipe to reply", description: "Swipe a chat message to the right to reply to it." },
  { id: "haptics", label: "Vibration feedback", description: "A short buzz when a hold or swipe action fires." },
];

const STORAGE_KEY = "indus360.gestures";

function load(): GesturePrefs {
  if (typeof window === "undefined") return DEFAULT_GESTURE_PREFS;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Record<string, unknown> | null;
    const merged = { ...DEFAULT_GESTURE_PREFS };
    // Unknown keys dropped, missing ones default ON (a gesture added later is on for old prefs too).
    if (raw && typeof raw === "object") for (const k of Object.keys(merged) as GestureId[]) if (typeof raw[k] === "boolean") merged[k] = raw[k] as boolean;
    return merged;
  } catch { return DEFAULT_GESTURE_PREFS; }
}

let prefs: GesturePrefs = load();
const listeners = new Set<() => void>();

export function getGesture(id: GestureId): boolean { return prefs[id]; }

export function setGesture(id: GestureId, on: boolean) {
  prefs = { ...prefs, [id]: on };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* storage blocked — lasts this visit */ }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The whole set (re-renders on change). Server render = defaults. */
export function useGesturePrefs(): GesturePrefs {
  return useSyncExternalStore(subscribe, () => prefs, () => DEFAULT_GESTURE_PREFS);
}

/** A short haptic buzz — only when "Vibration feedback" is on and the device can vibrate. */
export function buzz(ms = 15) {
  if (!prefs.haptics) return;
  try { navigator.vibrate?.(ms); } catch { /* no haptics */ }
}
