"use client";
import { useEffect, useState, type Dispatch, type SetStateAction, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { employeeLogin, saveEmployee, getEmployee } from "@/lib/employee";

// Remember-me stores the username + a base64-OBFUSCATED (not encrypted) password in localStorage
// so a returning user's credentials are pre-filled. Meant for a trusted personal machine.
const REMEMBER_KEY = "indus360.remember.creds";
const encPwd = (s: string) => { try { return btoa(unescape(encodeURIComponent(s))); } catch { return ""; } };
const decPwd = (s: string) => { try { return decodeURIComponent(escape(atob(s))); } catch { return ""; } };

export interface LoginForm {
  email: string; setEmail: Dispatch<SetStateAction<string>>;
  password: string; setPassword: Dispatch<SetStateAction<string>>;
  show: boolean; setShow: Dispatch<SetStateAction<boolean>>;
  remember: boolean; setRemember: Dispatch<SetStateAction<boolean>>;
  err: string | null; setErr: Dispatch<SetStateAction<string | null>>;
  busy: boolean;
  now: Date | null;
  greeting: () => string;
  submit: (e: FormEvent) => Promise<void>;
  forgot: () => void;
}

/**
 * ALL login LOGIC in one place — every login skin/design consumes this, so the page's look can be
 * swapped (Default / festive / event) WITHOUT touching the auth flow, remember-me, or redirects.
 * Authenticates three ways (employee bridge → admin app.Users → HR employee) exactly as before.
 */
export function useLoginForm(): LoginForm {
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

  // Pre-fill remembered credentials (username + password) if "Remember me" was used.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return;
      const { u, p } = JSON.parse(raw) as { u?: string; p?: string };
      if (u) setEmail(u);
      if (p) setPassword(decPwd(p));
      setRemember(true);
    } catch { /* ignore malformed / legacy value */ }
  }, []);

  useEffect(() => {
    if (status === "authenticated") { router.replace("/"); return; }
    if (status !== "loading" && getEmployee()) router.replace("/employee");
  }, [status, router]);

  const greeting = () => {
    if (!now) return "Welcome";
    const h = now.getHours();
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const em = email.trim();

    // Forget saved creds immediately if Remember me is off; save only after a successful login.
    if (!remember) localStorage.removeItem(REMEMBER_KEY);
    const rememberCreds = () => {
      if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ u: em, p: encPwd(password) }));
    };

    // 1) Employee bridge — mapped employees get a full app session.
    let res = await signIn("credentials", { mode: "employee", email: em, password, redirect: false });
    if (res?.ok && !res.error) { rememberCreds(); router.replace("/"); return; }

    // 2) Admin (app.Users).
    res = await signIn("credentials", { email: em, password, redirect: false });
    if (res?.ok && !res.error) { rememberCreds(); router.replace("/"); return; }

    // 3) Valid employee without an app account → HR profile; else bad credentials.
    const r = await employeeLogin(em, password);
    setBusy(false);
    if (r.success && r.employee) { rememberCreds(); saveEmployee(r.employee); router.replace("/employee"); }
    else setErr("Invalid username or password.");
  }

  const forgot = () => setErr("Please contact your administrator to reset your password.");

  return { email, setEmail, password, setPassword, show, setShow, remember, setRemember, err, setErr, busy, now, greeting, submit, forgot };
}
