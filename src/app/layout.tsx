import "./globals.css";
import type { Metadata } from "next";
import { ThemeScript } from "indas-ui";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Indus Command Center",
  description: "Centralized Client & Work Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript defaultMode="light" />
        {/* Web fonts for Settings → Preferences → Font Family (applied via --font-family-base). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
