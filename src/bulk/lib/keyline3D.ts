/**
 * Keyline 3D — pure-geometry panel detection from ContentWiseKeylineCoordinates rows.
 *
 * Content-agnostic. Consumes the response shape of
 * GET /api/planwindow/keylinecoordinates/{ContentType}/{Grain} and produces
 * the panel + hinge tree + fold schedule the 3D viewer needs.
 *
 * Strategy: subdivide-by-creases.
 *   1. Evaluate every DB-row formula with caller's {L, W, H, OF, PF}
 *   2. Outer cut boundary = bounding rect of all solid lines
 *   3. Fold creases = dashed straight lines inside that rect
 *   4. Recursively split the rect by every crease that fully crosses a sub-rect
 *   5. Leaf rects are panels; assign generic IDs by area
 *   6. Adjacency = panels sharing a crease segment → hinge tree (root = largest)
 *   7. Depth-based fold schedule
 */

// ───────── Shared types (mirror API response) ─────────

export interface KeylineRow {
  AddInX1: string
  AddInY1: string
  AddInX2: string
  AddInY2: string
  Linetype: string  // "Solid" | "Curve" | "Circle"
  LineStyles: string // "Solid" | "Dashed"
  ShapeType?: string // e.g. "LENGTH" | "WIDTH" | "DUST FLAP" | ...
}

export interface Dims {
  L: number    // Job Length
  W: number    // Job Width
  H: number    // Job Height
  OF: number   // Open Flap
  PF: number   // Pasting / Overlap Flap
  /** Bottom Flap — used by crash-lock cartons. Defaults to 0 if unused. */
  BF?: number
  /** Flap Height — legacy "Job_Flap_H". Defaults to 0. */
  FH?: number
  /** Tongue Height. Defaults to 0. */
  TH?: number
}

export interface Segment {
  x1: number; y1: number
  x2: number; y2: number
  isDashed: boolean
  /** Original Linetype from DB — "Solid" | "Curve" | "Circle" */
  shape: string
  shapeType?: string
}

export interface Rect {
  x: number; y: number     // top-left in flat-keyline space
  w: number; h: number
}

export interface Point { x: number; y: number }

export interface Panel {
  id: string               // generic: "panel_0", "panel_1", ...
  rect: Rect
  area: number
  /** Closed polygon outline in flat-keyline coords. CW order. Falls back to rect corners if tracing fails. */
  outline: Point[]
  /** Dominant ShapeType from DB boundary edges — e.g. "LENGTH", "DUST FLAP", "OPEN FLAP" */
  shapeType?: string
}

export interface HingedPanel extends Panel {
  parentId: string | null  // null for root
  /** Local axis on parent that this panel rotates around */
  hinge: {
    /** Edge of THIS panel touching the parent: 'left' | 'right' | 'top' | 'bottom' */
    edge: 'left' | 'right' | 'top' | 'bottom'
    /** Position of the hinge line (in flat space) used by the renderer */
    line: { x1: number; y1: number; x2: number; y2: number }
  } | null
  depth: number            // 0 = root
}

export interface FoldStage {
  panelId: string
  startProgress: number    // 0..1
  endProgress: number      // 0..1
  closedAngleDeg: number   // typically -90 (fold up) or +180 (tuck-in past 90)
}

// ───────── Formula evaluator ─────────
// Allowed identifiers: L, W, H, OF, PF; operators + - * / ( )
// Refuses anything else — defensive, no eval().

// Multi-letter IDs must come before single-letter ones in the longest-match loop.
const ALLOWED_IDS = ['OF', 'PF', 'BF', 'FH', 'TH', 'L', 'W', 'H'] as const

export function evalFormula(expr: string, dims: Dims): number {
  // Strip whitespace
  const s = expr.replace(/\s+/g, '')
  // Allowed chars: digits, dot, operators, parens, and the 5 identifier letters
  if (!/^[0-9.+\-*/()LWHOFPBT]+$/.test(s)) {
    throw new Error(`Disallowed characters in formula: ${expr}`)
  }
  // Tokenize then shunting-yard → RPN
  const tokens: string[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      tokens.push(s.slice(i, j))
      i = j
    } else if (/[A-Z]/.test(c)) {
      // longest match across allowed identifiers
      let matched = ''
      for (const id of ALLOWED_IDS) {
        if (s.startsWith(id, i) && id.length > matched.length) matched = id
      }
      if (!matched) throw new Error(`Unknown identifier at ${i} in ${expr}`)
      tokens.push(matched)
      i += matched.length
    } else if ('+-*/()'.includes(c)) {
      tokens.push(c)
      i++
    } else {
      throw new Error(`Unexpected char ${c} in ${expr}`)
    }
  }
  // Detect unary minus: a '-' at start or after an operator/'(' becomes "0-"
  const fixed: string[] = []
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    const prev = fixed[fixed.length - 1]
    if (t === '-' && (prev === undefined || '+-*/('.includes(prev))) {
      fixed.push('0')
    }
    fixed.push(t)
  }
  // Shunting-yard
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }
  const out: string[] = []
  const ops: string[] = []
  for (const t of fixed) {
    if (/^[0-9.]/.test(t) || ALLOWED_IDS.includes(t as typeof ALLOWED_IDS[number])) {
      out.push(t)
    } else if (t in prec) {
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[t]) {
        out.push(ops.pop()!)
      }
      ops.push(t)
    } else if (t === '(') {
      ops.push(t)
    } else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop()!)
      if (ops.pop() !== '(') throw new Error(`Mismatched parens in ${expr}`)
    }
  }
  while (ops.length) {
    const op = ops.pop()!
    if (op === '(' || op === ')') throw new Error(`Mismatched parens in ${expr}`)
    out.push(op)
  }
  // Evaluate RPN
  const stack: number[] = []
  for (const t of out) {
    if (t in prec) {
      const b = stack.pop()!
      const a = stack.pop()!
      stack.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : a / b)
    } else if (ALLOWED_IDS.includes(t as typeof ALLOWED_IDS[number])) {
      const v = dims[t as keyof Dims]
      stack.push(typeof v === 'number' ? v : 0)
    } else {
      stack.push(parseFloat(t))
    }
  }
  if (stack.length !== 1) throw new Error(`Invalid expression: ${expr}`)
  return stack[0]
}

// ───────── Step 1: rows → numeric segments ─────────
// Curves count as adjacency edges between their endpoints — they bound dust-ear
// panels just like straight lines do. Circles get the same treatment.

export function rowsToSegments(rows: KeylineRow[], dims: Dims): Segment[] {
  const segs: Segment[] = []
  for (const r of rows) {
    let x1: number, y1: number, x2: number, y2: number
    try {
      x1 = evalFormula(r.AddInX1, dims)
      y1 = evalFormula(r.AddInY1, dims)
      x2 = evalFormula(r.AddInX2, dims)
      y2 = evalFormula(r.AddInY2, dims)
    } catch {
      continue
    }
    segs.push({ x1, y1, x2, y2, isDashed: r.LineStyles === 'Dashed', shape: r.Linetype, shapeType: r.ShapeType })
  }
  return segs
}

// ───────── Step 2: outer bounding rect ─────────

export function boundsOf(segs: Segment[]): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of segs) {
    minX = Math.min(minX, s.x1, s.x2)
    minY = Math.min(minY, s.y1, s.y2)
    maxX = Math.max(maxX, s.x1, s.x2)
    maxY = Math.max(maxY, s.y1, s.y2)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

// ───────── Step 3: planar subdivision panel detection ─────────
// Every line segment in the keyline becomes an edge of a planar graph. Curves
// are sampled into chord polylines. Every pairwise intersection adds a vertex.
// We then build a half-edge structure and walk every bounded face — each face
// is one panel. Dashed edges become hinges; solid/curve edges are cuts.
//
// One algorithm, no orientation-specific patches. Works for any keyline shape
// in ContentWiseKeylineCoordinates.

const EPS = 0.5  // mm — tolerant equality
const MIN_HINGE_LEN = 5.0  // mm — minimum shared-edge length to count as a real hinge (filters 1mm corner-touches)
const CURVE_CHORDS = 8  // sample resolution for Curve / Circle segments

function near(a: number, b: number) { return Math.abs(a - b) < EPS }

// ─── Step 3a: sample curves + circles into straight chord segments ───

interface StraightSeg {
  x1: number; y1: number
  x2: number; y2: number
  isDashed: boolean
  shapeType?: string
}

/**
 * Match legacy drawCurveNSolid path shape: Q(x1, y1) - (x1, y2) - (x2, y2).
 * Sample uniformly along the quadratic Bezier into N chords.
 */
function sampleCurve(s: Segment, n: number): StraightSeg[] {
  const out: StraightSeg[] = []
  const bez = (t: number) => {
    const u = 1 - t
    // P0 = (x1,y1), P1 = (x2,y1), P2 = (x2,y2)  — control point flipped to match SVG drawCurveNSolid direction
    const x = u * u * s.x1 + 2 * u * t * s.x2 + t * t * s.x2
    const y = u * u * s.y1 + 2 * u * t * s.y1 + t * t * s.y2
    return { x, y }
  }
  let prev = bez(0)
  for (let i = 1; i <= n; i++) {
    const p = bez(i / n)
    out.push({ x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, isDashed: s.isDashed, shapeType: s.shapeType })
    prev = p
  }
  return out
}

function sampleCircle(s: Segment, n: number): StraightSeg[] {
  // Legacy drawCircleSolid: A r r 0 1 1 — a circular arc. Sample uniformly.
  const cx = (s.x1 + s.x2) / 2
  const cy = (s.y1 + s.y2) / 2
  const r = Math.sqrt((s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2) / 2
  const a1 = Math.atan2(s.y1 - cy, s.x1 - cx)
  const a2 = a1 + Math.PI * 2  // full sweep (matches the 1 1 large-arc flags)
  const out: StraightSeg[] = []
  let prev = { x: s.x1, y: s.y1 }
  for (let i = 1; i <= n; i++) {
    const t = a1 + ((a2 - a1) * i) / n
    const p = { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }
    out.push({ x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, isDashed: s.isDashed, shapeType: s.shapeType })
    prev = p
  }
  return out
}

function rawToStraightSegments(segs: Segment[]): StraightSeg[] {
  const out: StraightSeg[] = []
  for (const s of segs) {
    if (s.shape === 'Curve') {
      out.push(...sampleCurve(s, CURVE_CHORDS))
    } else if (s.shape === 'Circle') {
      out.push(...sampleCircle(s, CURVE_CHORDS * 2))
    } else {
      if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < EPS) continue
      out.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, isDashed: s.isDashed, shapeType: s.shapeType })
    }
  }
  return out
}

// ─── Step 3b: planar arrangement ─────────────────────────
// Find every pairwise segment intersection, split segments at those points,
// and dedupe vertices within EPS. Result: a set of "atomic" segments whose
// only intersection points are shared endpoints.

interface Vertex { x: number; y: number; id: number }
interface AtomicEdge { aId: number; bId: number; isDashed: boolean; shapeType?: string }

/** Intersection of two open segments. Returns null if parallel / no overlap. */
function segIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): { x: number; y: number; t: number; u: number } | null {
  const r = { x: bx - ax, y: by - ay }
  const s = { x: dx - cx, y: dy - cy }
  const denom = r.x * s.y - r.y * s.x
  if (Math.abs(denom) < 1e-9) return null
  const t = ((cx - ax) * s.y - (cy - ay) * s.x) / denom
  const u = ((cx - ax) * r.y - (cy - ay) * r.x) / denom
  // Strict-ish interior — endpoints touching is fine (we want them as vertices)
  if (t < -EPS / Math.hypot(r.x, r.y) || t > 1 + EPS / Math.hypot(r.x, r.y)) return null
  if (u < -EPS / Math.hypot(s.x, s.y) || u > 1 + EPS / Math.hypot(s.x, s.y)) return null
  return { x: ax + t * r.x, y: ay + t * r.y, t, u }
}

function buildArrangement(segs: StraightSeg[]): { verts: Vertex[]; edges: AtomicEdge[] } {
  const verts: Vertex[] = []
  const addVert = (x: number, y: number): number => {
    for (const v of verts) {
      if (Math.abs(v.x - x) < EPS && Math.abs(v.y - y) < EPS) return v.id
    }
    const id = verts.length
    verts.push({ x, y, id })
    return id
  }

  // For each input segment, compute all parameter splits along it.
  type Split = { t: number; vid: number }
  const splitsPerSeg: Split[][] = segs.map(() => [])

  for (let i = 0; i < segs.length; i++) {
    const a = segs[i]
    const aLen = Math.hypot(a.x2 - a.x1, a.y2 - a.y1)
    // Always include endpoints
    splitsPerSeg[i].push({ t: 0, vid: addVert(a.x1, a.y1) })
    splitsPerSeg[i].push({ t: 1, vid: addVert(a.x2, a.y2) })
    for (let j = i + 1; j < segs.length; j++) {
      const b = segs[j]
      const inter = segIntersect(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1, b.x2, b.y2)
      if (!inter) continue
      const vid = addVert(inter.x, inter.y)
      splitsPerSeg[i].push({ t: inter.t, vid })
      splitsPerSeg[j].push({ t: inter.u, vid })
      void aLen
    }
  }

  // Build atomic edges by walking each segment's sorted splits.
  const edges: AtomicEdge[] = []
  const seenEdge = new Set<string>()
  for (let i = 0; i < segs.length; i++) {
    const splits = splitsPerSeg[i]
      .sort((p, q) => p.t - q.t)
      .filter((p, idx, arr) => idx === 0 || p.vid !== arr[idx - 1].vid)
    for (let k = 0; k + 1 < splits.length; k++) {
      const aId = splits[k].vid
      const bId = splits[k + 1].vid
      if (aId === bId) continue
      const key = aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`
      if (seenEdge.has(key)) continue
      seenEdge.add(key)
      edges.push({ aId, bId, isDashed: segs[i].isDashed, shapeType: segs[i].shapeType })
    }
  }

  return { verts, edges }
}

// ─── Step 3c: face walking via half-edges ────────────────
// For each undirected edge create two half-edges (a→b and b→a). At each vertex,
// sort outgoing half-edges by angle. To walk a face: from a half-edge, take
// the next half-edge at its target vertex that is the most-clockwise turn from
// the incoming direction (matches keyline space where Y points down).

interface HalfEdge {
  id: number
  from: number      // vertex id
  to: number        // vertex id
  twin: number      // half-edge id
  next: number      // next half-edge in face (filled later)
  face: number      // face id (-1 = unassigned)
  isDashed: boolean
  shapeType?: string
}

function buildHalfEdges(verts: Vertex[], edges: AtomicEdge[]): HalfEdge[] {
  const he: HalfEdge[] = []
  for (const e of edges) {
    const idA = he.length
    he.push({ id: idA, from: e.aId, to: e.bId, twin: idA + 1, next: -1, face: -1, isDashed: e.isDashed, shapeType: e.shapeType })
    he.push({ id: idA + 1, from: e.bId, to: e.aId, twin: idA, next: -1, face: -1, isDashed: e.isDashed, shapeType: e.shapeType })
  }

  // Group half-edges by their `from` vertex, sorted CCW by angle.
  const outByVert = new Map<number, number[]>()
  for (const h of he) {
    if (!outByVert.has(h.from)) outByVert.set(h.from, [])
    outByVert.get(h.from)!.push(h.id)
  }
  const angleOf = (h: HalfEdge) => {
    const a = verts[h.from], b = verts[h.to]
    return Math.atan2(b.y - a.y, b.x - a.x)
  }
  for (const arr of outByVert.values()) {
    arr.sort((p, q) => angleOf(he[p]) - angleOf(he[q]))
  }

  // For each half-edge, `next` = at its target, take the half-edge that's the
  // most-clockwise from the reverse of this one (i.e. the half-edge whose angle
  // is just less than the incoming direction's angle, cyclically).
  for (const h of he) {
    const outgoing = outByVert.get(h.to)!
    const incomingAngle = Math.atan2(verts[h.from].y - verts[h.to].y, verts[h.from].x - verts[h.to].x)
    // Sort gave CCW; we want the predecessor of `incomingAngle` cyclically — that's
    // the "most clockwise turn" off the incoming edge (i.e. hug the boundary on
    // the right). In screen-y-down space that traces clockwise faces.
    let pickedIdx = -1
    let pickedDelta = -Infinity
    for (let i = 0; i < outgoing.length; i++) {
      const cand = he[outgoing[i]]
      if (cand.twin === h.id) continue
      let delta = angleOf(cand) - incomingAngle
      while (delta <= 1e-9) delta += Math.PI * 2
      while (delta > Math.PI * 2 + 1e-9) delta -= Math.PI * 2
      // We want the smallest positive delta (most clockwise from incoming when
      // looking with Y up) — but on screen Y is down, so "most CW visually" is
      // the LARGEST delta < 2π. Equivalent: 2π - delta is smallest.
      if (delta > pickedDelta) {
        pickedDelta = delta
        pickedIdx = cand.id
      }
    }
    if (pickedIdx === -1) {
      // Dead end (degree-1 vertex). Loop back via twin so the walk terminates.
      h.next = h.twin
    } else {
      h.next = pickedIdx
    }
  }
  return he
}

/** Signed area of a polygon (positive = CCW in math coords, but with screen-y-down it's reversed). */
function signedArea(pts: { x: number; y: number }[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

interface Face {
  id: number
  vertIds: number[]      // ordered
  halfEdges: number[]    // half-edge ids making this face
  area: number           // |signed area|
  signedArea: number     // signed (sign tells inner vs outer)
  bbox: Rect
}

function walkFaces(verts: Vertex[], he: HalfEdge[]): Face[] {
  const faces: Face[] = []
  for (const start of he) {
    if (start.face !== -1) continue
    const visited: number[] = []
    let cur = start
    let guard = 0
    while (cur.face === -1 && guard++ < he.length + 4) {
      cur.face = faces.length
      visited.push(cur.id)
      cur = he[cur.next]
    }
    if (visited.length < 3) {
      // Degenerate — mark as dummy face but skip
      continue
    }
    const vertIds = visited.map(id => he[id].from)
    const pts = vertIds.map(v => verts[v])
    const sa = signedArea(pts)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y
    }
    faces.push({
      id: faces.length,
      vertIds,
      halfEdges: visited,
      area: Math.abs(sa),
      signedArea: sa,
      bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    })
  }
  return faces
}

// ─── Step 3d: detectPanels — assemble + drop outer face ──

export function detectPanels(rows: KeylineRow[], dims: Dims): Panel[] {
  const rawSegs = rowsToSegments(rows, dims)
  if (rawSegs.length === 0) return []
  const straight = rawToStraightSegments(rawSegs)
  if (straight.length === 0) return []
  const { verts, edges } = buildArrangement(straight)
  console.log('[KL3D] arrangement: verts=', verts.length, 'edges=', edges.length)
  if (verts.length < 3 || edges.length < 3) return []
  const he = buildHalfEdges(verts, edges)
  const faces = walkFaces(verts, he)
  console.log('[KL3D] faces walked:', faces.length)
  if (faces.length === 0) return []

  // The outer "face" is the unbounded region surrounding everything — it has
  // the largest area by far (its boundary is the convex hull of the keyline).
  // Drop it. In screen-y-down space the outer face has POSITIVE signed area
  // (CW visually means math-CCW because Y is flipped) — but to be safe we just
  // drop the single largest face.
  faces.sort((a, b) => b.area - a.area)
  console.log('[KL3D] faces by area (top 15):',
    faces.slice(0, 15).map((f, i) => `[${i}] area=${f.area.toFixed(1)} verts=${f.vertIds.length}`)
  )
  const inner = faces.slice(1)

  // Filter degenerate slivers (e.g. OF cut tongue slits forming tiny faces).
  // Use 0.1% (not 0.5%) so crash-lock tongue tabs aren't dropped — losing them
  // breaks adjacency for the bottom flap panels that attach through them.
  const totalArea = inner.reduce((s, f) => s + f.area, 0)
  const minArea = totalArea * 0.001  // 0.1% of total panel area
  const kept = inner.filter(f => f.area >= minArea)
  console.log('[KL3D] inner faces:', inner.length, '→ kept after area filter:', kept.length,
    '(minArea=', minArea.toFixed(1), 'totalArea=', totalArea.toFixed(1), ')')

  // Sort by area desc for stable panel_N naming
  kept.sort((a, b) => b.area - a.area)

  return kept.map((f, i) => {
    // THREE.Shape extrudes a simple polygon. In keyline coords Y points down,
    // so a face traced visually-CW has POSITIVE signedArea here (the y-flip
    // inverts the standard math sign). Box3DViewer's mesh factory wants
    // visually-CW outlines, so reverse faces with negative signed area.
    let outline = f.vertIds.map(v => ({ x: verts[v].x, y: verts[v].y }))
    if (f.signedArea < 0) outline = outline.slice().reverse()

    // Dominant ShapeType: count occurrences on boundary half-edges, pick max.
    const shapeCounts = new Map<string, number>()
    for (const heId of f.halfEdges) {
      const st = he[heId].shapeType
      if (st) shapeCounts.set(st, (shapeCounts.get(st) ?? 0) + 1)
    }
    let dominantShapeType: string | undefined
    let maxCount = 0
    for (const [st, count] of shapeCounts) {
      if (count > maxCount) { maxCount = count; dominantShapeType = st }
    }

    return {
      id: `panel_${i}`,
      rect: f.bbox,
      area: f.area,
      outline,
      shapeType: dominantShapeType,
    }
  })
}

/** Re-export for callers that wanted the old tracer. Outline is on Panel now. */
export function tracePanelOutline(rect: Rect, _segs: Segment[]): Point[] {
  // Backwards-compat shim — outline is computed inside detectPanels.
  // Returns a rect fallback if anyone still calls this.
  return [
    { x: rect.x,           y: rect.y },
    { x: rect.x + rect.w,  y: rect.y },
    { x: rect.x + rect.w,  y: rect.y + rect.h },
    { x: rect.x,           y: rect.y + rect.h },
  ]
}

// ───────── Step 5: hinge tree ─────────
// Adjacency: two panels share a hinge if their rects share an edge segment.

function sharedEdge(a: Rect, b: Rect): { x1: number; y1: number; x2: number; y2: number; aEdge: 'left'|'right'|'top'|'bottom' } | null {
  // a's right edge meets b's left edge
  if (near(a.x + a.w, b.x)) {
    const yLo = Math.max(a.y, b.y)
    const yHi = Math.min(a.y + a.h, b.y + b.h)
    if (yHi - yLo > EPS) return { x1: a.x + a.w, y1: yLo, x2: a.x + a.w, y2: yHi, aEdge: 'right' }
  }
  // a's left edge meets b's right edge
  if (near(a.x, b.x + b.w)) {
    const yLo = Math.max(a.y, b.y)
    const yHi = Math.min(a.y + a.h, b.y + b.h)
    if (yHi - yLo > EPS) return { x1: a.x, y1: yLo, x2: a.x, y2: yHi, aEdge: 'left' }
  }
  // a's bottom edge meets b's top edge
  if (near(a.y + a.h, b.y)) {
    const xLo = Math.max(a.x, b.x)
    const xHi = Math.min(a.x + a.w, b.x + b.w)
    if (xHi - xLo > EPS) return { x1: xLo, y1: a.y + a.h, x2: xHi, y2: a.y + a.h, aEdge: 'bottom' }
  }
  // a's top edge meets b's bottom edge
  if (near(a.y, b.y + b.h)) {
    const xLo = Math.max(a.x, b.x)
    const xHi = Math.min(a.x + a.w, b.x + b.w)
    if (xHi - xLo > EPS) return { x1: xLo, y1: a.y, x2: xHi, y2: a.y, aEdge: 'top' }
  }
  return null
}

/** Fallback adjacency via outline polygons — two panels are adjacent if their
 *  outlines share at least 2 consecutive vertices (a polygon edge). Catches
 *  trapezoidal dust flaps whose bboxes don't quite line up with rect-rect
 *  sharedEdge() but whose actual polygon edges DO meet a neighbor's edge.
 */
function sharedOutlineEdge(
  a: Panel, b: Panel,
): { x1: number; y1: number; x2: number; y2: number; aEdge: 'left'|'right'|'top'|'bottom' } | null {
  const sameV = (p: Point, q: Point) =>
    Math.abs(p.x - q.x) < EPS && Math.abs(p.y - q.y) < EPS
  for (let i = 0; i < a.outline.length; i++) {
    const a1 = a.outline[i]
    const a2 = a.outline[(i + 1) % a.outline.length]
    for (let j = 0; j < b.outline.length; j++) {
      const b1 = b.outline[j]
      const b2 = b.outline[(j + 1) % b.outline.length]
      // Edge a1-a2 matches edge b1-b2 in either direction
      if ((sameV(a1, b1) && sameV(a2, b2)) || (sameV(a1, b2) && sameV(a2, b1))) {
        // Classify the hinge relative to A's bbox so the viewer knows which
        // axis to rotate around: pick the side of A whose midline is closest
        // to the shared segment's midpoint.
        const mx = (a1.x + a2.x) / 2
        const my = (a1.y + a2.y) / 2
        const dLeft   = Math.abs(mx - a.rect.x)
        const dRight  = Math.abs(mx - (a.rect.x + a.rect.w))
        const dTop    = Math.abs(my - a.rect.y)
        const dBot    = Math.abs(my - (a.rect.y + a.rect.h))
        const min = Math.min(dLeft, dRight, dTop, dBot)
        const aEdge: 'left'|'right'|'top'|'bottom' =
          min === dLeft ? 'left' : min === dRight ? 'right' : min === dTop ? 'top' : 'bottom'
        return { x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y, aEdge }
      }
    }
  }
  return null
}

export function buildHingeTree(panels: Panel[]): HingedPanel[] {
  if (panels.length === 0) return []
  // Build adjacency map — try rect-edge first (fast, gives axis-aligned hinges),
  // fall back to outline-edge for panels whose bboxes don't quite line up.
  const adj = new Map<string, { otherId: string; edge: 'left'|'right'|'top'|'bottom'; line: { x1: number; y1: number; x2: number; y2: number } }[]>()
  for (const p of panels) adj.set(p.id, [])
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      let e = sharedEdge(panels[i].rect, panels[j].rect)
      if (!e) {
        const oe = sharedOutlineEdge(panels[i], panels[j])
        if (oe) e = oe
      }
      if (e) {
        // Discard corner-touch near-zero edges (e.g. 1mm) — they create wrong BFS parents.
        // Real creases are always ≥ MIN_HINGE_LEN mm; tiny overlaps are just bbox rounding artifacts.
        const edgeLen = Math.abs(e.x2 - e.x1) + Math.abs(e.y2 - e.y1)
        if (edgeLen < MIN_HINGE_LEN) continue
        adj.get(panels[i].id)!.push({ otherId: panels[j].id, edge: e.aEdge, line: { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 } })
        // Flip edge for the other side
        const flip: Record<string, 'left'|'right'|'top'|'bottom'> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }
        adj.get(panels[j].id)!.push({ otherId: panels[i].id, edge: flip[e.aEdge], line: { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 } })
      }
    }
  }
  // BFS from largest panel (panel_0) → tree
  const byId = new Map(panels.map(p => [p.id, p]))
  const result = new Map<string, HingedPanel>()
  const root = panels[0]
  result.set(root.id, { ...root, parentId: null, hinge: null, depth: 0 })
  const queue: { id: string; depth: number }[] = [{ id: root.id, depth: 0 }]
  while (queue.length) {
    const { id, depth } = queue.shift()!
    for (const nb of adj.get(id)!) {
      if (result.has(nb.otherId)) continue
      const p = byId.get(nb.otherId)!
      // From CHILD's perspective, which edge of CHILD touches the PARENT?
      const parent = byId.get(id)!
      let childEdge = sharedEdge(p.rect, parent.rect)
      if (!childEdge) childEdge = sharedOutlineEdge(p, parent)
      if (!childEdge) continue
      result.set(p.id, {
        ...p,
        parentId: id,
        hinge: { edge: childEdge.aEdge, line: { x1: childEdge.x1, y1: childEdge.y1, x2: childEdge.x2, y2: childEdge.y2 } },
        depth: depth + 1,
      })
      queue.push({ id: p.id, depth: depth + 1 })
    }
  }
  const bfsReached = [...result.keys()]
  const allPanelIds = panels.map(p => p.id)
  const orphanIds = allPanelIds.filter(id => !result.has(id))
  console.log('[KL3D] buildHingeTree — panels:', allPanelIds.length,
    '| BFS reached:', bfsReached.length,
    '| orphans:', orphanIds.length, orphanIds,
    '| panels detail:', panels.map(p => `${p.id}(${p.shapeType ?? '?'} area=${p.area.toFixed(0)} rect=${JSON.stringify(p.rect)})`)
  )
  // ── Orphan rescue ──────────────────────────────────────────────────────────
  // Panels not reached by BFS (crash-lock flaps whose shared boundary has
  // intermediate vertices from lock-mechanism cuts, so sharedEdge/sharedOutlineEdge
  // both miss them). Attach each orphan to the already-placed panel whose
  // bounding box is nearest, then derive the best hinge we can.
  const rectMinDist = (a: Rect, b: Rect): number => {
    const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w))
    const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h))
    return Math.sqrt(dx * dx + dy * dy)
  }
  const sharedEdgeFuzzy = (a: Panel, b: Panel, tol: number) => {
    // Looser version of sharedEdge that accepts overlap > tol instead of > EPS
    const ra = a.rect, rb = b.rect
    if (Math.abs(ra.x + ra.w - rb.x) < tol) {
      const lo = Math.max(ra.y, rb.y), hi = Math.min(ra.y + ra.h, rb.y + rb.h)
      if (hi - lo > tol) return { x1: ra.x + ra.w, y1: lo, x2: ra.x + ra.w, y2: hi, aEdge: 'right' as const }
    }
    if (Math.abs(ra.x - (rb.x + rb.w)) < tol) {
      const lo = Math.max(ra.y, rb.y), hi = Math.min(ra.y + ra.h, rb.y + rb.h)
      if (hi - lo > tol) return { x1: ra.x, y1: lo, x2: ra.x, y2: hi, aEdge: 'left' as const }
    }
    if (Math.abs(ra.y + ra.h - rb.y) < tol) {
      const lo = Math.max(ra.x, rb.x), hi = Math.min(ra.x + ra.w, rb.x + rb.w)
      if (hi - lo > tol) return { x1: lo, y1: ra.y + ra.h, x2: hi, y2: ra.y + ra.h, aEdge: 'bottom' as const }
    }
    if (Math.abs(ra.y - (rb.y + rb.h)) < tol) {
      const lo = Math.max(ra.x, rb.x), hi = Math.min(ra.x + ra.w, rb.x + rb.w)
      if (hi - lo > tol) return { x1: lo, y1: ra.y, x2: hi, y2: ra.y, aEdge: 'top' as const }
    }
    return null
  }
  for (const p of panels) {
    if (result.has(p.id)) continue
    // Find nearest placed panel
    let bestParentId = root.id
    let bestDist = Infinity
    for (const hp of result.values()) {
      const d = rectMinDist(p.rect, hp.rect)
      if (d < bestDist) { bestDist = d; bestParentId = hp.id }
    }
    const parent = result.get(bestParentId)!
    const e = sharedEdgeFuzzy(p, parent, 8) ?? sharedEdge(p.rect, parent.rect) ?? sharedOutlineEdge(p, parent)
    result.set(p.id, {
      ...p,
      parentId: bestParentId,
      hinge: e ? { edge: e.aEdge, line: { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 } } : null,
      depth: parent.depth + 1,
    })
  }

  // Return in stable order (root first, then by depth)
  return [...result.values()].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))
}

// ───────── Step 6: fold schedule ─────────
// Stage order:
//   - depth-1 panels (walls + glue flap) fold first
//   - depth-2+ panels (dust flaps, tucks) fold next
//   - panels whose dimensions match OF (open flap) or PF (pasting flap) ALWAYS
//     fold dead last — they're the visible "lid" of the carton and close
//     ceremonially after everything underneath is already in place.
//
// All angles are +90 (the viewer's offsetX/offsetZ sign rule gives correct
// rotation direction per panel).

const TUCK_EPS = 1.0  // mm — how close a panel's extent must be to OF/PF to count as a tuck/glue

export function buildFoldSchedule(tree: HingedPanel[], dims?: Dims): FoldStage[] {
  const stages: FoldStage[] = []
  const movers = tree.filter(p => p.depth > 0)
  if (movers.length === 0) return stages

  // Identify "tuck-like" panels — must close LAST.
  // A panel is a tuck if its flat-rect H ≈ OF (top/bottom tuck flap) or its
  // flat-rect W ≈ PF (paste flap).
  const isTuck = (p: HingedPanel): boolean => {
    if (!dims) return false
    const matchesOF = dims.OF > 0 && Math.abs(p.rect.h - dims.OF) < TUCK_EPS
    const matchesPF = dims.PF > 0 && Math.abs(p.rect.w - dims.PF) < TUCK_EPS
    return matchesOF || matchesPF
  }

  const tucks = movers.filter(isTuck)
  const others = movers.filter(p => !isTuck(p))

  // Time budget: 80% of the slider for "others" (walls + dust flaps), 20% for
  // the closing tucks. If there are no tucks, others get the full slider.
  const tuckCutoff = tucks.length > 0 ? 0.8 : 1.0

  // Within "others", split by depth so structural folds happen in order.
  const othersMaxDepth = Math.max(0, ...others.map(p => p.depth))
  for (const p of others) {
    const d = p.depth
    const start = ((d - 1) / Math.max(1, othersMaxDepth)) * tuckCutoff
    const end   = (d / Math.max(1, othersMaxDepth)) * tuckCutoff
    stages.push({ panelId: p.id, startProgress: start, endProgress: end, closedAngleDeg: 90 })
  }

  // All tucks animate in the final window (tuckCutoff..1.0), simultaneously.
  for (const p of tucks) {
    stages.push({ panelId: p.id, startProgress: tuckCutoff, endProgress: 1.0, closedAngleDeg: 90 })
  }

  return stages
}

// ───────── Easing ─────────

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Returns the current fold angle (deg) for a panel given global progress 0..1 */
export function angleAt(stage: FoldStage, progress: number): number {
  const { startProgress, endProgress, closedAngleDeg } = stage
  if (progress <= startProgress) return 0
  if (progress >= endProgress) return closedAngleDeg
  const local = (progress - startProgress) / (endProgress - startProgress)
  return easeInOutCubic(local) * closedAngleDeg
}
