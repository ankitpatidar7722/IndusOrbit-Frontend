"use client";
import { Button } from "indas-ui";
import { DatabaseZap, RotateCcw, Trash2, FilePlus2, Upload, FileDown, CheckCircle2, Save } from "lucide-react";
import { softBtn as soft } from "./toolbarButtonStyle";

// Shared action toolbar for all 5 Import-Master screens (HSN/SparePart/Item/Tool/Ledger), matching
// BulkImport's exact button VISIBILITY:
//   Load Data (always) · Clear All Data (always, disabled when rows selected) ·
//   [Soft Delete (loaded) | Delete Excel Row (preview/validated)] (hidden in idle) ·
//   Fresh Upload (always) · Existing Upload (always) · Export (mode≠idle) ·
//   Check Validation (preview/validated only) · Save Data (only once validation passes → HIDDEN otherwise).
// One horizontal row (nowrap, scrolls on narrow screens).

export type MasterMode = "idle" | "loaded" | "preview" | "validated";

export default function MasterToolbar({
  mode, rowCount, selectedCount, busy, isValid,
  onLoad, onClear, onDelete, onFreshUpload, onExistingUpload, onExport, onValidate, onSave,
}: {
  mode: MasterMode; rowCount: number; selectedCount: number; busy: boolean; isValid: boolean;
  onLoad: () => void; onClear: () => void; onDelete: () => void; onFreshUpload: () => void;
  onExistingUpload: () => void; onExport: () => void; onValidate: () => void; onSave: () => void;
}) {
  const showDelete = mode === "loaded" || mode === "preview" || mode === "validated";
  const showValidate = mode === "preview" || mode === "validated";
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto", marginBottom: 14, justifyContent: "center", paddingBottom: 2 }}>
      <Button size="sm" variant="action-secondary" icon={DatabaseZap} onClick={onLoad} disabled={busy} style={soft("#3b82f6", "#1d4ed8", busy)}>Load Data</Button>
      <Button size="sm" variant="action-delete" icon={RotateCcw} onClick={onClear} disabled={busy || selectedCount > 0}>Clear All Data</Button>
      {showDelete && (
        <Button size="sm" variant="action-secondary" icon={Trash2} onClick={onDelete} disabled={busy || selectedCount === 0} style={soft("#f59e0b", "#b45309", busy || selectedCount === 0)}>
          {mode === "loaded" ? `Soft Delete (${selectedCount})` : `Delete Excel Row (${selectedCount})`}
        </Button>
      )}
      <Button size="sm" variant="action-secondary" icon={FilePlus2} onClick={onFreshUpload} disabled={busy} style={soft("#8b5cf6", "#6d28d9", busy)}>Fresh Upload</Button>
      <Button size="sm" variant="action-secondary" icon={Upload} onClick={onExistingUpload} disabled={busy} style={soft("#1f4576", "#16325a", busy)}>Existing Upload</Button>
      {mode !== "idle" && <Button size="sm" variant="action-secondary" icon={FileDown} onClick={onExport} disabled={busy} style={soft("#06b6d4", "#0e7490", busy)}>Export</Button>}
      {showValidate && <Button size="sm" variant="action-secondary" icon={CheckCircle2} onClick={onValidate} disabled={busy || rowCount === 0} style={soft("#ec4899", "#be185d", busy || rowCount === 0)}>Check Validation</Button>}
      {isValid && <Button size="sm" variant="action-save" icon={Save} onClick={onSave} disabled={busy}>Save Data</Button>}
    </div>
  );
}
