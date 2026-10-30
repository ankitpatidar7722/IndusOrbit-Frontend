"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * "You're offline" strip (idea from IndusFlexoERP's OfflineOverlay). Without it a lost connection only
 * showed as endless spinners or "Load error" text. Shown while the browser reports no network; it goes
 * away by itself when the connection is back. Not blocking — what is on screen stays readable.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const first = setTimeout(update, 0);
    return () => { clearTimeout(first); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position: "fixed", left: 0, right: 0, top: 0, zIndex: 200,
      paddingTop: "env(safe-area-inset-top, 0px)",
      background: "rgb(var(--color-error))", color: "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600 }}>
        <WifiOff size={16} aria-hidden />
        You&apos;re offline — changes can&apos;t be saved until the connection is back.
      </div>
    </div>
  );
}
