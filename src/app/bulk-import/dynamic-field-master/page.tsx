"use client";
import BulkModuleShell from "@/components/bulk/BulkModuleShell";
import { ListChecks } from "lucide-react";
import DynamicFieldMasterModule from "@/components/bulk/modules/DynamicFieldMasterModule";

// "Dynamic Field Master" — pick a Module (Item/Ledger/Tool) + Sub Module (group), then sync that group's
// fields from the shared Source DB into the picked client's DB. Runs behind the BulkModuleShell's
// Product+Client picker (X-Target-Company → the client DB). `key` re-mounts the module on client change.
export default function DynamicFieldMasterPage() {
  return (
    <BulkModuleShell title="Dynamic Field Master" icon={ListChecks}>
      {(client) => <DynamicFieldMasterModule key={client.companyUserId} client={client} />}
    </BulkModuleShell>
  );
}
