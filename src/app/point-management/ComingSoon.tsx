"use client";
import { Page } from "indas-ui";
import { Hammer } from "lucide-react";

/** Temporary placeholder for a Point Management page whose migration is in progress. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <Page title={title} description="Point Management">
      <div style={{ display: "grid", placeItems: "center", minHeight: "50vh" }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#eef3fb", color: "rgb(var(--color-primary))", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Hammer size={28} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 13.5, opacity: 0.65, lineHeight: 1.6 }}>
            This page is being migrated from the old Task Management app. You have access —
            the full page will appear here shortly.
          </div>
        </div>
      </div>
    </Page>
  );
}
