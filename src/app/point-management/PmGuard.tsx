"use client";
import {  } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { ShieldAlert } from "lucide-react";
import { usePmContext } from "./PmContext";

/**
 * Route-level authorization for Point Management pages. Renders children only if
 * the logged-in user has CanView on <module> (checked against the same
 * UserModuleAuthentication rows that drive the sidebar). This closes the gap
 * where a user could otherwise reach a page by typing its URL directly.
 */
export function PmGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const { ctx, loading, error } = usePmContext();

  if (loading) return <BrandedLoader size="lg" text="Loading…" />;
  if (error) return <div style={{ color: "#c0392b", padding: 24 }}>Failed to load permissions: <small>{error}</small></div>;
  if (!ctx || !ctx.modules.includes(module)) return <AccessDenied />;
  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fdecec", color: "#c0392b", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
          <ShieldAlert size={30} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Access denied</div>
        <div style={{ fontSize: 13.5, opacity: 0.65, lineHeight: 1.6 }}>
          You don’t have permission to view this page. If you think this is a mistake,
          ask an administrator to grant you access from <b>User Permissions</b>.
        </div>
      </div>
    </div>
  );
}
