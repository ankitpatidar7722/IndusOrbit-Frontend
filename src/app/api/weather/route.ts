/**
 * Current weather for the phone Home "Today" widget (ported from IndusFlexoERP).
 *   GET /api/weather                      -> located by the caller's network address (town level)
 *   GET /api/weather?lat=22.72&lon=75.86  -> at a given point
 *   -> { success, tempC, code, isDay, place }
 *
 * Server-side so the browser never asks for location: the town comes from the request IP (ipwho.is, no key;
 * a private/local IP = this server's own network) and Open-Meteo (no key) gives the reading. Cached 10 min per
 * ~1 km point, so many phones cost one upstream call. Any failure = 200 { success:false } → the widget hides
 * the weather line.
 */
import { NextRequest, NextResponse } from "next/server";

type Weather = { tempC: number; code: number; isDay: boolean; place: string | null } | null;

const TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 6000;
const cache = new Map<string, { at: number; data: Weather }>();
const inFlight = new Map<string, Promise<Weather>>();

async function getJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function load(lat: number, lon: number, place: string | null): Promise<Weather> {
  const w = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`);
  const cur = w?.current;
  if (!cur || typeof cur.temperature_2m !== "number") return null;
  return { tempC: Math.round(cur.temperature_2m), code: Number(cur.weather_code) || 0, isDay: cur.is_day === 1, place };
}

const PRIVATE_IP = /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80|::ffff:(127|10|192\.168)\.)/i;

/** Town + coordinates from the caller's IP (cached 6 h per IP). */
const ipCache = new Map<string, { at: number; loc: { lat: number; lon: number; place: string | null } | null }>();
async function locateByIp(ip: string) {
  const key = ip || "self";
  const hit = ipCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.loc;
  const j = await getJson(`https://ipwho.is/${ip && !PRIVATE_IP.test(ip) ? encodeURIComponent(ip) : ""}`);
  const loc = j?.success && Number.isFinite(j.latitude) && Number.isFinite(j.longitude)
    ? { lat: Number(j.latitude), lon: Number(j.longitude), place: (j.city as string) || (j.region as string) || null }
    : null;
  ipCache.set(key, { at: Date.now(), loc });
  return loc;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let lat = Number(searchParams.get("lat"));
  let lon = Number(searchParams.get("lon"));
  let place: string | null = null;
  if (!searchParams.has("lat") || !searchParams.has("lon")) {
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "";
    const loc = await locateByIp(ip);
    if (!loc) return NextResponse.json({ success: false });
    lat = loc.lat; lon = loc.lon; place = loc.place;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ success: false });
  }
  // ~1 km grid: enough for a weather reading; the exact position never leaves this server.
  const rl = Math.round(lat * 100) / 100;
  const rn = Math.round(lon * 100) / 100;
  const key = `${rl},${rn}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json({ success: !!hit.data, ...hit.data, place: place ?? hit.data?.place ?? null });

  let pending = inFlight.get(key);
  if (!pending) {
    pending = load(rl, rn, place).then((data) => {
      cache.set(key, { at: Date.now(), data });
      inFlight.delete(key);
      return data;
    });
    inFlight.set(key, pending);
  }
  const data = await pending;
  return NextResponse.json({ success: !!data, ...data });
}
