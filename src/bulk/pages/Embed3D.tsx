import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Box3DViewer } from '../components/Box3DViewer'
import {
    detectPanels, buildHingeTree, buildFoldSchedule,
    type KeylineRow as KL3DRow, type Dims as KL3DDims,
} from '../lib/keyline3D'
import { buildShapeTypeFoldSchedule, shapeTypeCoverage, rootFirst } from '../lib/foldSchedule'
import type { CameraPreset } from '../lib/three-helpers'

/**
 * Standalone 3D box viewer, meant to be embedded in an <iframe> by another
 * application (currently the EstimoPrime ERP "Content Open View" modal).
 *
 * It is deliberately a PURE RENDERER:
 *   - it never calls the API and never touches the database
 *   - it needs no login, no JWT and no tenant/company context
 *   - everything it draws arrives from the host page over postMessage
 *
 * That is what makes it safe to expose without authentication: the page can
 * only ever draw what the host already had. It also sidesteps the multi-tenant
 * connection-string problem entirely, because the host reads its own database
 * with its own session and simply hands over the rows.
 *
 * Host protocol
 * -------------
 * Host  -> iframe : { type: 'BOX3D_RENDER', rows, dims, contentType }
 * iframe -> host  : { type: 'BOX3D_READY' }            (send data now)
 *                   { type: 'BOX3D_RENDERED', panels, foldSource, coverage }
 *                   { type: 'BOX3D_ERROR', message }
 *
 * The host may post BOX3D_RENDER at any time; sending it again just redraws.
 */

// ─── Wire format ─────────────────────────────────────────────────────────────

/**
 * One keyline coordinate row as the host sends it.
 *
 * Field names are accepted case-insensitively because the two producers spell
 * them differently: the ASP.NET ERP returns PascalCase ("AddInX1", straight
 * from the ContentWiseKeylineCoordinates column names) while this project's
 * own .NET API returns camelCase ("addInX1").
 */
interface IncomingRow {
    [key: string]: unknown
}

interface IncomingDims {
    L?: number | string
    W?: number | string
    H?: number | string
    OF?: number | string
    PF?: number | string
    BF?: number | string
    FH?: number | string
    TH?: number | string
}

interface RenderMessage {
    type: 'BOX3D_RENDER'
    rows?: IncomingRow[]
    dims?: IncomingDims
    contentType?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Case-insensitive property lookup, so PascalCase and camelCase both work. */
function pick(row: IncomingRow, name: string): string | undefined {
    const direct = row[name]
    if (direct !== undefined && direct !== null) return String(direct)
    const lower = name.toLowerCase()
    for (const key of Object.keys(row)) {
        if (key.toLowerCase() === lower) {
            const v = row[key]
            return v === undefined || v === null ? undefined : String(v)
        }
    }
    return undefined
}

function num(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
    return Number.isFinite(n) ? n : fallback
}

/**
 * Normalise host rows into the shape the geometry engine expects.
 *
 * Rows without all four coordinates are dropped - they are usually annotation
 * rows. "DIM*" shape types are dimension arrows in the 2D keyline drawing, not
 * real panel edges, so they are dropped too. This mirrors KeyLineGenerator.
 */
function toKeylineRows(rows: IncomingRow[]): KL3DRow[] {
    return rows
        .map(r => ({
            AddInX1: pick(r, 'AddInX1') ?? '',
            AddInY1: pick(r, 'AddInY1') ?? '',
            AddInX2: pick(r, 'AddInX2') ?? '',
            AddInY2: pick(r, 'AddInY2') ?? '',
            Linetype: pick(r, 'LineType') ?? pick(r, 'Linetype') ?? 'Solid',
            LineStyles: pick(r, 'LineStyles') ?? 'Solid',
            ShapeType: pick(r, 'ShapeType'),
        }))
        .filter(r => r.AddInX1 && r.AddInY1 && r.AddInX2 && r.AddInY2)
        .filter(r => !r.ShapeType?.toUpperCase().startsWith('DIM'))
}

/**
 * Below this share of tagged panels we do not trust ShapeType and use the
 * geometric schedule instead.
 *
 * Rationale: ShapeType is still being filled in. Today most contents have none
 * at all, and a few have one or two stray values left over from testing. The
 * original `tree.some(p => p.shapeType)` check flipped the whole box onto the
 * ShapeType path as soon as a single panel had any text in that column, which
 * made a half-tagged box animate worse than an untagged one. Requiring a
 * majority means a box uses ShapeType only once it has really been tagged, and
 * each content upgrades itself automatically as the data is entered - no code
 * change needed.
 */
const SHAPE_TYPE_MIN_COVERAGE = 0.5

// ─── Component ───────────────────────────────────────────────────────────────

export default function Embed3D() {
    const [rows, setRows] = useState<IncomingRow[] | null>(null)
    const [dims, setDims] = useState<KL3DDims>({ L: 100, W: 80, H: 120, OF: 0, PF: 0, BF: 0, FH: 0, TH: 0 })
    const [contentType, setContentType] = useState<string>('')
    const [progress, setProgress] = useState(0)
    const [playing, setPlaying] = useState(false)
    const [hostError, setHostError] = useState<string | null>(null)

    const directionRef = useRef<1 | -1>(1)
    const lastTimeRef = useRef<number>(0)
    const presetHandlerRef = useRef<((p: CameraPreset) => void) | null>(null)
    // Where to post replies. '*' until the host introduces itself, then locked
    // to that exact origin so we never broadcast to an unexpected parent.
    const hostOriginRef = useRef<string>('*')

    // ── Receive data from the host page ──────────────────────────────────────
    useEffect(() => {
        function onMessage(ev: MessageEvent) {
            const data = ev.data as RenderMessage | undefined
            if (!data || data.type !== 'BOX3D_RENDER') return

            hostOriginRef.current = ev.origin || '*'
            try {
                const d = data.dims ?? {}
                setRows(Array.isArray(data.rows) ? data.rows : [])
                setContentType(data.contentType ?? '')
                setDims({
                    // The box needs positive extents to exist at all; a blank or
                    // zero field would collapse the geometry, so fall back to a
                    // sane default rather than rendering nothing.
                    L: Math.max(1, num(d.L, 100)),
                    W: Math.max(1, num(d.W, 80)),
                    H: Math.max(1, num(d.H, 120)),
                    OF: num(d.OF, 0),
                    PF: num(d.PF, 0),
                    BF: num(d.BF, 0),
                    FH: num(d.FH, 0),
                    TH: num(d.TH, 0),
                })
                setProgress(0)
                setPlaying(false)
                setHostError(null)
            } catch (e: any) {
                setHostError(String(e?.message || e))
            }
        }

        window.addEventListener('message', onMessage)
        // Tell the host we are mounted and ready for data. The host may also
        // post before this fires; it can simply post again on iframe load.
        try {
            window.parent?.postMessage({ type: 'BOX3D_READY' }, '*')
        } catch { /* no parent (opened directly) - harmless */ }

        return () => window.removeEventListener('message', onMessage)
    }, [])

    // ── Geometry pipeline ────────────────────────────────────────────────────
    const kl3dRows = useMemo<KL3DRow[]>(() => (rows ? toKeylineRows(rows) : []), [rows])

    const { tree, schedule, coverage, foldSource, error } = useMemo(() => {
        if (kl3dRows.length === 0) {
            return { tree: [], schedule: [], coverage: 0, foldSource: 'none' as const, error: null as string | null }
        }
        try {
            const panels = rootFirst(detectPanels(kl3dRows, dims), contentType)
            const builtTree = buildHingeTree(panels)
            const cov = shapeTypeCoverage(builtTree, contentType)
            // ShapeType drives the fold order once the content is properly
            // tagged; until then the purely geometric schedule is used.
            const useShapeType = cov >= SHAPE_TYPE_MIN_COVERAGE
            return {
                tree: builtTree,
                schedule: useShapeType
                    ? buildShapeTypeFoldSchedule(builtTree, contentType)
                    : buildFoldSchedule(builtTree, dims),
                coverage: cov,
                foldSource: (useShapeType ? 'shapetype' : 'geometry') as 'shapetype' | 'geometry',
                error: null as string | null,
            }
        } catch (e: any) {
            return { tree: [], schedule: [], coverage: 0, foldSource: 'none' as const, error: String(e?.message || e) }
        }
    }, [kl3dRows, dims, contentType])

    // ── Report the outcome back to the host ──────────────────────────────────
    useEffect(() => {
        if (rows === null) return
        const target = hostOriginRef.current
        try {
            if (error) {
                window.parent?.postMessage({ type: 'BOX3D_ERROR', message: error }, target)
            } else {
                window.parent?.postMessage(
                    { type: 'BOX3D_RENDERED', panels: tree.length, foldSource, coverage },
                    target,
                )
            }
        } catch { /* ignore */ }
    }, [rows, tree.length, foldSource, coverage, error])

    // ── Fold animation ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!playing) return
        let raf = 0
        const step = (t: number) => {
            if (!lastTimeRef.current) lastTimeRef.current = t
            const dt = (t - lastTimeRef.current) / 1000
            lastTimeRef.current = t
            setProgress(prev => {
                let next = prev + directionRef.current * dt * 0.5
                if (next >= 1) { next = 1; directionRef.current = -1 }
                else if (next <= 0) { next = 0; directionRef.current = 1 }
                return next
            })
            raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
        return () => { cancelAnimationFrame(raf); lastTimeRef.current = 0 }
    }, [playing])

    const applyPreset = useCallback((preset: CameraPreset) => {
        presetHandlerRef.current?.(preset)
    }, [])

    // ── Render ───────────────────────────────────────────────────────────────
    const waiting = rows === null
    const noGeometry = !waiting && !error && tree.length === 0

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f4f6f8', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {waiting && (
                    <Centered>Waiting for dimensions…</Centered>
                )}

                {hostError && (
                    <Centered tone="error">Could not read the data sent by the host.<br />{hostError}</Centered>
                )}

                {error && (
                    <Centered tone="error">
                        3D could not be built for this content.<br />
                        <span style={{ fontSize: 12, opacity: 0.8 }}>{error}</span>
                    </Centered>
                )}

                {noGeometry && (
                    <Centered>
                        3D view is not available for this content.<br />
                        <span style={{ fontSize: 12, opacity: 0.75 }}>
                            No foldable keyline panels were found — flat contents such as labels
                            and banners have no 3D shape.
                        </span>
                    </Centered>
                )}

                {!waiting && !error && tree.length > 0 && (
                    <Box3DViewer
                        tree={tree}
                        schedule={schedule}
                        dims={dims}
                        progress={progress}
                        showDims
                        className="w-full h-full"
                        onPresetReady={h => { presetHandlerRef.current = h }}
                    />
                )}
            </div>

            {!waiting && !error && tree.length > 0 && (
                <div style={{ borderTop: '1px solid #dfe3e8', background: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <button onClick={() => setPlaying(p => !p)} style={btnStyle}>
                        {playing ? '❚❚ Pause' : '▶ Play'}
                    </button>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px', minWidth: 180 }}>
                        <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>Flat</span>
                        <input
                            type="range" min={0} max={1} step={0.01} value={progress}
                            onChange={e => { setPlaying(false); setProgress(parseFloat(e.target.value)) }}
                            style={{ flex: 1 }}
                        />
                        <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>Closed</span>
                    </label>

                    <div style={{ display: 'flex', gap: 6 }}>
                        {(['front', 'top', 'side', 'iso'] as CameraPreset[]).map(p => (
                            <button key={p} onClick={() => applyPreset(p)} style={{ ...btnStyle, textTransform: 'capitalize' }}>
                                {p}
                            </button>
                        ))}
                    </div>

                    {/* Shows the data-entry team whether ShapeType is driving the
                        fold order yet, without them having to open the console. */}
                    <span
                        title={
                            foldSource === 'shapetype'
                                ? 'Fold order comes from each panel\'s ShapeType.'
                                : 'ShapeType is not filled in for this content yet, so the fold order is estimated from the geometry.'
                        }
                        style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                            background: foldSource === 'shapetype' ? '#e6f4ea' : '#fdf3e2',
                            color: foldSource === 'shapetype' ? '#1e7e34' : '#8a6100',
                        }}
                    >
                        {foldSource === 'shapetype'
                            ? `Fold: ShapeType (${Math.round(coverage * 100)}%)`
                            : `Fold: estimated (ShapeType ${Math.round(coverage * 100)}%)`}
                    </span>
                </div>
            )}
        </div>
    )
}

// ─── Small presentational bits ───────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
    padding: '5px 12px',
    fontSize: 12,
    border: '1px solid #cfd4d9',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
}

function Centered({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
    return (
        <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: 24, lineHeight: 1.6,
            color: tone === 'error' ? '#b3261e' : '#5f6b76', fontSize: 14,
        }}>
            <div>{children}</div>
        </div>
    )
}
