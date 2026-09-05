import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next 16's dev-only validation worker (jest-worker child process) crashes on
    // startup under Node 24 → "Jest worker encountered N child process exceptions,
    // exceeding retry limit", which breaks /api/auth/* and other routes. It only
    // spawns when (TURBOPACK && devValidationWorker !== false), so disable it.
    devValidationWorker: false,
  },
  // PWA: never cache the service worker file so a new deploy's SW is picked up immediately.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
