"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { pmApi, type PmContext as Ctx } from "@/lib/tms";

interface PmState { ctx: Ctx | null; loading: boolean; error: string | null; }
const PmCtx = createContext<PmState>({ ctx: null, loading: true, error: null });

/**
 * Fetches the logged-in user's Point Management context (TMS UserID + allowed
 * submodule routes) once and shares it across every PM page (provided via
 * app/point-management/layout.tsx). Pages use it for authorization (PmGuard)
 * and "my work" scoping (ctx.tmsUserId / ctx.tmsRole).
 */
export function PmProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [state, setState] = useState<PmState>({ ctx: null, loading: true, error: null });

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    const u = session.user as unknown as { UserID?: number; email?: string | null };
    let alive = true;
    pmApi.me(Number(u.UserID ?? 0), u.email ?? "")
      .then((ctx) => alive && setState({ ctx, loading: false, error: null }))
      .catch((e) => alive && setState({ ctx: null, loading: false, error: String(e) }));
    return () => { alive = false; };
  }, [status, session]);

  return <PmCtx.Provider value={state}>{children}</PmCtx.Provider>;
}

export const usePmContext = () => useContext(PmCtx);
