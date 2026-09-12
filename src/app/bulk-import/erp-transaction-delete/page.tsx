"use client";
import { Trash2 } from "lucide-react";
import BulkModuleShell from "@/components/bulk/BulkModuleShell";
import ERPTransactionDeleteModule from "@/components/bulk/modules/ERPTransactionDeleteModule";

export default function ERPTransactionDeletePage() {
  return (
    <BulkModuleShell title="ERP Transaction Delete" icon={Trash2}>
      {(client) => <ERPTransactionDeleteModule client={client} />}
    </BulkModuleShell>
  );
}
