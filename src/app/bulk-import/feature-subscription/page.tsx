"use client";
import { BadgeCheck } from "lucide-react";
import BulkModuleShell from "@/components/bulk/BulkModuleShell";
import FeatureSubscriptionModule from "@/components/bulk/modules/FeatureSubscriptionModule";

export default function FeatureSubscriptionPage() {
  return (
    <BulkModuleShell title="Feature Subscription" icon={BadgeCheck}>
      {(client) => <FeatureSubscriptionModule client={client} />}
    </BulkModuleShell>
  );
}
