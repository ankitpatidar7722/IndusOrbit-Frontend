"use client";
import { Building2 } from "lucide-react";
import BulkModuleShell from "@/components/bulk/BulkModuleShell";
import CompanyMasterModule from "@/components/bulk/modules/CompanyMasterModule";

export default function CompanyMasterPage() {
  return (
    <BulkModuleShell title="Company Master" icon={Building2}>
      {(client) => <CompanyMasterModule client={client} />}
    </BulkModuleShell>
  );
}
