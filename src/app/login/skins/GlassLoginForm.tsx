"use client";
import { User, Lock, Eye, EyeOff, Globe, LogIn } from "lucide-react";
import type { LoginForm } from "../useLoginForm";

/**
 * Shared frosted-glass sign-in form used by every festive skin (Ganesh / Diwali / New Year). Light
 * text on a dark festive background; only the accent (button gradient) and link colour change per
 * theme. Module-level so typing never remounts / loses focus. Login logic lives in the `form` hook.
 */
export function GlassLoginForm({
  form, accentFrom = "#e2692e", accentTo = "#c2410c", link = "#ffcf8a",
}: { form: LoginForm; accentFrom?: string; accentTo?: string; link?: string }) {
  const { email, setEmail, password, setPassword, show, setShow, remember, setRemember, err, busy, greeting, submit, forgot } = form;
  const field: React.CSSProperties = {
    width: "100%", height: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,.55)",
    background: "rgba(255,255,255,.93)", padding: "0 40px", fontSize: 14, color: "#2a1a10", outline: "none", boxSizing: "border-box",
  };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,246,236,.85)" };

  return (
    <div style={{ width: "100%", maxWidth: 400 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 999, padding: "4px 10px" }}>
          <Globe size={13} /> En
        </span>
      </div>

      <h1 style={{ fontSize: 27, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.15, textShadow: "0 2px 12px rgba(0,0,0,.4)" }}>{greeting()}</h1>
      <p style={{ fontSize: 14, color: "rgba(255,244,232,.82)", marginTop: 6, marginBottom: 20 }}>Welcome Back</p>

      <form onSubmit={submit}>
        <label style={label}>Username</label>
        <div style={{ position: "relative", marginTop: 6, marginBottom: 15 }}>
          <User size={16} style={{ position: "absolute", left: 13, top: 14, color: "#9a7a58" }} />
          <input type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your username" autoComplete="username" required style={field} />
        </div>

        <label style={label}>Password</label>
        <div style={{ position: "relative", marginTop: 6, marginBottom: 14 }}>
          <Lock size={16} style={{ position: "absolute", left: 13, top: 14, color: "#9a7a58" }} />
          <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password"
            autoComplete="current-password" required style={{ ...field, paddingRight: 42 }} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
            style={{ position: "absolute", right: 10, top: 11, background: "none", border: "none", cursor: "pointer", color: "#9a7a58", padding: 4 }}>
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "rgba(255,246,236,.9)", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 15, height: 15, accentColor: accentTo, cursor: "pointer" }} />
            Remember me
          </label>
          <button type="button" onClick={forgot} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: link }}>
            Forgot Password?
          </button>
        </div>

        {err && (
          <div style={{ fontSize: 12.5, color: "#fff", background: "rgba(190,40,40,.55)", border: "1px solid rgba(255,180,180,.5)", borderRadius: 10, padding: "9px 12px", marginTop: 12, textAlign: "center" }}>
            {err}
          </div>
        )}

        <button type="submit" disabled={busy}
          style={{ width: "100%", height: 47, marginTop: 18, borderRadius: 10, border: "none", cursor: busy ? "default" : "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, color: "#fff", fontSize: 15, fontWeight: 700,
            background: `linear-gradient(180deg,${accentFrom} 0%,${accentTo} 100%)`, boxShadow: `0 12px 26px -10px ${accentTo}cc`, opacity: busy ? 0.7 : 1 }}>
          <LogIn size={18} /> {busy ? "Signing in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
