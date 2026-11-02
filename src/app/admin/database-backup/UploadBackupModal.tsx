"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { StandardModal, Button, Input, Dropdown } from "indas-ui";
import { Upload, FileArchive, HardDrive, CheckCircle2, AlertCircle, AlertTriangle, RotateCcw, DatabaseBackup, X, FolderOpen } from "lucide-react";
import { backupUploadApi, databaseBackupApi, type ServerCredentials, type UploadedBackupInfo, type UploadOpStatus } from "@/lib/databaseBackup";

type Step = "select" | "uploading" | "finishing" | "uploaded" | "restoring" | "restored";
type RestoreMode = "new" | "replace";
interface RestoreResult { databaseName: string; sizeMB: number; dataFolder: string; replaced?: boolean; safetyBackup?: string | null }
const SYSTEM_DBS = ["master", "model", "msdb", "tempdb", "distribution"];

const PARALLEL = 3;
const RETRIES = 4;

const fmtMB = (mb: number | null | undefined) =>
  mb == null ? "—" : mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
const fmtBytes = (b: number) => fmtMB(b / 1048576);
const fmtEta = (sec: number) =>
  !isFinite(sec) || sec <= 0 ? "" : sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`
    : sec >= 60 ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : `${Math.round(sec)}s`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Browser-side gzip (backups shrink a lot) — falls back to raw bytes on browsers without CompressionStream.
const canGzip = typeof window !== "undefined" && "CompressionStream" in window;
async function gzipBlob(b: Blob): Promise<Blob> {
  return new Response(b.stream().pipeThrough(new CompressionStream("gzip"))).blob();
}

async function pollOp<T>(id: string, onTick: (s: UploadOpStatus<T>) => void, signal: AbortSignal): Promise<UploadOpStatus<T>> {
  while (!signal.aborted) {
    try {
      const s = await backupUploadApi.op<T>(id);
      onTick(s);
      if (s.isComplete) return s;
    } catch { /* transient — keep polling */ }
    await sleep(900);
  }
  throw new Error("Cancelled.");
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  creds: () => ServerCredentials;
  serverLabel: string;
  existingDatabases: string[];
  onBusyChange: (busy: boolean) => void;
  onRestored: () => void;
}

export default function UploadBackupModal({ isOpen, onClose, creds, serverLabel, existingDatabases, onBusyChange, onRestored }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [target, setTarget] = useState<{ folder: string; freeMB: number | null } | null>(null);
  const [targetError, setTargetError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [sentRaw, setSentRaw] = useState(0);
  const [sentWire, setSentWire] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [opPercent, setOpPercent] = useState(0);
  const [opStage, setOpStage] = useState("");
  const [info, setInfo] = useState<UploadedBackupInfo | null>(null);
  const [dbName, setDbName] = useState("");
  const [mode, setMode] = useState<RestoreMode>("new");
  const [replaceDb, setReplaceDb] = useState("");
  const [safetyBackup, setSafetyBackup] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  // The parent only knows the databases after "Show Databases" — read the list here so Replace always has it.
  const [dbs, setDbs] = useState<string[]>(existingDatabases);
  const [restored, setRestored] = useState<RestoreResult | null>(null);
  const uploadIdRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = step === "uploading" || step === "finishing" || step === "restoring";

  // Clock for speed / time-left while uploading.
  useEffect(() => {
    if (step !== "uploading") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);

  // The parent mounts this modal only while open, so every open starts with fresh state.
  useEffect(() => {
    backupUploadApi.target(creds())
      .then(setTarget)
      .catch((e) => setTargetError(e instanceof Error ? e.message : "Could not read the server's backup folder."));
    databaseBackupApi.serverDatabases(creds())
      .then((list) => setDbs(list.map((d) => d.name)))
      .catch(() => { /* keep the parent's list */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tooBig = !!file && target?.freeMB != null && file.size / 1048576 + 512 > target.freeMB;

  const pickFile = (f: File | null) => {
    setError("");
    if (f && !f.name.toLowerCase().endsWith(".bak")) { setFile(null); setError("Please choose a .bak file."); return; }
    setFile(f);
  };

  const upload = async () => {
    if (!file || busy) return;
    setError(""); setSentRaw(0); setSentWire(0);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const st = await backupUploadApi.start(creds(), file.name, file.size);
      uploadIdRef.current = st.uploadId;
      setStep("uploading");
      setStartedAt(Date.now());

      // Parallel workers pull the next chunk number; each chunk retries with back-off before giving up.
      let next = 0;
      const worker = async () => {
        while (!ac.signal.aborted) {
          const seq = next++;
          if (seq >= st.parts) return;
          const raw = file.slice(seq * st.chunkBytes, Math.min(file.size, (seq + 1) * st.chunkBytes));
          const body = canGzip ? await gzipBlob(raw) : raw;
          for (let attempt = 0; ; attempt++) {
            try {
              await backupUploadApi.chunk(st.uploadId, seq, body, canGzip, ac.signal);
              break;
            } catch (e) {
              if (ac.signal.aborted || attempt >= RETRIES) throw e;
              await sleep(1000 * 2 ** attempt);
            }
          }
          setSentRaw((v) => v + raw.size);
          setSentWire((v) => v + body.size);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, st.parts) }, worker));
      if (ac.signal.aborted) return;

      setStep("finishing"); setOpPercent(5); setOpStage("Joining file on the server");
      const { operationId } = await backupUploadApi.complete(st.uploadId);
      const res = await pollOp<UploadedBackupInfo>(operationId, (s) => { setOpPercent(s.percent); setOpStage(s.stage); }, ac.signal);
      if (!res.success || !res.result) throw new Error(res.error || "The uploaded file could not be verified.");
      setInfo(res.result);
      const base = res.result.databaseName || file.name.replace(/\.bak$/i, "");
      const clean = base.replace(/[^A-Za-z0-9_-]/g, "_");
      const same = dbs.find((d) => d.toLowerCase() === clean.toLowerCase());
      setDbName(same ? `${clean}_Restored` : clean);
      // The backup's own database already exists here → most likely an update of it: preselect Replace.
      if (same) { setMode("replace"); setReplaceDb(same); }
      setStep("uploaded");
    } catch (e) {
      if (ac.signal.aborted) return;
      if (uploadIdRef.current) backupUploadApi.cancel(uploadIdRef.current);
      uploadIdRef.current = "";
      setError(e instanceof Error ? e.message : "Upload failed.");
      setStep("select");
    }
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
    if (uploadIdRef.current) backupUploadApi.cancel(uploadIdRef.current);
    uploadIdRef.current = "";
    setStep("select");
    setError("Upload cancelled.");
  };

  const dbNameValid = /^[A-Za-z0-9_-]{1,100}$/.test(dbName);
  const dbNameTaken = dbs.some((d) => d.toLowerCase() === dbName.toLowerCase());
  const replaceOptions = dbs.filter((d) => !SYSTEM_DBS.includes(d.toLowerCase()) && /^[A-Za-z0-9_-]{1,100}$/.test(d));
  const replaceConfirmed = !!replaceDb && confirmText.trim().toLowerCase() === replaceDb.toLowerCase();
  const targetDb = mode === "new" ? dbName : replaceDb;
  const canRestore = mode === "new" ? dbNameValid && !dbNameTaken : replaceConfirmed;

  const restore = async () => {
    if (!uploadIdRef.current || !canRestore) return;
    setError("");
    const ac = new AbortController();
    abortRef.current = ac;
    setStep("restoring"); setOpPercent(2); setOpStage("Preparing restore");
    try {
      const { operationId } = await backupUploadApi.restore(uploadIdRef.current, targetDb, mode === "replace", safetyBackup);
      const res = await pollOp<RestoreResult>(
        operationId, (s) => { setOpPercent(s.percent); setOpStage(s.stage); }, ac.signal);
      if (!res.success || !res.result) throw new Error(res.error || "Restore failed.");
      setRestored(res.result);
      setStep("restored");
      onRestored();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
      setStep("uploaded");
    }
  };

  const close = () => { if (!busy) onClose(); };

  const elapsed = startedAt && now > startedAt ? (now - startedAt) / 1000 : 0;
  const speed = elapsed > 0 ? sentWire / elapsed : 0;   // bytes/s actually sent
  const pct = file ? Math.round((100 * sentRaw) / file.size) : 0;
  const eta = file && sentRaw > 0 ? (elapsed * (file.size - sentRaw)) / sentRaw : Infinity;

  return (
    <StandardModal isOpen={isOpen} onClose={close} title="Upload Backup" subtitle={serverLabel} size="lg"
      footerActions={
        <div data-navguard-safe style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {step === "select" && (
            <Button onClick={upload} size="md" icon={Upload} disabled={!file || tooBig || !!targetError}>Upload</Button>
          )}
          {step === "uploading" && (
            <Button onClick={cancelUpload} size="md" variant="action-secondary" icon={X}>Cancel Upload</Button>
          )}
          {step === "uploaded" && (
            <Button onClick={restore} size="md" icon={DatabaseBackup} disabled={!canRestore}>
              {mode === "replace" ? "Replace Database" : "Restore Database"}
            </Button>
          )}
          <Button onClick={close} size="md" variant="action-secondary" disabled={busy}>
            {step === "uploaded" || step === "restored" ? "Done" : "Close"}
          </Button>
        </div>
      }>
      <div data-navguard-safe style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Destination */}
        <div style={box}>
          <div style={rowLabel}><FolderOpen size={15} /> Saved to</div>
          {targetError ? (
            <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>{targetError}</div>
          ) : !target ? (
            <div style={muted}>Reading the server&apos;s backup folder…</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "baseline" }}>
              <code style={{ fontSize: 13, color: "rgb(var(--fg-default))", wordBreak: "break-all" }}>{info?.filePath ?? target.folder}</code>
              <span style={muted}><HardDrive size={13} style={{ verticalAlign: -2 }} /> {fmtMB(target.freeMB)} free on {target.folder.slice(0, 2)}</span>
            </div>
          )}
        </div>

        {/* 1. Pick a file */}
        {step === "select" && (
          <div>
            <input ref={fileInput} type="file" accept=".bak" style={{ display: "none" }}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            <div style={dropZone} onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0] ?? null); }}>
              <FileArchive size={30} style={{ color: "rgb(var(--color-primary))" }} />
              {file ? (
                <>
                  <div style={{ fontWeight: 700, color: "rgb(var(--fg-default))", wordBreak: "break-all" }}>{file.name}</div>
                  <div style={muted}>{fmtBytes(file.size)} · click to choose another file</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 700, color: "rgb(var(--fg-default))" }}>Choose a .bak file</div>
                  <div style={muted}>Click here or drag the file in</div>
                </>
              )}
            </div>
            {tooBig && (
              <div style={{ ...errLine, marginTop: 10 }}>
                <AlertCircle size={16} /> Not enough space on the server — the file needs {fmtBytes(file!.size)}, only {fmtMB(target?.freeMB)} free.
              </div>
            )}
          </div>
        )}

        {/* 2. Uploading */}
        {step === "uploading" && file && (
          <div>
            <ProgressBar label={`Uploading ${file.name}`} percent={pct} />
            <div style={{ ...muted, marginTop: 8, display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
              <span>{fmtBytes(sentRaw)} of {fmtBytes(file.size)}</span>
              {canGzip && sentWire > 0 && <span>sent compressed: {fmtBytes(sentWire)}</span>}
              {speed > 0 && <span>{(speed / 1048576).toFixed(1)} MB/s</span>}
              {fmtEta(eta) && <span>about {fmtEta(eta)} left</span>}
            </div>
            <div style={{ ...muted, marginTop: 8 }}>Please keep this tab open until the upload finishes.</div>
          </div>
        )}

        {/* 3 / 5. Server-side work */}
        {(step === "finishing" || step === "restoring") && (
          <div>
            <ProgressBar label={opStage || "Working…"} percent={opPercent} />
            <div style={{ ...muted, marginTop: 8 }}>
              {step === "restoring"
                ? `${mode === "replace" ? "Replacing" : "Restoring as"} ${targetDb} — please keep this tab open.`
                : "Almost done — checking the file on the server."}
            </div>
          </div>
        )}

        {/* 4. Uploaded → details + restore */}
        {(step === "uploaded" || step === "restored") && info && (
          <div style={box}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#16a34a", fontWeight: 700, marginBottom: 10 }}>
              <CheckCircle2 size={18} /> File uploaded and verified
            </div>
            <div style={grid}>
              <Info label="Database in backup" value={info.databaseName ?? "—"} />
              <Info label="Backed up on" value={info.backupDate ? new Date(info.backupDate).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} />
              <Info label="Source server" value={info.sourceServer ?? "—"} />
              <Info label="Backup size" value={fmtMB(info.backupSizeMB)} />
              <Info label="Size after restore" value={fmtMB(info.restoredSizeMB)} />
            </div>
          </div>
        )}

        {step === "uploaded" && (
          <div style={box}>
            <div style={rowLabel}><DatabaseBackup size={15} /> Restore (optional)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button type="button" onClick={() => setMode("new")} style={modeBtn(mode === "new")}>New database</button>
              <button type="button" onClick={() => setMode("replace")} style={modeBtn(mode === "replace")}>Replace existing database</button>
            </div>

            {mode === "new" ? (
              <>
                <div style={{ maxWidth: 380 }}>
                  <Input value={dbName} onChange={(e) => setDbName(e.target.value.trim())} placeholder="New database name" autoComplete="off" />
                </div>
                <div style={{ ...muted, marginTop: 6, color: dbNameTaken || (dbName && !dbNameValid) ? "#dc2626" : undefined }}>
                  {dbNameTaken ? "A database with this name already exists — choose another name, or use \"Replace existing database\"."
                    : dbName && !dbNameValid ? "Use only letters, numbers, _ and - (max 100)."
                      : "Creates a new database from this backup. Skip this if you only wanted the file on the server."}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ maxWidth: 380 }}>
                  <Dropdown value={replaceDb} onValueChange={(v) => { setReplaceDb(String(v)); setConfirmText(""); }} size="md" searchable
                    placeholder="Select the database to replace" options={replaceOptions.map((d) => ({ value: d, label: d }))} />
                </div>
                {replaceDb && (
                  <>
                    <div style={warnBox}>
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>
                        All current data in <b>{replaceDb}</b> will be replaced with the data from this backup
                        {info?.databaseName && info.databaseName.toLowerCase() !== replaceDb.toLowerCase() && <> (a backup of <b>{info.databaseName}</b>)</>}.
                        Users connected to it will be disconnected.
                      </span>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer" }}>
                      <input type="checkbox" checked={safetyBackup} onChange={(e) => setSafetyBackup(e.target.checked)} />
                      Back up the current {replaceDb} first (recommended)
                    </label>
                    <div style={{ maxWidth: 380 }}>
                      <div style={{ fontSize: 13, color: "#334155", marginBottom: 4 }}>Type <b>{replaceDb}</b> to confirm</div>
                      <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={replaceDb} autoComplete="off" />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {step === "restored" && restored && (
          <div style={{ ...box, borderColor: "rgba(22,163,74,.4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#16a34a", fontWeight: 700 }}>
              <CheckCircle2 size={18} /> Database {restored.databaseName} {restored.replaced ? "replaced" : "restored"} ({fmtMB(restored.sizeMB)})
            </div>
            <div style={{ ...muted, marginTop: 4 }}>Files are in {restored.dataFolder}</div>
            {restored.safetyBackup && (
              <div style={{ ...muted, marginTop: 4, wordBreak: "break-all" }}>Previous data saved in {restored.safetyBackup}</div>
            )}
          </div>
        )}

        {error && (
          <div style={errLine}>
            <AlertCircle size={16} /> {error}
            {step === "select" && file && !tooBig && (
              <button type="button" onClick={upload} style={linkBtn}><RotateCcw size={13} /> Try again</button>
            )}
          </div>
        )}
      </div>
    </StandardModal>
  );
}

function ProgressBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-default))", wordBreak: "break-all" }}>{label}</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: "rgb(var(--color-primary))" }}>{percent}%</span>
      </div>
      <div style={{ height: 12, borderRadius: 999, background: "rgb(var(--bg-muted, 229 231 235))", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${percent}%`, borderRadius: 999, background: "rgb(var(--color-primary))", transition: "width .25s ease" }} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "rgb(var(--fg-default))", wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

const box: CSSProperties = { border: "1px solid rgb(var(--border-default))", borderRadius: 12, padding: "12px 14px" };
const rowLabel: CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8 };
const muted: CSSProperties = { fontSize: 12, color: "rgb(var(--fg-muted))" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 };
const dropZone: CSSProperties = {
  border: "2px dashed rgb(var(--border-default))", borderRadius: 14, padding: "26px 16px", display: "flex",
  flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center", cursor: "pointer",
};
const modeBtn = (active: boolean): CSSProperties => ({
  border: `1px solid ${active ? "rgb(var(--color-primary))" : "rgb(var(--border-default))"}`,
  background: active ? "rgb(var(--color-primary) / 0.08)" : "transparent",
  color: active ? "rgb(var(--color-primary))" : "#334155",
  fontWeight: 600, fontSize: 13, borderRadius: 999, padding: "6px 14px", cursor: "pointer",
});
const warnBox: CSSProperties = {
  display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#b45309", lineHeight: 1.45,
  background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.35)", borderRadius: 10, padding: "8px 12px",
};
const errLine: CSSProperties = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, color: "#dc2626", fontSize: 13, fontWeight: 600 };
const linkBtn: CSSProperties = {
  border: "none", background: "transparent", color: "rgb(var(--color-primary))", fontWeight: 600, fontSize: 13,
  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, padding: 0,
};
