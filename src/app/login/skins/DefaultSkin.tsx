"use client";
import Image from "next/image";
import type { LoginForm } from "../useLoginForm";
import { LoginCardBody } from "./LoginCardBody";

/** The standard sign-in — big INDAS logo left, white card right, soft time-of-day background. */
export function DefaultSkin({ form }: { form: LoginForm }) {
  const bgGradient = () => {
    const h = form.now?.getHours() ?? 14;
    if (h >= 6 && h < 12) return "linear-gradient(135deg,#fff7ed 0%,#fefce8 45%,#dbeafe 100%)"; // morning
    if (h >= 12 && h < 17) return "linear-gradient(135deg,#eff6ff 0%,#ffffff 50%,#cffafe 100%)"; // afternoon
    return "linear-gradient(135deg,#faf5ff 0%,#eff6ff 45%,#e0e7ff 100%)"; // evening / night
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", background: bgGradient(), transition: "background 1s ease" }} className="grid-cols-1 lg:grid-cols-2">
      <section className="hidden lg:flex" style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 64px" }}>
        <div style={{ width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Image src="/app/company-logo.png" alt="INDAS Analytics" width={500} height={250} priority style={{ width: "100%", maxWidth: 460, height: "auto", objectFit: "contain" }} />
        </div>
      </section>

      <section className="p-4 sm:p-6 lg:p-16" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="lg:hidden" style={{ width: "100%", maxWidth: 220, marginBottom: 24 }}>
          <Image src="/app/company-logo.png" alt="INDAS Analytics" width={440} height={220} priority style={{ width: "100%", height: "auto", objectFit: "contain" }} />
        </div>
        <LoginCardBody form={form} />
      </section>
    </main>
  );
}
