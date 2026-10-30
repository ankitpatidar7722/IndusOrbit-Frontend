import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ThemeScript } from "indas-ui";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Indus Command Center",
  description: "Centralized Client & Work Management System",
  // PWA: manifest + home-screen install metadata (Next auto-emits the <link>/<meta> tags).
  applicationName: "Indus 360",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,            // iOS: run full-screen when launched from the home screen
    statusBarStyle: "default",
    title: "Indus 360",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1f4576",     // browser/OS UI tint when the app is open
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript defaultMode="light" />
        {/* Default web font (Inter). Any other Settings → Font Family choice is loaded on demand by
            components/FontLoader (applied via --font-family-base). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
