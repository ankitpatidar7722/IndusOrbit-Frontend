"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Loader2, MapPin, Moon, Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Phone Home "Today" widget (ported from IndusFlexoERP, compact variant) — sits beside the greeting:
 *
 *   [ Oct ]  03 : 37
 *   [ 30  ]  ☁ 26°  Partly cloudy
 *   [ Fri ]  📍 Bhopal
 *
 * Tear-off calendar tile (flips when the day changes), a flip clock (digits flip as the minute turns) and the
 * weather from our own /api/weather (town located server-side by network — no location prompt).
 * Everything time-based renders after mount (no server/client mismatch).
 */
type WeatherState =
  | { kind: "loading" }
  | { kind: "ready"; tempC: number; code: number; isDay: boolean; place: string | null }
  | { kind: "off" };

/** WMO weather code → icon + label. */
function describe(code: number, isDay: boolean): { icon: LucideIcon; label: string } {
  if (code === 0) return { icon: isDay ? Sun : Moon, label: "Clear" };
  if (code <= 2) return { icon: isDay ? CloudSun : CloudMoon, label: "Partly cloudy" };
  if (code === 3) return { icon: Cloud, label: "Cloudy" };
  if (code === 45 || code === 48) return { icon: CloudFog, label: "Fog" };
  if (code >= 51 && code <= 57) return { icon: CloudDrizzle, label: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: CloudRain, label: "Rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: CloudSnow, label: "Snow" };
  if (code >= 95) return { icon: CloudLightning, label: "Thunderstorm" };
  return { icon: Cloud, label: "Cloudy" };
}

/** One flip tile: a charcoal card with a seam; a new value flips down into place. */
function FlipTile({ value, reduceMotion }: { value: string; reduceMotion: boolean }) {
  return (
    <span className="today-flip">
      <motion.span
        key={value}
        className="today-flip-digit"
        initial={reduceMotion ? false : { rotateX: -90, opacity: 0.2 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {value}
      </motion.span>
      <span aria-hidden className="today-flip-fold" />
    </span>
  );
}

export default function TodayCard() {
  const reduceMotion = !!useReducedMotion();
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherState>({ kind: "loading" });

  // Tick on the minute (re-aligned each time so the flip lands as the clock turns).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      timer = setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 30);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  // Weather on open, refreshed every 15 minutes while Home is open.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/weather", { cache: "no-store" });
        const j = await r.json();
        if (alive) setWeather(j?.success ? { kind: "ready", tempC: j.tempC, code: j.code, isDay: j.isDay, place: j.place } : { kind: "off" });
      } catch {
        if (alive) setWeather({ kind: "off" });
      }
    };
    load();
    const interval = setInterval(load, 15 * 60_000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  // Same-size placeholder until mounted (time is client-only).
  if (!now) return <div className="m-glass-card" style={{ width: 165, height: 80, borderRadius: 20, flexShrink: 0 }} aria-hidden />;

  const month = now.toLocaleDateString("en-IN", { month: "short" });
  const weekday = now.toLocaleDateString("en-IN", { weekday: "short" });
  const day = String(now.getDate());
  const hours = ((now.getHours() + 11) % 12) + 1;
  const hh = String(hours).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() < 12 ? "AM" : "PM";
  const fullDate = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const w = weather.kind === "ready" ? describe(weather.code, weather.isDay) : null;

  return (
    <section aria-label="Today" title={fullDate} className="m-glass-card today-card">
      {/* Tear-off calendar tile */}
      <div className="today-cal">
        <div className="today-cal-month">{month}</div>
        <div style={{ position: "relative", height: 28 }}>
          <motion.span key={day} className="today-cal-day"
            initial={reduceMotion ? false : { rotateX: -100, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}>
            {day}
          </motion.span>
        </div>
        <div className="today-cal-weekday">{weekday}</div>
      </div>

      <div style={{ minWidth: 0, width: 92 }}>
        {/* Flip clock */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }} aria-label={`${hh}:${mm} ${ampm}`} role="timer">
          <FlipTile value={hh[0]} reduceMotion={reduceMotion} />
          <FlipTile value={hh[1]} reduceMotion={reduceMotion} />
          <span aria-hidden className="today-ink2" style={{ fontSize: 14, fontWeight: 700, lineHeight: 1, padding: "0 1px" }}>:</span>
          <FlipTile value={mm[0]} reduceMotion={reduceMotion} />
          <FlipTile value={mm[1]} reduceMotion={reduceMotion} />
        </div>
        {/* Weather: icon + temperature + condition, then the town on its own line. */}
        <div style={{ marginTop: 6, minHeight: 30 }}>
          {weather.kind === "ready" && w ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 4, height: 16 }}>
                <w.icon style={{ width: 15, height: 15, flexShrink: 0, color: "rgb(var(--color-warning))" }} strokeWidth={2.2} aria-hidden />
                <span className="today-ink" style={{ fontSize: 14, fontWeight: 700, lineHeight: "16px" }}>{weather.tempC}°</span>
                <span className="today-ink2 today-trunc" style={{ fontSize: 10.5, fontWeight: 500, lineHeight: "16px" }}>{w.label}</span>
              </div>
              {weather.place && (
                <div className="today-ink2" style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2, height: 13, fontWeight: 600 }} title={weather.place}>
                  <MapPin style={{ width: 10, height: 10, flexShrink: 0 }} strokeWidth={2.4} aria-hidden />
                  <span className="today-trunc" style={{ fontSize: 10.5, lineHeight: "13px" }}>{weather.place}</span>
                </div>
              )}
            </>
          ) : weather.kind === "loading" ? (
            <Loader2 className="today-spin today-ink2" style={{ width: 13, height: 13 }} aria-label="Getting weather…" />
          ) : (
            <span className="today-ink2" style={{ fontSize: 11, fontWeight: 500 }}>{ampm}</span>
          )}
        </div>
      </div>
    </section>
  );
}
