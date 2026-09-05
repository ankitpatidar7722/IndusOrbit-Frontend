import type { MetadataRoute } from "next";

/**
 * Web App Manifest — makes Indus 360 installable to a phone's home screen and run
 * full-screen (no browser chrome), like a native app. Served at /manifest.webmanifest
 * (Next auto-links it from the metadata below). Install needs this + HTTPS (Vercel ✓).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Indus Command Center",
    short_name: "Indus 360",
    description: "Centralized Client & Work Management System",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#1f4576",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
