"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { customersApi } from "@/lib/customers";
import EmailComposer, { type ComposerInit } from "./EmailComposer";

interface EmailComposerCtx {
  /** Open the composer. With no init, auto-detects Client context from the current /clients/[code] route. */
  openComposer: (init?: ComposerInit) => void | Promise<void>;
  closeComposer: () => void;
}

const Ctx = createContext<EmailComposerCtx | null>(null);

export function useEmailComposer(): EmailComposerCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEmailComposer must be used within <EmailComposerProvider>");
  return c;
}

export function EmailComposerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [init, setInit] = useState<ComposerInit | null>(null);

  const openComposer = useCallback(async (given?: ComposerInit) => {
    let resolved: ComposerInit = given ?? {};
    // On a client page, keep the client CONTEXT (for history/tagging) but do NOT auto-fill the To
    // field — the user asked that no default recipient appear when composing.
    if (!given?.to && !given?.context) {
      const m = pathname?.match(/^\/clients\/([^/]+)/);
      if (m) {
        try {
          const c = await customersApi.detail(decodeURIComponent(m[1]));
          resolved = {
            context: { clientCode: c.companyUniqueCode ?? undefined, clientName: c.companyName ?? undefined, module: "Client" },
          };
        } catch { /* open blank if the client can't be resolved */ }
      }
    }
    setInit(resolved);
    setOpen(true);
  }, [pathname]);

  const closeComposer = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ openComposer, closeComposer }}>
      {children}
      <EmailComposer open={open} init={init} onClose={closeComposer} />
    </Ctx.Provider>
  );
}
