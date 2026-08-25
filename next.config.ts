import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next 16's dev-only validation worker (jest-worker child process) crashes on
    // startup under Node 24 → "Jest worker encountered N child process exceptions,
    // exceeding retry limit", which breaks /api/auth/* and other routes. It only
    // spawns when (TURBOPACK && devValidationWorker !== false), so disable it.
    devValidationWorker: false,
  },
};

export default nextConfig;
