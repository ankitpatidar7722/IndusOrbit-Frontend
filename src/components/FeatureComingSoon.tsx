"use client";
import { Page } from "indas-ui";
import { Hammer, type LucideIcon } from "lucide-react";

/** Generic "coming soon" placeholder for a sidebar route whose page isn't built yet. */
export default function FeatureComingSoon({ title, group, icon: Icon = Hammer, note }: {
  title: string;
  group?: string;
  icon?: LucideIcon;
  note?: string;
}) {
  return (
    <Page title={title} description={group}>
      <div style={{ display: "grid", placeItems: "center", minHeight: "55vh" }}>
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div style={{ width: 66, height: 66, borderRadius: 16, background: "color-mix(in srgb, rgb(var(--color-primary)) 10%, white)", color: "rgb(var(--color-primary))", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon size={30} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: "rgb(var(--fg-default))" }}>{title}</div>
          <div style={{ fontSize: 13.5, color: "rgb(var(--fg-muted))", lineHeight: 1.6 }}>
            {note || "This section is coming soon. The full page will appear here shortly."}
          </div>
        </div>
      </div>
    </Page>
  );
}
