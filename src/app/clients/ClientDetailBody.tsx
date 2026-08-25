"use client";
import { useEffect, useState } from "react";
import { Tabs, Badge, Button, Dropdown } from "indas-ui";
import { Pencil, Building2, MapPin, CreditCard, Cloud, KeyRound, ShieldCheck, Rocket, Activity, FileCheck2, HardHat, X, Save, Wand2, Copy, Check, Eye, Download, FileText, FileDown, FileCode, FileSpreadsheet, CheckCircle2, Mail, type LucideIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { fetchClientTabPermissions, type TabPermMap } from "@/lib/clientTabPermissions";
import { clientDocsApi, type ClientDocType, type ClientDocMeta } from "@/lib/clientDocs";
import EmailHistoryCard from "@/components/email/EmailHistoryCard";
import { useEmailComposer } from "@/components/email/EmailComposerProvider";
import type { EmailAttachmentBase64 } from "@/lib/email";
import { customersApi, fmtDate, type CustomerDetail, type SubscriptionSave } from "@/lib/customers";
import { subscriptionVariant } from "@/lib/ui";
import { ModuleSettingsTab, ModuleGroupsTab, NewModuleTab } from "@/app/customers/ModuleManagerModal";
import MessageFormatPopup from "@/app/customers/MessageFormatPopup";
import DateField from "@/components/DateField";
import TrackerPanel from "./[code]/TrackerPanel";
import TemplateMasterPanel from "./TemplateMasterPanel";

// Theme tokens (indas-ui) — never hardcode colors (frontend-design skill rule #1).
const T = {
  surface: "rgb(var(--bg-surface))",
  subtle: "rgb(var(--bg-subtle))",
  fg: "rgb(var(--fg-default))",
  muted: "rgb(var(--fg-muted))",
  faint: "rgb(var(--fg-muted) / 0.55)",
  bd: "rgb(var(--bd-default))",
  primary: "rgb(var(--color-primary))",
  onPrimary: "#fff",
};

/** UTF-8 string → base64 (chunked so large documents don't blow the call stack). */
function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

/** One row in the Download (PDF / HTML) dropdown menu. */
const dlItemCss: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px",
  background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: T.fg,
  textAlign: "left", whiteSpace: "nowrap",
};

const APP_LABEL: Record<string, string> = { estimoprime: "Estimoprime", multiunit: "MultiUnit", printudeerp: "PrintudeERP", desktop: "Desktop" };
const appLabel = (a?: string | null) => (a ? APP_LABEL[a.toLowerCase()] ?? a : "—");
const APP_OPTIONS = ["estimoprime", "multiunit", "PrintudeERP"];
const STATUS_OPTIONS = ["Active", "Expired"];
const toDateInput = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : "");

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] || ch));

/** Fill the template's <span class="af">[[key]]</span> placeholders with escaped values. */
function fillTemplate(html: string, fields: [string, string][]): string {
  let out = html;
  for (const [k, v] of fields) out = out.split(`<span class="af">[[${k}]]</span>`).join(esc(v));
  return out;
}

/** Reflect live form state (checkbox/radio ticks, input values, textarea, select) into
 *  HTML attributes so the serialized document preserves what the user filled in. Without
 *  this, ticked checkboxes and typed <input> values are lost on serialization. */
function reflectFormState(doc: Document) {
  doc.querySelectorAll("input").forEach((el) => {
    const i = el as HTMLInputElement;
    if (i.type === "checkbox" || i.type === "radio") {
      if (i.checked) i.setAttribute("checked", ""); else i.removeAttribute("checked");
    } else {
      i.setAttribute("value", i.value);
    }
  });
  doc.querySelectorAll("textarea").forEach((el) => { const t = el as HTMLTextAreaElement; t.textContent = t.value; });
  doc.querySelectorAll("select").forEach((el) => {
    Array.from((el as HTMLSelectElement).options).forEach((o) => { if (o.selected) o.setAttribute("selected", ""); else o.removeAttribute("selected"); });
  });
}

/** Serialize a finalized, self-contained document: reflect form state, strip toolbars +
 *  scripts, disable editing. This clean HTML is what gets saved / viewed / downloaded. */
function cleanDocHtml(w: Window): string {
  reflectFormState(w.document);
  const root = w.document.documentElement.cloneNode(true) as HTMLElement;
  root.querySelectorAll(".indus-toolbar, .toolbar, script").forEach((e) => e.remove());
  root.querySelectorAll(".sheet").forEach((s) => s.removeAttribute("contenteditable"));
  return "<!doctype html>\n" + root.outerHTML;
}

/** Inject the in-window action bar (Save in edit mode + Print + Close) and set the sheet's
 *  editability. Removes the template's own toolbar so there's exactly one. */
function injectDocToolbar(w: Window, mode: "edit" | "view", onSave?: (btn: HTMLButtonElement) => void) {
  const doc = w.document;
  doc.querySelectorAll(".indus-toolbar, .toolbar").forEach((e) => e.remove());
  doc.querySelectorAll(".sheet").forEach((s) => {
    if (mode === "edit") s.setAttribute("contenteditable", "true"); else s.removeAttribute("contenteditable");
  });
  const style = doc.createElement("style");
  style.textContent = "@media print{.indus-toolbar{display:none !important;}}";
  doc.head?.appendChild(style);

  const bar = doc.createElement("div");
  bar.className = "indus-toolbar";
  bar.setAttribute("style", "position:sticky;top:0;z-index:99999;display:flex;gap:8px;justify-content:center;align-items:center;padding:10px 12px;background:#0f6a72;box-shadow:0 2px 10px rgba(0,0,0,.22);");
  const mk = (label: string, bg: string, fn: () => void) => {
    const b = doc.createElement("button");
    b.type = "button"; b.textContent = label;
    b.setAttribute("style", `cursor:pointer;border:none;border-radius:6px;padding:8px 16px;font:600 13px 'Segoe UI',system-ui,sans-serif;color:#fff;background:${bg};`);
    b.onclick = fn;
    return b;
  };
  if (mode === "edit" && onSave) {
    const saveBtn = mk("💾  Save Final Version", "#137a44", () => {});
    saveBtn.onclick = () => onSave(saveBtn);
    bar.appendChild(saveBtn);
  }
  bar.appendChild(mk("🖨️  Print / Save as PDF", "#0a4f55", () => w.print()));
  bar.appendChild(mk("✕  Close", "#5b6b73", () => w.close()));
  doc.body.insertBefore(bar, doc.body.firstChild);
}
const kickoffFields = (c: CustomerDetail): [string, string][] => [
  ["companyName", c.companyName ?? ""], ["city", c.city ?? ""], ["address", c.address ?? ""],
  ["gstin", c.gstin ?? ""], ["email", c.email ?? ""], ["mobile", c.mobile ?? ""],
  ["contact", c.mobile ?? ""], ["consultant", ""], ["segment", ""],
];
const signoffFields = (c: CustomerDetail): [string, string][] => [
  ["companyName", c.companyName ?? ""], ["city", c.city ?? ""], ["address", c.address ?? ""],
];

type FieldKind = "text" | "number" | "date" | "textarea" | "status" | "app" | "bool";
type FieldOpts = { full?: boolean; mono?: boolean; readOnly?: boolean; viewOnly?: boolean; copy?: boolean };

/** Small ghost icon-button that copies text to the clipboard (✓ feedback for 1.5s). */
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="xs" iconOnly icon={copied ? Check : Copy} tooltip={copied ? "Copied!" : "Copy"}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } }} />
  );
}

const labelCss: React.CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", display: "block", marginBottom: 5 };
const valueCss = (mono?: boolean): React.CSSProperties => ({ fontSize: 13.5, fontWeight: 600, color: T.fg, fontFamily: mono ? "monospace" : undefined, wordBreak: "break-word", lineHeight: 1.4 });
const fldInput: React.CSSProperties = { width: "100%", height: 38, padding: "0 11px", fontSize: 13.5, border: `1px solid ${T.bd}`, borderRadius: 8, background: T.surface, color: T.fg, outline: "none", boxSizing: "border-box" };
const fldArea: React.CSSProperties = { width: "100%", padding: "8px 11px", fontSize: 13.5, border: `1px solid ${T.bd}`, borderRadius: 8, background: T.surface, color: T.fg, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 };
const roInput: React.CSSProperties = { ...fldInput, background: T.subtle, color: T.muted };

/** One bordered section card: bg-subtle header band (icon + dark bold title) + field grid. */
function SectionCard({ icon: Icon, title, cols = 3, children }: { icon: LucideIcon; title: string; cols?: number; children: React.ReactNode }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.bd}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", background: T.subtle, borderBottom: `1px solid ${T.bd}` }}>
        <Icon size={15} style={{ color: T.primary }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.fg, letterSpacing: 0.4, textTransform: "uppercase" }}>{title}</span>
      </div>
      <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: "16px 24px" }}>
        {children}
      </div>
    </div>
  );
}

const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "company", label: "Company Detail", icon: Building2 },
  { id: "authority", label: "Module Authority", icon: ShieldCheck },
  { id: "kickoff", label: "Kick-Off", icon: Rocket },
  { id: "tracker", label: "Tracker", icon: Activity },
  { id: "templates", label: "Template Master Excel", icon: FileSpreadsheet },
  { id: "signoff", label: "Sign-Off", icon: FileCheck2 },
  { id: "onsite", label: "Onsite Management", icon: HardHat },
];
const SUB_TABS = [
  { id: "settings", label: "Module Settings" },
  { id: "groups", label: "Module Group Authority" },
  { id: "newmodule", label: "New Module Addition" },
];

/**
 * Full client detail UI (Parkson `frontend-design` skill). Each form section is a
 * bordered card with a dark, legible header. **Edit is IN-PLACE** — the Company Detail
 * tab's cards flip to editable inputs (no second modal); Save persists via customersApi.
 */
export default function ClientDetailBody({ id, onClose, onChanged, inModal = false }: { id: string; onClose: () => void; onChanged?: () => void; inModal?: boolean }) {
  const { data: session } = useSession();
  const { openComposer } = useEmailComposer();
  const [c, setC] = useState<CustomerDetail | null>(null);
  const [tab, setTab] = useState("company");
  const [subTab, setSubTab] = useState("settings");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [emailRefresh] = useState(0);
  // Saved Kick-Off / Sign-Off finalized-document status (drives the tab badges + View/Download).
  const [docMeta, setDocMeta] = useState<ClientDocMeta[]>([]);
  // Which doc's Download menu (PDF / HTML) is open, if any.
  const [dlMenu, setDlMenu] = useState<ClientDocType | null>(null);

  // In-place edit state
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<SubscriptionSave>({});
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [msgPopup, setMsgPopup] = useState(false);
  // Per-user tab permissions (view/edit). Empty until loaded → default view-all / edit-none.
  const [perms, setPerms] = useState<TabPermMap>({});

  useEffect(() => {
    setC(null); setErr(null); setTab("company"); setEditing(false);
    if (id) customersApi.detail(id).then(setC).catch((e) => setErr(String(e)));
  }, [id]);
  // Load the acting user's client-tab permissions once the session is known.
  useEffect(() => {
    const uid = (session?.user as { UserID?: number } | undefined)?.UserID;
    fetchClientTabPermissions(uid).then(setPerms);
  }, [session]);
  // If the active tab isn't viewable for this user, jump to the first viewable tab.
  useEffect(() => {
    const vis = TABS.filter((t) => perms[t.id]?.canView ?? true);
    if (vis.length && !vis.some((t) => t.id === tab)) setTab(vis[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perms]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);
  // Load saved-document status whenever the client changes.
  useEffect(() => {
    const code = c?.companyUniqueCode || c?.companyUserID;
    if (!code) { setDocMeta([]); return; }
    clientDocsApi.meta(code).then((r) => setDocMeta(r?.success ? (r.data || []) : [])).catch(() => {});
  }, [c?.companyUniqueCode, c?.companyUserID]);

  const set = (k: keyof SubscriptionSave, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const startEdit = () => { if (!c) return; setF({ ...c, originalCompanyUserID: c.companyUserID }); setFormErr(null); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setFormErr(null); };
  async function save() {
    if (!f.companyName?.trim()) { setFormErr("Client Name is required."); return; }
    if (!f.companyUserID?.trim()) { setFormErr("Company Login Name is required."); return; }
    if (/\s/.test(f.companyUserID)) { setFormErr("Login Name must not contain spaces."); return; }
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) { setFormErr("Enter a valid email."); return; }
    if (f.mobile && !/^\d+$/.test(String(f.mobile))) { setFormErr("Mobile must be numeric."); return; }
    setSaving(true); setFormErr(null);
    try {
      const res = await customersApi.update(f);
      if (res.success) {
        const fresh = await customersApi.detail(id);
        setC(fresh);
        setEditing(false);
        setFlash(res.message);
        onChanged?.();
      } else {
        setFormErr(res.message);
      }
    } catch (e) {
      setFormErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  const shell = (inner: React.ReactNode) =>
    inModal
      ? <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: T.subtle }}>{inner}</div>
      : <div>{inner}</div>;

  if (err) return shell(<div style={{ color: "rgb(var(--color-error))", padding: 24 }}>{err}</div>);
  if (!c) return shell(<div style={{ padding: 60, textAlign: "center", color: T.muted, fontSize: 14 }}>Loading client…</div>);

  const conn = c.conn_String ?? "";
  const app = c.applicationName ?? "";
  const trackerCode = c.companyUniqueCode ?? c.companyUserID;

  // Tab permission helpers (default while loading: view yes, edit no).
  const canView = (tabId: string) => perms[tabId]?.canView ?? true;
  const canEdit = (tabId: string) => perms[tabId]?.canEdit ?? false;
  const visibleTabs = TABS.filter((t) => canView(t.id));

  // ── Finalized Kick-Off / Sign-Off documents (edit → save → view/download) ──
  const docClientCode = c.companyUniqueCode || c.companyUserID;
  const sUser = (session?.user ?? {}) as { name?: string; UserID?: number };
  const docMetaFor = (t: ClientDocType) => docMeta.find((m) => m.docType === t) || null;
  const refreshDocMeta = () => {
    if (!docClientCode) return;
    clientDocsApi.meta(docClientCode).then((r) => setDocMeta(r?.success ? (r.data || []) : [])).catch(() => {});
  };

  const fetchFilledTemplate = async (docType: ClientDocType): Promise<string> => {
    const res = await fetch(docType === "SignOff" ? "/signoff.html" : "/kickoff.html", { cache: "no-store" });
    const html = await res.text();
    return fillTemplate(html, docType === "SignOff" ? signoffFields(c) : kickoffFields(c));
  };

  const saveFromWindow = async (w: Window, docType: ClientDocType, btn: HTMLButtonElement) => {
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const res = await clientDocsApi.save({
        clientCode: docClientCode, docType, htmlContent: cleanDocHtml(w),
        savedByUserId: sUser.UserID ?? null, savedByName: sUser.name ?? null,
      });
      if (res?.success) {
        btn.textContent = "✓ Saved"; btn.style.background = "#0a7d3c";
        refreshDocMeta();
        setFlash(`${docType === "SignOff" ? "Sign-Off" : "Kick-Off"} document saved.`);
        setTimeout(() => { try { btn.textContent = orig; btn.style.background = "#137a44"; btn.disabled = false; } catch { /* window closed */ } }, 2200);
      } else {
        btn.textContent = orig; btn.disabled = false;
        try { w.alert("Save failed: " + (res?.message || "unknown error")); } catch { /* window closed */ }
      }
    } catch (e) {
      btn.textContent = orig; btn.disabled = false;
      try { w.alert("Save failed: " + e); } catch { /* window closed */ }
    }
  };

  /** Open the document in a new window. mode "edit" = editable (continues from the saved
   *  final version if one exists, else the filled template) with a Save button; mode "view"
   *  = the saved final version, read-only. */
  const openDocWindow = (mode: "edit" | "view", docType: ClientDocType) => {
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to open the document."); return; }
    try {
      w.document.open();
      w.document.write('<!doctype html><meta charset="utf-8"><title>Loading…</title><body style="margin:0;font:14px \'Segoe UI\',system-ui,sans-serif;color:#556;display:grid;place-items:center;height:100vh">Loading document…</body>');
      w.document.close();
    } catch { /* ignore */ }
    (async () => {
      let html: string;
      try {
        if (mode === "view") {
          const r = await clientDocsApi.get(docClientCode, docType);
          if (!r?.success || !r.data) { try { w.close(); } catch { /* */ } setFlash("No saved document to view."); return; }
          html = r.data.htmlContent;
        } else if (docMetaFor(docType)) {
          const r = await clientDocsApi.get(docClientCode, docType);
          html = r?.success && r.data ? r.data.htmlContent : await fetchFilledTemplate(docType);
        } else {
          html = await fetchFilledTemplate(docType);
        }
      } catch (e) {
        try { w.close(); } catch { /* */ }
        alert("Failed to open document: " + e);
        return;
      }
      try { w.document.open(); w.document.write(html); w.document.close(); } catch { /* */ }
      setTimeout(() => {
        try {
          injectDocToolbar(w, mode, mode === "edit" ? (btn) => saveFromWindow(w, docType, btn) : undefined);
          w.focus();
        } catch { /* window closed */ }
      }, 0);
    })();
  };

  const downloadSavedDoc = async (docType: ClientDocType) => {
    try {
      const r = await clientDocsApi.get(docClientCode, docType);
      if (!r?.success || !r.data) { setFlash("No saved document to download."); return; }
      const blob = new Blob([r.data.htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = String(r.data.updatedAt || r.data.savedAt || "").slice(0, 10);
      a.href = url; a.download = `${docType}_${docClientCode}${stamp ? "_" + stamp : ""}.html`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { setFlash("Download failed: " + e); }
  };

  /** Download as PDF: open the saved document and trigger the print dialog. The document's
   *  own A4 print styling makes "Save as PDF" (the default print destination) produce a clean,
   *  vector, multi-page PDF — far better quality than client-side HTML→PDF rasterizing. */
  const downloadPdf = (docType: ClientDocType) => {
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to download the PDF."); return; }
    try {
      w.document.open();
      w.document.write('<!doctype html><meta charset="utf-8"><title>Preparing PDF…</title><body style="margin:0;font:14px \'Segoe UI\',system-ui,sans-serif;color:#556;display:grid;place-items:center;height:100vh">Preparing PDF… (choose <b>&nbsp;Save as PDF&nbsp;</b> in the print dialog)</body>');
      w.document.close();
    } catch { /* ignore */ }
    (async () => {
      try {
        const r = await clientDocsApi.get(docClientCode, docType);
        if (!r?.success || !r.data) { try { w.close(); } catch { /* */ } setFlash("No saved document to download."); return; }
        w.document.open(); w.document.write(r.data.htmlContent); w.document.close();
        setTimeout(() => { try { w.focus(); w.print(); } catch { /* */ } }, 500);
      } catch (e) {
        try { w.close(); } catch { /* */ }
        setFlash("PDF download failed: " + e);
      }
    })();
  };

  /** Email the finalized Kick-Off / Sign-Off document to the client (opens the composer to review + send). */
  const emailDoc = async (docType: ClientDocType, label: string) => {
    try {
      const r = await clientDocsApi.get(docClientCode, docType);
      if (!r?.success || !r.data) { setFlash(`Please save a finalized ${label} version first.`); return; }
      const safe = `${label.replace(/[^a-z0-9]+/gi, "-")}-${docClientCode}`;
      // Prefer a real PDF (server renders the saved doc via a headless browser); fall back to HTML.
      setFlash("Preparing document…");
      let attachment: EmailAttachmentBase64;
      const pdf = await clientDocsApi.pdf(docClientCode, docType);
      if (pdf) {
        attachment = { filename: `${safe}.pdf`, content: pdf.base64, contentType: "application/pdf", size: pdf.size };
      } else {
        const html = r.data.htmlContent;
        attachment = { filename: `${safe}.html`, content: utf8ToBase64(html), contentType: "text/html", size: new TextEncoder().encode(html).length };
      }
      setFlash(null);
      const client = c.companyName || docClientCode;
      const me = (session?.user as { name?: string } | undefined)?.name ?? "Indus Analytics";
      openComposer({
        to: c.email ? [{ email: c.email, name: client }] : [],
        subject: `${label} Document — ${client}`,
        body: `Dear ${client},\n\nPlease find attached the ${label} document for your reference. Kindly review and let us know if any changes are required.\n\nRegards,\n${me}`,
        attachments: [attachment],
        context: { clientCode: docClientCode, clientName: c.companyName ?? undefined, module: label },
        onSent: () => setFlash(`${label} document emailed to the client.`),
      });
    } catch (e) {
      setFlash("Could not prepare the email: " + e);
    }
  };

  /** The action bar shown above the Kick-Off / Sign-Off checklist. */
  const renderDocBar = (docType: ClientDocType, label: string) => {
    const meta = docMetaFor(docType);
    const editable = canEdit(docType === "SignOff" ? "signoff" : "kickoff");
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 2, marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
          {meta ? (
            <>
              <CheckCircle2 size={14} style={{ color: "#0a7d3c", flexShrink: 0 }} />
              <span style={{ color: T.muted }}>
                Final version saved <b style={{ color: T.fg }}>{fmtDate(meta.updatedAt || meta.savedAt)}</b>
                {meta.savedByName ? <> · by <b style={{ color: T.fg }}>{meta.savedByName}</b></> : null}
              </span>
            </>
          ) : (
            <span style={{ color: T.faint }}>No finalized {label} version saved yet</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {editable
            ? <Button variant="outline" size="sm" icon={FileText} onClick={() => openDocWindow("edit", docType)}>Open Document (Edit &amp; Save)</Button>
            : <Button variant="outline" size="sm" icon={Eye} onClick={() => openDocWindow("view", docType)}>Open Document (View)</Button>}
          {meta && <Button variant="outline" size="sm" icon={Eye} onClick={() => openDocWindow("view", docType)}>View Saved</Button>}
          {meta && (
            <div style={{ position: "relative" }}>
              <Button variant="outline" size="sm" icon={Download} onClick={() => setDlMenu(dlMenu === docType ? null : docType)}>Download ▾</Button>
              {dlMenu === docType && (
                <>
                  <div onClick={() => setDlMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)", zIndex: 41, background: T.surface, border: `1px solid ${T.bd}`, borderRadius: 9, boxShadow: "0 10px 30px rgba(0,0,0,.16)", overflow: "hidden", minWidth: 184 }}>
                    <button onClick={() => { setDlMenu(null); downloadPdf(docType); }} style={dlItemCss}><FileDown size={15} style={{ color: "#c0392b" }} /> Download as PDF</button>
                    <button onClick={() => { setDlMenu(null); downloadSavedDoc(docType); }} style={{ ...dlItemCss, borderTop: `1px solid ${T.bd}` }}><FileCode size={15} style={{ color: T.primary }} /> Download as HTML</button>
                  </div>
                </>
              )}
            </div>
          )}
          {meta && <Button variant="outline" size="sm" icon={Mail} onClick={() => emailDoc(docType, label)}>Email to Client</Button>}
        </div>
      </div>
    );
  };

  // Field cell — renders a read-only value (view) or an input bound to the draft (edit).
  const fld = (label: string, key: keyof SubscriptionSave, kind: FieldKind = "text", opts: FieldOpts = {}) => {
    const box = (inner: React.ReactNode) => (
      <div key={String(key)} style={{ gridColumn: opts.full ? "1 / -1" : undefined, minWidth: 0 }}>
        <label style={labelCss}>{label}</label>
        {inner}
      </div>
    );
    const cv = c[key as keyof CustomerDetail] as React.ReactNode;

    if (!editing || opts.viewOnly) {
      const empty = cv == null || String(cv).trim() === "";
      if (kind === "status") return box(cv ? <Badge variant={subscriptionVariant(String(cv))}>{cv}</Badge> : <div style={{ ...valueCss(), color: T.faint }}>—</div>);
      if (kind === "date") return box(<div style={valueCss()}>{fmtDate(cv as string)}</div>);
      if (kind === "bool") return box(<div style={valueCss()}>{cv == null ? <span style={{ color: T.faint }}>—</span> : cv ? "Yes" : "No"}</div>);
      if (kind === "app") return box(<div style={valueCss()}>{empty ? <span style={{ color: T.faint }}>—</span> : appLabel(c.applicationName)}</div>);
      if (opts.copy && !empty) return box(
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ ...valueCss(opts.mono), flex: 1, minWidth: 0, wordBreak: "break-all", whiteSpace: opts.full ? "pre-wrap" : undefined }}>{cv}</div>
          <CopyBtn text={String(cv)} />
        </div>
      );
      return box(<div style={{ ...valueCss(opts.mono), color: empty ? T.faint : T.fg }}>{empty ? "—" : cv}</div>);
    }

    const fv = f[key];
    // Dropdowns include the current saved value so an edit always pre-selects it (even off-list).
    if (kind === "status") return box(<Dropdown value={(fv as string) ?? ""} onValueChange={(v) => set(key, String(v))} options={Array.from(new Set([...STATUS_OPTIONS, ...(fv ? [String(fv)] : [])])).map((o) => ({ value: o, label: o }))} placeholder="Select…" searchable size="md" />);
    if (kind === "app") return box(<Dropdown value={(fv as string) ?? ""} onValueChange={(v) => set(key, String(v))} options={Array.from(new Set([...APP_OPTIONS, ...(fv ? [String(fv)] : [])])).map((o) => ({ value: o, label: o }))} placeholder="Select…" searchable size="md" />);
    if (kind === "date") return box(<DateField value={fv as string | undefined} onChange={(v) => set(key, v)} />);
    if (kind === "textarea") return box(<textarea value={(fv as string) ?? ""} onChange={(e) => set(key, e.target.value)} rows={2} style={fldArea} />);
    if (kind === "bool") return box(
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 38, cursor: "pointer" }}>
        <input type="checkbox" checked={!!fv} onChange={(e) => set(key, e.target.checked)} style={{ width: 16, height: 16, accentColor: "rgb(var(--color-primary))" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: T.fg }}>{fv ? "On" : "Off"}</span>
      </label>
    );
    if (kind === "number") return box(<input type="number" value={(fv as number | string | undefined) ?? ""} onChange={(e) => set(key, Number(e.target.value))} style={fldInput} />);
    return box(<input type="text" value={(fv as string) ?? ""} onChange={(e) => set(key, e.target.value)} readOnly={opts.readOnly} style={opts.readOnly ? roInput : fldInput} />);
  };

  const actions = editing ? (
    <>
      <Button variant="action-cancel" size="sm" onClick={cancelEdit}>Cancel</Button>
      <Button variant="action-save" size="sm" icon={Save} loading={saving} onClick={save}>Save Changes</Button>
    </>
  ) : (
    canEdit("company")
      ? <Button variant="action-edit" size="sm" icon={Pencil} onClick={startEdit}>Edit</Button>
      : <span style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 5 }}><Eye size={13} /> View only</span>
  );

  // Header — Parkson-style: subtle gradient bar, avatar + bold dark name + muted subtitle + status + close.
  const header = (
    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 14, padding: "13px 22px", background: "linear-gradient(to right, rgb(var(--bg-subtle)), rgb(var(--bg-surface)))", borderBottom: `1px solid ${T.bd}`, ...(inModal ? {} : { borderRadius: 12, border: `1px solid ${T.bd}`, marginBottom: 14 }) }}>
      <div style={{ width: 44, height: 44, borderRadius: 11, background: T.primary, color: T.onPrimary, display: "grid", placeItems: "center", fontSize: 19, fontWeight: 700, flexShrink: 0 }}>{c.companyName[0]}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.fg, lineHeight: 1.2 }}>{c.companyName}</div>
        <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>
          <span style={{ fontFamily: "monospace", fontWeight: 600, color: T.primary }}>{c.companyUniqueCode || "—"}</span>
          {c.city ? ` · ${c.city}` : ""} · {appLabel(c.applicationName)}{c.applicationVersion ? ` v${c.applicationVersion}` : ""}
        </div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <Badge variant={subscriptionVariant(c.subscriptionStatus)}>{c.subscriptionStatus ?? "—"}</Badge>
        <Button variant="ghost" size="sm" iconOnly icon={X} tooltip="Close" onClick={onClose} />
      </div>
    </div>
  );

  const tabsBar = (
    <div style={{ flexShrink: 0, padding: inModal ? "12px 22px 0" : "0", background: inModal ? T.surface : undefined, borderBottom: inModal ? `1px solid ${T.bd}` : undefined }}>
      <Tabs tabs={visibleTabs} activeTab={tab} onTabChange={setTab} variant="pill" size="md" fullWidth />
    </div>
  );

  const body = (
    <div style={inModal ? { flex: 1, minHeight: 0, overflow: "auto", padding: "18px 22px 26px" } : { marginTop: 16 }}>
      {flash && (
        <div style={{ background: "color-mix(in srgb, rgb(var(--color-success)) 12%, rgb(var(--bg-surface)))", color: "rgb(var(--color-success))", border: `1px solid color-mix(in srgb, rgb(var(--color-success)) 35%, transparent)`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, fontWeight: 600 }}>✓ {flash}</div>
      )}

      {tab === "company" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: editing ? T.primary : "transparent" }}>{editing ? "Editing — make your changes and Save" : ""}</div>
            <div style={{ display: "flex", gap: 8 }}>{actions}</div>
          </div>
          {formErr && <div style={{ color: "rgb(var(--color-error))", fontSize: 12.5, fontWeight: 600, marginTop: -4 }}>{formErr}</div>}

          <SectionCard icon={Building2} title="Client Information" cols={3}>
            {fld("Client Code", "companyUniqueCode", "text", { mono: true, readOnly: true })}
            {fld("Client Name", "companyName")}
            {fld("Company Code", "companyCode")}
            {fld("Application", "applicationName", "app")}
            {fld("Application Version", "applicationVersion")}
            {fld("GSTIN", "gstin", "text", { mono: true })}
          </SectionCard>

          <SectionCard icon={MapPin} title="Address & Contact" cols={3}>
            {fld("Address", "address", "textarea", { full: true })}
            {fld("City", "city")}
            {fld("State", "state")}
            {fld("Country", "country")}
            {fld("Email", "email")}
            {fld("Mobile", "mobile")}
            {fld("F-Year", "fYear")}
          </SectionCard>

          <SectionCard icon={CreditCard} title="ERP Subscription" cols={4}>
            {fld("Status", "subscriptionStatus", "status")}
            {fld("From Date", "fromDate", "date")}
            {fld("To Date", "toDate", "date")}
            {fld("Payment Due", "paymentDueDate", "date")}
            {fld("Login Allowed", "loginAllowed", "number")}
            {fld("Message Active", "isMessageActive", "bool")}
            {fld("Status Description", "statusDescription", "text", { full: true })}
            {editing && f.isMessageActive ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label style={{ ...labelCss, marginBottom: 0 }}>ERP Message</label>
                  <Button variant="ghost" size="xs" icon={Wand2} onClick={() => setMsgPopup(true)}>Format Message</Button>
                </div>
                <textarea value={f.subscriptionStatusMessage ?? ""} onChange={(e) => set("subscriptionStatusMessage", e.target.value)} rows={2} style={fldArea} />
              </div>
            ) : (!editing && c.subscriptionStatusMessage ? fld("ERP Message", "subscriptionStatusMessage", "text", { full: true }) : null)}
          </SectionCard>

          <SectionCard icon={Cloud} title="Cloud Subscription" cols={4}>
            {fld("Cloud Status", "cloudSubscriptionStatus", "status")}
            {fld("Cloud From", "cloudFromDate", "date")}
            {fld("Cloud To", "cloudToDate", "date")}
            {fld("Cloud Payment Due", "cloudPaymentDueDate", "date")}
          </SectionCard>

          <SectionCard icon={KeyRound} title="Login & Access" cols={3}>
            {fld("Company Login Name", "companyUserID", "text", { mono: true, copy: true })}
            {fld("Password", "password", "text", { mono: true, copy: true })}
            {fld("Last Login", "lastLoginDateTime", "date", { viewOnly: true })}
            {fld("Application URL", "applicationBaseURL", "text", { full: true, mono: true, viewOnly: true, copy: true })}
            {fld("Connection String", "conn_String", "textarea", { full: true, copy: true })}
          </SectionCard>

          {!editing && <EmailHistoryCard clientCode={c.companyUniqueCode ?? undefined} refreshKey={emailRefresh} />}
        </div>
      )}

      {tab === "authority" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Tabs tabs={SUB_TABS} activeTab={subTab} onTabChange={setSubTab} variant="rounded" size="sm" />
          </div>
          {!canEdit("authority") && <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Eye size={13} /> View only — you can browse module authority but not change it.</div>}
          <div style={!canEdit("authority") ? { pointerEvents: "none", opacity: 0.92 } : undefined}>
            {subTab === "settings" && <ModuleSettingsTab app={app} connStr={conn} onFlash={setFlash} source={c} />}
            {subTab === "groups" && <ModuleGroupsTab app={app} connStr={conn} onFlash={setFlash} />}
            {subTab === "newmodule" && <NewModuleTab app={app} connStr={conn} onFlash={setFlash} />}
          </div>
        </div>
      )}
      {tab === "kickoff" && (
        <div>
          {renderDocBar("KickOff", "Kick-Off")}
        </div>
      )}
      {tab === "tracker" && <TrackerPanel code={trackerCode} view="tracker" clientEmail={c.email} clientName={c.companyName} clientCode={c.companyUniqueCode} clientApplication={c.applicationName} canEdit={canEdit("tracker")} />}
      {tab === "templates" && <TemplateMasterPanel client={c} canEdit={canEdit("templates")} />}
      {tab === "signoff" && (
        <div>
          {renderDocBar("SignOff", "Sign-Off")}
        </div>
      )}
      {tab === "onsite" && <TrackerPanel code={trackerCode} view="onsite" clientEmail={c.email} clientName={c.companyName} clientCode={c.companyUniqueCode} canEdit={canEdit("onsite")} />}

      <MessageFormatPopup
        visible={msgPopup}
        onClose={() => setMsgPopup(false)}
        onLoadMessage={(title, content) => setF((prev) => ({ ...prev, statusDescription: title, subscriptionStatusMessage: content }))}
      />
    </div>
  );

  return shell(<>{header}{tabsBar}{body}</>);
}
