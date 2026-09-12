import type { HingedPanel, FoldStage, Panel } from './keyline3D'

// ─── ShapeType-driven fold sequencing ────────────────────────────────────────
//
// A panel's ShapeType (stored per keyline coordinate row in
// ContentWiseKeylineCoordinates) says what the panel *is*, which in turn says
// *when* it folds while the carton closes:
//
//   1 = LENGTH / WIDTH   (main body walls stand up first)
//   2 = PASTING FLAP     (glue flap folds inside)
//   3 = DUST FLAP        (side dust flaps close at 90 degrees)
//   4 = OPEN FLAP        (top tuck flap tucks inside length)
//   5 = BOTTOM FLAP      (opposite of open flap)
//   6 = TUCKIN WIDTH     (final lock - closes last)
//   HEIGHT = root panel, never folds
//
// Extracted from KeyLineGenerator.tsx so the embedded 3D viewer and the
// generator page share one implementation instead of drifting apart.

/** Default fold sequence (generic box types). */
export const SHAPE_FOLD_SEQ: Record<string, number> = {
    'LENGTH':       1,
    'WIDTH':        1,
    'PASTING FLAP': 2,
    'DUST FLAP':    3,
    'OPEN FLAP':    4,
    'BOTTOM FLAP':  5,
    'TUCKIN WIDTH': 6,
}
export const DEFAULT_MAX_SEQ = 6

/** Content-specific fold sequences - keyed by content name (case-insensitive). */
export const CONTENT_FOLD_SEQ: Record<string, {
    seq: Record<string, number>
    maxSeq: number
    bodyAtDepth1?: string[]
    /** Panels whose area ≥ this are treated as body walls: they fold first (seq 1)
     *  at 90°, regardless of their ShapeType. Handles boxes where large structural
     *  walls are mislabeled as flaps (e.g. a 60×100 wall tagged "DUST FLAP"), which
     *  would otherwise fold at a flap's step/angle and tear the box apart. */
    bodyMinArea?: number
    /** Per-ShapeType closed angle override. Negative value reverses fold direction. */
    angleOverride?: Record<string, number>
    /** Force this ShapeType to be the BFS root (stays flat). Falls back to largest-area if not found. */
    rootShapeType?: string
    /** Per-ShapeType, per-depth seq override — takes priority over seq[]. */
    depthSeq?: Record<string, Record<number, number>>
    /** Per-ShapeType, per-depth closedAngleDeg override — takes priority over angleOverride[]. */
    depthAngles?: Record<string, Record<number, number>>
}> = {
    'CAKE-BOX': {
        seq: {
            'SIDE FLAP': 1,
            'DUST FLAP': 2,
            'LENGTH':    3,
            'TOP FLAP':  4,
            'OPEN FLAP': 5,
        },
        maxSeq: 5,
    },

    'PIZZABOX': {
        rootShapeType: 'MAIN PANEL',
        seq: {
            'SIDE LOCK SECOND': 2, // must be before 'SIDE LOCK' — it is a substring of this key
            'SIDE LOCK':        1,
            'DUST FLAP':        3,
            'SIDE WALL':        4,
            'SIDE PASTING':     5,
            'SIDE FLAP':        6,
            'TOP CLOSE FLAP':   7,
            'TONGUE':           8,
            'TOUNGE':           8, // DB typo alias
        },
        angleOverride: {
            'SIDE LOCK SECOND': -90,  // opposite direction to SIDE LOCK
            'SIDE PASTING':    180,   // folds all the way inside — pastes flat against Side Wall
        },
        maxSeq: 8,
    },

    'SIXCORNERBOX': {
        rootShapeType: 'MAIN PANEL',
        seq: {
            'SIDE WALL SECOND': 4, // before 'SIDE WALL' — substring match guard
            'SIDE WALL':        1,
            'TOP DUST FLAP':    7, // before 'DUST FLAP' — folds after lid
            'DUST FLAP':        2,
            'SIDE FLAP SECOND': 5, // depth=3 tuck-ins; depth=2 lid overridden by depthSeq
            'SIDE FLAP':        3,
            'TOP PANEL':        6,
            'TOP CLOSE FLAP':   8,
        },
        // depth=2 SIDE FLAP SECOND is the large lid panel — fold it AFTER tuck-ins (step 5) at step 6
        depthSeq: {
            'SIDE FLAP SECOND': { 2: 6 },
        },
        // depth=2 SIDE FLAP SECOND (lid) folds over the box (inward); depth=3+ tuck-in use angleOverride (180°)
        depthAngles: {
            'SIDE FLAP SECOND': { 2: 90 },
        },
        angleOverride: {
            'TOP DUST FLAP':     90,
            'TOP CLOSE FLAP':    90,
            'TOP PANEL':         90,
            'SIDE FLAP SECOND':  90, // depth=3+ tuck-in flaps fold into box opening (depthAngles takes priority at depth=2)
        },
        maxSeq: 8,
    },

    'SLEEVEFOODBOXTRAY': {
        rootShapeType: 'MAIN PANEL',
        seq: {
            'SIDE LOCK':  1,
            'DUST FLAP':  2,
            'PASTING':    3,
            'SIDE FLAP':  4,
            'SIDE WALL':  5,
        },
        angleOverride: {
            'SIDE FLAP': 180,  // folds inside box — pastes against Side Wall
            'PASTING':   180,  // folds inside box — pastes against Main Panel
        },
        maxSeq: 5,
    },

    // CrashLockBottomTuckEndFoldingCarton:
    //   Body walls fold up → pasting flap glues → dust flaps close → open flap closes →
    //   crash-lock bottom flaps → top hang flap folds inward (gets pasted below bottom hang) →
    //   bottom hang flap closes over it → tongue tucks into length side last.
    'CRASHLOCKBOTTOMTUCKENDFOLDINGCARTON': {
        seq: {
            'LENGTH':           1,
            'WIDTH':            1,
            'PASTING FLAP':     2,
            'DUST FLAP':        3,
            'OPEN FLAP':        4,
            'BOTTOM FLAP':      5,
            'TOP HANG FLAP':    6,
            'BOTTOM HANG FLAP': 7,
            'TONGUE':           8,
            'TOUNGE':           8, // DB typo alias
        },
        // In this box, depth-1 DUST FLAPs are the WIDTH body walls (mislabeled in DB).
        // They fold with the body at step 1, not step 3.
        bodyAtDepth1: ['DUST FLAP'],
        maxSeq: 8,
    },

    // EfluteBottomWithHandleBox — carry-handle gable box:
    //   Body walls stand up → bottom flaps + Bottom Hang close the base (90°) →
    //   Top Hang panels stay straight (they rise into the carry handle) →
    //   Dust Flaps close LAST and only half-fold (45°), exactly as in the sample.
    //
    //   NB: in this box the two 60×100 side walls are tagged "DUST FLAP" and one
    //   is at BFS depth 3, so bodyAtDepth1 can't catch them — bodyMinArea does,
    //   by treating any panel ≥ 5000 area as a body wall (walls are 6000–8000;
    //   the real dust flaps are only 305–503, and every closing flap ≤ 2629).
    'EFLUTEBOTTOMWITHHANDLEBOX': {
        seq: {
            'WIDTH':        1,
            'LENGTH':       1,
            'PASTING FLAP': 2,
            'BOTTOM FLAP':  3, // bottom closing panels
            'BOTTOM HANG':  4, // bottom hang band
            'TOP HANG':     5, // handle sides (stay straight)
            'DUST FLAP':    6, // real dust flaps close LAST
        },
        angleOverride: {
            'BOTTOM HANG': 90, // folds flat to close the bottom
            'TOP HANG':     0, // stays straight — forms the handle sides
            'DUST FLAP':   45, // half-fold, and closes last
        },
        bodyMinArea: 5000, // ≥5000 area ⇒ body wall (folds 90° at step 1), even if tagged "DUST FLAP"
        maxSeq: 6,
    },

    // GadgetBox — close order: Pasting Flap → Length → Width → Bottom Flap →
    // Open Flap. Every wall is tagged "HEIGHT" (no LENGTH/WIDTH type), so we split
    // by BFS depth: the big 60×100 walls are the "Length" (step 2) and the small
    // depth-1 HEIGHT panels the "Width" (step 3). "CREASE" panels are design-only
    // corner fold-lines: held at 0° they stay flush with their wall and just ride
    // along as it stands up (never fold on their own).
    //
    // NB: we keep the natural (largest wall) root. Rooting on a bottom flap made
    // that flap the fixed base, so it never closed and the box mis-formed. One
    // wall must stay flat as the reference, so the few creases on that base wall
    // stay flat — an accepted trade-off for the box closing correctly.
    'GADGETBOX': {
        seq: {
            'PASTING FLAP': 1,
            'HEIGHT':       2, // big body walls ("Length")
            'CREASE':       3, // fold at the SAME step as the Width walls they join (step 3)
            'BOTTOM FLAP':  4, // bottom closes
            'OPEN FLAP':    5,
        },
        depthSeq: {
            'HEIGHT': { 1: 3 }, // small depth-1 HEIGHT panels are the "Width" walls → step 3
        },
        // A crease divides a wall. To end up coplanar with that wall it must match
        // the wall's orientation:
        //   - depth-1 creases hang off the FLAT root, so they fold up 90° themselves
        //     to join the standing wall.
        //   - depth-2+ creases hang off a wall that has ALREADY folded, so they stay
        //     at 0° (flush) and simply ride along with it.
        depthAngles: {
            'CREASE':     { 1: 90 },
            // The depth-1 OPEN FLAP folds 90° to close the top; its depth-2 child
            // would fold another 90° (tucking all the way down). Hold that child at
            // 0° so the open flap stops flush at 90° instead of tucking under.
            'OPEN FLAP':  { 2: 0 },
        },
        angleOverride: {
            'CREASE': 0, // depth-2+ creases: flush with their already-folded wall
        },
        maxSeq: 5,
    },

    // StandardStraightTuckInHang — the standard fold order, with two special flaps:
    //   • FLAP ONE stays straight/vertical (0°) — it does NOT close, and
    //   • FLAP TWO (its child) turns right over 180° and pastes flat onto FLAP ONE.
    // The 70×100 WIDTH walls are tagged "DUST FLAP" (area 7000), so they'd fold at
    // the dust-flap step and tear the box. bodyMinArea 6500 treats them as body
    // walls (fold first, 90°) while leaving the OPEN FLAP closers (5600), the two
    // named flaps (4000) and the real dust flaps (~3000) on their normal steps.
    'STANDARDSTRAIGHTTUCKINHANG': {
        seq: {
            'LENGTH':       1,
            'WIDTH':        1,
            'PASTING FLAP': 2,
            'DUST FLAP':    3,
            'OPEN FLAP':    4,
            'FLAP ONE':     5,
            'FLAP TWO':     6, // pastes last, after Flap One is standing
            'BOTTOM FLAP':  5,
            'TUCKIN WIDTH': 6,
        },
        angleOverride: {
            'FLAP ONE': 0,   // straight vertical — does not close
            'FLAP TWO': 180, // turns right over and pastes flat onto Flap One
        },
        bodyMinArea: 6500,
        maxSeq: 6,
    },
}

/** The sequence table that applies to a given content name. */
export function foldSeqFor(contentType?: string) {
    const contentKey = (contentType ?? '').toUpperCase().trim()
    return CONTENT_FOLD_SEQ[contentKey] ?? { seq: SHAPE_FOLD_SEQ, maxSeq: DEFAULT_MAX_SEQ }
}

/**
 * Does this ShapeType map to a known fold step? Matching is "contains", so
 * "DUST FLAP LEFT" matches "DUST FLAP" - but "DUSTFLAP" (no space) does not.
 */
export function isRecognisedShapeType(shapeType: string | undefined, contentType?: string): boolean {
    const st = (shapeType ?? '').toUpperCase().trim()
    if (!st) return false
    const { seq } = foldSeqFor(contentType)
    return Object.keys(seq).some(key => st.includes(key))
}

/**
 * How much of this box has usable ShapeType data.
 *
 * Only foldable panels (depth > 0) count - the root panel never folds and is
 * not expected to carry a ShapeType. Returns 0..1.
 *
 * This exists because ShapeType is being filled in gradually. A box with one
 * stray value ("ANKIT", "CROOKED LINE", "3") must not be treated as fully
 * tagged, or every other panel silently falls back to depth ordering and the
 * animation looks wrong. See pickFoldSchedule below.
 */
export function shapeTypeCoverage(tree: HingedPanel[], contentType?: string): number {
    const foldable = tree.filter(p => p.depth > 0)
    if (foldable.length === 0) return 0
    const tagged = foldable.filter(p => isRecognisedShapeType(p.shapeType, contentType)).length
    return tagged / foldable.length
}

/**
 * Build the fold order from each panel's ShapeType.
 * Panels whose ShapeType is missing or unrecognised fall back to their depth.
 */
export function buildShapeTypeFoldSchedule(
    tree: HingedPanel[],
    contentType?: string,
): FoldStage[] {
    const contentKey = (contentType ?? '').toUpperCase().trim()
    const contentConfig = CONTENT_FOLD_SEQ[contentKey]
    const { seq: foldSeq, maxSeq } = foldSeqFor(contentType)

    return tree
        .filter(p => p.depth > 0)
        .map(p => {
            const st = (p.shapeType ?? '').toUpperCase().trim()

            // Large panels are the structural body walls even when the DB tags them
            // as a flap type — they must stand up first (seq 1) at 90°, or the box
            // tears apart. This overrides every ShapeType-based rule below.
            const isBodyWall =
                contentConfig?.bodyMinArea != null &&
                p.rect.w * p.rect.h >= contentConfig.bodyMinArea

            // --- Determine fold step ---
            let seq = 0

            // depthSeq takes priority: per-ShapeType per-depth override
            if (contentConfig?.depthSeq) {
                for (const [key, depthMap] of Object.entries(contentConfig.depthSeq)) {
                    if (st.includes(key) && p.depth in depthMap) {
                        seq = depthMap[p.depth]
                        break
                    }
                }
            }

            // Main seq table (substring match, first hit wins)
            if (seq === 0) {
                for (const [key, val] of Object.entries(foldSeq)) {
                    if (st.includes(key)) { seq = val; break }
                }
            }

            // Fallback: use BFS depth
            if (seq === 0) seq = Math.min(p.depth, maxSeq)

            // bodyAtDepth1: depth-1 panels mislabeled as a flap type in the DB
            if (p.depth === 1 && contentConfig?.bodyAtDepth1?.some(key => st.includes(key))) {
                seq = 1
            }

            // bodyMinArea: large mislabeled walls fold with the body (highest priority)
            if (isBodyWall) seq = 1

            // --- Determine fold angle ---
            let closedAngleDeg = 90
            let angleFound = false

            // depthAngles takes priority: per-ShapeType per-depth angle
            if (contentConfig?.depthAngles) {
                for (const [key, depthMap] of Object.entries(contentConfig.depthAngles)) {
                    if (st.includes(key) && p.depth in depthMap) {
                        closedAngleDeg = depthMap[p.depth]
                        angleFound = true
                        break
                    }
                }
            }

            // angleOverride fallback
            if (!angleFound && contentConfig?.angleOverride) {
                for (const [key, angle] of Object.entries(contentConfig.angleOverride)) {
                    if (st.includes(key)) { closedAngleDeg = angle; break }
                }
            }

            // bodyMinArea walls always stand straight up at 90° (highest priority)
            if (isBodyWall) closedAngleDeg = 90

            return {
                panelId: p.id,
                startProgress: (seq - 1) / maxSeq,
                endProgress:   seq / maxSeq,
                closedAngleDeg,
            }
        })
}

/**
 * Reorders panels so the content-specific root panel is first (index 0).
 * buildHingeTree always treats panels[0] as the BFS root (flat base).
 * If no rootShapeType is configured, or the ShapeType is not found,
 * the original array (largest-area-first) is returned unchanged.
 */
export function rootFirst(panels: Panel[], contentType?: string): Panel[] {
    const contentKey = (contentType ?? '').toUpperCase().trim()
    const rs = CONTENT_FOLD_SEQ[contentKey]?.rootShapeType?.toUpperCase()
    if (!rs) return panels
    const idx = panels.findIndex(p => (p.shapeType ?? '').toUpperCase().includes(rs))
    if (idx <= 0) return panels // already first, or not found
    const reordered = [...panels]
    ;[reordered[0], reordered[idx]] = [reordered[idx], reordered[0]]
    return reordered
}
