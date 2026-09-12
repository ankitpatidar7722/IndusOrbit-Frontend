"use client";
import { Tags } from "lucide-react";
import BulkModuleShell from "@/components/bulk/BulkModuleShell";
import ManagePlansModule from "@/components/bulk/modules/ManagePlansModule";

export default function ManagePlansPage() {
  return (
    <BulkModuleShell title="Manage Plans" icon={Tags}>
      {(client) => <ManagePlansModule client={client} />}
    </BulkModuleShell>
  );
}
