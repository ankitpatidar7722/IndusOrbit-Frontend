"use client";
import { useEffect, useState, useCallback } from "react";
import { Download } from "lucide-react";
import { getInstallPrompt, isInstalled, promptInstall, subscribeInstall } from "@/lib/pwaInstall";

/**
 * "Install App" button. Renders nothing unless the app is actually installable:
 *  - Chrome / Edge / Android → real native install prompt (beforeinstallprompt).
 *  - iOS Safari (no such event) → a short "Share → Add to Home Screen" hint.
 *  - Already installed / not installable → renders nothing.
 *
 * `variant="drawer"` = full-width row for the mobile menu; `variant="card"` = standalone card (Settings).
 */
export default function InstallAppButton({ variant = "drawer" }: { variant?: "drawer" | "card" }) {
  const [, force] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [installedNow, setInstalledNow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isInstalled()) setInstalledNow(true);
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const iOS = /iphone|ipad|ipod/i.test(ua);
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    // iOS can only "install" via Safari's Share sheet; show the hint only if not already installed.
    setIsIOS(iOS && !standalone);
    const unsub = subscribeInstall(() => { force((n) => n + 1); if (isInstalled()) setInstalledNow(true); });
    return unsub;
  }, []);

  const onInstall = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") setInstalledNow(true);
  }, []);

  if (!mounted) return null;        // avoid SSR/first-render hydration mismatch — reveal only after mount
  if (installedNow) return null;

  const canPrompt = !!getInstallPrompt();
  if (!canPrompt && !isIOS) return null; // not installable on this browser (e.g. desktop Firefox)

  const rowStyle: React.CSSProperties =
    variant === "drawer"
      ? { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", margin: "8px 0", border: "none", borderRadius: 10, background: "rgba(255,255,255,.14)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "left" }
      : { display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", border: "none", borderRadius: 9, background: "rgb(var(--color-primary))", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" };

  // iOS Safari: no programmatic prompt — guide the user through the Share sheet.
  if (!canPrompt && isIOS) {
    return (
      <div style={{ width: variant === "drawer" ? "100%" : "auto" }}>
        <button onClick={() => setShowIOSHelp((v) => !v)} style={rowStyle} aria-expanded={showIOSHelp}>
          <Download size={17} /> Install App
        </button>
        {showIOSHelp && (
          <div
            style={{
              marginTop: 6, padding: "10px 12px", borderRadius: 10, fontSize: 12.5, lineHeight: 1.55,
              background: variant === "drawer" ? "rgba(255,255,255,.10)" : "rgb(var(--bg-subtle))",
              color: variant === "drawer" ? "rgba(255,255,255,.92)" : "rgb(var(--fg-default))",
              border: variant === "drawer" ? "none" : "1px solid rgb(var(--bd-subtle))",
            }}
          >
            iPhone/iPad par: neeche <b>Share</b> button (⬆️ box) dabao → scroll karke{" "}
            <b>&ldquo;Add to Home Screen&rdquo;</b> chuno → <b>Add</b>. App icon home screen par aa jayega.
          </div>
        )}
      </div>
    );
  }

  // Chrome / Edge / Android — real install prompt.
  return (
    <button onClick={onInstall} style={rowStyle}>
      <Download size={17} /> Install App
    </button>
  );
}
