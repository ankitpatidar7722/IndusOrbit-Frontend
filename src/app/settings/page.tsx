"use client";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Card, CardContent, Switch, Input, useModalAlert, ThemeContext, useDevice } from "indas-ui";

import {
  User, Bell, Settings as SettingsIcon, ArrowLeft, LogOut, Eye, EyeOff, KeyRound, Camera, X,
  CircleUser, PenLine, Mail, Server, Cloud, Zap, CheckCircle2, Database, Type, RotateCcw,
  Palette, Save, Loader2, Trash2, Check, Smartphone, Sparkles, HelpCircle, LayoutTemplate,
} from "lucide-react";
import { LOGIN_SKINS } from "@/app/login/skins";
import { usersApi, photoUrl, type UserDetail } from "@/lib/users";
import { emailApi } from "@/lib/email";
import ImageCropModal from "@/components/ImageCropModal";
import GuideModal from "@/components/GuideModal";
import { useNotifications } from "@/contexts/NotificationsContext";
import { MessageSquare } from "lucide-react";
import { bottomNavCandidates, DEFAULT_ITEMS, MAX_BOTTOM_NAV, iconForItem, loadBottomNav, saveBottomNav, type BottomNavStored } from "@/lib/bottomNav";

/* ─── palette ─── */
const NAVY = "rgb(var(--color-primary))";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";
const cardStyle: React.CSSProperties = { background: "rgb(var(--bg-surface))", border: "1px solid #e9edf3", borderRadius: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 12px 28px -18px rgba(16,24,40,.18)" };
const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-muted))", marginBottom: 6 };
const readOnlyChip: React.CSSProperties = { fontSize: 13.5, color: "rgb(var(--fg-default))", padding: "9px 12px", background: "rgb(var(--bg-subtle))", borderRadius: 8, border: "1px solid #e6eaf0", minHeight: 38 };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, background: NAVY, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-muted))", border: "1px solid #d7deea", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const iconBox: React.CSSProperties = { width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "rgb(var(--bg-subtle))", color: NAVY, flexShrink: 0 };

/** icon-box + title/subtitle + right control (the page's signature row). */
function Row({ icon, title, subtitle, children, tint, stackOnMobile }: { icon: React.ReactNode; title: string; subtitle?: string; children?: React.ReactNode; tint?: string; stackOnMobile?: boolean }) {
  const { isMobile } = useDevice();
  // Rows with a wide control (font-family select, font-size slider) stack on a phone so the control
  // drops below the title at full width instead of overflowing the row. Switch/button rows stay inline.
  const stack = !!isMobile && !!stackOnMobile;
  return (
    <div style={{ display: "flex", flexDirection: stack ? "column" : "row", alignItems: stack ? "flex-start" : "center", justifyContent: "space-between", gap: stack ? 12 : 14, padding: 14, background: "rgb(var(--bg-subtle))", borderRadius: 11, border: "1px solid #eef1f5" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ ...iconBox, ...(tint ? { background: `${tint}14`, color: tint } : {}) }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(var(--fg-default))" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ flexShrink: 0, ...(stack ? { width: "100%" } : {}) }}>{children}</div>
    </div>
  );
}

function EyeInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="new-password" style={{ paddingRight: 36 } as React.CSSProperties} />
      <button type="button" onClick={() => setShow((s) => !s)} style={{ position: "absolute", right: 9, top: 9, background: "none", border: "none", cursor: "pointer", color: "rgb(var(--fg-subtle))", padding: 2 }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
    </div>
  );
}

const FONTS = [
  ["system", "System Default"], ["roboto", "Roboto"], ["openSans", "Open Sans"], ["lato", "Lato"], ["poppins", "Poppins"],
  ["montserrat", "Montserrat"], ["nunito", "Nunito"], ["sourceSansPro", "Source Sans Pro"], ["workSans", "Work Sans"], ["ubuntu", "Ubuntu"],
] as const;
const PRESETS = [
  { variant: "default", name: "Default", color: "#003366" }, { variant: "green", name: "Forest", color: "#047857" },
  { variant: "red", name: "Crimson", color: "#B91C1C" }, { variant: "purple", name: "Royal", color: "#7C3AED" },
  { variant: "orange", name: "Sunset", color: "#C2410C" }, { variant: "black", name: "Midnight", color: "#000000" },
] as const;

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (x: number) => Math.max(0, Math.min(255, x));
  const r = clamp(((n >> 16) & 255) + amt), g = clamp(((n >> 8) & 255) + amt), b = clamp((n & 255) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const su = (session?.user ?? {}) as { UserID?: number; CompanyID?: number; name?: string; email?: string; Role?: string };
  const userId = su.UserID ?? 0;
  const companyId = su.CompanyID ?? 1;
  const { showSuccess, showError, showWarning, hideAlert, AlertComponent } = useModalAlert();
  const themeCtx = useContext(ThemeContext);
  const { isMobile } = useDevice();

  const [tab, setTab] = useState<"profile" | "notifications" | "preferences" | "bottomnav">("profile");
  // Which setup guide the Help popup is showing (null = closed).
  const [guide, setGuide] = useState<{ src: string; title: string } | null>(null);
  // Bottom Navbar (mobile): the user's chosen shortcut items (max 4). Persisted per-user in localStorage.
  // Candidates = Home/Clients/Chat/Alerts + every module the user can view.
  const [navItems, setNavItems] = useState<BottomNavStored[]>(DEFAULT_ITEMS);
  const [navCandidates, setNavCandidates] = useState<BottomNavStored[]>([]);
  useEffect(() => { setNavItems(loadBottomNav(userId)); }, [userId]);
  useEffect(() => { if (userId) bottomNavCandidates(userId).then(setNavCandidates); }, [userId]);
  const navHas = (key: string) => navItems.some((i) => i.key === key);
  const toggleNavItem = (it: BottomNavStored) => setNavItems((prev) => {
    if (prev.some((i) => i.key === it.key)) return prev.filter((i) => i.key !== it.key);
    if (prev.length >= MAX_BOTTOM_NAV) return prev;   // cap at 4 (a 5th "Menu" is always shown)
    return [...prev, it];
  });

  /* ── profile ── */
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [pf, setPf] = useState({ fullName: "", email: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [sign, setSign] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const signRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);   // image picked for the crop modal
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  /* ── password ── */
  const [showPwd, setShowPwd] = useState(false);
  const [pwd, setPwd] = useState({ cur: "", nw: "", cf: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  /* ── email/smtp ── */
  const [showEmail, setShowEmail] = useState(false);
  const [provider, setProvider] = useState("SMTP");
  const [smtp, setSmtp] = useState({ smtpUsername: "", smtpPassword: "", smtpServer: "smtp.gmail.com", smtpPort: "587", smtpAuthenticate: true, smtpUseSSL: true });
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);

  /* ── AI (Gemini) key — each user adds their own free key so no shared rate limit ── */
  const [showAi, setShowAi] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiHasKey, setGeminiHasKey] = useState(false);
  const [geminiMasked, setGeminiMasked] = useState("");
  const [savingAi, setSavingAi] = useState(false);
  useEffect(() => {
    if (userId) usersApi.geminiKeyStatus(userId).then((r) => { if (r.success) { setGeminiHasKey(r.hasKey); setGeminiMasked(r.masked); } }).catch(() => {});
  }, [userId]);
  const saveGeminiKey = async (explicit?: string) => {
    if (!userId) return;
    const key = (explicit !== undefined ? explicit : geminiKey).trim();
    setSavingAi(true);
    const r = await usersApi.selfGeminiKey(userId, key);
    setSavingAi(false);
    if (r.success) {
      setGeminiHasKey(!!key); setGeminiMasked(key ? `…${key.slice(-4)}` : ""); setGeminiKey(""); setShowAi(false);
      showSuccess(key ? "AI key saved" : "AI key removed", key ? "Your Gemini key is saved — Tracker summaries will use it." : "Your Gemini key has been cleared.", 2600);
    } else showError("Could not save", r.message || "Please try again.");
  };

  /* ── Change Login Page (admin only) — global login-screen DESIGN picker (auth logic unchanged) ── */
  const isAdmin = String((session?.user as { Role?: string } | undefined)?.Role || "").toLowerCase().includes("admin");
  const [loginDesign, setLoginDesign] = useState("default");
  const [savingLoginDesign, setSavingLoginDesign] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    fetch(`${API}/api/login-design`).then((r) => r.json()).then((d) => setLoginDesign((d?.design as string) || "default")).catch(() => {});
  }, [isAdmin]);
  const applyLoginDesign = async (id: string) => {
    if (savingLoginDesign || id === loginDesign) return;
    setSavingLoginDesign(true);
    try {
      const r = await fetch(`${API}/api/login-design`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ Design: id }) });
      if (r.ok) { setLoginDesign(id); showSuccess("Login page updated", `Everyone will now see the "${LOGIN_SKINS.find((s) => s.id === id)?.label}" login design.`, 2800); }
      else showError("Could not update", "Failed to change the login page design.");
    } catch { showError("Could not update", "Failed to change the login page design."); }
    finally { setSavingLoginDesign(false); }
  };

  /* ── notifications ── */
  const [notif, setNotif] = useState({ email: true, push: false, system: true });
  // OS/browser Web Push (real PushSubscription, not just a local pref).
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSupportedState, setPushSupportedState] = useState(true);
  useEffect(() => {
    let alive = true;
    import("@/lib/push").then(async (p) => {
      if (!alive) return;
      setPushSupportedState(p.pushSupported());
      setPushOn(await p.isPushSubscribed());
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const togglePush = async (v: boolean) => {
    setPushBusy(true);
    try {
      const p = await import("@/lib/push");
      if (v) { await p.subscribeToPush(userId, companyId); setPushOn(true); showSuccess("Push enabled", "You'll get notifications on this device even when the app is closed.", 2800); }
      else { await p.unsubscribeFromPush(userId, companyId); setPushOn(false); showSuccess("Push disabled", "OS notifications turned off on this device.", 2200); }
    } catch (e) {
      showError("Push notifications", e instanceof Error ? e.message : String(e));
      try { const p = await import("@/lib/push"); setPushOn(await p.isPushSubscribed()); } catch { /* ignore */ }
    } finally { setPushBusy(false); }
  };
  // Server-persisted chat/email notification prefs (drive whether notifications are raised at all).
  const { settings: notifSettings, saveSettings: saveNotifSettings } = useNotifications();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSign(localStorage.getItem("userSignature"));
      try { const n = JSON.parse(localStorage.getItem("indus360-notif-prefs") || "null"); if (n) setNotif(n); } catch { /* ignore */ }
    }
    if (userId) {
      usersApi.get(userId).then((r) => {
        if (r.success) {
          setDetail(r.data);
          // profile photo now lives on the server (app.Users.PhotoPath) — load it if present
          setPhoto(r.data.photoPath ? photoUrl(userId, r.data.photoPath) : null);
          setPf({ fullName: r.data.fullName ?? "", email: r.data.email ?? "" });
          setProvider(r.data.emailProvider || "SMTP");
          setSmtp((s) => ({
            ...s,
            smtpUsername: r.data.smtpUsername ?? "", smtpServer: r.data.smtpServer ?? "smtp.gmail.com",
            smtpPort: r.data.smtpPort ?? "587", smtpAuthenticate: r.data.smtpAuthenticate ?? true, smtpUseSSL: r.data.smtpUseSSL ?? true,
          }));
        }
      }).catch(() => {});
      emailApi.config(su.email).then((c) => setEmailConfigured(c.configured)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fileToBase64 = (file: File): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
  const upload = async (file: File | undefined, kind: "photo" | "sign") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showError("Invalid file", "Please choose an image."); return; }
    const max = kind === "photo" ? 8 : 1;
    if (file.size > max * 1024 * 1024) { showError("Too large", `Max ${max} MB.`); return; }
    const b64 = await fileToBase64(file);
    // Photo → open the WhatsApp-style crop modal; the cropped square gets uploaded to the server.
    if (kind === "photo") { setCropSrc(b64); return; }
    setSign(b64); localStorage.setItem("userSignature", b64);
  };
  // save the cropped photo to the server (disk) + point <img> at the served URL
  const onPhotoCropped = async (dataUrl: string) => {
    setCropSrc(null);
    if (!userId) return;
    setUploadingPhoto(true);
    try {
      const r = await usersApi.uploadPhoto(userId, dataUrl);
      if (r.success) { setPhoto(photoUrl(userId, r.version ?? Date.now())); showSuccess("Photo updated", "Your profile photo has been saved."); }
      else showError("Upload failed", r.message || "Could not save the photo.");
    } catch (e) { showError("Upload failed", String(e instanceof Error ? e.message : e)); }
    finally { setUploadingPhoto(false); }
  };
  const removeImg = async (kind: "photo" | "sign") => {
    if (kind === "photo") {
      setPhoto(null);
      if (userId) { try { await usersApi.deletePhoto(userId); } catch { /* ignore */ } }
      return;
    }
    setSign(null); localStorage.removeItem("userSignature");
  };

  const saveProfile = async () => {
    if (!pf.fullName.trim() || !pf.email.trim()) { showError("Required", "Name and email are required."); return; }
    setSavingProfile(true);
    const r = await usersApi.selfProfile(userId, { fullName: pf.fullName.trim(), email: pf.email.trim() });
    setSavingProfile(false);
    if (r.success) { setEditing(false); setDetail((d) => (d ? { ...d, fullName: pf.fullName, email: pf.email } : d)); showSuccess("Saved", "Profile updated.", 2000); }
    else showError("Save failed", r.message);
  };

  const changePwd = async () => {
    if (!pwd.cur || !pwd.nw) { showError("Required", "Enter current and new password."); return; }
    if (pwd.nw !== pwd.cf) { showError("Mismatch", "New passwords do not match."); return; }
    if (pwd.nw.length < 4) { showError("Too short", "New password must be at least 4 characters."); return; }
    setSavingPwd(true);
    const r = await usersApi.selfPassword(userId, { currentPassword: pwd.cur, newPassword: pwd.nw });
    setSavingPwd(false);
    if (r.success) { setPwd({ cur: "", nw: "", cf: "" }); setShowPwd(false); showSuccess("Password changed", "Your password has been updated.", 2200); }
    else showError("Failed", r.message);
  };

  const saveSmtp = async () => {
    setSavingSmtp(true);
    const r = await usersApi.selfSmtp(userId, { emailProvider: provider, ...smtp, smtpPassword: smtp.smtpPassword || undefined });
    setSavingSmtp(false);
    if (r.success) { setShowEmail(false); setEmailConfigured(!!smtp.smtpUsername); showSuccess("Email settings saved", "Your mail will send from this account.", 2500); emailApi.config(su.email).then((c) => setEmailConfigured(c.configured)).catch(() => {}); }
    else showError("Save failed", r.message);
  };

  const setNotifPref = (k: keyof typeof notif, v: boolean) => { const n = { ...notif, [k]: v }; setNotif(n); localStorage.setItem("indus360-notif-prefs", JSON.stringify(n)); };

  const clearData = () => {
    showWarning("Clear App Data", "This signs you out and wipes local preferences, cache and cookies on this device. Continue?", [
      { label: "Cancel", variant: "secondary", onClick: () => hideAlert() },
      { label: "Clear & Sign out", variant: "primary", onClick: () => { hideAlert(); try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ } signOut({ callbackUrl: "/login" }); } },
    ]);
  };
  const doLogout = () => {
    showWarning("Log out?", "You will be signed out of Indus Command Center.", [
      { label: "Cancel", variant: "secondary", onClick: () => hideAlert() },
      { label: "Log Out", variant: "primary", onClick: () => { hideAlert(); signOut({ callbackUrl: "/login" }); } },
    ]);
  };

  const applyCustom = (hex: string) => themeCtx?.setCustomTheme({ accent: hex, accentHover: shade(hex, -22), accentSubtle: shade(hex, 60), accentMuted: shade(hex, 30) }, "Custom");

  const tabs = useMemo(() => [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "preferences" as const, label: "Preferences", icon: SettingsIcon },
    { id: "bottomnav" as const, label: "Bottom Navbar", icon: Smartphone },
  ], []);

  const fontScale = themeCtx?.theme.fontScale ?? 100;

  return (
    <div style={{ padding: "8px 0 40px" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <button onClick={() => router.back()} style={{ ...ghostBtn, padding: "8px 12px" }}><ArrowLeft size={16} /> Back</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "rgb(var(--fg-default))", margin: 0 }}>Settings</h1>
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* left rail */}
        <div style={{ ...cardStyle, width: isMobile ? "100%" : 300, flexShrink: 0, padding: 14 }}>
          {tabs.map((t) => {
            const Icon = t.icon; const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, marginBottom: 6, textAlign: "left", background: active ? NAVY : "transparent", color: active ? "#fff" : "#48586b" }}>
                <Icon size={17} /> {t.label}
              </button>
            );
          })}
          <div style={{ borderTop: "1px solid #eef1f5", margin: "6px 4px 8px" }} />
          <button onClick={doLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "left", background: "transparent", color: "#c0392b" }}>
            <LogOut size={17} /> Logout
          </button>
        </div>

        {/* content — flex column (not grid) so a wide child (e.g. the 3-col theme presets) can't
            overflow via grid's min-width:auto; children stay bounded to the column width on mobile. */}
        <div style={{ flex: 1, minWidth: isMobile ? 0 : 320, display: "flex", flexDirection: "column", gap: 16 }}>
          {tab === "profile" && (
            <>
              {/* Profile Information */}
              <Card style={cardStyle}>
                <CardContent style={{ padding: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                    <div>
                      <div style={{ fontSize: 15.5, fontWeight: 700, color: "rgb(var(--fg-default))" }}>Profile Information</div>
                      <div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))", marginTop: 2 }}>Your personal details</div>
                    </div>
                    {!editing && <button onClick={() => setEditing(true)} style={ghostBtn}><PenLine size={15} /> Edit</button>}
                  </div>

                  <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: isMobile ? 20 : 26 }}>
                    {/* photo + signature */}
                    <div style={{ display: "flex", gap: 22 }}>
                      <div>
                        <div style={label}>Photo</div>
                        <div style={{ position: "relative", width: 80, height: 80 }}>
                          <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", background: "rgb(var(--bg-subtle))", display: "grid", placeItems: "center", border: "1px solid #e6eaf0" }}>
                            {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <CircleUser size={64} strokeWidth={1.1} color="#9aa7b4" />}
                          </div>
                          {/* Photo can be changed anytime (WhatsApp-style) — not gated behind profile Edit */}
                          <button onClick={() => photoRef.current?.click()} title="Change photo"
                            style={{ position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: "50%", background: NAVY, border: "2px solid #fff", cursor: "pointer", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 2px 6px rgba(0,0,0,.2)" }}>
                            {uploadingPhoto ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}
                          </button>
                          {photo && !uploadingPhoto && <button onClick={() => removeImg("photo")} title="Remove photo" style={{ position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: "50%", background: "#ef4444", color: "#fff", border: "2px solid #fff", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={11} /></button>}
                          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0], "photo"); e.currentTarget.value = ""; }} />
                        </div>
                      </div>
                      <div>
                        <div style={label}>Signature</div>
                        <div style={{ position: "relative", width: 128, height: 80 }}>
                          <div style={{ width: 128, height: 80, borderRadius: 10, border: "2px dashed #cbd5e1", background: "rgb(var(--bg-subtle))", display: "grid", placeItems: "center", overflow: "hidden" }}>
                            {sign ? <img src={sign} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <PenLine size={28} color="#9aa7b4" />}
                          </div>
                          {editing && <>
                            <button onClick={() => signRef.current?.click()} style={{ position: "absolute", inset: 0, borderRadius: 10, background: "rgba(0,0,0,.45)", border: "none", cursor: "pointer", color: "#fff", display: "grid", placeItems: "center" }}><Camera size={20} /></button>
                            {sign && <button onClick={() => removeImg("sign")} style={{ position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: "50%", background: "#ef4444", color: "#fff", border: "2px solid #fff", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={11} /></button>}
                            <input ref={signRef} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0], "sign"); e.currentTarget.value = ""; }} />
                          </>}
                        </div>
                      </div>
                    </div>

                    {/* fields */}
                    <div style={{ flex: 1, minWidth: isMobile ? 0 : 280, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                      <div><label style={label}>Full Name</label>{editing ? <Input value={pf.fullName} onChange={(e) => setPf((p) => ({ ...p, fullName: e.target.value }))} /> : <div style={readOnlyChip}>{detail?.fullName || "—"}</div>}</div>
                      <div><label style={label}>Email Address</label>{editing ? <Input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={pf.email} onChange={(e) => setPf((p) => ({ ...p, email: e.target.value }))} /> : <div style={readOnlyChip}>{detail?.email || "—"}</div>}</div>
                      <div><label style={label}>Role</label><div style={readOnlyChip}>{detail?.role || "—"}</div></div>
                      <div><label style={label}>Contact No</label><div style={readOnlyChip}>{detail?.mobile || <span style={{ color: "rgb(var(--fg-subtle))" }}>— from HR —</span>}</div></div>
                    </div>
                  </div>

                  {editing && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                      <button onClick={() => { setEditing(false); setPf({ fullName: detail?.fullName ?? "", email: detail?.email ?? "" }); }} style={ghostBtn}>Cancel</button>
                      <button onClick={saveProfile} disabled={savingProfile} style={{ ...primaryBtn, opacity: savingProfile ? 0.7 : 1 }}>{savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {savingProfile ? "Saving…" : "Update"}</button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email + Password */}
              <Card style={cardStyle}>
                <CardContent style={{ padding: 22, display: "grid", gap: 20 }}>
                  {/* Email Settings */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "rgb(var(--fg-default))" }}>Email Settings</div>
                        <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 2 }}>Configure your mailbox — emails you send go out from here.</div>
                        {emailConfigured && <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#1c9a54", marginTop: 6, fontWeight: 600 }}><CheckCircle2 size={13} /> {provider === "MicrosoftGraph" ? "Microsoft Graph" : "SMTP"} configured</div>}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button onClick={() => setGuide({ src: "/email-smtp-guide.html", title: "Email (SMTP) — Setup Guide" })} style={ghostBtn}><HelpCircle size={15} /> Help</button>
                        {!showEmail && <button onClick={() => setShowEmail(true)} style={ghostBtn}><Mail size={15} /> Configure</button>}
                      </div>
                    </div>
                    {showEmail && (
                      <div style={{ marginTop: 14, padding: 16, background: "rgb(var(--bg-subtle))", borderRadius: 10, border: "1px solid #e6eaf0", display: "grid", gap: 14 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          {[["MicrosoftGraph", "Microsoft Graph", Cloud], ["SMTP", "SMTP", Server]].map(([pv, lbl, Ic]) => {
                            const P = Ic as React.ElementType; const on = provider === pv;
                            return <button key={pv as string} onClick={() => setProvider(pv as string)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", background: on ? NAVY : "#fff", color: on ? "#fff" : "#48586b", border: on ? "none" : "1px solid #d7deea" }}><P size={15} /> {lbl as string}</button>;
                          })}
                        </div>
                        {provider === "MicrosoftGraph" && <div style={{ fontSize: 12.5, color: "#8a5a00", background: "#fff8e6", border: "1px solid #f2e2b8", borderRadius: 8, padding: "8px 12px" }}>Microsoft Graph isn&apos;t wired yet — sending uses SMTP. Fill the SMTP details below.</div>}
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                          <div><label style={label}>SMTP Username</label><Input inputMode="email" autoCapitalize="none" autoCorrect="off" value={smtp.smtpUsername} onChange={(e) => setSmtp((s) => ({ ...s, smtpUsername: e.target.value }))} placeholder="you@gmail.com" /></div>
                          <div><label style={label}>SMTP Password</label><EyeInput value={smtp.smtpPassword} onChange={(v) => setSmtp((s) => ({ ...s, smtpPassword: v }))} placeholder="App password (leave blank to keep)" /></div>
                          <div><label style={label}>SMTP Server</label><Input value={smtp.smtpServer} onChange={(e) => setSmtp((s) => ({ ...s, smtpServer: e.target.value }))} placeholder="smtp.gmail.com" /></div>
                          <div><label style={label}>Port</label><Input inputMode="numeric" value={smtp.smtpPort} onChange={(e) => setSmtp((s) => ({ ...s, smtpPort: e.target.value }))} placeholder="587" /></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                          <button onClick={() => setShowEmail(false)} style={ghostBtn}>Cancel</button>
                          <button onClick={saveSmtp} disabled={savingSmtp} style={{ ...primaryBtn, opacity: savingSmtp ? 0.7 : 1 }}>{savingSmtp ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save</button>
                        </div>
                        <div style={{ fontSize: 11.5, color: "rgb(var(--fg-subtle))" }}>Tip: for Gmail use an <b>App Password</b> (Google Account → Security → App passwords), not your login password.</div>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid #eef1f5" }} />

                  {/* AI Summary Key (Gemini) — per-user, self-service */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "rgb(var(--fg-default))", display: "inline-flex", alignItems: "center", gap: 6 }}><Sparkles size={15} style={{ color: NAVY }} /> AI Summary Key (Gemini)</div>
                        <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 2 }}>Add your own free Google Gemini key — the Tracker “Summarize” button uses your key, so you never hit a shared limit.</div>
                        {geminiHasKey && <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#1c9a54", marginTop: 6, fontWeight: 600 }}><CheckCircle2 size={13} /> Key configured {geminiMasked && <span style={{ color: "rgb(var(--fg-muted))", fontWeight: 500 }}>({geminiMasked})</span>}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button onClick={() => setGuide({ src: "/gemini-key-guide.html", title: "AI Summary Key — Setup Guide" })} style={ghostBtn}><HelpCircle size={15} /> Help</button>
                        {!showAi && <button onClick={() => setShowAi(true)} style={ghostBtn}><Sparkles size={15} /> {geminiHasKey ? "Change" : "Add key"}</button>}
                      </div>
                    </div>
                    {showAi && (
                      <div style={{ marginTop: 14, padding: 16, background: "rgb(var(--bg-subtle))", borderRadius: 10, border: "1px solid #e6eaf0", display: "grid", gap: 14 }}>
                        <div><label style={label}>Gemini API Key</label><EyeInput value={geminiKey} onChange={setGeminiKey} placeholder={geminiHasKey ? "Enter a new key to replace the current one" : "Paste your Gemini API key"} /></div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: NAVY, fontWeight: 700 }}>Get a free key ↗</a>
                          <div style={{ display: "flex", gap: 10 }}>
                            {geminiHasKey && <button onClick={() => saveGeminiKey("")} disabled={savingAi} style={ghostBtn}><Trash2 size={14} /> Remove</button>}
                            <button onClick={() => { setShowAi(false); setGeminiKey(""); }} style={ghostBtn}>Cancel</button>
                            <button onClick={() => saveGeminiKey()} disabled={savingAi || !geminiKey.trim()} style={{ ...primaryBtn, opacity: savingAi || !geminiKey.trim() ? 0.6 : 1 }}>{savingAi ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 11.5, color: "rgb(var(--fg-subtle))" }}>Sign in with your office Google account at the link above → <b>Create API key</b> (it&apos;s free). Your key is stored securely and used only for your own summaries.</div>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid #eef1f5" }} />

                  {/* Reset Password */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "rgb(var(--fg-default))" }}>Reset Password</div>
                        <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 2 }}>Update your password to keep your account secure.</div>
                      </div>
                      {!showPwd && <button onClick={() => setShowPwd(true)} style={ghostBtn}><KeyRound size={15} /> Reset</button>}
                    </div>
                    {showPwd && (
                      <div style={{ marginTop: 14, padding: 16, background: "rgb(var(--bg-subtle))", borderRadius: 10, border: "1px solid #e6eaf0", display: "grid", gap: 14 }}>
                        <div><label style={label}>Current password</label><EyeInput value={pwd.cur} onChange={(v) => setPwd((p) => ({ ...p, cur: v }))} /></div>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                          <div><label style={label}>New password</label><EyeInput value={pwd.nw} onChange={(v) => setPwd((p) => ({ ...p, nw: v }))} /></div>
                          <div><label style={label}>Confirm new password</label><EyeInput value={pwd.cf} onChange={(v) => setPwd((p) => ({ ...p, cf: v }))} /></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                          <button onClick={() => { setShowPwd(false); setPwd({ cur: "", nw: "", cf: "" }); }} style={ghostBtn}>Cancel</button>
                          <button onClick={changePwd} disabled={savingPwd} style={{ ...primaryBtn, opacity: savingPwd ? 0.7 : 1 }}>{savingPwd ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Update</button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {tab === "notifications" && (
            <Card style={cardStyle}>
              <CardContent style={{ padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15.5, fontWeight: 700, color: "rgb(var(--fg-default))", marginBottom: 4 }}><Bell size={17} /> Notification Preferences</div>
                <div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))", marginBottom: 18 }}>Choose how you want to be notified.</div>
                <div style={{ display: "grid", gap: 12 }}>
                  <Row icon={<MessageSquare size={18} />} title="Message Notifications" subtitle="Get notified when someone sends you a chat message">
                    <Switch checked={notifSettings.NotifyMessages} onCheckedChange={(v: boolean) => saveNotifSettings({ ...notifSettings, NotifyMessages: v })} />
                  </Row>
                  <Row icon={<Mail size={18} />} title="Email Notifications" subtitle="Get notified when a new email arrives in your inbox">
                    <Switch checked={notifSettings.NotifyEmails} onCheckedChange={(v: boolean) => saveNotifSettings({ ...notifSettings, NotifyEmails: v })} />
                  </Row>
                  <Row icon={<Bell size={18} />} title="Push Notifications (OS)" subtitle={pushSupportedState ? "Get notified on your phone or desktop, even when the app is closed" : "Not supported in this browser"}>
                    <Switch checked={pushOn} disabled={pushBusy || !pushSupportedState} onCheckedChange={togglePush} />
                  </Row>
                  <Row icon={<Zap size={18} />} title="System Updates" subtitle="Notifications about system maintenance and updates"><Switch checked={notif.system} onCheckedChange={(v: boolean) => setNotifPref("system", v)} /></Row>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "preferences" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Font family */}
              <Row icon={<Type size={18} />} title="Font Family" subtitle="Choose your preferred font style" stackOnMobile>
                <select value={themeCtx?.theme.fontFamily ?? "system"} onChange={(e) => themeCtx?.setFontFamily(e.target.value as "system")} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d7deea", fontSize: 13, minWidth: 180, width: isMobile ? "100%" : undefined, background: "rgb(var(--bg-surface))" }}>
                  {FONTS.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
                </select>
              </Row>

              {/* Font size */}
              <Row icon={<Eye size={18} />} title="Font Size" subtitle={`Adjust text size: ${Math.round(fontScale)}%`} stackOnMobile>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", width: isMobile ? "100%" : undefined }}>
                  <span style={{ fontSize: 11, color: "rgb(var(--fg-subtle))" }}>80%</span>
                  <input type="range" min={80} max={150} step={1} value={fontScale} onChange={(e) => themeCtx?.setFontScale(parseInt(e.target.value))} style={{ width: isMobile ? 140 : 180, accentColor: NAVY }} />
                  <span style={{ fontSize: 11, color: "rgb(var(--fg-subtle))" }}>150%</span>
                  <button onClick={() => themeCtx?.setFontScale(100)} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }}><RotateCcw size={13} /> Reset</button>
                </div>
              </Row>

              {/* Theme customizer */}
              <Card style={cardStyle}>
                <CardContent style={{ padding: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ ...iconBox, background: `linear-gradient(135deg,${NAVY},color-mix(in srgb, rgb(var(--color-primary)) 60%, white))`, color: "#fff" }}><Palette size={18} /></div>
                      <div><div style={{ fontSize: 14, fontWeight: 700, color: "rgb(var(--fg-default))" }}>Theme Customizer</div><div style={{ fontSize: 12, color: "rgb(var(--fg-muted))" }}>Mode, presets & custom color</div></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: "rgb(var(--fg-muted))" }}>{themeCtx?.isDark ? "Dark" : "Light"} mode</span><Switch checked={!!themeCtx?.isDark} onCheckedChange={() => themeCtx?.toggleMode()} /></div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgb(var(--fg-muted))", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Color Themes</div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                    {PRESETS.map((p) => {
                      const on = (themeCtx?.theme.variant ?? "default") === p.variant;
                      return (
                        <button key={p.variant} onClick={() => themeCtx?.setVariant(p.variant)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, cursor: "pointer", background: on ? "#f6f8fb" : "#fff", border: on ? `2px solid ${NAVY}` : "2px solid #e6eaf0" }}>
                          <div style={{ display: "flex", gap: 2, height: 40, width: "100%" }}>
                            <div style={{ flex: 1, background: p.color, borderRadius: "5px 0 0 5px" }} />
                            <div style={{ flex: 1, background: p.color, opacity: 0.7 }} />
                            <div style={{ flex: 1, background: p.color, opacity: 0.4, borderRadius: "0 5px 5px 0" }} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "rgb(var(--fg-default))" }}>{p.name}{on && <Check size={13} color={NAVY} />}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgb(var(--fg-muted))", margin: "18px 0 8px", textTransform: "uppercase", letterSpacing: 0.4 }}>Custom Color</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "rgb(var(--bg-subtle))", borderRadius: 10, border: "1px solid #e6eaf0" }}>
                    <input type="color" defaultValue="#3B82F6" onChange={(e) => applyCustom(e.target.value)} style={{ width: 44, height: 40, borderRadius: 8, border: "1px solid #d7deea", cursor: "pointer", background: "none" }} />
                    <div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))" }}>Pick a brand color to generate a custom theme. {themeCtx?.customTheme && <button onClick={() => themeCtx?.removeCustomTheme()} style={{ ...ghostBtn, padding: "4px 10px", fontSize: 12, marginLeft: 6 }}>Reset</button>}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Change Login Page — admin only, global design picker (login logic unchanged) */}
              {isAdmin && (
                <Card style={cardStyle}>
                  <CardContent style={{ padding: 22 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ ...iconBox, background: NAVY, color: "#fff" }}><LayoutTemplate size={18} /></div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "rgb(var(--fg-default))" }}>Change Login Page</div>
                        <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))" }}>Pick the sign-in design everyone sees. Design only — the login itself works exactly the same.</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(3, minmax(0,1fr))", gap: 12, marginTop: 16 }}>
                      {LOGIN_SKINS.map((s) => {
                        const on = loginDesign === s.id;
                        return (
                          <button key={s.id} onClick={() => applyLoginDesign(s.id)} disabled={savingLoginDesign}
                            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: 14, borderRadius: 12, cursor: savingLoginDesign ? "default" : "pointer", textAlign: "left",
                              background: on ? "#f6f8fb" : "rgb(var(--bg-surface))", border: on ? `2px solid ${NAVY}` : "2px solid #e6eaf0", opacity: savingLoginDesign && !on ? 0.6 : 1 }}>
                            <div style={{ fontSize: 30, lineHeight: 1 }}>{s.preview}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700, color: "rgb(var(--fg-default))" }}>{s.label}{on && <Check size={14} color={NAVY} />}</div>
                            <div style={{ fontSize: 11.5, color: "rgb(var(--fg-muted))" }}>{s.description}</div>
                            <span style={{ fontSize: 11, fontWeight: on ? 700 : 600, color: on ? NAVY : "rgb(var(--fg-subtle))" }}>{on ? "● Active" : "Tap to apply"}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11.5, color: "rgb(var(--fg-subtle))", marginTop: 12 }}>Applies to everyone (global). Open the login page in a private window to preview.</div>
                  </CardContent>
                </Card>
              )}

              {/* Clear data */}
              <Row icon={<Database size={18} />} title="Clear App Data" subtitle="Sign out and wipe cookies, cache and local storage on this device" tint="#ef4444">
                <button onClick={clearData} style={{ ...ghostBtn, color: "#c0392b", borderColor: "#eec4c4" }}><Trash2 size={15} /> Clear</button>
              </Row>
            </div>
          )}

          {tab === "bottomnav" && (
            <Card style={cardStyle}>
              <CardContent style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15.5, fontWeight: 700, color: "rgb(var(--fg-default))", marginBottom: 4 }}>
                  <Smartphone size={17} /> Bottom Navbar
                </div>
                <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))", marginBottom: 16 }}>
                  Choose up to {MAX_BOTTOM_NAV} shortcuts for the mobile bottom bar (tap to add / remove).
                  A <b>Menu</b> button (opens the full sidebar) is always shown. <b>{navItems.length}/{MAX_BOTTOM_NAV}</b> selected.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                  {(navCandidates.length ? navCandidates : navItems).map((it) => {
                    const on = navHas(it.key);
                    const full = !on && navItems.length >= MAX_BOTTOM_NAV;
                    const Icon = iconForItem(it);
                    return (
                      <button key={it.key} type="button" onClick={() => { if (!full) toggleNavItem(it); }} disabled={full}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 11, cursor: full ? "not-allowed" : "pointer", textAlign: "left",
                          border: `1.5px solid ${on ? NAVY : "#d7deea"}`,
                          background: on ? "color-mix(in srgb, rgb(var(--color-primary)) 10%, transparent)" : "rgb(var(--bg-surface))",
                          color: on ? NAVY : "rgb(var(--fg-muted))", opacity: full ? 0.45 : 1 }}>
                        <Icon size={18} style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{it.label}</span>
                        {on && <Check size={16} style={{ flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                  {navCandidates.length === 0 && <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "rgb(var(--fg-subtle))", padding: 12 }}>Loading modules…</div>}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <button onClick={() => { saveBottomNav(userId, navItems); showSuccess("Saved", "Bottom navbar updated.", 2000); }}
                    disabled={navItems.length === 0} style={{ ...primaryBtn, opacity: navItems.length ? 1 : 0.6 }}>
                    <Save size={15} /> Save
                  </button>
                  <button onClick={() => setNavItems(DEFAULT_ITEMS)} style={ghostBtn}><RotateCcw size={15} /> Reset to default</button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <AlertComponent />
      <GuideModal src={guide?.src ?? null} title={guide?.title} onClose={() => setGuide(null)} />
      <ImageCropModal open={!!cropSrc} imageSrc={cropSrc} onCancel={() => setCropSrc(null)} onCropped={onPhotoCropped} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin .8s linear infinite}`}</style>
    </div>
  );
}
