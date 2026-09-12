"use client";
import { Images } from "lucide-react";
import BulkModuleShell from "@/components/bulk/BulkModuleShell";
import ContentAuthorityModule from "@/components/bulk/modules/ContentAuthorityModule";

export default function ContentAuthorityPage() {
  return (
    <BulkModuleShell title="Content Authority" icon={Images}>
      {(client) => <ContentAuthorityModule client={client} />}
    </BulkModuleShell>
  );
}
