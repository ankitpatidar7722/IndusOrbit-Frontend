"use client";
import { PenTool } from "lucide-react";
import BulkModuleShell from "@/components/bulk/BulkModuleShell";
import KeyLineGenerator from "@/bulk/pages/KeyLineGenerator";

// KeyLine Generator — the full BulkImport keyline/dieline CAD tool (coordinate tables + mathjs formula
// engine + 3D box-folding preview via Box3DViewer + sheet planning + import/export), wired to operate
// on the picked client's DB (X-Target-Company set by BulkModuleShell). `key` re-mounts on client change.
export default function KeyLineGeneratorPage() {
  return (
    <BulkModuleShell title="KeyLine Generator" icon={PenTool}>
      {(client) => <KeyLineGenerator key={client.companyUserId} />}
    </BulkModuleShell>
  );
}
