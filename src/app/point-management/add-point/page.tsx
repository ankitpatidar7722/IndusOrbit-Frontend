"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Page, Card, CardContent, Textarea, Button, Dropdown } from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { Plus, Check, Paperclip, X } from "lucide-react";
import { PmGuard } from "../PmGuard";
import { usePmContext } from "../PmContext";
import { PmHeader } from "../shared";
import { pmApi, type PmProduct, type PmCategory, type PmUser } from "@/lib/tms";
import { api, type KeylineModule } from "@/lib/api";
import { customersApi, type CustomerCard } from "@/lib/customers";

const PRIORITIES = ["High", "Medium", "Low"];
const COMPLEXITIES = ["Simple", "Medium", "Complex"];

// A /clients customer's Application → the matching TMS product name, and the reverse
// (product → the application(s) that map to it) for filtering the Customer dropdown by Product.
const APP_TO_PRODUCT: Record<string, string> = {
  desktop: "Indus Print Desktop",
  estimoprime: "Indus Print Web",
  multiunit: "Indus Print Web",
  printudeerp: "Printude ERP",
};
const PRODUCT_TO_APPS: Record<string, string[]> = {};
for (const [app, product] of Object.entries(APP_TO_PRODUCT)) (PRODUCT_TO_APPS[product] ??= []).push(app);

function AddPoint({ reportedById }: { reportedById: number }) {
  const router = useRouter();
  const [clients, setClients] = useState<CustomerCard[]>([]);   // Customer dropdown = the /clients companies
  const [products, setProducts] = useState<PmProduct[]>([]);
  const [categories, setCategories] = useState<PmCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // keyline Module / Sub Module catalog (same source as the client Change-Request form)
  const [keyline, setKeyline] = useState<KeylineModule[]>([]);
  const [users, setUsers] = useState<PmUser[]>([]);

  const [module, setModule] = useState("");
  const [subModule, setSubModule] = useState("");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");         // selected /clients company
  const [productID, setProductID] = useState<number | "">("");  // auto-mapped from the client's application
  const [category, setCategory] = useState("Bug");
  const [priority, setPriority] = useState("Medium");
  const [complexity, setComplexity] = useState("");
  const [reportedByID, setReportedByID] = useState<number>(reportedById); // defaults to the logged-in user
  const [files, setFiles] = useState<File[]>([]);  // attachments (image / excel / pdf / anything)

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    Promise.all([customersApi.list(), pmApi.products(), pmApi.categories(), pmApi.users(), api.keylineModules()])
      .then(([cl, p, cat, u, km]) => { setClients(cl); setProducts(p); setCategories(cat); setUsers(u); setKeyline(km.success ? km.data : []); })
      .finally(() => setLoading(false));
  }, []);

  const heads = Array.from(new Set(keyline.map((k) => k.head)));
  const subsFor = (h: string) => (h ? Array.from(new Set(keyline.filter((k) => k.head === h).map((k) => k.name))) : []);

  // Real /clients data has inconsistent casing/spacing in applicationName ("Multiunit" vs
  // "multi unit" vs "MultiUnit") — normalize before comparing against PRODUCT_TO_APPS' keys.
  const normApp = (a?: string | null) => (a ?? "").toLowerCase().replace(/\s+/g, "");

  // Selected Product → its allowed Application(s), then filter the Customer list down to only
  // clients on one of those applications (e.g. Indus Print Web → Estimoprime / Multiunit).
  const selectedProductName = productID ? products.find((p) => p.productID === productID)?.productName : undefined;
  const allowedApps = selectedProductName ? PRODUCT_TO_APPS[selectedProductName] ?? [] : undefined;
  const clientsForProduct = allowedApps
    ? clients.filter((c) => allowedApps.includes(normApp(c.applicationName)))
    : clients;
  // Unique client company names for the Customer dropdown (some codes repeat the same name).
  const clientNames = Array.from(new Set(clientsForProduct.map((c) => c.companyName).filter(Boolean)));

  // Product picked → clear any Customer selection that no longer matches its application filter.
  const pickProduct = (id: number | "") => {
    setProductID(id);
    if (!id) { setCustomerName(""); return; }
    const prodName = products.find((p) => p.productID === id)?.productName;
    const apps = prodName ? PRODUCT_TO_APPS[prodName] ?? [] : [];
    const cl = clients.find((c) => c.companyName === customerName);
    if (customerName && !apps.includes(normApp(cl?.applicationName))) setCustomerName("");
  };

  async function submit() {
    setMsg(null);
    if (!customerName || !module || !productID || !description.trim() || !reportedByID) {
      setMsg({ text: "Customer, Module, Product, Description and Reported By are required.", ok: false });
      return;
    }
    setSaving(true);
    try {
      const uploader = reportedByID || reportedById;
      const { pointId } = await pmApi.addPoint({
        description: description.trim(),
        module: module || undefined, subModule: subModule || undefined,
        customerID: 0, customerName, productID: Number(productID), reportedByID: uploader,
        priority, category, complexity: complexity || undefined,
      });
      // Upload any attachments to the freshly-created point.
      let attachFail = 0;
      for (const file of files) {
        try { await pmApi.uploadAttachment(pointId, file, uploader); } catch { attachFail++; }
      }
      if (attachFail === 0) {
        // Success → show the message briefly, then jump to Manage Points where the new point shows.
        setMsg({ text: `Point #${pointId} created — redirecting to the points grid…`, ok: true });
        setTimeout(() => router.push("/point-management/manage-points"), 1200);
        return;
      }
      // Point was created but some attachments failed — stay so the user sees it + can retry.
      setMsg({ text: `Point created, but ${attachFail} attachment(s) failed to upload.`, ok: false });
      setModule(""); setSubModule(""); setDescription(""); setCustomerName(""); setProductID(""); setComplexity("");
      setCategory("Bug"); setPriority("Medium"); setReportedByID(reportedById); setFiles([]);
    } catch (e) {
      setMsg({ text: String(e), ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <BrandedLoader size="lg" text="Loading…" />;

  return (
    <Page>
      <PmHeader page="add-point" />
      <Card>
        <CardContent>
          <div style={{ paddingTop: 22 }} />
          {msg && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px", borderRadius: 9, fontSize: 13.5,
              background: msg.ok ? "#eaf7ee" : "#fdecec", color: msg.ok ? "#1e7e46" : "#c0392b" }}>
              {msg.ok && <Check size={16} />} {msg.text}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <Field label="Product *">
              <Dropdown value={String(productID || "")} onValueChange={(v) => pickProduct(v ? Number(v) : "")}
                options={products.map((p) => ({ value: String(p.productID), label: p.productName }))}
                placeholder="— Select product —" searchable size="md" />
            </Field>
            <Field label="Customer *">
              <Dropdown value={customerName} onValueChange={(v) => setCustomerName(String(v))}
                options={clientNames.map((n) => ({ value: n, label: n }))}
                placeholder={productID ? "— Select customer —" : "Select a product first"} searchable size="md" disabled={!productID} />
            </Field>
            <Field label="Module *">
              <Dropdown value={module} onValueChange={(v) => { setModule(String(v)); setSubModule(""); }}
                options={heads.map((h) => ({ value: h, label: h }))} placeholder="— select —" searchable size="md" />
            </Field>
            <Field label="Sub Module">
              <Dropdown value={subModule} onValueChange={(v) => setSubModule(String(v))}
                options={subsFor(module).map((n) => ({ value: n, label: n }))}
                placeholder={module ? "— select —" : "Select a module first"} searchable size="md" disabled={!module} />
            </Field>
            <Field label="Category">
              <Dropdown value={category} onValueChange={(v) => setCategory(String(v))}
                options={categories.map((c) => ({ value: c.categoryName, label: c.categoryName }))} size="md" />
            </Field>
            <Field label="Priority">
              <Dropdown value={priority} onValueChange={(v) => setPriority(String(v))}
                options={PRIORITIES.map((p) => ({ value: p, label: p }))} size="md" />
            </Field>
            <Field label="Complexity">
              <Dropdown value={complexity} onValueChange={(v) => setComplexity(String(v))}
                options={[{ value: "", label: "—" }, ...COMPLEXITIES.map((c) => ({ value: c, label: c }))]} placeholder="—" size="md" />
            </Field>
          </div>
          <div style={{ marginTop: 16 }}>
            <Field label="Description *">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue / task…" rows={5} />
            </Field>
          </div>

          {/* Attachments — image / Excel / PDF / anything */}
          <div style={{ marginTop: 16 }}>
            <Field label="Attachment">
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 14px", border: "1px dashed #9fabbd", borderRadius: 9, background: "rgb(var(--bg-subtle))", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-muted))", width: "fit-content" }}>
                <Paperclip size={15} /> Choose files
                <input type="file" multiple hidden
                  onChange={(e) => { const list = Array.from(e.target.files ?? []); if (list.length) setFiles((p) => [...p, ...list]); e.currentTarget.value = ""; }} />
              </label>
              <span style={{ marginLeft: 10, fontSize: 12, color: "rgb(var(--fg-muted))" }}>Image, Excel, PDF — anything (max 50 MB each)</span>
              {files.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {files.map((f, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgb(var(--bg-subtle))", border: "1px solid #dbe2ea", borderRadius: 999, padding: "4px 8px 4px 12px", fontSize: 12.5, fontWeight: 600, color: "rgb(var(--fg-muted))" }}>
                      {f.name} <span style={{ opacity: 0.55, fontWeight: 500 }}>({fmtBytes(f.size)})</span>
                      <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#c0392b", display: "grid", placeItems: "center", padding: 0 }}><X size={13} /></button>
                    </span>
                  ))}
                </div>
              )}
            </Field>
          </div>

          {/* Reported By (defaults to the logged-in user, editable) */}
          <div style={{ marginTop: 16, maxWidth: 320 }}>
            <Field label="Reported By *">
              <Dropdown value={String(reportedByID || "")} onValueChange={(v) => setReportedByID(Number(v))}
                options={users.map((u) => ({ value: String(u.userID), label: u.fullName }))} placeholder="— select user —" searchable size="md" />
            </Field>
          </div>

          <div style={{ marginTop: 20 }}>
            <Button onClick={submit} disabled={saving}>
              <Plus size={16} style={{ marginRight: 6 }} /> {saving ? "Saving…" : "Create Point"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", fontWeight: 600, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function Page_() {
  const { ctx } = usePmContext();
  return (
    <PmGuard module="/point-management/add-point">
      {ctx ? <AddPoint reportedById={ctx.tmsUserId} /> : null}
    </PmGuard>
  );
}
