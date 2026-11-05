"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { StandardModal, Button } from "indas-ui";
import { Mail, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";
const RESEND_SECONDS = 60;

async function post(path: string, body: unknown): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API}/api/auth/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { success: res.ok && data?.success !== false, message: data?.message || (res.ok ? "" : "Something went wrong. Please try again.") };
}

/**
 * "Forgot Password?" — 1) enter the account email → a 6-digit OTP is emailed to the address saved on that
 * account, 2) enter the OTP + a new password. The server answers step 1 the same way for every email, so
 * this screen never tells anyone whether an email is registered.
 */
export default function ForgotPasswordModal({ open, initialEmail, onClose, onDone }: {
  open: boolean; initialEmail: string; onClose: () => void; onDone: (email: string) => void;
}) {
  const [step, setStep] = useState<"email" | "otp" | "done">("email");
  const [typed, setTyped] = useState<string | null>(null);   // null = not edited yet → the login email
  const [email, setEmail] = useState("");                      // the address the OTP was requested for
  const [otp, setOtp] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [err, setErr] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);

  // Countdown for "Resend OTP".
  useEffect(() => {
    if (step !== "otp") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  // Reset on close (an event, not an effect), so the next open starts at step 1 with the login email.
  const close = () => {
    setStep("email"); setTyped(null); setEmail(""); setOtp(""); setPwd(""); setPwd2(""); setShow(false); setInfo(""); setErr(""); setResendAt(0);
    onClose();
  };
  const emailValue = typed ?? initialEmail;

  const send = async () => {
    const em = emailValue.trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) { setErr("Please enter a valid email."); return; }
    setBusy(true); setErr("");
    try {
      const r = await post("forgot-password", { email: em });
      if (!r.success) { setErr(r.message); return; }
      setEmail(em); setInfo(r.message); setStep("otp"); setOtp("");
      const t = Date.now(); setNow(t); setResendAt(t + RESEND_SECONDS * 1000);
    } catch { setErr("Could not reach the server. Please try again."); }
    finally { setBusy(false); }
  };

  const reset = async () => {
    if (!/^\d{6}$/.test(otp)) { setErr("Enter the 6-digit OTP from the email."); return; }
    if (pwd.length < 6) { setErr("The new password must be at least 6 characters."); return; }
    if (pwd !== pwd2) { setErr("The two passwords do not match."); return; }
    setBusy(true); setErr("");
    try {
      const r = await post("reset-password", { email, otp, newPassword: pwd });
      if (!r.success) { setErr(r.message); return; }
      setInfo(r.message); setStep("done");
    } catch { setErr("Could not reach the server. Please try again."); }
    finally { setBusy(false); }
  };

  const finish = () => { const em = email; close(); onDone(em); };

  return (
    <StandardModal isOpen={open} onClose={busy ? () => {} : close} title="Reset Password" size="sm"
      footerActions={
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {step !== "done" && <Button variant="action-cancel" size="md" onClick={close} disabled={busy}>Cancel</Button>}
          {step === "email" && <Button size="md" icon={Mail} loading={busy} onClick={send}>Send OTP</Button>}
          {step === "otp" && <Button size="md" icon={KeyRound} loading={busy} onClick={reset}>Reset Password</Button>}
          {step === "done" && <Button size="md" onClick={finish}>Back to Sign In</Button>}
        </div>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {step === "email" && (
          <>
            <div style={hint}>Enter the email you sign in with. We will send a one-time code (OTP) to the email saved on that account.</div>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" value={emailValue} onChange={(e) => setTyped(e.target.value)} autoComplete="username" autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="name@company.com" style={inp} />
            </div>
          </>
        )}

        {step === "otp" && (
          <>
            <div style={{ ...hint, color: "#166534", background: "rgba(22,163,74,.08)", border: "1px solid rgba(22,163,74,.25)", borderRadius: 10, padding: "8px 12px" }}>
              {info} <span style={{ color: "rgb(var(--fg-muted))" }}>Also check the Spam folder.</span>
            </div>
            <div>
              <label style={lbl}>OTP</label>
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code"
                autoFocus placeholder="6-digit code" style={{ ...inp, letterSpacing: 6, fontWeight: 700, fontSize: 18 }} />
              <div style={{ marginTop: 6, fontSize: 12.5, color: "rgb(var(--fg-muted))" }}>
                Sent to {email}.{" "}
                {wait > 0 ? <>Resend in {wait}s</> : (
                  <button type="button" onClick={send} disabled={busy} style={link}>Resend OTP</button>
                )}
                {" · "}<button type="button" onClick={() => { setTyped(email); setStep("email"); setErr(""); }} disabled={busy} style={link}>Change email</button>
              </div>
            </div>
            <div>
              <label style={lbl}>New Password</label>
              <div style={{ position: "relative" }}>
                <input type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password"
                  placeholder="At least 6 characters" style={{ ...inp, paddingRight: 40 }} />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: "rgb(var(--fg-muted))", display: "inline-flex" }}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <div>
              <label style={lbl}>Confirm New Password</label>
              <input type={show ? "text" : "password"} value={pwd2} onChange={(e) => setPwd2(e.target.value)} autoComplete="new-password"
                onKeyDown={(e) => { if (e.key === "Enter") reset(); }} placeholder="Type it again" style={inp} />
            </div>
          </>
        )}

        {step === "done" && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#166534", fontSize: 14, fontWeight: 600 }}>
            <CheckCircle2 size={20} style={{ flexShrink: 0 }} /> {info}
          </div>
        )}

        {err && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} /> {err}
          </div>
        )}
      </div>
    </StandardModal>
  );
}

const lbl: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 5 };
const hint: CSSProperties = { fontSize: 13, color: "rgb(var(--fg-muted))", lineHeight: 1.5 };
const inp: CSSProperties = {
  width: "100%", height: 42, padding: "0 12px", fontSize: 14, borderRadius: 10, border: "1px solid rgb(var(--bd-default, 203 213 225))",
  background: "rgb(var(--bg-surface, 255 255 255))", color: "rgb(var(--fg-default, 15 23 42))", outline: "none", boxSizing: "border-box",
};
const link: CSSProperties = { border: "none", background: "transparent", padding: 0, color: "rgb(var(--color-primary))", fontWeight: 600, cursor: "pointer", fontSize: 12.5 };
