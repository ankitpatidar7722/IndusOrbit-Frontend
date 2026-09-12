"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Box3DViewer } from "@/bulk/components/Box3DViewer";
import { detectPanels, buildHingeTree, buildFoldSchedule, type KeylineRow, type Dims } from "@/bulk/lib/keyline3D";
import { buildShapeTypeFoldSchedule, rootFirst } from "@/bulk/lib/foldSchedule";
import type { CameraPreset } from "@/bulk/lib/three-helpers";
import { keylineGetCoordinates } from "@/bulk/services/api";
import { Loader2 } from "lucide-react";

// Renders the SAME interactive 3D box as KeyLine Generator, but for Content Authority — which only knows
// the content NAME (no grain/ups/dimensions context). Keyline coordinates live per (content, grain, ups)
// in the shared keyline master, so we probe the common combos in parallel and fold the first that has
// data. Dimensions default to a representative box; the fold geometry comes from the stored coordinates.
const COMBOS: [string, string][] = [
  ["With Grain", "First Up"], ["With Grain", "Last Up"], ["Across Grain", "First Up"], ["Across Grain", "Last Up"],
  ["With Grain", "Even Up"], ["With Grain", "Odd Up"], ["Across Grain", "Even Up"], ["Across Grain", "Odd Up"],
];
const DIMS: Dims = { L: 60, W: 40, H: 100, OF: 15, PF: 10, BF: 11.25, FH: 6.5, TH: 9 };
const BTN = "px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors";

export default function ContentBox3D({ contentName }: { contentName: string }) {
  const [rows, setRows] = useState<KeylineRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const dirRef = useRef<1 | -1>(1);
  const lastTimeRef = useRef(0);
  const presetRef = useRef<((p: CameraPreset) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setLoadErr(false); setRows(null); setProgress(0);
      try {
        // Probe all combos in parallel, then take the first (priority-ordered) that returned coordinates.
        const results = await Promise.all(
          COMBOS.map(([g, u]) => keylineGetCoordinates(contentName, g, u).catch(() => [] as Awaited<ReturnType<typeof keylineGetCoordinates>>)),
        );
        if (cancelled) return;
        const hit = results.find((r) => r && r.length > 0) ?? [];
        setRows(hit
          .filter((r) => r.addInX1 && r.addInY1 && r.addInX2 && r.addInY2 && !r.shapeType?.toUpperCase().startsWith("DIM"))
          .map((r) => ({
            AddInX1: r.addInX1 ?? "0", AddInY1: r.addInY1 ?? "0",
            AddInX2: r.addInX2 ?? "0", AddInY2: r.addInY2 ?? "0",
            Linetype: r.lineType ?? "Solid", LineStyles: r.lineStyles ?? "Solid",
            ShapeType: r.shapeType,
          })));
      } catch { if (!cancelled) setLoadErr(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [contentName]);

  const { tree, schedule, buildErr } = useMemo(() => {
    if (!rows || rows.length === 0) return { tree: [], schedule: [], buildErr: null as string | null };
    try {
      const panels = rootFirst(detectPanels(rows, DIMS), contentName);
      const built = buildHingeTree(panels);
      const schedule = built.some((p) => p.shapeType)
        ? buildShapeTypeFoldSchedule(built, contentName)
        : buildFoldSchedule(built, DIMS);
      return { tree: built, schedule, buildErr: null };
    } catch (e) { return { tree: [], schedule: [], buildErr: String((e as { message?: string })?.message || e) }; }
  }, [rows, contentName]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = (t: number) => {
      const dt = lastTimeRef.current ? (t - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = t;
      setProgress((prev) => {
        let next = prev + dirRef.current * 0.35 * dt;
        if (next >= 1) { next = 1; dirRef.current = -1; }
        if (next <= 0) { next = 0; dirRef.current = 1; }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); lastTimeRef.current = 0; };
  }, [playing]);

  const onPresetReady = useCallback((h: (p: CameraPreset) => void) => { presetRef.current = h; }, []);
  const setView = (p: CameraPreset) => presetRef.current?.(p);
  const reset = () => { setPlaying(false); setProgress(0); dirRef.current = 1; };

  if (loading) return <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /><span className="text-sm">Loading 3D box…</span></div>;
  if (loadErr) return <div className="h-full flex items-center justify-center text-sm text-red-500 px-6 text-center">Failed to load 3D keyline data.</div>;
  if (!rows || rows.length === 0 || tree.length === 0 || buildErr) return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400 text-center px-6">
      <p className="text-sm font-semibold">No 3D keyline data for this content.</p>
      <p className="text-xs">This content has no saved keyline coordinates to fold into a 3D box.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 relative">
        <Box3DViewer tree={tree} schedule={schedule} dims={DIMS} progress={progress} thickness={0.6} onPresetReady={onPresetReady} className="w-full h-full" />
      </div>
      {/* Controls bar — same layout as KeyLine Generator's 3D preview */}
      <div className="shrink-0 flex flex-col items-center gap-2 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex gap-2 text-xs font-medium">
          <span className="px-2.5 py-1 rounded-full bg-primary/20 text-primary">L = {Math.round(DIMS.L)} mm</span>
          <span className="px-2.5 py-1 rounded-full bg-primary/20 text-primary">W = {Math.round(DIMS.W)} mm</span>
          <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">H = {Math.round(DIMS.H)} mm</span>
        </div>
        <div className="flex items-center gap-3 w-full max-w-sm px-4">
          <span className="text-xs font-semibold text-primary w-10 text-right shrink-0">Open</span>
          <input type="range" min={0} max={1} step={0.001} value={progress} onChange={(e) => { setPlaying(false); setProgress(parseFloat(e.target.value)); }} className="flex-1 h-2 rounded-full accent-blue-600 cursor-pointer" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-10 shrink-0">Close</span>
          <span className="text-xs tabular-nums text-gray-400 w-9 text-right">{Math.round(progress * 100)}%</span>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <button onClick={() => setPlaying((p) => !p)} className={BTN}>{playing ? "⏸ Pause" : "▶ Play"}</button>
          <button onClick={reset} className={BTN}>↺ Reset</button>
          <button onClick={() => setView("default")} className={BTN}>Default</button>
          <button onClick={() => setView("top")} className={BTN}>Top</button>
          <button onClick={() => setView("front")} className={BTN}>Front</button>
          <button onClick={() => setView("side")} className={BTN}>Side</button>
        </div>
      </div>
    </div>
  );
}
