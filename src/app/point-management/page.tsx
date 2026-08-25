"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {  } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { usePmContext } from "./PmContext";
import { PM_SUBMODULES } from "@/lib/tms";

/**
 * Point Management landing = a thin redirector. The 16 pages live in the sidebar
 * (collapsible "Point Management" section); this route just forwards the user to
 * their first accessible page instead of showing a card grid.
 */
export default function PointManagementHub() {
  const { ctx, loading } = usePmContext();
  const router = useRouter();

  const first = ctx ? PM_SUBMODULES.find((s) => ctx.modules.includes(s.route))?.route : undefined;

  useEffect(() => {
    if (first) router.replace(first);
  }, [first, router]);

  if (!loading && ctx && !first) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", padding: 24 }}>
        <div style={{ textAlign: "center", opacity: 0.6, fontSize: 14 }}>
          No Point Management pages are assigned to you. Ask an admin to grant access under User Permissions.
        </div>
      </div>
    );
  }

  return <BrandedLoader size="lg" text="Opening…" />;
}
