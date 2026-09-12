"use client";
import { ShieldCheck } from "lucide-react";
import BulkModuleShell from "@/components/bulk/BulkModuleShell";
import ModuleAuthorityModule from "@/components/bulk/modules/ModuleAuthorityModule";

export default function ModuleAuthorityPage() {
  return (
    <BulkModuleShell title="Module Authority" icon={ShieldCheck}>
      {(client) => <ModuleAuthorityModule client={client} />}
    </BulkModuleShell>
  );
}
