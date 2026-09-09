"use client";
import Image from "next/image";
import type { LoginForm } from "../useLoginForm";
import { GlassLoginForm } from "./GlassLoginForm";

/**
 * Ganesh Chaturthi skin — uses the finished festive artwork (public/Ganesh.png: marigold toran,
 * glowing lanterns, ॐ, line-art Ganesha, the Ganesha idol, warm light streak) as a full-bleed
 * background, with the REAL working login form overlaid as a frosted-glass card exactly where the
 * artwork's card sits. Login logic is unchanged — only the look changes.
 *
 * The artwork is 1247×623 (~2:1). A stage div carries that exact aspect ratio so the glass card,
 * positioned in percentages, always lines up with the card baked into the image at any screen size.
 */
const IMG_W = 1247, IMG_H = 623;
const ACCENT = { accentFrom: "#e2692e", accentTo: "#c2410c", link: "#ffcf8a" };

/** A hollow, slowly-rotating golden chakra — centered on the ॐ so the Om shows through its middle. */
function Chakra() {
  const c = 200, spokes = 24, petals = 16;
  return (
    <svg viewBox="0 0 400 400" width="100%" height="100%" aria-hidden preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", inset: 0, animation: "gcSpin 80s linear infinite" }}>
      <g stroke="#ffd98a" strokeWidth={1.3} fill="none">
        <circle cx={c} cy={c} r={c * 0.98} /><circle cx={c} cy={c} r={c * 0.72} /><circle cx={c} cy={c} r={c * 0.42} />
        {Array.from({ length: spokes }, (_, i) => {
          const a = (i / spokes) * Math.PI * 2;
          return <line key={i} x1={c + Math.cos(a) * c * 0.42} y1={c + Math.sin(a) * c * 0.42} x2={c + Math.cos(a) * c * 0.98} y2={c + Math.sin(a) * c * 0.98} />;
        })}
        {Array.from({ length: petals }, (_, i) => {
          const a = (i / petals) * Math.PI * 2, x = c + Math.cos(a) * c * 0.72, y = c + Math.sin(a) * c * 0.72;
          return <ellipse key={"p" + i} cx={x} cy={y} rx={c * 0.11} ry={c * 0.045} transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`} />;
        })}
      </g>
    </svg>
  );
}

export function GaneshChaturthiSkin({ form }: { form: LoginForm }) {
  return (
    <main style={{ minHeight: "100vh", position: "relative", display: "grid", placeItems: "center", overflow: "hidden",
      background: "radial-gradient(1200px 760px at 50% 42%, #3a2410 0%, #241206 58%, #160c04 100%)" }}>
      <style>{`
        @keyframes gcSpin { to { transform: rotate(360deg) } }
        .gc-desktop { display: block; }
        .gc-mobile  { display: none; }
        @media (max-width: 1023.98px) {
          .gc-desktop { display: none !important; }
          .gc-mobile  { display: flex !important; }
        }
      `}</style>

      {/* ── DESKTOP: full festive artwork + real card overlaid on the baked card ── */}
      <div className="gc-desktop" style={{ position: "relative", width: `min(100vw, calc(100vh * ${IMG_W} / ${IMG_H}))`, aspectRatio: `${IMG_W} / ${IMG_H}` }}>
        <Image src="/Ganesh.png" alt="Happy Ganesh Chaturthi — Indus Analytics" fill priority sizes="100vw" style={{ objectFit: "contain" }} />
        {/* rotating golden chakra centered on the artwork's ॐ (hollow middle → the Om shows through) */}
        <div aria-hidden style={{ position: "absolute", left: "32%", top: "46%", width: "27%", aspectRatio: "1", transform: "translate(-50%,-50%)", opacity: 0.32, pointerEvents: "none" }}>
          <Chakra />
        </div>
        {/* frosted-glass panel sitting exactly over the artwork's card (percentages → always aligned) */}
        <div style={{ position: "absolute", left: "56.3%", top: "14%", width: "35%", height: "74%",
          borderRadius: "1.4vw", background: "rgba(58,32,14,.34)", backdropFilter: "blur(26px) saturate(1.1)", WebkitBackdropFilter: "blur(26px) saturate(1.1)",
          border: "1px solid rgba(255,236,214,.32)", boxShadow: "0 24px 60px -22px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.18)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "2% 2.6%" }}>
          <GlassLoginForm form={form} {...ACCENT} />
        </div>
      </div>

      {/* ── MOBILE: warm festive gradient + compact branding + real card ── */}
      <div className="gc-mobile" style={{ width: "100%", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "34px 18px", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
          <div style={{ position: "relative", display: "grid", placeItems: "center", width: 148, height: 148 }}>
            <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, pointerEvents: "none" }}><Chakra /></div>
            <div style={{ position: "relative", fontFamily: "'Nirmala UI','Noto Sans Devanagari',system-ui,sans-serif", fontWeight: 700, fontSize: 52, lineHeight: 1, color: "#ffe4a0", textShadow: "0 0 26px rgba(255,200,90,.85)" }}>ॐ</div>
          </div>
          <h2 style={{ margin: "4px 0 0", fontFamily: "'Nirmala UI','Noto Sans Devanagari',system-ui,sans-serif", fontSize: 23, fontWeight: 800, color: "#ffe9bd" }}>गणपति बप्पा मोरया</h2>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.6, color: "#ffcf8a" }}>Happy Ganesh Chaturthi 🙏</p>
          <div style={{ width: 150, marginTop: 6 }}>
            <Image src="/app/company-logo.png" alt="INDAS Analytics" width={440} height={220} priority style={{ width: "100%", height: "auto", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.96 }} />
          </div>
        </div>
        <div style={{ width: "100%", maxWidth: 400, borderRadius: 20, background: "rgba(58,32,14,.4)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,236,214,.3)", boxShadow: "0 20px 50px -20px rgba(0,0,0,.55)", padding: "22px 22px 26px" }}>
          <GlassLoginForm form={form} {...ACCENT} />
        </div>
      </div>
    </main>
  );
}
