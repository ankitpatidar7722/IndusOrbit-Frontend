"use client";
import { User, Lock, Eye, EyeOff, Globe } from "lucide-react";
import type { LoginForm } from "../useLoginForm";

/**
 * The shared white sign-in card (greeting + username/password + remember + login button). Every
 * login skin renders THIS for the actual form, wrapping it in its own background / logo / decoration.
 * `accent` recolors the greeting + button + links so festive skins can match their theme.
 */
export function LoginCardBody({ form, accent = "rgb(var(--color-primary))" }: { form: LoginForm; accent?: string }) {
  const { email, setEmail, password, setPassword, show, setShow, remember, setRemember, err, busy, greeting, submit, forgot } = form;

  const field: React.CSSProperties = {
    width: "100%", height: 46, borderRadius: 10, border: "1px solid #d9e0ea", background: "rgb(var(--bg-subtle))",
    padding: "0 42px", fontSize: 14, color: "rgb(var(--fg-default))", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "rgb(var(--fg-muted))",
  };

  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div style={{ background: "rgb(var(--bg-surface))", borderRadius: 18, boxShadow: "0 24px 60px -24px rgba(16,24,40,.35), 0 2px 8px rgba(16,24,40,.05)", border: "1px solid #eef1f6", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 18px 0" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))", background: "rgb(var(--bg-subtle))", borderRadius: 999, padding: "4px 10px" }}>
            <Globe size={13} /> En
          </span>
        </div>

        <div style={{ padding: "8px 32px 34px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: accent, margin: 0, lineHeight: 1.2 }}>{greeting()}</h1>
          <p style={{ fontSize: 14, color: "rgb(var(--fg-muted))", marginTop: 6, marginBottom: 24 }}>Login to your account</p>

          <form onSubmit={submit}>
            <label style={labelStyle}>Username</label>
            <div style={{ position: "relative", marginTop: 6, marginBottom: 18 }}>
              <User size={16} style={{ position: "absolute", left: 14, top: 15, color: "rgb(var(--fg-subtle))" }} />
              <input type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your username"
                autoComplete="username" required style={field} />
            </div>

            <label style={labelStyle}>Password</label>
            <div style={{ position: "relative", marginTop: 6, marginBottom: 14 }}>
              <Lock size={16} style={{ position: "absolute", left: 14, top: 15, color: "rgb(var(--fg-subtle))" }} />
              <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password"
                autoComplete="current-password" required style={{ ...field, paddingRight: 42 }} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
                style={{ position: "absolute", right: 10, top: 11, background: "none", border: "none", cursor: "pointer", color: "rgb(var(--fg-subtle))", padding: 4 }}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "rgb(var(--fg-muted))", cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: accent, cursor: "pointer" }} />
                Remember me
              </label>
              <button type="button" onClick={forgot}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: accent }}>
                Forgot Password?
              </button>
            </div>

            {err && (
              <div style={{ fontSize: 12.5, color: "#c33", background: "#fdecec", border: "1px solid #f4c9c9", borderRadius: 10, padding: "9px 12px", marginTop: 12, textAlign: "center" }}>
                {err}
              </div>
            )}

            <button type="submit" disabled={busy}
              style={{ width: "100%", height: 48, marginTop: 20, borderRadius: 10, border: "none", cursor: busy ? "default" : "pointer",
                color: "#fff", fontSize: 15, fontWeight: 700, background: accent, boxShadow: "0 10px 22px -10px rgba(31,69,118,.7)", opacity: busy ? 0.7 : 1 }}>
              {busy ? "Signing in…" : "Login"}
            </button>
          </form>
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "rgb(var(--fg-subtle))", marginTop: 18 }}>
        © {new Date().getFullYear()} Indus Analytics · All rights reserved
      </p>
    </div>
  );
}
