// Professional, subtle notification chimes — synthesized with the Web Audio API (no audio files).
// Distinct, pleasant tones per type; soft volume + short, so they never irritate.
//   Message → light ascending "pop"     (E5→B5, sine)
//   Email   → calm descending bell       (G5→D5, sine, long soft decay)
//   Point   → gentle wood-block double   (A4→D5, triangle)  [Point-Management / System]

let ctx: AudioContext | null = null;
let lastPlay = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  return ctx;
}

/** Browsers keep the AudioContext suspended until a user gesture — resume it on the first one. */
export function armNotificationSounds() {
  if (typeof window === "undefined") return;
  const resume = () => { try { getCtx()?.resume(); } catch { /* ignore */ } };
  window.addEventListener("pointerdown", resume, { once: true });
  window.addEventListener("keydown", resume, { once: true });
}

interface Tone { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number }

function playTones(tones: Tone[]) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") { try { c.resume(); } catch { /* ignore */ } }
  const now = c.currentTime;
  // A soft low-pass keeps the timbre mellow (not harsh/beepy).
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  lp.connect(c.destination);
  for (const t of tones) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = t.type || "sine";
    osc.frequency.value = t.freq;
    const peak = t.gain ?? 0.13;
    const s = now + t.start;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(peak, s + 0.012);      // gentle attack (no click)
    g.gain.exponentialRampToValueAtTime(0.0001, s + t.dur);    // smooth decay
    osc.connect(g); g.connect(lp);
    osc.start(s); osc.stop(s + t.dur + 0.03);
  }
}

/** Play the chime for a notification type. Throttled so a burst never becomes noise. */
export function playNotificationSound(type: "Message" | "Email" | "System" | "Point" | string) {
  const nowMs = Date.now();
  if (nowMs - lastPlay < 1200) return;
  lastPlay = nowMs;

  if (type === "Email") {
    playTones([
      { freq: 784, start: 0, dur: 0.45, type: "sine", gain: 0.12 },     // G5
      { freq: 587.33, start: 0.15, dur: 0.6, type: "sine", gain: 0.12 },// D5  (calm ding-dong)
    ]);
  } else if (type === "Message") {
    playTones([
      { freq: 659.25, start: 0, dur: 0.16, type: "sine", gain: 0.13 },  // E5
      { freq: 987.77, start: 0.085, dur: 0.2, type: "sine", gain: 0.13 },// B5 (light rising pop)
    ]);
  } else {
    // Point-Management / System — distinct lower wood-block double-tap.
    playTones([
      { freq: 440, start: 0, dur: 0.15, type: "triangle", gain: 0.13 },   // A4
      { freq: 587.33, start: 0.16, dur: 0.26, type: "triangle", gain: 0.13 }, // D5
    ]);
  }
}
