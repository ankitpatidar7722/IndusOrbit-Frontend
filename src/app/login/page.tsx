"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Image from "next/image";
import { User, Lock, Eye, EyeOff, Globe } from "lucide-react";
import { employeeLogin, saveEmployee, getEmployee } from "@/lib/employee";

/**
 * Unified sign-in — Parkson/Estimo split layout (big INDAS logo left, white card right).
 * One page authenticates three ways:
 *  1. Employee (IndusAppDB.Employees) → bridges to the mapped Indus360 app session,
 *  2. Admin (app.Users) fallback,
 *  3. Unmapped employee → HR profile page.
 * No Company Code / Financial Year — just Username + Password. Greeting is time-based.
 */
const REMEMBER_KEY = "indus360.remember.username";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // Live clock (drives the time-based greeting) — null on the server to avoid a hydration mismatch.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Remembered username.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(REMEMBER_KEY) : null;
    if (saved) { setEmail(saved); setRemember(true); }
  }, []);

  useEffect(() => {
    if (status === "authenticated") { router.replace("/"); return; }
    if (status !== "loading" && getEmployee()) router.replace("/employee");
  }, [status, router]);

  function greeting() {
    if (!now) return "Welcome";
    const h = now.getHours();
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  }

  // Soft, time-of-day background wash (matches the Parkson login).
  function bgGradient() {
    const h = now?.getHours() ?? 14;
    if (h >= 6 && h < 12) return "linear-gradient(135deg,#fff7ed 0%,#fefce8 45%,#dbeafe 100%)"; // morning
    if (h >= 12 && h < 17) return "linear-gradient(135deg,#eff6ff 0%,#ffffff 50%,#cffafe 100%)"; // afternoon
    return "linear-gradient(135deg,#faf5ff 0%,#eff6ff 45%,#e0e7ff 100%)"; // evening / night
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const em = email.trim();

    if (remember) localStorage.setItem(REMEMBER_KEY, em);
    else localStorage.removeItem(REMEMBER_KEY);

    // 1) Employee bridge — mapped employees get a full app session.
    let res = await signIn("credentials", { mode: "employee", email: em, password, redirect: false });
    if (res?.ok && !res.error) { router.replace("/"); return; }

    // 2) Admin (app.Users).
    res = await signIn("credentials", { email: em, password, redirect: false });
    if (res?.ok && !res.error) { router.replace("/"); return; }

    // 3) Valid employee without an app account → HR profile; else bad credentials.
    const r = await employeeLogin(em, password);
    setBusy(false);
    if (r.success && r.employee) { saveEmployee(r.employee); router.replace("/employee"); }
    else setErr("Invalid username or password.");
  }

  const field: React.CSSProperties = {
    width: "100%", height: 46, borderRadius: 10, border: "1px solid #d9e0ea", background: "rgb(var(--bg-subtle))",
    padding: "0 42px", fontSize: 14, color: "rgb(var(--fg-default))", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "rgb(var(--fg-muted))",
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", background: bgGradient(), transition: "background 1s ease" }}
      className="grid-cols-1 lg:grid-cols-2">
      {/* ── Left: brand / big logo (lg+) ── */}
      <section className="hidden lg:flex" style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 64px" }}>
        <div style={{ width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Image src="/app/company-logo.png" alt="INDAS Analytics" width={500} height={250}
            priority style={{ width: "100%", maxWidth: 460, height: "auto", objectFit: "contain" }} />
        </div>
      </section>

      {/* ── Right: sign-in card ── */}
      <section className="p-4 sm:p-6 lg:p-16" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        {/* Mobile logo */}
        <div className="lg:hidden" style={{ width: "100%", maxWidth: 220, marginBottom: 24 }}>
          <Image src="/app/company-logo.png" alt="INDAS Analytics" width={440} height={220}
            priority style={{ width: "100%", height: "auto", objectFit: "contain" }} />
        </div>

        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ background: "rgb(var(--bg-surface))", borderRadius: 18, boxShadow: "0 24px 60px -24px rgba(16,24,40,.35), 0 2px 8px rgba(16,24,40,.05)", border: "1px solid #eef1f6", overflow: "hidden" }}>
            {/* Language chip (top-right) */}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 18px 0" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))", background: "rgb(var(--bg-subtle))", borderRadius: 999, padding: "4px 10px" }}>
                <Globe size={13} /> En
              </span>
            </div>

            <div style={{ padding: "8px 32px 34px" }}>
              {/* Greeting + title */}
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "rgb(var(--color-primary))", margin: 0, lineHeight: 1.2 }}>{greeting()}</h1>
              <p style={{ fontSize: 14, color: "rgb(var(--fg-muted))", marginTop: 6, marginBottom: 24 }}>Login to your account</p>

              <form onSubmit={submit}>
                <label style={labelStyle}>Username</label>
                <div style={{ position: "relative", marginTop: 6, marginBottom: 18 }}>
                  <User size={16} style={{ position: "absolute", left: 14, top: 15, color: "rgb(var(--fg-subtle))" }} />
                  <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your username"
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

                {/* Remember me + forgot password */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "rgb(var(--fg-muted))", cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: "rgb(var(--color-primary))", cursor: "pointer" }} />
                    Remember me
                  </label>
                  <button type="button" onClick={() => setErr("Please contact your administrator to reset your password.")}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "rgb(var(--color-primary))" }}>
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
                    color: "#fff", fontSize: 15, fontWeight: 700,
                    background: "rgb(var(--color-primary))", boxShadow: "0 10px 22px -10px rgba(31,69,118,.7)", opacity: busy ? 0.7 : 1 }}>
                  {busy ? "Signing in…" : "Login"}
                </button>
              </form>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: "rgb(var(--fg-subtle))", marginTop: 18 }}>
            © {new Date().getFullYear()} Indus Analytics · All rights reserved
          </p>
        </div>
      </section>
    </main>
  );
}
