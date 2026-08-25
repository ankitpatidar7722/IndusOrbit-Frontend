"use client";
import React from "react";

/**
 * Branded loading indicator (INDAS Analytics logo + bouncing dots + progress bar),
 * always centered. Drop-in replacement for indas-ui's PageLoading — which rendered
 * bare and drifted to the top. Styles live in globals.css (`.indus-loader-*`).
 *
 * - inline (default): centers within the content area (min-height fills the viewport).
 * - overlay: full-screen centered card over a subtle blurred backdrop (route/auth loads).
 */
export default function BrandedLoader({
  text,
  overlay = false,
  className,
}: {
  text?: string;
  size?: "sm" | "md" | "lg"; // accepted for drop-in compatibility; layout is fixed
  overlay?: boolean;
  className?: string;
}) {
  const card = (
    <div className="indus-loader-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app/loading-logo.png" alt="INDAS Analytics" className="indus-loader-logo" />
      <div className="indus-loader-dots">
        <span style={{ animationDelay: "0ms" }} />
        <span style={{ animationDelay: "150ms" }} />
        <span style={{ animationDelay: "300ms" }} />
      </div>
      <div className="indus-loader-bar"><div /></div>
      {text && <div className="indus-loader-text">{text}</div>}
    </div>
  );

  if (overlay) return <div className="indus-loader-overlay">{card}</div>;
  return <div className={`indus-loader-wrap${className ? " " + className : ""}`}>{card}</div>;
}
