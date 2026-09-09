/**
 * PWA install-prompt singleton.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt` ONCE, often before React hydrates. We attach the
 * listener at module-load (as early as possible — imported for side-effect in providers.tsx) and
 * stash the event so a button mounted later can still offer "Install". Components subscribe to be
 * notified when the event arrives or the app gets installed.
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

if (typeof window !== "undefined") {
  // Already launched as an installed app?
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) installed = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // stop Chrome's mini-infobar; we show our own button instead
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

/** The stashed install event, or null if not (yet) installable. */
export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

/** True once the app is running installed (or was installed this session). */
export function isInstalled(): boolean {
  return installed;
}

/** Fire the native install prompt. Returns the user's choice, or null if unavailable. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  if (!deferred) return null;
  const evt = deferred;
  await evt.prompt();
  let outcome: "accepted" | "dismissed" = "dismissed";
  try { outcome = (await evt.userChoice).outcome; } catch { /* ignore */ }
  deferred = null;
  notify();
  return outcome;
}

/** Subscribe to install-state changes. Returns an unsubscribe fn. */
export function subscribeInstall(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}
