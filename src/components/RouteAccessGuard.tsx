"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShieldAlert } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import { fetchMyModuleAccess, getCachedModuleAccess, isRouteDenied, type ModuleAccessMap } from "@/lib/routeAccess";

/**
 * Route-level authorization for every module page. Renders the page only when the logged-in user
 * has CanView on the module that owns the current route (checked against the same
 * UserModuleAuthentication rows that drive the sidebar). Closes the gap where a user could reach a
 * page by typing its URL directly (e.g. /users). Routes with no matching module (dashboard,
 * settings, self-service) are never gated.
 */
export default function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const uid = (session?.user as { UserID?: number } | undefined)?.UserID;
  // Seed synchronously from the cache so already-fetched sessions never flash a loader on nav.
  const [map, setMap] = useState<ModuleAccessMap | null>(() => getCachedModuleAccess(uid));

  useEffect(() => {
    if (!uid) return;
    const cached = getCachedModuleAccess(uid);
    if (cached) { setMap(cached); return; }
    let cancelled = false;
    fetchMyModuleAccess(uid).then((m) => { if (!cancelled) setMap(m); }).catch(() => { if (!cancelled) setMap({}); });
    return () => { cancelled = true; };
  }, [uid]);

  if (!uid) return <>{children}</>;                 // not signed in yet — the shell handles auth
  if (map === null) return <BrandedLoader text="Checking access…" />;   // first load only
  if (isRouteDenied(pathname, map)) return <AccessDenied />;
  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70vh", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 440 }}>
        <div style={{ width: 68, height: 68, borderRadius: 18, background: "#fdecec", color: "#c0392b", display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
          <ShieldAlert size={32} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8, color: "rgb(var(--fg-default))" }}>You don&apos;t have access to this page</div>
        <div style={{ fontSize: 13.5, color: "rgb(var(--fg-muted))", lineHeight: 1.65 }}>
          You are not authorized to view this page. Please contact your <b>administrator</b> to request access
          from <b>User Management → Module Authority</b>.
        </div>
      </div>
    </div>
  );
}
