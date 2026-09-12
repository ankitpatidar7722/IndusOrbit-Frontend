"use client";
import { PackagePlus } from "lucide-react";
import BulkModuleShell from "@/components/bulk/BulkModuleShell";
import StockUploadModule from "@/components/bulk/modules/StockUploadModule";

export default function StockUploadPage() {
  return (
    <BulkModuleShell title="Stock Upload" icon={PackagePlus}>
      {(client) => <StockUploadModule client={client} />}
    </BulkModuleShell>
  );
}
