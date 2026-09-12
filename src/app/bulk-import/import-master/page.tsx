"use client";
import { FileSpreadsheet } from "lucide-react";
import BulkModuleShell from "@/components/bulk/BulkModuleShell";
import ImportMasterModule from "@/components/bulk/modules/ImportMasterModule";

export default function ImportMasterPage() {
  return (
    <BulkModuleShell title="Import Master" icon={FileSpreadsheet}>
      {(client) => <ImportMasterModule client={client} />}
    </BulkModuleShell>
  );
}
