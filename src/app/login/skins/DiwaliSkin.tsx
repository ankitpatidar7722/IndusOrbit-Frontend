"use client";
import Image from "next/image";
import type { LoginForm } from "../useLoginForm";
import { GlassLoginForm } from "./GlassLoginForm";

/** Festive Diwali skin — marigold toran, live diyas, a glowing diya inside a spinning rangoli,
 * fireworks and sparkles, with the shared frosted-glass login card. Same login logic, festive look. */
const ACCENT = { accentFrom: "#f59e0b", accentTo: "#d97706", link: "#fcd34d" };

function Marigold({ x, y, r }: { x: number; y: number; r: number }) {
  const petals = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2);
  return (
    <g transform={`translate(${x},${y})`}>
      {petals.map((a, i) => <circle key={i} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={r * 0.5} fill="#ef7f1a" />)}
      <circle r={r} fill="#fb923c" />
      {petals.map((a, i) => <circle key={"m" + i} cx={Math.cos(a) * r * 0.55} cy={Math.sin(a) * r * 0.55} r={r * 0.32} fill="#fcbf49" />)}
      <circle r={r * 0.46} fill="#facc15" />
      <circle r={r * 0.2} fill="#d97706" />
    </g>
  );
}
function Leaf({ x, y, flip }: { x: number; y: number; flip?: boolean }) {
  return <path d="M0,0 C 13,6 13,25 0,32 C -13,25 -13,6 0,0 Z" transform={`translate(${x},${y}) scale(${flip ? -0.62 : 0.62},0.62)`} fill="#1a7a3a" stroke="#14622e" strokeWidth={0.6} />;
}
function Toran() {
  const xs = [40, 150, 260, 370, 480, 590, 700, 810, 920, 1030, 1140, 1200];
  return (
    <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, transformOrigin: "top center", animation: "dwSway 6s ease-in-out infinite", zIndex: 3 }}>
      <svg viewBox="0 0 1240 120" width="100%" preserveAspectRatio="xMidYMin slice" style={{ display: "block", filter: "drop-shadow(0 6px 9px rgba(0,0,0,.4))" }}>
        <path d="M -20 8 Q 620 60 1260 8" stroke="#0f5a28" strokeWidth={4} fill="none" />
        {xs.map((x, i) => {
          const len = 30 + (i % 3) * 11, topY = 8 + Math.sin((x / 1240) * Math.PI) * 40;
          return (
            <g key={x}>
              <line x1={x} y1={topY} x2={x} y2={topY + len} stroke="#1a7a3a" strokeWidth={3} />
              {i % 2 === 0 && <><Leaf x={x - 9} y={topY + len - 6} /><Leaf x={x + 9} y={topY + len - 6} flip /></>}
              <Marigold x={x} y={topY + len + 11} r={i % 2 === 0 ? 14 : 11} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
/** Clay diya with a flickering flame. */
function Diya({ size = 66 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.82} viewBox="0 0 60 50" aria-hidden style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,.4))" }}>
      <defs>
        <radialGradient id="dwFlameG" cx="50%" cy="70%" r="70%">
          <stop offset="0%" stopColor="#fff7cc" /><stop offset="45%" stopColor="#ffd24d" /><stop offset="100%" stopColor="#f97316" />
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="18" rx="15" ry="17" fill="rgba(255,175,50,.28)" />
      <g style={{ transformOrigin: "30px 26px", animation: "dwFlame 1.3s ease-in-out infinite" }}>
        <path d="M30 2 C 37 13, 35 24, 30 27 C 25 24, 23 13, 30 2 Z" fill="url(#dwFlameG)" />
        <path d="M30 11 C 33 17, 32 23, 30 25 C 28 23, 27 17, 30 11 Z" fill="#fff6d0" />
      </g>
      <path d="M4 30 Q 30 50 56 30 Q 47 38 30 38 Q 13 38 4 30 Z" fill="#7a340f" />
      <path d="M6 29 Q 30 45 54 29 Q 30 37 6 29 Z" fill="#bf651c" />
      <ellipse cx="30" cy="30.5" rx="4" ry="1.5" fill="#3a1606" />
    </svg>
  );
}
/** Slowly-spinning colourful rangoli backdrop. */
function Rangoli() {
  const c = 200;
  const rings = [{ r: 0.92, n: 20, col: "#fbbf24" }, { r: 0.66, n: 14, col: "#fb7185" }, { r: 0.42, n: 10, col: "#f59e0b" }];
  return (
    <svg viewBox="0 0 400 400" width="100%" height="100%" aria-hidden preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", inset: 0, animation: "dwSpin 70s linear infinite" }}>
      {rings.map((ring, ri) => Array.from({ length: ring.n }, (_, i) => {
        const a = (i / ring.n) * Math.PI * 2, x = c + Math.cos(a) * c * ring.r, y = c + Math.sin(a) * c * ring.r;
        return <ellipse key={ri + "-" + i} cx={x} cy={y} rx={c * 0.1} ry={c * 0.042} fill={ring.col} transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`} />;
      }))}
      <g stroke="#ffe0a0" strokeWidth={1.2} fill="none"><circle cx={c} cy={c} r={c * 0.92} /><circle cx={c} cy={c} r={c * 0.66} /><circle cx={c} cy={c} r={c * 0.42} /></g>
    </svg>
  );
}
/** SVG firework burst. */
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

function Branding({ compact }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: compact ? 4 : 10 }}>
      <div style={{ position: "relative", display: "grid", placeItems: "center", width: compact ? 130 : 210, height: compact ? 130 : 210 }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.55 }}><Rangoli /></div>
        <div aria-hidden style={{ position: "absolute", width: compact ? 96 : 150, height: compact ? 96 : 150, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,200,90,.5) 0%, transparent 68%)", animation: "dwHalo 3.4s ease-in-out infinite" }} />
        <div style={{ position: "relative", animation: "dwFlick 2s ease-in-out infinite" }}><Diya size={compact ? 66 : 96} /></div>
      </div>
      <h2 style={{ margin: compact ? "8px 0 0" : "14px 0 0", fontFamily: "'Nirmala UI','Noto Sans Devanagari',system-ui,sans-serif", fontSize: compact ? 24 : 34, fontWeight: 800, letterSpacing: 0.5, color: "#ffe9bd", textShadow: "0 2px 18px rgba(255,170,50,.7)" }}>शुभ दीपावली</h2>
      <p style={{ margin: 0, fontSize: compact ? 12.5 : 15, fontWeight: 600, letterSpacing: 1, color: "#fcd34d", textTransform: "uppercase" }}>✨ Happy Diwali ✨</p>
      <div style={{ width: compact ? 148 : 240, marginTop: compact ? 6 : 18 }}>
        <Image src="/app/company-logo.png" alt="INDAS Analytics" width={440} height={220} priority style={{ width: "100%", height: "auto", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.96 }} />
      </div>
    </div>
  );
}

/** Warm frosted-glass card wrapper around the login form. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", maxWidth: 420, borderRadius: 20, background: "rgba(60,24,8,.42)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
      border: "1px solid rgba(255,224,170,.3)", boxShadow: "0 24px 60px -22px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.16)", padding: "26px 26px 30px" }}>
      {children}
    </div>
  );
}

export function DiwaliSkin({ form }: { form: LoginForm }) {
  const sparkles = [
    { top: "26%", left: "15%", d: "0s" }, { top: "44%", left: "9%", d: ".7s" }, { top: "66%", left: "20%", d: "1.2s" },
    { top: "30%", left: "44%", d: ".4s" }, { top: "72%", left: "40%", d: "1.6s" }, { top: "22%", left: "60%", d: "1.1s" },
  ];
  return (
    <main style={{ minHeight: "100vh", position: "relative", display: "grid", placeItems: "center", overflow: "hidden",
      background: "radial-gradient(1200px 700px at 50% -8%, #6a1f0a 0%, #3a1305 45%, #1c0a02 100%)" }}>
      <style>{`
        @keyframes dwSpin  { to { transform: rotate(360deg) } }
        @keyframes dwSway  { 0%,100%{ transform: rotate(-1.2deg) } 50%{ transform: rotate(1.2deg) } }
        @keyframes dwHalo  { 0%,100%{ opacity:.55; transform: scale(.94) } 50%{ opacity:1; transform: scale(1.06) } }
        @keyframes dwFlame { 0%,100%{ transform: scaleY(1) translateX(0) } 50%{ transform: scaleY(1.1) translateX(1px) } }
        @keyframes dwFlick { 0%,100%{ opacity:1 } 45%{ opacity:.78 } }
        @keyframes dwTwink { 0%,100%{ opacity:.12; transform: scale(.6) } 50%{ opacity:1; transform: scale(1) } }
        @keyframes dwBurst { 0%{ opacity:0; transform: scale(.2) } 25%{ opacity:1 } 60%{ opacity:.9; transform: scale(1) } 100%{ opacity:0; transform: scale(1.1) } }
        .dw-desktop { display: grid; }
        .dw-mobile  { display: none; }
        @media (max-width: 1023.98px) {
          .dw-desktop { display: none !important; }
          .dw-mobile  { display: flex !important; }
        }
      `}</style>

      <Toran />
      {/* fireworks */}
      <div aria-hidden style={{ position: "absolute", top: "14%", left: "40%", width: 90, height: 90, zIndex: 1, animation: "dwBurst 4s ease-out infinite" }}><Firework color="#fcd34d" /></div>
      <div aria-hidden style={{ position: "absolute", top: "22%", left: "62%", width: 70, height: 70, zIndex: 1, animation: "dwBurst 4.5s ease-out 1.6s infinite" }}><Firework color="#fb7185" /></div>
      <div aria-hidden style={{ position: "absolute", top: "12%", left: "12%", width: 60, height: 60, zIndex: 1, animation: "dwBurst 5s ease-out 2.6s infinite" }}><Firework color="#a78bfa" /></div>
      {/* sparkles */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
        {sparkles.map((s, i) => (
          <span key={i} style={{ position: "absolute", top: s.top, left: s.left, width: 6, height: 6, borderRadius: "50%", background: "radial-gradient(circle,#fff6d0 0%,#ffcf5a 60%,transparent 72%)", animation: `dwTwink 2.8s ease-in-out ${s.d} infinite` }} />
        ))}
      </div>
      {/* diyas along the bottom */}
      <div aria-hidden style={{ position: "absolute", bottom: "5%", left: "8%", zIndex: 2, animation: "dwFlick 2s ease-in-out infinite" }}><Diya size={64} /></div>
      <div aria-hidden className="dw-desktop" style={{ position: "absolute", bottom: "6%", left: "40%", zIndex: 2, animation: "dwFlick 2.3s ease-in-out .5s infinite" }}><Diya size={50} /></div>
      <div aria-hidden style={{ position: "absolute", bottom: "5%", right: "8%", zIndex: 2, animation: "dwFlick 2.2s ease-in-out .3s infinite" }}><Diya size={64} /></div>

      {/* ── DESKTOP: branding left, glass card right ── */}
      <div className="dw-desktop" style={{ position: "relative", zIndex: 4, width: "100%", minHeight: "100vh", gridTemplateColumns: "1fr 1fr", placeItems: "center", padding: "70px 40px 40px" }}>
        <Branding />
        <Card><GlassLoginForm form={form} {...ACCENT} /></Card>
      </div>

      {/* ── MOBILE: compact branding + card ── */}
      <div className="dw-mobile" style={{ position: "relative", zIndex: 4, width: "100%", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 18px", gap: 18 }}>
        <Branding compact />
        <Card><GlassLoginForm form={form} {...ACCENT} /></Card>
      </div>
    </main>
  );
}
