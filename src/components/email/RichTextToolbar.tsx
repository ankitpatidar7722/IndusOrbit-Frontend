"use client";
import { useEffect, useRef, useState } from "react";
import {
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Link2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  RemoveFormatting, ChevronDown, Baseline, Highlighter,
} from "lucide-react";
import { insertImageFile } from "@/lib/imageEmbed";

/**
 * A Gmail-style formatting toolbar shared by the email Composer and the Template editor, so both
 * offer the SAME rich controls (undo/redo, font family & size, B/I/U/strike, text & highlight colour,
 * alignment, lists, link, image, clear formatting). It drives a contentEditable via document.execCommand.
 *
 * All controls use onMouseDown+preventDefault so the editor keeps focus and the current text SELECTION
 * survives while the command runs (essential for colour/size/family applied to selected text).
 * `onChange` is called after every command so a host that mirrors the HTML into state (the template
 * editor) stays in sync. `rightSlot` renders extra host controls (e.g. Signature toggle / Attach).
 */
export default function RichTextToolbar({
  editorRef, onChange, imageMaxWidth = 480, onImageError, rightSlot,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onChange?: () => void;
  imageMaxWidth?: number;
  onImageError?: (msg: string) => void;
  rightSlot?: React.ReactNode;
}) {
  const focusEditor = () => editorRef.current?.focus();
  const run = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); focusEditor(); onChange?.(); };
  // Colour/size commands emit CSS spans (email-friendly) rather than deprecated <font> tags.
  const runCss = (cmd: string, val: string) => { document.execCommand("styleWithCSS", false, "true"); document.execCommand(cmd, false, val); document.execCommand("styleWithCSS", false, "false"); focusEditor(); onChange?.(); };

  return (
    <div style={barCss}>
      <Grp>
        <Btn title="Undo" onClick={() => run("undo")}><Undo2 size={15} /></Btn>
        <Btn title="Redo" onClick={() => run("redo")}><Redo2 size={15} /></Btn>
      </Grp>
      <Sep />
      <FontMenu onPick={(v) => runCss("fontName", v)} />
      <SizeMenu onPick={(v) => run("fontSize", v)} />
      <Sep />
      <Grp>
        <Btn title="Bold" onClick={() => run("bold")}><Bold size={15} /></Btn>
        <Btn title="Italic" onClick={() => run("italic")}><Italic size={15} /></Btn>
        <Btn title="Underline" onClick={() => run("underline")}><Underline size={15} /></Btn>
        <Btn title="Strikethrough" onClick={() => run("strikeThrough")}><Strikethrough size={15} /></Btn>
      </Grp>
      <Sep />
      <Grp>
        <ColorMenu title="Text colour" icon={<Baseline size={15} />} onPick={(c) => runCss("foreColor", c)} />
        <ColorMenu title="Highlight colour" icon={<Highlighter size={15} />} onPick={(c) => runCss("hiliteColor", c)} withNone />
      </Grp>
      <Sep />
      <Grp>
        <Btn title="Align left" onClick={() => run("justifyLeft")}><AlignLeft size={15} /></Btn>
        <Btn title="Align centre" onClick={() => run("justifyCenter")}><AlignCenter size={15} /></Btn>
        <Btn title="Align right" onClick={() => run("justifyRight")}><AlignRight size={15} /></Btn>
        <Btn title="Justify" onClick={() => run("justifyFull")}><AlignJustify size={15} /></Btn>
      </Grp>
      <Sep />
      <Grp>
        <Btn title="Bullet list" onClick={() => run("insertUnorderedList")}><List size={15} /></Btn>
        <Btn title="Numbered list" onClick={() => run("insertOrderedList")}><ListOrdered size={15} /></Btn>
      </Grp>
      <Sep />
      <Grp>
        <Btn title="Insert link" onClick={() => { const url = window.prompt("Link URL"); if (url) run("createLink", url); }}><Link2 size={15} /></Btn>
        <label style={{ ...btnCss, cursor: "pointer" }} title="Insert image" onMouseDown={(e) => e.preventDefault()}>
          <ImageIcon size={15} />
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const file = e.target.files?.[0]; e.currentTarget.value = "";
            if (!file) return;
            try { await insertImageFile(editorRef.current, file, imageMaxWidth, false); onChange?.(); }
            catch (err) { onImageError?.(err instanceof Error ? err.message : String(err)); }
          }} />
        </label>
        <Btn title="Clear formatting" onClick={() => { run("removeFormat"); run("unlink"); }}><RemoveFormatting size={15} /></Btn>
      </Grp>
      {rightSlot && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>{rightSlot}</div>}
    </div>
  );
}

/* ── Font family + size menus (custom popovers so the editor selection is preserved) ─────────────── */
const FONTS: { label: string; css: string }[] = [
  { label: "Sans Serif", css: "Arial, Helvetica, sans-serif" },
  { label: "Serif", css: "Georgia, 'Times New Roman', serif" },
  { label: "Fixed Width", css: "'Courier New', monospace" },
  { label: "Wide", css: "'Arial Black', sans-serif" },
  { label: "Narrow", css: "'Arial Narrow', sans-serif" },
  { label: "Comic Sans", css: "'Comic Sans MS', cursive" },
  { label: "Garamond", css: "Garamond, serif" },
  { label: "Tahoma", css: "Tahoma, sans-serif" },
  { label: "Trebuchet", css: "'Trebuchet MS', sans-serif" },
  { label: "Verdana", css: "Verdana, sans-serif" },
];
function FontMenu({ onPick }: { onPick: (css: string) => void }) {
  return (
    <Menu width={112} label={<span style={{ fontSize: 12.5, fontWeight: 600 }}>Sans Serif</span>} title="Font">
      {(close) => FONTS.map((f) => (
        <MenuItem key={f.label} onPick={() => { onPick(f.css); close(); }}>
          <span style={{ fontFamily: f.css }}>{f.label}</span>
        </MenuItem>
      ))}
    </Menu>
  );
}
const SIZES: { label: string; v: string }[] = [
  { label: "Small", v: "2" }, { label: "Normal", v: "3" }, { label: "Large", v: "5" }, { label: "Huge", v: "6" },
];
function SizeMenu({ onPick }: { onPick: (v: string) => void }) {
  return (
    <Menu width={46} label={<span style={{ fontSize: 13, fontWeight: 700 }}>T</span>} title="Font size">
      {(close) => SIZES.map((s) => (
        <MenuItem key={s.v} onPick={() => { onPick(s.v); close(); }}>{s.label}</MenuItem>
      ))}
    </Menu>
  );
}

/* ── Colour menu (swatch grid + native custom picker) ───────────────────────────────────────────── */
const SWATCHES = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#ffffff",
  "#e11d48", "#ea580c", "#f59e0b", "#16a34a", "#0891b2", "#2563eb", "#7c3aed",
  "#9f1239", "#9a3412", "#b45309", "#166534", "#155e75", "#1e40af", "#5b21b6",
];
function ColorMenu({ title, icon, onPick, withNone }: { title: string; icon: React.ReactNode; onPick: (c: string) => void; withNone?: boolean }) {
  return (
    <Menu width="auto" title={title} label={icon} arrow>
      {(close) => (
        <div style={{ padding: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 18px)", gap: 5 }}>
            {SWATCHES.map((c) => (
              <button key={c} type="button" title={c} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(c); close(); }}
                style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid rgba(0,0,0,.2)", background: c, cursor: "pointer", padding: 0 }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, borderTop: "1px solid rgb(var(--bd-default))", paddingTop: 8 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "rgb(var(--fg-muted))", cursor: "pointer" }} onMouseDown={(e) => e.preventDefault()}>
              <input type="color" onChange={(e) => { onPick(e.target.value); }} style={{ width: 22, height: 22, border: "none", background: "none", padding: 0, cursor: "pointer" }} /> Custom
            </label>
            {withNone && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick("transparent"); close(); }}
                style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "rgb(var(--fg-muted))", background: "none", border: "1px solid rgb(var(--bd-default))", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>None</button>
            )}
          </div>
        </div>
      )}
    </Menu>
  );
}

/* ── Small primitives ───────────────────────────────────────────────────────────────────────────── */
const barCss: React.CSSProperties = { display: "flex", gap: 5, padding: 7, flexWrap: "wrap", alignItems: "center", background: "rgb(var(--bg-subtle))", borderBottom: "1px solid rgb(var(--bd-default))" };
const btnCss: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 28, border: "1px solid rgb(var(--bd-default))", background: "rgb(var(--bg-surface))", borderRadius: 7, cursor: "pointer", color: "rgb(var(--fg-default))" };
function Btn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={title} style={btnCss} onMouseDown={(e) => { e.preventDefault(); onClick(); }}>{children}</button>;
}
function Grp({ children }: { children: React.ReactNode }) { return <div style={{ display: "inline-flex", gap: 3 }}>{children}</div>; }
function Sep() { return <span style={{ width: 1, height: 20, background: "rgb(var(--bd-default))", margin: "0 2px" }} />; }

/** A toolbar dropdown whose open/close preserves the editor selection (trigger uses preventDefault). */
function Menu({ label, title, width, arrow, children }: { label: React.ReactNode; title: string; width: number | "auto"; arrow?: boolean; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        style={{ ...btnCss, width: width === "auto" ? "auto" : width, padding: "0 7px", gap: 4 }}>
        {label}<ChevronDown size={12} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 60, background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--bd-default))", borderRadius: 9, boxShadow: "0 12px 30px rgba(0,0,0,.18)", overflow: "hidden", minWidth: arrow ? 0 : 132, maxHeight: 280, overflowY: "auto" }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
function MenuItem({ onPick, children }: { onPick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onMouseDown={(e) => { e.preventDefault(); onPick(); }}
      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 13, border: "none", background: "transparent", color: "rgb(var(--fg-default))", cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgb(var(--bg-subtle))")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      {children}
    </button>
  );
}
