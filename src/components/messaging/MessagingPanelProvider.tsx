"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Maximize2 } from "lucide-react";
import { MessagingProvider } from "@/contexts/MessagingContext";
import { MessagingPanelContent } from "./messaging-panel-content";

// App header (TopHeader) height — the slide-in panel starts just below it so it
// never overlaps the header (logo / company / profile stay visible + clickable).
const HEADER_H = 58;

interface MessagingPanelCtx { openMessaging: () => void; closeMessaging: () => void }
const Ctx = createContext<MessagingPanelCtx>({ openMessaging: () => {}, closeMessaging: () => {} });
export const useMessagingPanel = () => useContext(Ctx);

const panelHdrBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: "none", background: "rgba(255,255,255,.16)",
  color: "#fff", display: "grid", placeItems: "center", cursor: "pointer",
};

/**
 * Provides the app-wide messaging state (MessagingProvider) + a header-triggered
 * slide-in chat panel. The full page lives at /messages; this is the quick panel.
 */
export function MessagingPanelProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const openMessaging = useCallback(() => setOpen(true), []);
  const closeMessaging = useCallback(() => setOpen(false), []);
  const openFullScreen = useCallback(() => { setOpen(false); router.push("/activity/messages"); }, [router]);

  return (
    <MessagingProvider>
      <Ctx.Provider value={{ openMessaging, closeMessaging }}>
        {children}
        {open && (
          <>
            <div onClick={closeMessaging} style={{ position: "fixed", top: HEADER_H, left: 0, right: 0, bottom: 0, zIndex: 60, background: "rgba(15,23,42,.28)" }} />
            <div style={{ position: "fixed", top: HEADER_H, right: 0, bottom: 0, width: 960, maxWidth: "96vw", zIndex: 61, background: "rgb(var(--bg-surface))", boxShadow: "-12px 0 40px rgba(0,0,0,.22)", display: "flex", flexDirection: "column", animation: "indusSlideIn .18s ease-out" }}>
              <div style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", background: "rgb(var(--color-primary-hover))", color: "#fff" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Messages</span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={openFullScreen} title="Open full screen" style={panelHdrBtn}><Maximize2 size={16} /></button>
                  <button onClick={closeMessaging} title="Close" style={panelHdrBtn}><X size={17} /></button>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <MessagingPanelContent onClose={closeMessaging} />
              </div>
            </div>
          </>
        )}
      </Ctx.Provider>
    </MessagingProvider>
  );
}
