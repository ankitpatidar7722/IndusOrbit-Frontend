"use client";
import { useEffect, useState } from "react";
import { useLoginForm } from "./useLoginForm";
import { getSkin } from "./skins";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

/**
 * Login page = ONE shared logic (useLoginForm) + a swappable DESIGN (skin). The active skin is a
 * global, admin-chosen value read from a PUBLIC endpoint (this page is pre-auth). Changing the skin
 * only changes the look — the auth flow / remember-me / redirects are identical for every design.
 * Admin picks the skin from Settings → "Change Login Page". Falls back to "default".
 */
export default function LoginPage() {
  const form = useLoginForm();
  const [designId, setDesignId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // ?preview=<skinId> lets an admin preview any design WITHOUT changing the global active setting.
    const preview = new URLSearchParams(window.location.search).get("preview");
    if (preview) { setDesignId(preview); return; }
    fetch(`${API}/api/login-design`)
      .then((r) => r.json())
      .then((d) => { if (alive) setDesignId((d?.design as string) || "default"); })
      .catch(() => { if (alive) setDesignId("default"); });
    return () => { alive = false; };
  }, []);

  // Avoid a wrong-skin flash: hold a neutral screen until the design id resolves (fast fetch).
  if (designId === null) return <main style={{ minHeight: "100vh", background: "#f8fafc" }} />;

  const Skin = getSkin(designId).Component;
  return <Skin form={form} />;
}
