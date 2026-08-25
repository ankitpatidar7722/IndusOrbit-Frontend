"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { StandardModal, Input, Textarea } from "indas-ui";
import { customersApi, type CustomerCard } from "@/lib/customers";

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, opacity: 0.65, display: "block", marginBottom: 3 };

export default function DeleteCustomerModal({
  target, isOpen, onClose, onDeleted,
}: {
  target: CustomerCard | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (msg: string) => void;
}) {
  const { data: session } = useSession();
  const sessionEmail = session?.user?.email ?? "";
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Auth is now the LOGGED-IN user's own Indus 360 login: lock the User Name to the
  // session email and only ask for their password + a reason.
  useEffect(() => {
    if (isOpen) { setUserName(sessionEmail); setPassword(""); setReason(""); setErr(null); }
  }, [isOpen, sessionEmail]);

  async function confirm() {
    if (!userName.trim() || !password.trim()) { setErr("User name and password are required."); return; }
    if (!reason.trim()) { setErr("Reason is required."); return; }
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await customersApi.remove({
        companyUserID: target.companyUserID,
        companyName: target.companyName,
        companyUniqueCode: target.companyUniqueCode ?? undefined,
        userName, password, reason,
      });
      if (res.success) onDeleted(res.message);
      else setErr(res.message);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Authentication Required"
      subtitle={target ? `Delete ${target.companyName} (${target.companyUserID})` : undefined}
      badge={{ label: "Danger", variant: "destructive" }}
      size="md"
      showFooter
      onSave={confirm}
      onCancel={onClose}
      saveLabel={busy ? "Deleting…" : "Delete"}
      saving={busy}
    >
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 14 }}>
        Deleting a subscription is authenticated against your <b>Indus 360 login</b>. Confirm with your password and a reason.
      </div>
      {err && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{err}</div>}
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={labelStyle}>User Name *</label>
          <Input value={userName} readOnly={!!sessionEmail} onChange={(e) => setUserName(e.target.value)}
            placeholder="your login email" autoComplete="off"
            style={sessionEmail ? { background: "rgb(var(--bg-subtle))", color: "rgb(var(--fg-muted))", cursor: "not-allowed" } : undefined} />
        </div>
        <div>
          <label style={labelStyle}>Password *</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label style={labelStyle}>Reason for Deletion *</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
      </div>
    </StandardModal>
  );
}
