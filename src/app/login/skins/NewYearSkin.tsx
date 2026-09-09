"use client";
import Image from "next/image";
import type { LoginForm } from "../useLoginForm";
import { GlassLoginForm } from "./GlassLoginForm";

/** Festive New Year skin — night sky with twinkling stars, SVG fireworks, falling confetti and a
 * glowing year inside a spinning starburst, with the shared frosted-glass login card. */
const ACCENT = { accentFrom: "#8b5cf6", accentTo: "#6d28d9", link: "#c4b5fd" };

function Firework({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return <line key={i} x1={50} y1={50} x2={50 + Math.cos(a) * 44} y2={50 + Math.sin(a) * 44} stroke={color} strokeWidth={2} strokeLinecap="round" />;
      })}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return <circle key={"d" + i} cx={50 + Math.cos(a) * 46} cy={50 + Math.sin(a) * 46} r={2.4} fill={color} />;
      })}
    </svg>
  );
}
/** Slowly-spinning golden starburst backdrop. */
function Starburst() {
  const c = 200, rays = 24;
  return (
    <svg viewBox="0 0 400 400" width="100%" height="100%" aria-hidden preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", inset: 0, animation: "nySpin 60s linear infinite" }}>
      <g stroke="#c4b5fd" strokeWidth={1.3} fill="none">
        {Array.from({ length: rays }, (_, i) => {
          const a = (i / rays) * Math.PI * 2, out = i % 2 === 0 ? 0.98 : 0.74;
          return <line key={i} x1={c + Math.cos(a) * c * 0.32} y1={c + Math.sin(a) * c * 0.32} x2={c + Math.cos(a) * c * out} y2={c + Math.sin(a) * c * out} />;
        })}
        <circle cx={c} cy={c} r={c * 0.74} stroke="#fcd34d" />
        <circle cx={c} cy={c} r={c * 0.32} />
      </g>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2, x = c + Math.cos(a) * c * 0.86, y = c + Math.sin(a) * c * 0.86;
        return <circle key={"s" + i} cx={x} cy={y} r={3} fill="#fcd34d" />;
      })}
    </svg>
  );
}

function Branding({ year, compact }: { year: number; compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: compact ? 4 : 10 }}>
      <div style={{ position: "relative", display: "grid", placeItems: "center", width: compact ? 140 : 220, height: compact ? 140 : 220 }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.5 }}><Starburst /></div>
        <div aria-hidden style={{ position: "absolute", width: compact ? 100 : 156, height: compact ? 100 : 156, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,.5) 0%, transparent 68%)", animation: "nyHalo 3.4s ease-in-out infinite" }} />
        <div style={{ position: "relative", fontSize: compact ? 38 : 56, fontWeight: 900, color: "#fff", letterSpacing: 1, textShadow: "0 0 28px rgba(167,139,250,.95), 0 2px 10px rgba(0,0,0,.4)" }}>{year}</div>
      </div>
      <h2 style={{ margin: compact ? "8px 0 0" : "14px 0 0", fontFamily: "'Nirmala UI','Noto Sans Devanagari',system-ui,sans-serif", fontSize: compact ? 22 : 30, fontWeight: 800, letterSpacing: 0.5, color: "#e9e6ff", textShadow: "0 2px 18px rgba(139,92,246,.7)" }}>नववर्ष की शुभकामनाएं</h2>
      <p style={{ margin: 0, fontSize: compact ? 12.5 : 15, fontWeight: 600, letterSpacing: 1, color: "#c4b5fd", textTransform: "uppercase" }}>🎉 Happy New Year 🎉</p>
      <div style={{ width: compact ? 148 : 240, marginTop: compact ? 6 : 18 }}>
        <Image src="/app/company-logo.png" alt="INDAS Analytics" width={440} height={220} priority style={{ width: "100%", height: "auto", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.96 }} />
      </div>
    </div>
  );
}

/** Cool frosted-glass card wrapper around the login form. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", maxWidth: 420, borderRadius: 20, background: "rgba(20,18,52,.52)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
      border: "1px solid rgba(184,174,255,.3)", boxShadow: "0 24px 60px -22px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.14)", padding: "26px 26px 30px" }}>
      {children}
    </div>
  );
}

export function NewYearSkin({ form }: { form: LoginForm }) {
  const year = (form.now?.getFullYear() ?? new Date().getFullYear()) + 1;
  const stars = [
    { top: "18%", left: "22%", d: "0s" }, { top: "30%", left: "10%", d: ".6s" }, { top: "58%", left: "16%", d: "1.1s" },
    { top: "24%", left: "46%", d: ".3s" }, { top: "68%", left: "38%", d: "1.5s" }, { top: "16%", left: "66%", d: ".9s" },
    { top: "44%", left: "72%", d: "1.3s" }, { top: "62%", left: "84%", d: ".5s" },
  ];
  const confetti = [
    { left: "8%", dur: "9s", delay: "0s", col: "#fcd34d" }, { left: "22%", dur: "11s", delay: "2s", col: "#f472b6" },
    { left: "36%", dur: "10s", delay: "4s", col: "#a78bfa" }, { left: "52%", dur: "12s", delay: "1s", col: "#34d399" },
    { left: "68%", dur: "10.5s", delay: "3s", col: "#60a5fa" }, { left: "84%", dur: "13s", delay: "1.6s", col: "#fbbf24" },
  ];
  return (
    <main style={{ minHeight: "100vh", position: "relative", display: "grid", placeItems: "center", overflow: "hidden",
      background: "radial-gradient(1000px 560px at 50% -4%, #241b57 0%, #12163a 45%, #020617 100%)" }}>
      <style>{`
        @keyframes nySpin  { to { transform: rotate(360deg) } }
        @keyframes nyHalo  { 0%,100%{ opacity:.55; transform: scale(.94) } 50%{ opacity:1; transform: scale(1.06) } }
        @keyframes nyTwink { 0%,100%{ opacity:.15; transform: scale(.5) } 50%{ opacity:1; transform: scale(1) } }
        @keyframes nyBurst { 0%{ opacity:0; transform: scale(.2) } 25%{ opacity:1 } 60%{ opacity:.9; transform: scale(1) } 100%{ opacity:0; transform: scale(1.1) } }
        @keyframes nyFall  { 0%{ transform: translateY(-30px) rotate(0); opacity:0 } 8%{ opacity:1 } 92%{ opacity:1 } 100%{ transform: translateY(104vh) rotate(360deg); opacity:0 } }
        .ny-desktop { display: grid; }
        .ny-mobile  { display: none; }
        @media (max-width: 1023.98px) {
          .ny-desktop { display: none !important; }
          .ny-mobile  { display: flex !important; }
        }
      `}</style>

      {/* twinkling stars */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
        {stars.map((s, i) => (
          <span key={i} style={{ position: "absolute", top: s.top, left: s.left, width: 5, height: 5, borderRadius: "50%", background: "radial-gradient(circle,#fff 0%,#c4b5fd 60%,transparent 72%)", animation: `nyTwink 3s ease-in-out ${s.d} infinite` }} />
        ))}
      </div>
      {/* fireworks */}
      <div aria-hidden style={{ position: "absolute", top: "12%", left: "38%", width: 90, height: 90, zIndex: 1, animation: "nyBurst 4s ease-out infinite" }}><Firework color="#fcd34d" /></div>
      <div aria-hidden style={{ position: "absolute", top: "20%", left: "64%", width: 72, height: 72, zIndex: 1, animation: "nyBurst 4.6s ease-out 1.6s infinite" }}><Firework color="#f472b6" /></div>
      <div aria-hidden style={{ position: "absolute", top: "10%", left: "14%", width: 62, height: 62, zIndex: 1, animation: "nyBurst 5.2s ease-out 2.7s infinite" }}><Firework color="#60a5fa" /></div>
      {/* confetti */}
      <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
        {confetti.map((cf, i) => (
          <span key={i} style={{ position: "absolute", top: -20, left: cf.left, width: 8, height: 12, borderRadius: 2, background: cf.col, boxShadow: "0 1px 3px rgba(0,0,0,.25)", animation: `nyFall ${cf.dur} linear ${cf.delay} infinite` }} />
        ))}
      </div>

      {/* ── DESKTOP: branding left, glass card right ── */}
      <div className="ny-desktop" style={{ position: "relative", zIndex: 4, width: "100%", minHeight: "100vh", gridTemplateColumns: "1fr 1fr", placeItems: "center", padding: "60px 40px 40px" }}>
        <Branding year={year} />
        <Card><GlassLoginForm form={form} {...ACCENT} /></Card>
      </div>

      {/* ── MOBILE: compact branding + card ── */}
      <div className="ny-mobile" style={{ position: "relative", zIndex: 4, width: "100%", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 18px", gap: 18 }}>
        <Branding year={year} compact />
        <Card><GlassLoginForm form={form} {...ACCENT} /></Card>
      </div>
    </main>
  );
}
