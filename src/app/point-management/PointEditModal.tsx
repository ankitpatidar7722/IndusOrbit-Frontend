"use client";
import { useEffect, useRef, useState } from "react";
import { StandardModal, Textarea, Button, Dropdown } from "indas-ui";
import { Upload, Paperclip, Trash2 } from "lucide-react";
import { pmApi, type PmProduct, type PmCategory, type PointGridRow, type NewPoint, type AttachmentRow } from "@/lib/tms";
import { api, type KeylineModule } from "@/lib/api";
import { customersApi, type CustomerCard } from "@/lib/customers";

const PRIORITIES = ["High", "Medium", "Low"];
const COMPLEXITIES = ["Simple", "Medium", "Complex"];

const fieldWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5 };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#334155" };

/**
 * Edit a Queue-status point (Manage Points → Edit). Reuses the Add-Point field set as a modal,
 * pre-filled from the grid row. Module / Sub Module dropdowns are typable (custom values accepted).
 * Customer is sent by name (backend resolves name → TMS CustomerID, find-or-create).
 */
export default function PointEditModal({ open, point, onClose, onSaved, onError, uploaderId }: {
  open: boolean; point: PointGridRow | null; onClose: () => void;
  onSaved: (msg: string) => void; onError: (msg: string) => void; uploaderId: number;
}) {
  const [clients, setClients] = useState<CustomerCard[]>([]);
  const [products, setProducts] = useState<PmProduct[]>([]);
  const [categories, setCategories] = useState<PmCategory[]>([]);
  const [keyline, setKeyline] = useState<KeylineModule[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerName, setCustomerName] = useState("");
  const [productID, setProductID] = useState<number | "">("");
  const [module, setModule] = useState("");
  const [subModule, setSubModule] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [complexity, setComplexity] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const refreshAtt = () => { if (point) pmApi.listAttachments(point.pointID).then(setAttachments).catch(() => {}); };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([customersApi.list(), pmApi.products(), pmApi.categories(), api.keylineModules()])
      .then(([cl, p, cat, km]) => { setClients(cl); setProducts(p); setCategories(cat); setKeyline(km.success ? km.data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Pre-fill from the row each time the modal opens for a point.
  useEffect(() => {
    if (!open || !point) return;
    setErr(null);
    setCustomerName(point.customerName ?? "");
    setProductID(point.productID || "");
    setModule(point.module ?? "");
    setSubModule(point.subModule ?? "");
    setCategory(point.category ?? "");
    setPriority(point.priority || "Medium");
    setComplexity(point.complexity ?? "");
    setDescription(point.description ?? "");
    setAttachments([]);
    pmApi.listAttachments(point.pointID).then(setAttachments).catch(() => {});
  }, [open, point]);

  const heads = Array.from(new Set(keyline.map((k) => k.head)));
  const subsFor = (h: string) => (h ? Array.from(new Set(keyline.filter((k) => k.head === h).map((k) => k.name))) : []);
  const clientNames = Array.from(new Set(clients.map((c) => c.companyName).filter(Boolean)));

  const save = async () => {
    if (!point) return;
    if (!description.trim()) { setErr("Description is required."); return; }
    setSaving(true); setErr(null);
    try {
      const body: NewPoint = {
        description: description.trim(),
        module: module || undefined, subModule: subModule || undefined,
        // customerID=0 → backend resolves the (possibly changed) customer by name.
        customerID: 0, customerName: customerName || undefined,
        productID: productID ? Number(productID) : 0,
        reportedByID: point.reportedByID,  // unchanged (the UPDATE never touches ReportedBy)
        priority: priority || "Medium", category: category || "Bug", complexity: complexity || undefined,
      };
      const r = await pmApi.updatePoint(point.pointID, body);
      if (r.ok) { onSaved(`Point #${point.pointID} updated successfully.`); onClose(); }
      else { setErr(r.message || "Could not update the point."); onError(r.message || "Could not update the point."); }
    } catch (e) { setErr(String(e)); } finally { setSaving(false); }
  };

  return (
    <StandardModal
      isOpen={open}
      onClose={onClose}
      title={point ? `Edit Point #${point.pointID}` : "Edit Point"}
      subtitle="Only Queue points can be edited."
      size="lg"
      showFooter
      footerActions={
        <>
          <Button variant="action-save" onClick={save} loading={saving}>Update</Button>
          <Button variant="action-cancel" onClick={onClose} disabled={saving}>Cancel</Button>
        </>
      }
    >
      {loading ? <div style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>Loading…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={fieldWrap}><span style={lbl}>Customer</span>
            <Dropdown value={customerName} onValueChange={(v) => setCustomerName(String(v))}
              options={clientNames.map((n) => ({ value: n, label: n }))} placeholder="Select or type…" searchable allowTextInput allowCustomInput size="md" /></div>
          <div style={fieldWrap}><span style={lbl}>Product</span>
            <Dropdown value={String(productID || "")} onValueChange={(v) => setProductID(v ? Number(v) : "")}
              options={products.map((p) => ({ value: String(p.productID), label: p.productName }))} placeholder="— select —" searchable size="md" /></div>
          <div style={fieldWrap}><span style={lbl}>Module</span>
            <Dropdown value={module} onValueChange={(v) => { setModule(String(v)); setSubModule(""); }}
              options={heads.map((h) => ({ value: h, label: h }))} placeholder="Select or type…" searchable allowTextInput allowCustomInput size="md" /></div>
          <div style={fieldWrap}><span style={lbl}>Sub Module</span>
            <Dropdown value={subModule} onValueChange={(v) => setSubModule(String(v))}
              options={subsFor(module).map((n) => ({ value: n, label: n }))}
              placeholder={module ? "Select or type…" : "Select a module first"} searchable allowTextInput allowCustomInput size="md" disabled={!module} /></div>
          <div style={fieldWrap}><span style={lbl}>Category</span>
            <Dropdown value={category} onValueChange={(v) => setCategory(String(v))}
              options={categories.map((c) => ({ value: c.categoryName, label: c.categoryName }))} placeholder="— select —" size="md" /></div>
          <div style={fieldWrap}><span style={lbl}>Priority</span>
            <Dropdown value={priority} onValueChange={(v) => setPriority(String(v))}
              options={PRIORITIES.map((p) => ({ value: p, label: p }))} size="md" /></div>
          <div style={fieldWrap}><span style={lbl}>Complexity</span>
            <Dropdown value={complexity} onValueChange={(v) => setComplexity(String(v))}
              options={[{ value: "", label: "—" }, ...COMPLEXITIES.map((c) => ({ value: c, label: c }))]} placeholder="—" size="md" /></div>
          <div style={{ ...fieldWrap, gridColumn: "1 / -1" }}><span style={lbl}>Description *</span>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the issue / task…" /></div>

          {/* Attachments — view / add / remove the files that travel with this point */}
          <div style={{ ...fieldWrap, gridColumn: "1 / -1" }}><span style={lbl}>Attachment</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {attachments.length === 0 && <span style={{ fontSize: 12.5, color: "#94a3b8" }}>No files attached yet.</span>}
              {attachments.map((a) => (
                <span key={a.attachmentID} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 12.5 }}>
                  <Paperclip size={13} style={{ opacity: 0.55, flexShrink: 0 }} />
                  <a href={pmApi.attachmentDownloadUrl(a.attachmentID)} target="_blank" rel="noreferrer" style={{ color: "rgb(var(--color-primary))", textDecoration: "none", fontWeight: 600 }}>{a.originalFileName || a.fileName}</a>
                  <button type="button" onClick={async () => { await pmApi.deleteAttachment(a.attachmentID); refreshAtt(); }} title="Delete"
                    style={{ display: "inline-flex", alignItems: "center", border: "none", background: "transparent", cursor: "pointer", color: "#c0392b", padding: 0, lineHeight: 0 }}><Trash2 size={13} /></button>
                </span>
              ))}
              <input ref={fileRef} type="file" style={{ display: "none" }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f && point) { try { await pmApi.uploadAttachment(point.pointID, f, uploaderId); refreshAtt(); } finally { e.target.value = ""; } }
                }} />
              <Button variant="outline" size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>Upload file</Button>
            </div>
          </div>
          {err && <div style={{ gridColumn: "1 / -1", color: "#c0392b", fontSize: 12.5 }}>{err}</div>}
        </div>
      )}
    </StandardModal>
  );
}
