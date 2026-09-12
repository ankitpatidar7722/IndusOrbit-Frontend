"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AlertTriangle, Flame, Lock, ShieldAlert, Loader2 } from "lucide-react";
import { getCompanyClientUsers } from "@/bulk/services/api";

// Shared 3-step escalating security flow for "Clear All Data" (and Fresh Upload), matching BulkImport:
//   Step 1 WARNING · Step 2 CONFIRMATION · Step 3 FINAL CONFIRMATION — each gated by a fresh arithmetic
//   captcha — then Step 4 credential (Username + Password + Reason), authorised against the client's
//   user master (the backend clear endpoint validates the credentials). Polished, professional look.

interface StepCfg { title: string; body: string; cancel: string; ok: string; accent: string; Icon: typeof AlertTriangle }

const INP: CSSProperties = { padding: "10px 12px", borderRadius: 10, fontSize: 13.5, width: "100%", border: "1px solid rgb(var(--border-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" };
const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 };

export default function SecurityClearModal({
  open, groupLabel, companyName, companyUserId, busy, error, actionLabel = "Authorize & Clear Data", onCancel, onSubmit,
}: {
  open: boolean; groupLabel: string; companyName: string; companyUserId: string; busy: boolean; error?: string;
  actionLabel?: string; onCancel: () => void; onSubmit: (username: string, password: string, reason: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [captcha, setCaptcha] = useState({ a: 0, b: 0, ans: 0 });
  const [input, setInput] = useState("");
  const [capErr, setCapErr] = useState(false);
  const [creds, setCreds] = useState({ username: "", password: "", reason: "" });
  const [users, setUsers] = useState<string[]>([]);
  const capRef = useRef<HTMLInputElement>(null);

  const gen = () => { const a = Math.floor(Math.random() * 50) + 20, b = Math.floor(Math.random() * 30) + 10; setCaptcha({ a, b, ans: a - b }); setInput(""); setCapErr(false); };

  useEffect(() => {
    if (!open) return;
    setStep(1); gen(); setCreds({ username: "", password: "", reason: "" });
    getCompanyClientUsers(companyUserId).then((r) => setUsers(((r?.data ?? []) as { userName?: string }[]).map((u) => u.userName ?? "").filter(Boolean))).catch(() => setUsers([]));
  }, [open, companyUserId]);

  const steps = useMemo<StepCfg[]>(() => [
    { title: `WARNING — Data Deletion (1/3)`, body: `Are you sure you want to clear ALL ${groupLabel} data for this client?`, cancel: "Cancel", ok: "Yes, Continue", accent: "#dc2626", Icon: AlertTriangle },
    { title: `CONFIRMATION (2/3)`, body: `Have you discussed with the client that this data needs to be cleared?`, cancel: "No, Cancel", ok: "Yes, Proceed", accent: "#ea580c", Icon: AlertTriangle },
    { title: `FINAL CONFIRMATION (3/3)`, body: `Have you received an email from your client asking to clear the data?`, cancel: "No, Cancel", ok: "Yes, Proceed", accent: "#b91c1c", Icon: Flame },
  ], [groupLabel]);

  if (!open) return null;

  const next = () => { if (parseInt(input) !== captcha.ans) { setCapErr(true); return; } if (step < 3) { setStep(step + 1); gen(); } else setStep(4); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!creds.username.trim() || !creds.reason.trim()) return; onSubmit(creds.username.trim(), creds.password, creds.reason.trim()); };

  const cfg = step <= 3 ? steps[step - 1] : null;
  const accent = cfg?.accent ?? "rgb(var(--color-primary))";
  const correct = input !== "" && parseInt(input) === captcha.ans;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ width: 480, maxWidth: "100%", background: "rgb(var(--bg-surface))", borderRadius: 20, boxShadow: "0 24px 64px -12px rgba(2,6,23,0.5)", border: `2px solid ${accent}`, padding: "26px 26px 22px", maxHeight: "92vh", overflowY: "auto" }}>
        {/* Icon badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 58, height: 58, borderRadius: 16, background: step <= 3 ? `${accent}1a` : "rgba(31,69,118,0.10)", color: step <= 3 ? accent : "rgb(var(--color-primary))" }}>
            {step <= 3 ? (cfg && <cfg.Icon size={28} />) : <Lock size={28} />}
          </span>
        </div>

        {cfg ? (
          <>
            <h2 style={{ textAlign: "center", fontSize: 19, fontWeight: 800, color: accent, margin: "0 0 10px", letterSpacing: 0.3, textTransform: "uppercase" }}>{cfg.title}</h2>
            <p style={{ textAlign: "center", fontSize: 14, color: "rgb(var(--fg-default))", margin: "0 0 8px", lineHeight: 1.5 }}>{cfg.body}</p>
            <p style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#dc2626", margin: "0 0 18px", letterSpacing: 0.5, textTransform: "uppercase" }}>
              Note: this permanently deletes all {groupLabel} data for {companyName}.
            </p>

            {/* Security verification sub-card */}
            <div style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.28)", borderRadius: 14, padding: "16px 18px", marginBottom: 18 }}>
              <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "rgb(var(--color-primary))", letterSpacing: 1.4, marginBottom: 12 }}>SECURITY VERIFICATION — SOLVE THIS</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 30, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "rgb(var(--color-primary))" }}>{captcha.a}</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: "rgb(var(--fg-muted))" }}>−</span>
                <span style={{ fontSize: 30, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "rgb(var(--color-primary))" }}>{captcha.b}</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: "rgb(var(--fg-muted))" }}>=</span>
                <span style={{ fontSize: 30, fontWeight: 900, color: "rgba(100,116,139,0.5)" }}>?</span>
                <span style={{ width: 34, height: 3, borderRadius: 2, background: correct ? "#22c55e" : "rgba(148,163,184,0.4)", transition: "background .15s" }} />
              </div>
              <input ref={capRef} autoFocus type="number" value={input} placeholder="Enter answer"
                onChange={(e) => { setInput(e.target.value); setCapErr(false); }} onKeyDown={(e) => { if (e.key === "Enter") next(); }}
                style={{ width: "100%", textAlign: "center", padding: "10px 12px", borderRadius: 10, fontSize: 18, fontWeight: 700, fontFamily: "ui-monospace, monospace", border: `2px solid ${capErr ? "#dc2626" : "rgb(var(--border-default))"}`, background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))" }} />
              {capErr && <p style={{ color: "#dc2626", fontSize: 12.5, margin: "8px 0 0", textAlign: "center", fontWeight: 600 }}>Incorrect answer. Please try again.</p>}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "transparent", border: "1px solid rgb(var(--border-default))", color: "rgb(var(--fg-muted))" }}>{cfg.cancel}</button>
              <button onClick={next} style={{ flex: 1.4, padding: "11px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", background: "rgb(var(--color-primary))", border: "none", color: "#fff", boxShadow: "0 6px 16px -6px rgba(31,69,118,0.5)" }}>{cfg.ok}</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 style={{ textAlign: "center", fontSize: 19, fontWeight: 800, color: "rgb(var(--fg-default))", margin: "0 0 4px" }}>Security Verification</h2>
            <p style={{ textAlign: "center", fontSize: 12.5, color: "rgb(var(--fg-muted))", margin: "0 0 18px" }}>Authorise with a valid <b>{companyName}</b> user (validated against the user master).</p>
            <div style={{ marginBottom: 12 }}>
              <div style={lbl}>Username <span style={{ color: "#dc2626" }}>*</span></div>
              <input list="clear-user-list" required value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} style={INP} placeholder="Start typing a user…" />
              <datalist id="clear-user-list">{users.map((u) => <option key={u} value={u} />)}</datalist>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={lbl}>Password <span style={{ color: "rgb(var(--fg-muted))", fontWeight: 400, fontSize: 11 }}>(optional)</span></div>
              <input type="password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} style={INP} placeholder="Leave blank if no password is set" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Reason for Deletion <span style={{ color: "#dc2626" }}>*</span></div>
              <textarea required rows={3} value={creds.reason} onChange={(e) => setCreds({ ...creds, reason: e.target.value })} style={INP} placeholder="Please explicitly state why the data is being cleared…" />
            </div>
            {error && <p style={{ color: "#dc2626", fontSize: 13, fontWeight: 600, margin: "0 0 12px", textAlign: "center" }}>{error}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "transparent", border: "1px solid rgb(var(--border-default))", color: "rgb(var(--fg-muted))" }}>Cancel</button>
              <button type="submit" disabled={busy} style={{ flex: 1.6, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: busy ? "wait" : "pointer", background: "#dc2626", border: "none", color: "#fff", opacity: busy ? 0.75 : 1, boxShadow: "0 6px 16px -6px rgba(220,38,38,0.5)" }}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />} {actionLabel}
              </button>
            </div>
          </form>
        )}
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "rgb(var(--fg-muted))" }}>Step {step} of 4</div>
      </div>
    </div>
  );
}
