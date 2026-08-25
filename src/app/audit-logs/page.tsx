"use client";
import { ScrollText } from "lucide-react";
import FeatureComingSoon from "@/components/FeatureComingSoon";

export default function AuditLogsPage() {
  return <FeatureComingSoon title="Audit Logs" group="Activity" icon={ScrollText}
    note="A searchable log of system and user activity is coming soon." />;
}
