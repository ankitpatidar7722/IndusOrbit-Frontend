"use client";
import { useEffect, useState } from "react";
import { Tabs, Badge, Button, Dropdown, Switch, useDevice } from "indas-ui";
import { countryNames, stateNames, cityNames, useLocationData } from "@/lib/location";
import { Pencil, Building2, MapPin, CreditCard, Cloud, KeyRound, ShieldCheck, Rocket, Activity, FileCheck2, HardHat, X, Save, Wand2, Copy, Check, Eye, Download, FileText, FileDown, FileCode, FileSpreadsheet, CheckCircle2, Mail, History, type LucideIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { fetchClientTabPermissions, type TabPermMap } from "@/lib/clientTabPermissions";
import { clientDocsApi, type ClientDocType, type ClientDocMeta, type ClientDocHistoryItem } from "@/lib/clientDocs";
import EmailHistoryCard from "@/components/email/EmailHistoryCard";
import { useEmailComposer } from "@/components/email/EmailComposerProvider";
import type { EmailAttachmentBase64 } from "@/lib/email";
import { customersApi, fmtDate, type CustomerDetail, type SubscriptionSave, type ClientExceed, type ExceedHistoryRow, type SignoffData } from "@/lib/customers";
import { fetchUserPermissions } from "@/lib/featurePermissions";
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

/** "05 Sep 2026, 3:57 PM" for the document Save/Email audit history. */
const fmtHistoryDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
};

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
  root.querySelectorAll(".indus-toolbar, .toolbar, .indus-addrow, .indus-delcol, .indus-delcell, .indus-msctl, script").forEach((e) => e.remove());
  // Replace <input type="date"> with plain DD-MM-YYYY text. Native date inputs render in the
  // browser's locale (MM/DD/YYYY on the print server), so we bake the value as fixed DD-MM-YYYY
  // text — consistent on print/PDF regardless of machine locale. Operates on the clone only, so
  // the live editing window keeps its pickers.
  root.querySelectorAll('input[type="date"]').forEach((el) => {
    const inp = el as HTMLInputElement;
    const iso = inp.getAttribute("value") || "";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    const span = w.document.createElement("span");
    if (inp.className) span.className = inp.className;
    if (inp.id) span.id = inp.id;
    span.textContent = m ? `${m[3]}-${m[2]}-${m[1]}` : "";
    inp.replaceWith(span);
  });
  // Strip ALL contenteditable (the sheet + any template-lock islands) so the saved HTML is clean
  // and the per-user lock is re-applied fresh on the next open (never baked into the document).
  root.querySelectorAll("[contenteditable]").forEach((s) => s.removeAttribute("contenteditable"));
  // Drop the embedded name→mobile lookup map (only needed live, for the §8 Support Contact sync).
  root.querySelectorAll("[data-mobiles]").forEach((s) => s.removeAttribute("data-mobiles"));
  return "<!doctype html>\n" + root.outerHTML;
}

/** Patch the Sign-Off document Version wherever it appears (running header + §1 "Document Version"
 *  row) so a reopened saved doc reflects the current send revision instead of the value baked in at
 *  save time. fillTemplate replaces each `<span class="af">[[…]]</span>` with plain text, so the
 *  saved version is a bare text node — we locate it structurally (never by a marker class). */
function patchDocVersion(doc: Document, version: string) {
  // "Document Version" (Sign-Off) / "Version" (Kick-Off) row — set the value cell (an .af span if
  // present, else its plain text).
  doc.querySelectorAll("td.k").forEach((td) => {
    const label = (td.textContent || "").trim().toLowerCase();
    if (label === "document version" || label === "version") {
      const cell = td.nextElementSibling as HTMLElement | null;
      if (!cell) return;
      const span = cell.querySelector(".af") as HTMLElement | null;
      if (span) span.textContent = version; else cell.textContent = version;
    }
  });
  // Running header "… Version: <value>" — the value trails the last <b>Version:</b>. Replace the
  // last .af span if present, else the last non-empty text node (leaving Document Code untouched).
  const hd = doc.querySelector(".hd-2");
  if (hd) {
    const afs = hd.querySelectorAll(".af");
    if (afs.length) {
      afs[afs.length - 1].textContent = version;
    } else {
      const kids = Array.from(hd.childNodes);
      for (let i = kids.length - 1; i >= 0; i--) {
        const n = kids[i];
        if (n.nodeType === 3 && (n.textContent || "").trim().length > 0) { n.textContent = " " + version; break; }
      }
    }
  }
}

/** Show a prominent, auto-dismissing banner at the top of a document window (used for Save
 *  success / failure). The doc opens in its own window so the main-app toast is hidden behind it. */
function showDocBanner(w: Window, message: string, bg: string) {
  const doc = w.document;
  doc.getElementById("indus-doc-banner")?.remove();
  const el = doc.createElement("div");
  el.id = "indus-doc-banner";
  el.textContent = message;
  el.setAttribute("style",
    `position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;` +
    `background:${bg};color:#fff;font:700 14px 'Segoe UI',system-ui,sans-serif;` +
    `padding:12px 22px;border-radius:10px;box-shadow:0 8px 26px rgba(0,0,0,.28);` +
    `max-width:92vw;text-align:center;`);
  doc.body.appendChild(el);
  w.setTimeout(() => { try { el.remove(); } catch { /* window closed */ } }, 4200);
}

/** Inject the in-window action bar (Save in edit mode + Print + Close) and set the sheet's
 *  editability. Removes the template's own toolbar so there's exactly one. */
function injectDocToolbar(w: Window, mode: "edit" | "view", onSave?: (btn: HTMLButtonElement) => void, lockTemplate = false) {
  const doc = w.document;
  doc.querySelectorAll(".indus-toolbar, .toolbar").forEach((e) => e.remove());
  doc.querySelectorAll(".sheet").forEach((s) => {
    if (mode === "edit") s.setAttribute("contenteditable", "true"); else s.removeAttribute("contenteditable");
  });
  // Template authority: regular users may fill DATA but NOT edit the FIXED template. Editable only
  // with "Can Edit Signoff Template". Locks section/point headings, sub-headings, column headers,
  // field labels, instructional text, S.N. + module names/departments (§3), S.N. + deliverable /
  // go-live-checklist items (§4), S.N. + report names (§5), §7 declaration statements, §9 feedback
  // evaluation-area names, letterhead & footer. Data cells (td.fill, user-name/signature) and form
  // controls stay editable. (§9 rating checkboxes are display-only for EVERYONE, via CSS pointer-events.)
  if (mode === "edit" && lockTemplate) {
    const FIXED = "h2.sec, h3.sub, tr.h td, th, td.k, p.note, .cover-title, .prep, .conf, .toc td, .lh, .foot, .mod td:nth-child(1), .mod td:nth-child(2), .mod td:nth-child(3), .lkcells td, .lkcol2 td:nth-child(1), .lkcol2 td:nth-child(2), .lkcol12 td:nth-child(1), .lkcol12 td:nth-child(2), .rate td.area, .sig td";
    doc.querySelectorAll(FIXED).forEach((el) => el.setAttribute("contenteditable", "false"));
  }
  const style = doc.createElement("style");
  style.textContent = "@media print{.indus-toolbar{display:none !important;}}"
    // "View Saved" is strictly read-only: freeze every form control (checkboxes / selects / inputs)
    // so nothing in the document can be changed — it's for viewing + Print/PDF only.
    + (mode === "view" ? " .sheet input,.sheet select,.sheet textarea{pointer-events:none !important;}" : "");
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
  // Print / Save as PDF → render the current doc to a CLEAN server PDF (no browser date/title/URL
  // headers). The viewer tab is opened SYNCHRONOUSLY (within the click gesture) so it isn't
  // popup-blocked, then navigated to the PDF once ready. If the popup is blocked the PDF is
  // downloaded instead; if the server has no renderer it falls back to the browser's own print.
  const printBtn = mk("🖨️  Print / Save as PDF", "#0a4f55", () => {});
  printBtn.onclick = async () => {
    const orig = printBtn.textContent;
    printBtn.disabled = true; printBtn.textContent = "⏳  Preparing…";
    let pv: Window | null = null;
    try { pv = w.open("", "_blank"); } catch { pv = null; }
    if (pv) { try { pv.document.write('<!doctype html><meta charset="utf-8"><title>PDF</title><body style="margin:0;font:14px \'Segoe UI\',system-ui,sans-serif;display:grid;place-items:center;height:100vh;color:#5b6b73">Preparing clean PDF…</body>'); } catch { /* */ } }
    try {
      const blob = await clientDocsApi.renderPdfFromHtml(cleanDocHtml(w));
      if (blob) {
        const url = URL.createObjectURL(blob);
        if (pv) { pv.location.href = url; }
        else { const a = document.createElement("a"); a.href = url; a.download = "SignOff.pdf"; document.body.appendChild(a); a.click(); a.remove(); }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        if (pv) { try { pv.close(); } catch { /* */ } }
        w.print(); // no server renderer → browser print
      }
    } catch {
      if (pv) { try { pv.close(); } catch { /* */ } }
      try { w.print(); } catch { /* window closed */ }
    } finally { try { printBtn.textContent = orig; printBtn.disabled = false; } catch { /* */ } }
  };
  bar.appendChild(printBtn);
  bar.appendChild(mk("✕  Close", "#5b6b73", () => w.close()));
  doc.body.insertBefore(bar, doc.body.firstChild);

  // Keep §7 "Accepted Go-Live Date" in sync with §2 "Go-Live Date" while editing.
  if (mode === "edit") {
    const goLive = doc.getElementById("goLiveDate") as HTMLInputElement | null;
    const accepted = doc.getElementById("acceptedGoLiveDate") as HTMLInputElement | null;
    if (goLive && accepted) {
      const sync = () => { accepted.value = goLive.value; };
      goLive.addEventListener("change", sync);
      goLive.addEventListener("input", sync);
    }
    // §7 "Authorized Representative" mirrors §2 "Customer SPOC Person" as it's typed.
    const spoc = doc.getElementById("spocCell");
    const authRep = doc.getElementById("authRepCell");
    if (spoc && authRep) {
      const syncRep = () => {
        const val = (spoc.textContent || "").trim();
        const target = authRep.querySelector(".af");
        if (target) target.textContent = val; else authRep.textContent = val;
      };
      spoc.addEventListener("input", syncRep);
    }

    // §8 "Support SPOC" mirrors §2 "Implementation Engineer" as it's typed, and §8 "Support Contact"
    // auto-derives that person's mobile from the embedded app.Users name→mobile map.
    const implEng = doc.getElementById("implEngCell");
    const supportSpoc = doc.getElementById("supportSpocCell");
    const supportContact = doc.getElementById("supportContactCell");
    if (implEng && (supportSpoc || supportContact)) {
      let mobiles: Record<string, string> = {};
      try { mobiles = JSON.parse(supportContact?.getAttribute("data-mobiles") || "{}"); } catch { /* no map */ }
      const setCell = (cell: HTMLElement | null, val: string) => {
        if (!cell) return;
        const af = cell.querySelector(".af");
        if (af) af.textContent = val; else cell.textContent = val;
      };
      const syncEng = () => {
        const name = (implEng.textContent || "").trim();
        setCell(supportSpoc, name);
        setCell(supportContact, mobiles[name.toLowerCase()] || "");
      };
      implEng.addEventListener("input", syncEng);
    }

    // "+ Add Row" (top-right of the table) + a per-row Delete (✕) button. Both are UI-only helpers:
    // hidden in print and stripped from the saved/serialized HTML (see cleanDocHtml). Data operation
    // → everyone. Used by Sign-Off's §6 Pending Items Register and Kick-Off's Agreed Customizations.
    const wireRowEditing = (tbl: HTMLTableElement, newRowInner: string) => {
      const dataRows = () => [...tbl.rows].filter((r) => !r.classList.contains("h"));
      const renumber = () => dataRows().forEach((r, i) => { const c = r.cells[0]; if (c) c.textContent = String(i + 1); });
      const addDelCell = (tr: HTMLTableRowElement) => {
        const td = tr.insertCell(-1);
        td.className = "indus-delcell";
        td.setAttribute("contenteditable", "false");
        td.setAttribute("style", "text-align:center; width:34px;");
        const del = doc.createElement("button");
        del.type = "button";
        del.title = "Delete row";
        del.textContent = "✕";
        del.setAttribute("style", "cursor:pointer; border:none; border-radius:5px; padding:2px 7px; font:700 12px 'Segoe UI',system-ui,sans-serif; color:#fff; background:#c0392b;");
        del.onclick = () => { tr.remove(); renumber(); };
        td.appendChild(del);
      };
      // one-time: add an (empty) header cell + a delete cell to each existing data row
      if (!tbl.querySelector(".indus-delcol")) {
        const hdr = tbl.rows[0];
        if (hdr && hdr.classList.contains("h")) {
          const hc = hdr.insertCell(-1); hc.className = "indus-delcol"; hc.setAttribute("contenteditable", "false");
        }
        dataRows().forEach(addDelCell);
      }
      // one "+ Add Row" bar per table (guarded by the table's own preceding sibling, so multiple
      // editable tables in the same document each get their own).
      if (!tbl.previousElementSibling?.classList.contains("indus-addrow")) {
        const wrap = doc.createElement("div");
        wrap.className = "indus-addrow";
        wrap.setAttribute("style", "text-align:right; margin:2px 0 4px;");
        wrap.setAttribute("contenteditable", "false");
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.textContent = "＋ Add Row";
        btn.setAttribute("style", "cursor:pointer; border:none; border-radius:5px; padding:4px 12px; font:600 11px 'Segoe UI',system-ui,sans-serif; color:#fff; background:#0f6a72;");
        btn.onclick = () => { const tr = tbl.insertRow(-1); tr.innerHTML = newRowInner; addDelCell(tr); renumber(); };
        wrap.appendChild(btn);
        tbl.parentNode?.insertBefore(wrap, tbl);
      }
    };

    // Sign-Off §6 Pending Items Register (S.N. / description / module / date / priority / status / initials)
    const pt = doc.getElementById("pendingTable") as HTMLTableElement | null;
    if (pt) wireRowEditing(pt,
      `<td class="c"></td><td class="fill"></td><td class="fill"></td>` +
      `<td class="fill"><input type="date" class="pd"></td>` +
      `<td class="fill"><select class="sc"><option value=""></option><option>Urgent</option><option>Normal</option></select></td>` +
      `<td class="fill"><select class="sc"><option value=""></option><option>In Progress</option><option>Not Required</option><option>Completed</option><option>Pending</option></select></td>` +
      `<td class="fill"></td><td class="fill"></td>`);

    // Kick-Off §2 Agreed Customizations / Special Commitments (No. / Requirement / Module / Timeline / Reference)
    const ct = doc.getElementById("customizeTable") as HTMLTableElement | null;
    if (ct) wireRowEditing(ct,
      `<td class="c"></td><td class="fill"></td><td class="fill"></td><td class="fill"></td><td class="fill"></td>`);

    // §8 Support Email — multi-select dropdown (options built in fetchFilledTemplate from the
    // active Support-role users). Only present on a fresh fill; stripped from saved/printed HTML,
    // leaving the comma-separated selection as plain text (.ms-display). Wire the toggle + sync here.
    const seCell = doc.getElementById("supportEmailCell");
    const sePanel = seCell?.querySelector(".ms-panel") as HTMLElement | null;
    if (seCell && sePanel) {
      const seBtn = seCell.querySelector(".ms-btn") as HTMLButtonElement | null;
      const boxes = () => [...sePanel.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
      // Always render "<fixed email>[, ...selected]". Re-query the (non-editable) display span each
      // time so it can never end up detached — fixes "remove all then re-select shows nothing".
      const refresh = () => {
        const d = seCell.querySelector(".ms-display") as HTMLElement | null;
        if (!d) return;
        const fixed = d.getAttribute("data-fixed") || "";
        const sel = boxes().filter((b) => b.checked).map((b) => b.value);
        d.textContent = [fixed, ...sel].filter(Boolean).join(", ");
      };
      seBtn?.addEventListener("click", (e) => { e.stopPropagation(); sePanel.style.display = sePanel.style.display === "block" ? "none" : "block"; });
      boxes().forEach((b) => b.addEventListener("change", refresh));
      doc.addEventListener("click", (e) => { if (!seCell.contains(e.target as Node)) sePanel.style.display = "none"; });
    }

    // Protect form controls from DELETION: users may tick/untick checkboxes, radios and use the
    // date/dropdown pickers, but Backspace/Delete must NOT remove them from the editable document.
    // Also protect the §8 Support Email display + its dropdown control (non-editable islands the
    // browser would otherwise delete atomically on Backspace).
    const PROTECTED = "input, select, .ms-display, .indus-msctl";
    const sheetEl = doc.querySelector(".sheet") as HTMLElement | null;
    sheetEl?.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const sel = doc.getSelection();
      if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      const isCtrl = (node: Node | null): boolean =>
        !!node && node.nodeType === 1 &&
        (!!(node as Element).matches?.(PROTECTED) || !!(node as Element).querySelector?.(PROTECTED));
      if (!r.collapsed) {
        if (r.cloneContents().querySelector(PROTECTED)) e.preventDefault();
        return;
      }
      const c = r.startContainer, o = r.startOffset;
      const target: Node | null = e.key === "Backspace"
        ? (c.nodeType === 1 ? c.childNodes[o - 1] : (o === 0 ? c.previousSibling : null))
        : (c.nodeType === 1 ? c.childNodes[o] : (o >= (c.textContent?.length ?? 0) ? c.nextSibling : null));
      if (isCtrl(target)) e.preventDefault();
    });
  }
}
/** Kick-Off placeholders. Auto-filled from the SAME live data source as Sign-Off (control DB +
 *  client DB + app DB via /api/signoff-data) when available, falling back to the client's own
 *  fields so the document still opens meaningfully. documentCode uses the KO- prefix (not CLS-). */
const kickoffFields = (c: CustomerDetail, d?: SignoffData | null, version = "1.0"): [string, string][] => {
  const g = (v?: string | null) => (v ?? "").toString();
  const code = (c.companyUniqueCode ?? "").trim();
  return [
    ["documentCode", code ? `IA-ERP-KO-${code}` : "IA-ERP-KO-001"],
    ["version", version || "1.0"],
    ["documentDate", g(d?.documentDate)],
    ["erpProduct", g(d?.erpProduct)],
    ["companyName", g(d?.companyName) || (c.companyName ?? "")],
    ["address", g(d?.address) || (c.address ?? "")],
    ["city", g(d?.city) || (c.city ?? "")],
    ["gstin", c.gstin ?? ""],
    ["email", c.email ?? ""],
    ["contactPerson", g(d?.contactPerson)],
    ["mobile", c.mobile ?? ""],
    ["implEngineer", g(d?.implementationEngineer)],
    ["implEngineerMobile", g(d?.implementationEngineerMobile)],
  ];
};
/** Sign-Off placeholders. When live auto-fill data `d` is available (fetched on open) the fields
 *  come from there; otherwise falls back to the client's own companyName/address/city so the
 *  document still opens meaningfully. */
const signoffFields = (c: CustomerDetail, d?: SignoffData | null): [string, string][] => {
  const g = (v?: string | null) => (v ?? "").toString();
  return [
    ["documentCode", g(d?.documentCode)],
    ["version", g(d?.version) || "1.0"],
    ["documentDate", g(d?.documentDate)],
    ["erpProduct", g(d?.erpProduct)],
    ["companyName", g(d?.companyName) || (c.companyName ?? "")],
    ["address", g(d?.address) || (c.address ?? "")],
    ["city", g(d?.city) || (c.city ?? "")],
    ["projectStartDate", g(d?.projectStartDate)],
    ["goLiveDate", g(d?.goLiveDate)],
    ["projectCompletionDate", g(d?.projectCompletionDate)],
    ["contactPerson", g(d?.contactPerson)],
    ["implEngineer", g(d?.implementationEngineer)],
    ["implEngineerMobile", g(d?.implementationEngineerMobile)],
    ["implHead", g(d?.implementationHead) || "Mahesh Patidar"],
    ["supportEmail", g(d?.supportEmail) || "maheshpatidar.indusanalytics@gmail.com"],
  ];
};

type FieldKind = "text" | "number" | "date" | "textarea" | "status" | "app" | "bool" | "country" | "state" | "city" | "appurl";
type FieldOpts = { full?: boolean; mono?: boolean; readOnly?: boolean; viewOnly?: boolean; copy?: boolean; narrow?: boolean; span?: number };

/** Small ghost icon-button that copies text to the clipboard (✓ feedback for 1.5s). */
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="xs" iconOnly icon={copied ? Check : Copy} tooltip={copied ? "Copied!" : "Copy"}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } }} />
  );
}

const labelCss: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", display: "block", marginBottom: 2 };
const valueCss = (mono?: boolean): React.CSSProperties => ({ fontSize: 12.5, fontWeight: 600, color: T.fg, fontFamily: mono ? "monospace" : undefined, wordBreak: "break-word", lineHeight: 1.3 });
const fldInput: React.CSSProperties = { width: "100%", height: 38, padding: "0 11px", fontSize: 13.5, border: `1px solid ${T.bd}`, borderRadius: 8, background: T.surface, color: T.fg, outline: "none", boxSizing: "border-box" };
const fldArea: React.CSSProperties = { width: "100%", padding: "8px 11px", fontSize: 13.5, border: `1px solid ${T.bd}`, borderRadius: 8, background: T.surface, color: T.fg, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 };
const roInput: React.CSSProperties = { ...fldInput, background: T.subtle, color: T.muted };
// View-mode display "box" — makes read-only values look like the edit-mode input boxes.
const roBox: React.CSSProperties = { minHeight: 38, padding: "7px 11px", border: `1px solid ${T.bd}`, borderRadius: 8, background: T.subtle, display: "flex", alignItems: "center", boxSizing: "border-box", overflow: "hidden" };
const histTh: React.CSSProperties = { padding: "6px 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap" };
const histTd: React.CSSProperties = { padding: "7px 8px", verticalAlign: "top" };

// ── Subscription Period → auto date maths ──────────────────
const PERIOD_OPTIONS = ["1 Month", "6 Month", "1 Year", "1.5 Year", "2 Year"];
const PERIOD_MONTHS: Record<string, number> = { "1 Month": 1, "6 Month": 6, "1 Year": 12, "1.5 Year": 18, "2 Year": 24 };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function addMonths(dateStr: string | null | undefined, months: number): string {
  const s = String(dateStr ?? "").slice(0, 10); if (!s) return "";
  const d = new Date(s); if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + months); return ymd(d);
}
function addDays(dateStr: string | null | undefined, days: number): string {
  const s = String(dateStr ?? "").slice(0, 10); if (!s) return "";
  const d = new Date(s); if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days); return ymd(d);
}

/** One bordered section card: bg-subtle header band (icon + dark bold title) + field grid. */
function SectionCard({ icon: Icon, title, cols = 3, children }: { icon: LucideIcon; title: string; cols?: number; children: React.ReactNode }) {
  // On phones, force 2 columns regardless of the desktop `cols` (3/4/5/6) so field values (dates,
  // "1 Year", …) never get squeezed into ~55px columns and wrap character-by-character. Driven in JS
  // (not just CSS) so it's guaranteed to apply inside this modal.
  const { isMobile } = useDevice();
  const colCount = isMobile ? 2 : cols;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.bd}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: T.subtle, borderBottom: `1px solid ${T.bd}` }}>
        <Icon size={13} style={{ color: T.primary }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.fg, letterSpacing: 0.4, textTransform: "uppercase" }}>{title}</span>
      </div>
      <div className="cdb-grid" style={{ padding: "9px 14px", display: "grid", gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`, gap: "8px 20px", alignItems: "start" }}>
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
export default function ClientDetailBody({ id, onClose, onChanged, inModal = false, lockTab, lockTabEditable }: { id: string; onClose: () => void; onChanged?: () => void; inModal?: boolean; lockTab?: string; lockTabEditable?: boolean }) {
  const { data: session } = useSession();
  const { openComposer } = useEmailComposer();
  const [c, setC] = useState<CustomerDetail | null>(null);
  // On phones the SectionCard grid is forced to 2 columns, so a field asking for span≥2 (e.g. the
  // span-3 "Status Description" / "ERP Message") must become full-width — otherwise `grid-column:
  // span 3` in a 2-track grid spawns an implicit 3rd column, re-cramping everything (dates wrap).
  const { isMobile: isMobileView } = useDevice();
  const colSpan = (span?: number, full?: boolean): string | undefined =>
    full ? "1 / -1" : (isMobileView && span && span >= 2) ? "1 / -1" : span ? `span ${span}` : undefined;
  // Authority to edit the FIXED Sign-Off template (headings/labels). Regular users can only fill data.
  const [canEditSignoffTemplate, setCanEditSignoffTemplate] = useState(false);
  // lockTab (e.g. "tracker") pins this to a single tab and hides the tab-bar — used by the
  // Implementation Process pages that render just one section for a picked client.
  const [tab, setTab] = useState(lockTab ?? "company");
  const [subTab, setSubTab] = useState("settings");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [emailRefresh] = useState(0);
  // Saved Kick-Off / Sign-Off finalized-document status (drives the tab badges + View/Download).
  const [docMeta, setDocMeta] = useState<ClientDocMeta[]>([]);
  // Which doc's Download menu (PDF / HTML) is open, if any.
  const [dlMenu, setDlMenu] = useState<ClientDocType | null>(null);
  // Save/Email audit-history modal: which doc it's open for + its rows + loading state.
  const [historyFor, setHistoryFor] = useState<ClientDocType | null>(null);
  const [historyItems, setHistoryItems] = useState<ClientDocHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // In-place edit state
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<SubscriptionSave>({});
  useLocationData(); // lazily load country/state/city data (kept out of the main bundle)
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [msgPopup, setMsgPopup] = useState(false);
  // Per-user tab permissions (view/edit). Empty until loaded → default view-all / edit-none.
  const [perms, setPerms] = useState<TabPermMap>({});
  // Application URL dropdown options — distinct non-empty ApplicationBaseURL from the control DB.
  const [appUrls, setAppUrls] = useState<string[]>([]);
  useEffect(() => { customersApi.appUrls().then(setAppUrls).catch(() => {}); }, []);

  // Subscription-period helpers (edit-mode only) — drive the To Date + Payment Due auto-calc.
  const [erpPeriod, setErpPeriod] = useState("");
  const [erpExceedOn, setErpExceedOn] = useState(false);
  const [erpExceedDays, setErpExceedDays] = useState("");
  const [cloudPeriod, setCloudPeriod] = useState("");
  const [cloudExceedOn, setCloudExceedOn] = useState(false);
  const [cloudExceedDays, setCloudExceedDays] = useState("");
  const resetPeriodHelpers = () => { setErpPeriod(""); setErpExceedOn(false); setErpExceedDays(""); setCloudPeriod(""); setCloudExceedOn(false); setCloudExceedDays(""); };
  // Exceed-days state (persisted in OUR local app DB, never the shared control DB). `exceed` holds the
  // last-loaded values + full change history; `histKind` opens the history modal for one kind.
  const [exceed, setExceed] = useState<ClientExceed | null>(null);
  const [histKind, setHistKind] = useState<"ERP" | "Cloud" | null>(null);

  useEffect(() => {
    setC(null); setErr(null); setTab(lockTab ?? "company"); setEditing(false); resetPeriodHelpers();
    if (id) customersApi.detail(id).then(setC).catch((e) => setErr(String(e)));
  }, [id]);

  // Picking a Subscription Period recomputes To Date = From + Period and Payment Due = To Date.
  // These run ONLY on an explicit user pick (not when the saved period is seeded on edit), so the
  // stored To/Payment dates are never silently shifted just by opening a client for editing.
  // Exceed days never touch Payment Due — they drive only the separate, read-only Exceed Date.
  const pickErpPeriod = (p: string) => {
    setErpPeriod(p);
    const to = addMonths(f.fromDate, PERIOD_MONTHS[p] ?? 0);
    if (to) setF((prev) => ({ ...prev, toDate: to, paymentDueDate: to }));
  };
  const pickCloudPeriod = (p: string) => {
    setCloudPeriod(p);
    const to = addMonths(f.cloudFromDate, PERIOD_MONTHS[p] ?? 0);
    if (to) setF((prev) => ({ ...prev, cloudToDate: to, cloudPaymentDueDate: to }));
  };
  // Load the acting user's client-tab permissions once the session is known.
  useEffect(() => {
    const uid = (session?.user as { UserID?: number } | undefined)?.UserID;
    fetchClientTabPermissions(uid).then(setPerms);
    fetchUserPermissions(uid).then((p) => setCanEditSignoffTemplate(p.has("signoff.editTemplate"))).catch(() => {});
  }, [session]);
  // If the active tab isn't viewable for this user, jump to the first viewable tab.
  // (Skipped when lockTab is set — the route is single-tab and its own guard controls access.)
  useEffect(() => {
    if (lockTab) return;
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
  // Load persisted exceed-days (ERP + Cloud) + change history, and seed the editable controls.
  // Keyed by CompanyUserID — the same row key the subscription update/detail use.
  useEffect(() => {
    const code = c?.companyUserID;
    if (!code) { setExceed(null); return; }
    customersApi.getExceed(code).then((x) => {
      setExceed(x);
      setErpExceedOn(x.erp.active); setErpExceedDays(x.erp.days ? String(x.erp.days) : "");
      setCloudExceedOn(x.cloud.active); setCloudExceedDays(x.cloud.days ? String(x.cloud.days) : "");
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.companyUniqueCode, c?.companyUserID]);

  const set = (k: keyof SubscriptionSave, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const startEdit = () => { if (!c) return; setF({ ...c, originalCompanyUserID: c.companyUserID }); setErpPeriod(c.erpSubscriptionPeriod ?? ""); setCloudPeriod(c.cloudSubscriptionPeriod ?? ""); setFormErr(null); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setFormErr(null); };
  async function save() {
    if (!f.companyName?.trim()) { setFormErr("Client Name is required."); return; }
    if (!f.companyUserID?.trim()) { setFormErr("Company Login Name is required."); return; }
    if (/\s/.test(f.companyUserID)) { setFormErr("Login Name must not contain spaces."); return; }
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) { setFormErr("Enter a valid email."); return; }
    if (f.mobile && !/^\d+$/.test(String(f.mobile))) { setFormErr("Mobile must be numeric."); return; }
    setSaving(true); setFormErr(null);
    try {
      const res = await customersApi.update({ ...f, erpSubscriptionPeriod: erpPeriod || null, cloudSubscriptionPeriod: cloudPeriod || null });
      if (res.success) {
        // Persist exceed-days: writes ExceedDays/ExceedDate onto the subscription row + logs history.
        // Runs AFTER update(f) so ExceedDate is recomputed from the just-saved Payment Due. Non-fatal on error.
        const exCode = f.companyUserID;
        if (exCode) {
          try {
            const x = await customersApi.saveExceed(exCode, {
              erp: { active: erpExceedOn, days: parseInt(erpExceedDays) || 0 },
              cloud: { active: cloudExceedOn, days: parseInt(cloudExceedDays) || 0 },
            });
            if (x && "history" in x) setExceed(x);
          } catch { /* exceed save is best-effort; the main subscription save already succeeded */ }
        }
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
  // For the locked tab (Implementation Process pages), edit follows that Implementation module's
  // OWN authority (passed in as lockTabEditable) — NOT the separate client-detail-tab (clienttab-*)
  // permission that /clients uses. So granting the /implementation/<step> module edit rights in
  // User Management makes the tab editable here, matching the admin's expectation.
  const canEdit = (tabId: string) =>
    (lockTab && tabId === lockTab && lockTabEditable !== undefined)
      ? lockTabEditable
      : (perms[tabId]?.canEdit ?? false);
  const visibleTabs = TABS.filter((t) => canView(t.id));

  // ── Finalized Kick-Off / Sign-Off documents (edit → save → view/download) ──
  const docClientCode = c.companyUniqueCode || c.companyUserID;
  const sUser = (session?.user ?? {}) as { name?: string; UserID?: number };
  const docMetaFor = (t: ClientDocType) => docMeta.find((m) => m.docType === t) || null;
  const refreshDocMeta = () => {
    if (!docClientCode) return;
    clientDocsApi.meta(docClientCode).then((r) => setDocMeta(r?.success ? (r.data || []) : [])).catch(() => {});
  };
  const loadHistory = (docType: ClientDocType) => {
    if (!docClientCode) return;
    setHistoryLoading(true);
    clientDocsApi.history(docClientCode, docType)
      .then((r) => setHistoryItems(r?.success ? (r.data || []) : []))
      .catch(() => setHistoryItems([]))
      .finally(() => setHistoryLoading(false));
  };
  const openHistory = (docType: ClientDocType) => { setHistoryFor(docType); setHistoryItems([]); loadHistory(docType); };

  const fetchFilledTemplate = async (docType: ClientDocType): Promise<string> => {
    const res = await fetch(docType === "SignOff" ? "/signoff.html" : "/kickoff.html", { cache: "no-store" });
    let html = await res.text();
    if (docType !== "SignOff") {
      // Kick-Off: fill the live send-version (1.0 → 1.1 → … per email) so it matches the Sign-Off flow.
      let version = "1.0";
      try { const vr = await clientDocsApi.version(docClientCode, "KickOff"); if (vr?.success && vr.version) version = vr.version; } catch { /* keep 1.0 */ }
      // Same LIVE auto-fill data source as Sign-Off (control DB + client DB + app DB). Degrade
      // gracefully — if the backend or client DB is unreachable, open with the client fallback.
      let kdata: SignoffData | null = null;
      try {
        const r = await customersApi.signoffData(c.companyUserID);
        if (r?.success) kdata = r.data;
      } catch { /* unreachable — document still opens with client fallback fields */ }
      html = fillTemplate(html, kickoffFields(c, kdata, version));
      // Tick the "In Scope" checkbox for each module present in the client's ModuleMaster.
      for (const m of kdata?.inScopeModules ?? [])
        html = html.split(`data-module="${m}">`).join(`data-module="${m}" checked>`);
      // Default Project Start Date to the client's actual start (ISO yyyy-mm-dd). Target Go-Live
      // stays blank — it's a future target the user sets during kick-off.
      html = html.replace('id="projectStartDate">', `id="projectStartDate" value="${kdata?.projectStartDateIso ?? ""}">`);
      return html;
    }

    // Sign-Off: fetch the live auto-fill data (control DB + client DB + app DB). Degrade
    // gracefully — if the backend or client DB is unreachable, open with the client fallback.
    let data: SignoffData | null = null;
    try {
      const r = await customersApi.signoffData(c.companyUserID);
      if (r?.success) data = r.data;
    } catch { /* unreachable — document still opens with client fallback fields */ }

    html = fillTemplate(html, signoffFields(c, data));
    // Tick the "In Scope" checkbox for each module present in the client's ModuleMaster.
    for (const m of data?.inScopeModules ?? [])
      html = html.split(`data-module="${m}">`).join(`data-module="${m}" checked>`);
    // Default the Go-Live / Project Completion / Accepted Go-Live date pickers to today
    // (ISO yyyy-mm-dd for <input type="date">). The user can change them; §7 stays in sync with §2.
    const nd = new Date();
    const todayIso = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-${String(nd.getDate()).padStart(2, "0")}`;
    html = html
      .replace('id="documentDate">', `id="documentDate" value="${todayIso}">`)
      .replace('id="projectStartDate">', `id="projectStartDate" value="${data?.projectStartDateIso ?? ""}">`)
      .replace('id="goLiveDate">', `id="goLiveDate" value="${todayIso}">`)
      .replace('id="projCompletionDate">', `id="projCompletionDate" value="${todayIso}">`)
      .replace('id="acceptedGoLiveDate">', `id="acceptedGoLiveDate" value="${todayIso}">`);

    // §8 Support Email — a FIXED base email (maheshpatidar…, always shown) + a dropdown to ADD
    // more active Support-role emails. The result renders as plain comma-separated text
    // (.ms-display, non-editable so the user can't break it) on save/print; the interactive
    // control (.indus-msctl) is stripped by cleanDocHtml. Falls back to the fixed email alone
    // when the option list is unavailable.
    const supportEmails = data?.supportEmails ?? [];
    const fixedEmail = (data?.supportEmail || "maheshpatidar.indusanalytics@gmail.com").trim();
    if (supportEmails.length) {
      const options = supportEmails.filter((e) => e.trim().toLowerCase() !== fixedEmail.toLowerCase());
      const opts = options.map((e) =>
        `<label class="ms-opt" style="display:block;padding:4px 12px;font:400 11.5px 'Segoe UI',system-ui,sans-serif;white-space:nowrap;cursor:pointer;">` +
        `<input type="checkbox" value="${esc(e)}" style="margin-right:7px;vertical-align:middle;">${esc(e)}</label>`
      ).join("");
      const ctrl =
        `<span class="ms-display" contenteditable="false" data-fixed="${esc(fixedEmail)}">${esc(fixedEmail)}</span>` +
        `<span class="indus-msctl" contenteditable="false" style="position:relative;display:inline-block;margin-left:8px;vertical-align:middle;">` +
          `<button type="button" class="ms-btn" style="cursor:pointer;border:1px solid #0f6a72;background:#eaf5f6;color:#0f6a72;border-radius:5px;padding:2px 10px;font:600 11px 'Segoe UI',system-ui,sans-serif;">▼ Add Email</button>` +
          `<div class="ms-panel" style="display:none;position:absolute;top:100%;left:0;z-index:60;background:#fff;border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,.15);max-height:230px;overflow:auto;min-width:250px;margin-top:4px;">${opts}</div>` +
        `</span>`;
      html = html.replace(
        /(<td class="fill" id="supportEmailCell">)[\s\S]*?(<\/td>)/,
        (_m, open: string, close: string) => open + ctrl + close,
      );
    }

    // §8 Support SPOC + Support Contact follow §2 Implementation Engineer. Embed the active-user
    // name/email → mobile map so injectDocToolbar can look up the mobile client-side as the user
    // edits the engineer name (stripped from saved HTML by cleanDocHtml).
    const userMobiles = data?.userMobiles ?? {};
    if (Object.keys(userMobiles).length) {
      html = html.replace('id="supportContactCell"', `id="supportContactCell" data-mobiles="${esc(JSON.stringify(userMobiles))}"`);
    }
    return html;
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
        if (historyFor === docType) loadHistory(docType);
        setFlash(`${docType === "SignOff" ? "Sign-Off" : "Kick-Off"} document saved.`);
        // The doc opens in its OWN window (the main-app flash banner is hidden behind it), and on the
        // server a save can take several seconds — so show a clear, prominent success banner INSIDE the
        // doc window itself, otherwise the only cue is a brief button-text flip the user often misses.
        try { showDocBanner(w, `✓ ${docType === "SignOff" ? "Sign-Off" : "Kick-Off"} saved successfully`, "#0a7d3c"); } catch { /* window closed */ }
        setTimeout(() => { try { btn.textContent = orig; btn.style.background = "#137a44"; btn.disabled = false; } catch { /* window closed */ } }, 2200);
      } else {
        btn.textContent = orig; btn.disabled = false;
        try { showDocBanner(w, "✕ Save failed: " + (res?.message || "unknown error"), "#c0392b"); } catch { try { w.alert("Save failed: " + (res?.message || "unknown error")); } catch { /* window closed */ } }
      }
    } catch (e) {
      btn.textContent = orig; btn.disabled = false;
      try { showDocBanner(w, "✕ Save failed — check your connection and retry", "#c0392b"); } catch { try { w.alert("Save failed: " + e); } catch { /* window closed */ } }
    }
  };

  /** Open the document in a new window. mode "edit" = editable (continues from the saved
   *  final version if one exists, else the filled template) with a Save button; mode "view"
   *  = the saved final version, read-only. When `forceTemplate` is true, edit mode ignores any
   *  saved version and opens the LATEST auto-filled template instead — used by "Open New Template"
   *  so a client with an old saved doc can move to the current template if they choose. Nothing is
   *  overwritten until the user explicitly clicks Save inside the window. */
  const openDocWindow = (mode: "edit" | "view", docType: ClientDocType, forceTemplate = false) => {
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to open the document."); return; }
    try {
      w.document.open();
      w.document.write('<!doctype html><meta charset="utf-8"><title>Loading…</title><body style="margin:0;font:14px \'Segoe UI\',system-ui,sans-serif;color:#556;display:grid;place-items:center;height:100vh">Loading document…</body>');
      w.document.close();
    } catch { /* ignore */ }
    (async () => {
      let html: string;
      let loadedSaved = false;
      try {
        if (mode === "view") {
          const r = await clientDocsApi.get(docClientCode, docType);
          if (!r?.success || !r.data) { try { w.close(); } catch { /* */ } setFlash("No saved document to view."); return; }
          html = r.data.htmlContent; loadedSaved = true;
        } else if (!forceTemplate && docMetaFor(docType)) {
          const r = await clientDocsApi.get(docClientCode, docType);
          if (r?.success && r.data) { html = r.data.htmlContent; loadedSaved = true; }
          else html = await fetchFilledTemplate(docType);
        } else {
          html = await fetchFilledTemplate(docType);
        }
      } catch (e) {
        try { w.close(); } catch { /* */ }
        alert("Failed to open document: " + e);
        return;
      }
      // A saved Kick-Off / Sign-Off bakes the Version as static text at save time, but the version
      // bumps on every email send (1.0 → 1.1 → …). In EDIT mode ("Open Document") re-fetch the live
      // version and patch it so the working copy reflects the current send revision. "View Saved"
      // (view mode) intentionally shows the frozen document as-is — its Version stays as saved.
      let liveVersion: string | null = null;
      if (loadedSaved && mode === "edit") {
        try {
          const vr = await clientDocsApi.version(docClientCode, docType);
          if (vr?.success) liveVersion = vr.version ?? null;
        } catch { /* keep the baked version */ }
      }
      try { w.document.open(); w.document.write(html); w.document.close(); } catch { /* */ }
      setTimeout(() => {
        try {
          if (liveVersion) patchDocVersion(w.document, liveVersion);
          injectDocToolbar(w, mode, mode === "edit" ? (btn) => saveFromWindow(w, docType, btn) : undefined, docType === "SignOff" && !canEditSignoffTemplate);
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

  /** Download as PDF. Prefers the SERVER-rendered PDF (headless print with
   *  `--print-to-pdf-no-header`) → a clean file with NO browser date / title / URL headers,
   *  downloaded directly. Falls back to opening the saved doc + the browser's "Save as PDF"
   *  only when the server has no renderer available. */
  const downloadPdf = async (docType: ClientDocType) => {
    setFlash("Preparing PDF…");
    const pdf = await clientDocsApi.pdf(docClientCode, docType);
    if (pdf) {
      try {
        const bytes = Uint8Array.from(atob(pdf.base64), (ch) => ch.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url; a.download = `${docType}-${docClientCode}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        setFlash(null);
        return;
      } catch { /* fall through to the browser-print path below */ }
    }
    // Fallback: open the saved doc and use the browser's "Save as PDF" (may show browser headers).
    setFlash(null);
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to download the PDF."); return; }
    try {
      w.document.open();
      w.document.write('<!doctype html><meta charset="utf-8"><title>Preparing PDF…</title><body style="margin:0;font:14px \'Segoe UI\',system-ui,sans-serif;color:#556;display:grid;place-items:center;height:100vh">Preparing PDF… (choose <b>&nbsp;Save as PDF&nbsp;</b> in the print dialog)</body>');
      w.document.close();
    } catch { /* ignore */ }
    try {
      const r = await clientDocsApi.get(docClientCode, docType);
      if (!r?.success || !r.data) { try { w.close(); } catch { /* */ } setFlash("No saved document to download."); return; }
      w.document.open(); w.document.write(r.data.htmlContent); w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch { /* */ } }, 500);
    } catch (e) {
      try { w.close(); } catch { /* */ }
      setFlash("PDF download failed: " + e);
    }
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
        onSent: () => {
          setFlash(`${label} document emailed to the client.`);
          // Email actually sent → log an audit entry (who / to whom / version) + bump the send
          // revision so the Sign-Off Version increments (1.0 → 1.1 → …) the next time it's opened.
          void clientDocsApi.markSent(docClientCode, docType, {
            actorUserId: sUser.UserID ?? null,
            actorName: sUser.name ?? null,
            recipient: c.email ?? null,
          }).then(() => { refreshDocMeta(); if (historyFor === docType) loadHistory(docType); });
        },
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
          {/* When a client has an OLD saved copy, let an editor open the LATEST template instead
              (non-destructive — the saved copy stays until they Save the new one). */}
          {meta && editable && <Button variant="outline" size="sm" icon={Wand2} onClick={() => openDocWindow("edit", docType, true)}>Open New Template</Button>}
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
          {meta && <Button variant="outline" size="sm" icon={History} onClick={() => openHistory(docType)}>History</Button>}
        </div>

        {historyFor === docType && (
          <div onClick={() => setHistoryFor(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 96vw)", maxHeight: "82vh", display: "flex", flexDirection: "column", background: T.surface, border: `1px solid ${T.bd}`, borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,.28)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", background: "rgb(var(--color-primary))", color: "#fff" }}>
                <History size={18} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>{label} — Save &amp; Email History</span>
                <button onClick={() => setHistoryFor(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "inline-flex", padding: 2 }}><X size={18} /></button>
              </div>
              <div style={{ overflow: "auto" }}>
                {historyLoading ? (
                  <div style={{ padding: 30, textAlign: "center", color: T.muted, fontSize: 13 }}>Loading history…</div>
                ) : historyItems.length === 0 ? (
                  <div style={{ padding: 30, textAlign: "center", color: T.faint, fontSize: 13 }}>No Save or Email activity recorded yet.</div>
                ) : (
                  historyItems.map((h) => {
                    const emailed = h.action === "Emailed";
                    return (
                      <div key={h.historyId} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${T.bd}` }}>
                        <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: emailed ? "#e8f0fe" : "#e7f6ec", color: emailed ? "#1a56db" : "#0a7d3c" }}>
                          {emailed ? <Mail size={16} /> : <Save size={16} />}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13.5, color: T.fg, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {emailed ? "Emailed to client" : "Saved final version"}
                            {h.version ? <span style={{ fontSize: 11, fontWeight: 700, color: emailed ? "#1a56db" : "#0a7d3c", background: emailed ? "#e8f0fe" : "#e7f6ec", padding: "1px 8px", borderRadius: 20 }}>v{h.version}</span> : null}
                          </div>
                          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                            by <b style={{ color: T.fg }}>{h.actorName || "Unknown"}</b> · {fmtHistoryDate(h.createdAt)}
                          </div>
                          {emailed && h.recipient ? <div style={{ fontSize: 12, color: T.muted, marginTop: 1, wordBreak: "break-all" }}>to {h.recipient}</div> : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Field cell — renders a read-only value (view) or an input bound to the draft (edit).
  // A labelled custom grid cell (for controls that aren't backed by `f`, e.g. the period helpers).
  const cell = (label: string, node: React.ReactNode, span?: number) => (
    <div style={{ gridColumn: span ? `span ${span}` : undefined, minWidth: 0 }}>
      <label style={labelCss}>{label}</label>
      {node}
    </div>
  );
  // Exceed-Days control: On/Off switch + (when on) a days number input.
  const exceedCtl = (on: boolean, setOn: (v: boolean) => void, days: string, setDays: (v: string) => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 38 }}>
      <Switch checked={on} onCheckedChange={() => setOn(!on)} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: on ? "rgb(var(--color-success))" : T.muted }}>{on ? "On" : "Off"}</span>
      {on && <input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} placeholder="days" style={{ ...fldInput, width: 88, marginLeft: 2 }} />}
    </div>
  );
  // Read-only Exceed Date = Payment Due + Exceed Days (Payment Due itself is never changed). Includes a
  // "History" link that opens the change-log modal for that subscription kind.
  const exceedDateCell = (base: string | null | undefined, on: boolean, days: string, kind: "ERP" | "Cloud", span?: number) => {
    const n = parseInt(days) || 0;
    const d = on && base ? addDays(base, n) : "";
    return (
      <div style={{ gridColumn: colSpan(span), minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <label style={{ ...labelCss, marginBottom: 0 }}>Exceed Date</label>
          <button type="button" onClick={() => setHistKind(kind)} title="Exceed-days change history"
            style={{ display: "inline-flex", alignItems: "center", gap: 3, border: "none", background: "transparent", color: T.primary, cursor: "pointer", fontSize: 10.5, fontWeight: 700, padding: 0 }}>
            <History size={12} /> History
          </button>
        </div>
        <div style={{ ...roBox, gap: 6 }}>
          {d ? <span style={valueCss()}>{fmtDate(d)}</span> : <span style={{ ...valueCss(), color: T.faint }}>—</span>}
          {on && n > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgb(var(--color-primary))", background: "color-mix(in srgb, rgb(var(--color-primary)) 12%, transparent)", padding: "1px 6px", borderRadius: 6 }}>+{n}d</span>}
        </div>
      </div>
    );
  };

  const fld = (label: string, key: keyof SubscriptionSave, kind: FieldKind = "text", opts: FieldOpts = {}) => {
    const box = (inner: React.ReactNode) => (
      <div key={String(key)} style={{ gridColumn: colSpan(opts.span, opts.full), minWidth: 0 }}>
        <label style={labelCss}>{label}</label>
        {inner}
      </div>
    );
    const cv = c[key as keyof CustomerDetail] as React.ReactNode;

    if (!editing || opts.viewOnly) {
      const empty = cv == null || String(cv).trim() === "";
      // Read-only values are shown INSIDE a box (same look as the edit-mode input boxes).
      const vb = (inner: React.ReactNode) => box(
        <div style={{ ...roBox, ...(opts.full ? { alignItems: "flex-start", minHeight: 54 } : {}) }}>{inner}</div>
      );
      if (kind === "status") return vb(cv ? <Badge variant={subscriptionVariant(String(cv))}>{cv}</Badge> : <span style={{ ...valueCss(), color: T.faint }}>—</span>);
      if (kind === "date") return vb(<span style={valueCss()}>{fmtDate(cv as string)}</span>);
      if (kind === "bool") return vb(cv == null ? <span style={{ ...valueCss(), color: T.faint }}>—</span> : <Badge variant={cv ? "success" : "secondary"}>{cv ? "On" : "Off"}</Badge>);
      if (kind === "app") return vb(<span style={valueCss()}>{empty ? <span style={{ color: T.faint }}>—</span> : appLabel(c.applicationName)}</span>);
      if (opts.copy && !empty) return vb(
        <div style={{ display: "flex", alignItems: opts.full ? "flex-start" : "center", gap: 8, width: "100%" }}>
          <div style={{ ...valueCss(opts.mono), flex: 1, minWidth: 0, wordBreak: "break-all", whiteSpace: opts.full ? "pre-wrap" : undefined }}>{cv}</div>
          <CopyBtn text={String(cv)} />
        </div>
      );
      return vb(<span style={{ ...valueCss(opts.mono), color: empty ? T.faint : T.fg, whiteSpace: opts.full ? "pre-wrap" : undefined }}>{empty ? "—" : cv}</span>);
    }

    const fv = f[key];
    // Dropdowns include the current saved value so an edit always pre-selects it (even off-list).
    if (kind === "status") return box(<Dropdown value={(fv as string) ?? ""} onValueChange={(v) => set(key, String(v))} options={Array.from(new Set([...STATUS_OPTIONS, ...(fv ? [String(fv)] : [])])).map((o) => ({ value: o, label: o }))} placeholder="Select…" searchable size="md" />);
    if (kind === "app") return box(<Dropdown value={(fv as string) ?? ""} onValueChange={(v) => set(key, String(v))} options={Array.from(new Set([...APP_OPTIONS, ...(fv ? [String(fv)] : [])])).map((o) => ({ value: o, label: o }))} placeholder="Select…" searchable size="md" />);
    // Cascading Country → State → City (values stored as names; picking a parent resets children).
    if (kind === "country") return box(<Dropdown value={(fv as string) ?? ""} onValueChange={(v) => setF((p) => ({ ...p, country: String(v), state: "", city: "" }))} options={countryNames(fv as string).map((o) => ({ value: o, label: o }))} placeholder="Select…" searchable size="md" />);
    if (kind === "state") return box(<Dropdown value={(fv as string) ?? ""} onValueChange={(v) => setF((p) => ({ ...p, state: String(v), city: "" }))} options={stateNames(f.country, fv as string).map((o) => ({ value: o, label: o }))} placeholder="Select…" searchable size="md" />);
    if (kind === "city") return box(<Dropdown value={(fv as string) ?? ""} onValueChange={(v) => set("city", String(v))} options={cityNames(f.country, f.state, fv as string).map((o) => ({ value: o, label: o }))} placeholder="Select…" searchable size="md" />);
    // Application URL: dropdown of distinct ApplicationBaseURL values (current value kept so it pre-selects even if off-list).
    if (kind === "appurl") return box(<Dropdown value={(fv as string) ?? ""} onValueChange={(v) => set(key, String(v))} options={Array.from(new Set([...appUrls, ...(fv ? [String(fv)] : [])])).filter(Boolean).map((o) => ({ value: o, label: o }))} placeholder="Select URL…" searchable size="md" />);
    if (kind === "date") return box(<DateField value={fv as string | undefined} onChange={(v) => set(key, v)} />);
    if (kind === "textarea") return box(<textarea value={(fv as string) ?? ""} onChange={(e) => set(key, e.target.value)} rows={2} style={fldArea} />);
    if (kind === "bool") return box(
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 38 }}>
        <Switch checked={!!fv} onCheckedChange={() => set(key, !fv)} />
        <span style={{ fontSize: 13, fontWeight: 600, color: fv ? "rgb(var(--color-success))" : T.muted }}>{fv ? "On" : "Off"}</span>
      </div>
    );
    if (kind === "number") return box(<input type="number" inputMode="numeric" value={(fv as number | string | undefined) ?? ""} onChange={(e) => set(key, Number(e.target.value))} style={fldInput} />);
    // Mobile keyboard hint derived from the field key: email → @ keyboard, mobile/contact/phone → phone pad.
    const km = String(key).toLowerCase();
    const im = km.includes("email") ? "email" : (km.includes("mobile") || km.includes("contact") || km.includes("phone")) ? "tel" : undefined;
    const noCaps = im === "email" || im === "tel";
    return box(<input type={im === "email" ? "email" : im === "tel" ? "tel" : "text"} inputMode={im} autoCapitalize={noCaps ? "none" : undefined} autoCorrect={noCaps ? "off" : undefined} value={(fv as string) ?? ""} onChange={(e) => set(key, e.target.value)} readOnly={opts.readOnly} style={{ ...(opts.readOnly ? roInput : fldInput), ...(opts.narrow ? { maxWidth: 150 } : null) }} />);
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
    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 14, padding: "9px 22px", background: "linear-gradient(to right, rgb(var(--bg-subtle)), rgb(var(--bg-surface)))", borderBottom: `1px solid ${T.bd}`, ...(inModal ? {} : { borderRadius: 12, border: `1px solid ${T.bd}`, marginBottom: 14 }) }}>
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
        {!lockTab && <Button variant="ghost" size="sm" iconOnly icon={X} tooltip="Close" onClick={onClose} />}
      </div>
    </div>
  );

  const tabsBar = (
    <div style={{ flexShrink: 0, padding: inModal ? "12px 22px 0" : "0", background: inModal ? T.surface : undefined, borderBottom: inModal ? `1px solid ${T.bd}` : undefined }}>
      <Tabs tabs={visibleTabs} activeTab={tab} onTabChange={setTab} variant="pill" size="md" fullWidth />
    </div>
  );

  const body = (
    <div style={inModal ? { flex: 1, minHeight: 0, overflow: "auto", padding: "12px 20px 16px" } : { marginTop: 16 }}>
      {flash && (
        <div style={{ background: "color-mix(in srgb, rgb(var(--color-success)) 12%, rgb(var(--bg-surface)))", color: "rgb(var(--color-success))", border: `1px solid color-mix(in srgb, rgb(var(--color-success)) 35%, transparent)`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, fontWeight: 600 }}>✓ {flash}</div>
      )}

      {tab === "company" && (
        <div style={{ display: "grid", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: editing ? T.primary : "transparent" }}>{editing ? "Editing — make your changes and Save" : ""}</div>
            <div style={{ display: "flex", gap: 8 }}>{actions}</div>
          </div>
          {formErr && <div style={{ color: "rgb(var(--color-error))", fontSize: 12.5, fontWeight: 600, marginTop: -4 }}>{formErr}</div>}

          <SectionCard icon={Building2} title="Client Information" cols={5}>
            {fld("Client Code", "companyUniqueCode", "text", { mono: true, readOnly: true, narrow: true })}
            {fld("Client Name", "companyName")}
            {fld("Company Code", "companyCode")}
            {fld("Application", "applicationName", "app")}
            {fld("GSTIN", "gstin", "text", { mono: true })}
          </SectionCard>

          <SectionCard icon={MapPin} title="Address & Contact" cols={4}>
            {fld("Address", "address", "textarea", { span: 2 })}
            {fld("Country", "country", "country")}
            {fld("State", "state", "state")}
            {fld("City", "city", "city")}
            {fld("Email", "email", "text", { span: 2 })}
            {fld("Mobile", "mobile")}
          </SectionCard>

          <SectionCard icon={CreditCard} title="ERP Subscription" cols={6}>
            {fld("Status", "subscriptionStatus", "status")}
            {cell("Subscription Period", editing
              ? <Dropdown value={erpPeriod} onValueChange={(v) => pickErpPeriod(String(v))} options={PERIOD_OPTIONS.map((o) => ({ value: o, label: o }))} placeholder="Select…" size="md" />
              : <div style={roBox}><span style={{ ...valueCss(), color: c.erpSubscriptionPeriod ? T.fg : T.faint }}>{c.erpSubscriptionPeriod || "—"}</span></div>
            )}
            {fld("From Date", "fromDate", "date")}
            {fld("To Date", "toDate", "date")}
            {editing && cell("Exceed Days", exceedCtl(erpExceedOn, setErpExceedOn, erpExceedDays, setErpExceedDays), 2)}
            {fld("Payment Due", "paymentDueDate", "date")}
            {exceedDateCell(editing ? f.paymentDueDate : c.paymentDueDate, erpExceedOn, erpExceedDays, "ERP")}
            {fld("User Limit", "userLimit", "number")}
            {fld("Message Active", "isMessageActive", "bool")}
            {fld("Status Description", "statusDescription", "text", { span: 3 })}
            {editing && f.isMessageActive ? (
              <div style={{ gridColumn: colSpan(3) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label style={{ ...labelCss, marginBottom: 0 }}>ERP Message</label>
                  <Button variant="ghost" size="xs" icon={Wand2} onClick={() => setMsgPopup(true)}>Format Message</Button>
                </div>
                <textarea value={f.subscriptionStatusMessage ?? ""} onChange={(e) => set("subscriptionStatusMessage", e.target.value)} rows={2} style={fldArea} />
              </div>
            ) : (!editing && c.subscriptionStatusMessage ? fld("ERP Message", "subscriptionStatusMessage", "text", { span: 3 }) : null)}
          </SectionCard>

          <SectionCard icon={Cloud} title="Cloud Subscription" cols={4}>
            {fld("Cloud Status", "cloudSubscriptionStatus", "status")}
            {cell("Subscription Period", editing
              ? <Dropdown value={cloudPeriod} onValueChange={(v) => pickCloudPeriod(String(v))} options={PERIOD_OPTIONS.map((o) => ({ value: o, label: o }))} placeholder="Select…" size="md" />
              : <div style={roBox}><span style={{ ...valueCss(), color: c.cloudSubscriptionPeriod ? T.fg : T.faint }}>{c.cloudSubscriptionPeriod || "—"}</span></div>
            )}
            {fld("Cloud From", "cloudFromDate", "date")}
            {fld("Cloud To", "cloudToDate", "date")}
            {editing && cell("Exceed Days", exceedCtl(cloudExceedOn, setCloudExceedOn, cloudExceedDays, setCloudExceedDays), 2)}
            {fld("Cloud Payment Due", "cloudPaymentDueDate", "date")}
            {exceedDateCell(editing ? f.cloudPaymentDueDate : c.cloudPaymentDueDate, cloudExceedOn, cloudExceedDays, "Cloud")}
          </SectionCard>

          <SectionCard icon={KeyRound} title="Login & Access" cols={3}>
            {fld("Company Login Name", "companyUserID", "text", { mono: true, copy: true })}
            {fld("Password", "password", "text", { mono: true, copy: true })}
            {fld("Application URL", "applicationBaseURL", "appurl", { mono: true, copy: true })}
            {fld("Connection String", "conn_String", "textarea", { full: true, copy: true })}
          </SectionCard>

          {!editing && <EmailHistoryCard clientCode={c.companyUniqueCode ?? undefined} refreshKey={emailRefresh} />}
        </div>
      )}

      {tab === "authority" && (
        <div>
          <div className="scroll-tabs" style={{ marginBottom: 16 }}>
            <Tabs tabs={SUB_TABS} activeTab={subTab} onTabChange={setSubTab} variant="rounded" size="sm" />
          </div>
          {!canEdit("authority") && <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Eye size={13} /> View only — you can browse module authority but not change it.</div>}
          <div style={!canEdit("authority") ? { pointerEvents: "none", opacity: 0.92 } : undefined}>
            {subTab === "settings" && <ModuleSettingsTab app={app} connStr={conn} onFlash={setFlash} source={c} />}
            {subTab === "groups" && <ModuleGroupsTab app={app} connStr={conn} onFlash={setFlash} clientName={c?.companyName} />}
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
      {tab === "onsite" && <TrackerPanel code={trackerCode} view="onsite" clientEmail={c.email} clientName={c.companyName} clientCode={c.companyUniqueCode} clientAddress={c.address} canEdit={canEdit("onsite")} />}

      {histKind && (
        <div onClick={() => setHistKind(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 96vw)", maxHeight: "82vh", display: "flex", flexDirection: "column", background: T.surface, border: `1px solid ${T.bd}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.28)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: T.subtle, borderBottom: `1px solid ${T.bd}` }}>
              <History size={16} style={{ color: T.primary }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: T.fg }}>{histKind} Exceed-Days History</div>
              <div style={{ marginLeft: "auto" }}><Button variant="ghost" size="sm" iconOnly icon={X} onClick={() => setHistKind(null)} /></div>
            </div>
            {(() => {
              const rows: ExceedHistoryRow[] = (exceed?.history ?? []).filter((h) => h.kind.toLowerCase() === histKind.toLowerCase());
              const cur = histKind === "ERP" ? { on: erpExceedOn, days: erpExceedDays } : { on: cloudExceedOn, days: cloudExceedDays };
              return (
                <div style={{ overflow: "auto", padding: "12px 18px 16px" }}>
                  <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
                    Current: <b style={{ color: T.fg }}>{cur.on ? `${parseInt(cur.days) || 0} day(s)` : "Off"}</b>
                    {" · "}Changed <b style={{ color: T.fg }}>{rows.length}</b> time{rows.length === 1 ? "" : "s"}
                  </div>
                  {rows.length === 0 ? (
                    <div style={{ padding: "28px 0", textAlign: "center", color: T.faint, fontSize: 13 }}>No changes recorded yet.</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, color: T.fg }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: T.muted }}>
                          <th style={histTh}>When</th>
                          <th style={histTh}>Change</th>
                          <th style={histTh}>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((h, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${T.bd}` }}>
                            <td style={histTd}>{new Date(h.changedDate).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                            <td style={histTd}><span style={{ color: T.muted }}>{h.oldDays}</span> <span style={{ color: T.faint }}>→</span> <b style={{ color: "rgb(var(--color-primary))" }}>{h.newDays}</b> <span style={{ color: T.muted }}> days</span></td>
                            <td style={histTd}>{h.changedByName || (h.changedBy != null ? `#${h.changedBy}` : "—")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <MessageFormatPopup
        visible={msgPopup}
        onClose={() => setMsgPopup(false)}
        onLoadMessage={(title, content) => setF((prev) => ({ ...prev, statusDescription: title, subscriptionStatusMessage: content }))}
      />
    </div>
  );

  return shell(<>{header}{lockTab ? null : tabsBar}{body}</>);
}
