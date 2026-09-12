"use client";
/**
 * Box3DViewer — generic Three.js viewer for hinged-panel folding.
 *
 * Knows nothing about Reverse Tuck-In specifically. Takes a HingedPanel
 * tree + FoldStage schedule + a 0..1 progress value and renders.
 *
 * Each panel is a thin extruded box parented to its hinge group; the hinge
 * group sits on the parent panel's hinge edge and rotates around the local
 * hinge axis. This is how real cardboard folds.
 */

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

// @ts-ignore
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

// @ts-ignore
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer'

import { setCameraPreset, clearSceneKeeping, createDimensionAnnotations, type CameraPreset } from '../lib/three-helpers'
import type { HingedPanel, FoldStage, Dims } from '../lib/keyline3D'
import { angleAt } from '../lib/keyline3D'

interface Box3DViewerProps {
  tree: HingedPanel[]
  schedule: FoldStage[]
  dims: Dims
  /** 0 = flat, 1 = closed */
  progress: number
  /** Material thickness in mm (visual only) */
  thickness?: number
  /** Show L/W/H dimension labels. Default true. */
  showDims?: boolean
  className?: string
  onPresetReady?: (handler: (preset: CameraPreset) => void) => void
}

// Cardboard-like palette
const PANEL_COLOR = 0xC5A682
const PANEL_EDGE = 0x4A3520

// ── Inner-liner occlusion ───────────────────────────────────────────────────
//
// In a shut carton the body walls and lids form the OUTER shell; dust flaps,
// pasting/glue flaps and tuck flaps fold flat against the inside of those walls.
// Because our fold model is zero-thickness, an inner flap ends up in the exact
// same plane as the wall it lies against, so the two opaque faces z-fight and
// the inner flap (and its dark edge lines) bleeds through the closed box.
//
// We can't trust ShapeType names to tell shell from liner (many boxes are only
// half-tagged), and fold order lies (walls fold first yet are outermost, tuck
// flaps fold last yet are innermost). Geometry is reliable: in the CLOSED box a
// wall and everything folded against it share one plane, and the wall is always
// the LARGEST panel in that plane while the flaps tucked against it are smaller.
// So within each shared plane we keep the biggest panel at the front and push
// the smaller ones back in the depth buffer (faces AND edges). See
// computeOcclusionOffsets — this needs no ShapeType data at all.
const OCCLUSION_OFFSET_STEP = 4
// How far (mm) each inner-liner rank is physically pushed into the box interior.
// Must exceed the panel thickness so an inner flap sits clearly behind the outer
// wall and real depth testing hides its faces AND its crease lines.
const INNER_INSET_MM = 1.5

/** Push a panel mesh (its face material and its edge-line material) back in the
 *  depth buffer by `off` polygon-offset units, so shallower panels occlude it. */
function setMeshDepthOffset(mesh: THREE.Mesh, off: number): void {
  const apply = (m: any) => {
    if (!m) return
    m.polygonOffset = true
    m.polygonOffsetFactor = off
    m.polygonOffsetUnits = off
  }
  const mm = mesh.material as THREE.Material | THREE.Material[]
  if (Array.isArray(mm)) mm.forEach(apply)
  else apply(mm)
  mesh.children.forEach((c: any) => apply(c.material))
}

export function Box3DViewer({
  tree,
  schedule,
  dims,
  progress,
  thickness = 0.6,
  showDims = true,
  className = '',
  onPresetReady,
}: Box3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const labelRendererRef = useRef<CSS2DRenderer | null>(null)
  const controlsRef = useRef<any>(null)
  const sceneCenterRef = useRef<THREE.Vector3>(new THREE.Vector3())
  const fitDimRef = useRef<number>(100)
  const floorGroupRef = useRef<THREE.Group | null>(null)
  const dimGroupRef = useRef<THREE.Group | null>(null)

  const panelGroupsRef = useRef<Map<string, { hingeGroup: THREE.Group; panelMesh: THREE.Mesh }>>(new Map())
  const scheduleRef = useRef<FoldStage[]>(schedule)
  scheduleRef.current = schedule
  // Current fold progress, readable inside the build effect without making it a
  // dependency (which would rebuild the whole scene on every animation frame).
  const progressRef = useRef(progress)
  progressRef.current = progress
  // Per-panel occlusion rank within its closed-state plane (0 = outer shell,
  // >0 = inner liner). Populated by the build effect, read by the fold effect to
  // fade inner-flap outlines as the box shuts. WebGL polygonOffset can't push
  // LINES back (it only offsets filled triangles), so an inner flap's dark edge
  // lines would still bleed through the outer wall — fading them is the fix.
  const occlusionRankRef = useRef<Map<string, number>>(new Map())
  // Per-panel inner-flap inset (signed mm along the panel's own normal), computed
  // once from the closed pose. Applied by the fold effect scaled by progress, so
  // panels are flush at flat/open (no gaps at fold lines) and only recede as the
  // box actually shuts and the inner flaps need hiding.
  const insetRef = useRef<Map<string, number>>(new Map())

  // ── Scene init (once) ─────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf5f5f5)
    sceneRef.current = scene

    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 20000)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setSize(w, h)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(w, h)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.left = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(labelRenderer.domElement)
    labelRendererRef.current = labelRenderer

    // Bright ambient so every face stays cardboard-colored regardless of view angle
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    scene.add(new THREE.HemisphereLight(0xffffff, 0xddccbb, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 0.55)
    key.position.set(-200, 400, 250)
    key.castShadow = true
    key.shadow.camera.top = 500
    key.shadow.camera.bottom = -500
    key.shadow.camera.left = -500
    key.shadow.camera.right = 500
    key.shadow.camera.near = 1
    key.shadow.camera.far = 2000
    key.shadow.mapSize.width = 2048
    key.shadow.mapSize.height = 2048
    key.shadow.bias = -0.0005
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.3)
    fill.position.set(200, 200, -200)
    scene.add(fill)
    // Bottom fill — prevents black underside when viewed from below
    const bottom = new THREE.DirectionalLight(0xffffff, 0.25)
    bottom.position.set(0, -300, 0)
    scene.add(bottom)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.8
    controlsRef.current = controls
    controls.addEventListener('start', () => { controls.autoRotate = false })

    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const cw = container.clientWidth || 1
      const ch = container.clientHeight || 1
      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
      renderer.setSize(cw, ch)
      labelRenderer.setSize(cw, ch)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      if (labelRenderer.domElement.parentNode) {
        labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement)
      }
    }
  }, [])

  // ── Build panel hierarchy whenever tree or dims change ────
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!scene || !camera || !controls) return

    clearSceneKeeping(scene, 5, labelRendererRef.current?.domElement)
    panelGroupsRef.current.clear()
    floorGroupRef.current = null
    dimGroupRef.current = null

    if (tree.length === 0) return

    const minX = Math.min(...tree.map(p => p.rect.x))
    const minY = Math.min(...tree.map(p => p.rect.y))
    const maxX = Math.max(...tree.map(p => p.rect.x + p.rect.w))
    const maxY = Math.max(...tree.map(p => p.rect.y + p.rect.h))
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    const rootGroup = new THREE.Group()
    rootGroup.name = 'box-root'
    scene.add(rootGroup)

    const groupsById = new Map<string, THREE.Group>()
    groupsById.set('__root__', rootGroup)

    const sorted = [...tree].sort((a, b) => a.depth - b.depth)

    console.log('[Box3D] building panels:', sorted.map(p =>
      `${p.id}(st=${p.shapeType ?? '?'} depth=${p.depth} parent=${p.parentId ?? 'ROOT'} hinge=${p.hinge ? p.hinge.edge : 'NULL'})`
    ))
    for (const p of sorted) {
      const hingeGroup = new THREE.Group()
      hingeGroup.name = `hinge_${p.id}`
      ;(hingeGroup as any).userData.shapeType = p.shapeType

      const parentGroup = p.parentId ? groupsById.get(p.parentId)! : rootGroup

      if (p.parentId === null || !p.hinge) {
        // ── Orphan-rescued panel: has a parent but hinge wasn't detected ──────
        // Falling through to the root path would corrupt rootFlatX/Z and freeze
        // the panel at (0,0,0) with no hingeAxis. Derive a synthetic hinge from
        // geometry so the panel moves with its parent and can still fold.
        if (p.parentId !== null) {
          const rootFlatX = (rootGroup as any).userData.rootFlatX ?? cx
          const rootFlatZ = (rootGroup as any).userData.rootFlatZ ?? cy
          const parentPanel = sorted.find(pp => pp.id === p.parentId)
          const pCX = p.rect.x + p.rect.w / 2
          const pCZ = p.rect.y + p.rect.h / 2
          const parCX = parentPanel ? parentPanel.rect.x + parentPanel.rect.w / 2 : cx
          const parCZ = parentPanel ? parentPanel.rect.y + parentPanel.rect.h / 2 : cy
          const dxP = parCX - pCX
          const dzP = parCZ - pCZ
          // Decide hinge side: side-by-side → vertical hinge; stacked → horizontal hinge
          let hx: number, hz: number, hingeIsV: boolean
          if (Math.abs(dxP) >= Math.abs(dzP)) {
            // Vertical hinge (left or right edge of this panel)
            hx = (dxP > 0 ? p.rect.x + p.rect.w : p.rect.x) - rootFlatX
            hz = pCZ - rootFlatZ
            hingeIsV = true
          } else {
            // Horizontal hinge (top or bottom edge of this panel)
            hx = pCX - rootFlatX
            hz = (dzP > 0 ? p.rect.y + p.rect.h : p.rect.y) - rootFlatZ
            hingeIsV = false
          }
          hingeGroup.position.set(hx, 0, hz)
          scene.add(hingeGroup)
          ;(groupsById.get(p.parentId) ?? rootGroup).attach(hingeGroup)
          const meshCX = pCX - rootFlatX
          const meshCZ = pCZ - rootFlatZ
          const mesh = makePanelMesh(p, thickness)
          mesh.position.set(meshCX, 0, meshCZ)
          scene.add(mesh)
          hingeGroup.attach(mesh)
          panelGroupsRef.current.set(p.id, { hingeGroup, panelMesh: mesh })
          groupsById.set(p.id, hingeGroup)
          ;(hingeGroup as any).userData.hingeAxis = hingeIsV ? 'z' : 'x'
          ;(hingeGroup as any).userData.offsetX = meshCX - hx
          ;(hingeGroup as any).userData.offsetZ = meshCZ - hz
          continue
        }

        // ── True root panel (parentId === null) ───────────────────────────────
        const rootFlatX = p.rect.x + p.rect.w / 2
        const rootFlatZ = p.rect.y + p.rect.h / 2
        ;(rootGroup as any).userData.rootFlatX = rootFlatX
        ;(rootGroup as any).userData.rootFlatZ = rootFlatZ

        hingeGroup.position.set(0, 0, 0)
        rootGroup.add(hingeGroup)

        const mesh = makePanelMesh(p, thickness)
        hingeGroup.add(mesh)
        panelGroupsRef.current.set(p.id, { hingeGroup, panelMesh: mesh })
        groupsById.set(p.id, hingeGroup)
        continue
      }

      const h = p.hinge!
      const hx = (h.line.x1 + h.line.x2) / 2 - ((rootGroup as any).userData.rootFlatX ?? cx)
      const hz = (h.line.y1 + h.line.y2) / 2 - ((rootGroup as any).userData.rootFlatZ ?? cy)
      const hingeIsVertical = Math.abs(h.line.x1 - h.line.x2) < 0.5
      hingeGroup.position.set(hx, 0, hz)
      scene.add(hingeGroup)
      parentGroup.attach(hingeGroup)

      const meshCenterX = p.rect.x + p.rect.w / 2 - ((rootGroup as any).userData.rootFlatX ?? cx)
      const meshCenterZ = p.rect.y + p.rect.h / 2 - ((rootGroup as any).userData.rootFlatZ ?? cy)
      const offsetX = meshCenterX - hx
      const offsetZ = meshCenterZ - hz

      const mesh = makePanelMesh(p, thickness)
      mesh.position.set(meshCenterX, 0, meshCenterZ)
      scene.add(mesh)
      hingeGroup.attach(mesh)

      panelGroupsRef.current.set(p.id, { hingeGroup, panelMesh: mesh })
      groupsById.set(p.id, hingeGroup)

      ;(hingeGroup as any).userData.hingeAxis = hingeIsVertical ? 'z' : 'x'
      ;(hingeGroup as any).userData.offsetX = offsetX
      ;(hingeGroup as any).userData.offsetZ = offsetZ
    }

    // ── Occlusion: hide inner flaps behind the outer shell in the closed box ────
    //
    // Fold every panel to its fully-closed pose and read the world plane each one
    // lands in. Within every shared plane the LARGEST panel is the outer wall/lid;
    // the dust/pasting/tuck flaps tucked against it are smaller. Each smaller flap
    // is then physically pushed INTO the box along its inward normal (plus a depth
    // bias and an outline fade as backup), so the opaque wall genuinely occludes
    // its faces AND crease lines — exactly like real board, where a packed box
    // shows nothing of the flaps folded inside it. Purely geometric: needs no
    // ShapeType tagging, and the console 'occlusion' log shows the classification.
    const setClosedPose = () => {
      for (const stage of scheduleRef.current) {
        const entry = panelGroupsRef.current.get(stage.panelId)
        if (!entry) continue
        const ud = (entry.hingeGroup as any).userData
        const angleRad = (stage.closedAngleDeg * Math.PI) / 180
        const offX = (ud.offsetX as number) || 0
        const offZ = (ud.offsetZ as number) || 0
        if (ud.hingeAxis === 'z') {
          entry.hingeGroup.rotation.set(0, 0, (offX >= 0 ? 1 : -1) * angleRad)
        } else if (ud.hingeAxis === 'x') {
          entry.hingeGroup.rotation.set((offZ >= 0 ? -1 : 1) * angleRad, 0, 0)
        }
      }
    }

    setClosedPose()
    rootGroup.updateWorldMatrix(false, true)

    const _n = new THREE.Vector3()
    const _pos = new THREE.Vector3()
    const _q = new THREE.Quaternion()
    const _tmp = new THREE.Vector3()

    type PanelPlane = { id: string; area: number; key: string; rawNormal: THREE.Vector3; pos: THREE.Vector3; shapeType?: string }
    const panelPlanes: PanelPlane[] = []
    const interiorCenter = new THREE.Vector3()
    for (const p of sorted) {
      const entry = panelGroupsRef.current.get(p.id)
      if (!entry) continue
      entry.panelMesh.getWorldQuaternion(_q)
      entry.panelMesh.getWorldPosition(_pos)
      // World direction of the panel's face (local +Y after the extrude rotate).
      const rawNormal = _n.set(0, 1, 0).applyQuaternion(_q).normalize().clone()
      // Group by which of the 6 box faces this panel lands on: snap the normal to
      // its dominant axis and bucket the position along that axis. This tolerates
      // imperfect (non-90°) folds far better than comparing exact normals — a flap
      // folded a few degrees off still lands in its wall's group instead of a
      // singleton group that would (wrongly) rank 0 and never recede.
      const ax = Math.abs(rawNormal.x), ay = Math.abs(rawNormal.y), az = Math.abs(rawNormal.z)
      const axis = ax >= ay && ax >= az ? 'x' : ay >= az ? 'y' : 'z'
      const along = axis === 'x' ? _pos.x : axis === 'y' ? _pos.y : _pos.z
      const key = `${axis}|${Math.round(along / 8) * 8}`
      const pos = _pos.clone()
      panelPlanes.push({ id: p.id, area: p.rect.w * p.rect.h, key, rawNormal, pos, shapeType: p.shapeType })
      interiorCenter.add(pos)
    }
    if (panelPlanes.length) interiorCenter.multiplyScalar(1 / panelPlanes.length)

    const planeGroups = new Map<string, PanelPlane[]>()
    for (const pp of panelPlanes) {
      const list = planeGroups.get(pp.key) ?? []
      list.push(pp)
      planeGroups.set(pp.key, list)
    }

    occlusionRankRef.current.clear()
    insetRef.current.clear()
    for (const list of planeGroups.values()) {
      // Largest panel in a shared plane = outer shell (rank 0, stays put); the
      // smaller flaps tucked against it = inner liners (rank > 0) that recede.
      list.sort((a, b) => b.area - a.area)
      list.forEach((pp, rank) => {
        // Flush surface elements are NOT inner flaps and must never be inset,
        // depth-biased or faded — otherwise they sink 1.5mm behind their wall and
        // read as a cut/gap instead of a crease line. Two kinds qualify:
        //   • panels that never fold (closed angle ≈ 0), and
        //   • CREASE panels (design fold-lines) at any angle — a folding crease is
        //     still a division of the wall's OUTER surface, coplanar with it.
        const stage = scheduleRef.current.find(s => s.panelId === pp.id)
        const neverFolds = stage != null && Math.abs(stage.closedAngleDeg) < 0.5
        const isCrease = (pp.shapeType ?? '').toUpperCase().includes('CREASE')
        const rankEff = (neverFolds || isCrease) ? 0 : rank
        occlusionRankRef.current.set(pp.id, rankEff)
        const entry = panelGroupsRef.current.get(pp.id)
        if (!entry) return
        setMeshDepthOffset(entry.panelMesh, rankEff * OCCLUSION_OFFSET_STEP)
        if (rankEff > 0) {
          // Record how far to push this inner flap INTO the box, along its inward
          // normal, so the opaque outer wall occludes its faces AND crease lines
          // (coplanar panels share exact depth; no depth-bias can order them). The
          // fold effect applies this scaled by progress — 0 at flat so fold lines
          // stay seamless, ramping to full only as the box shuts.
          const outwardness = pp.rawNormal.dot(_tmp.copy(pp.pos).sub(interiorCenter))
          const inwardSign = outwardness > 0 ? -1 : 1
          insetRef.current.set(pp.id, inwardSign * rankEff * INNER_INSET_MM)
        }
      })
    }
    // Readable, fully-expanded classification (one line per box face) so the fix
    // can be verified from the console without drilling into collapsed objects.
    console.log('[Box3D] occlusion by face:\n' + [...planeGroups.values()]
      .map(list => '  ' + list.map((pp, r) => `${pp.id}[a${Math.round(pp.area)} r${r}]`).join('  +  '))
      .join('\n'))

    // Restore the panels to the current fold progress — setClosedPose above left
    // them shut only so the closed-state planes could be measured. The progress
    // effect also re-applies this, but doing it here avoids a one-frame flash.
    for (const stage of scheduleRef.current) {
      const entry = panelGroupsRef.current.get(stage.panelId)
      if (!entry) continue
      const ud = (entry.hingeGroup as any).userData
      const angleRad = (angleAt(stage, progressRef.current) * Math.PI) / 180
      const offX = (ud.offsetX as number) || 0
      const offZ = (ud.offsetZ as number) || 0
      if (ud.hingeAxis === 'z') {
        entry.hingeGroup.rotation.set(0, 0, (offX >= 0 ? 1 : -1) * angleRad)
      } else if (ud.hingeAxis === 'x') {
        entry.hingeGroup.rotation.set((offZ >= 0 ? -1 : 1) * angleRad, 0, 0)
      }
    }

    const boxL = dims.L
    const boxW = dims.W
    const boxH = dims.H
    const boxMaxDim = Math.max(boxL, boxW, boxH)
    const boxCenter = new THREE.Vector3(0, boxH / 2, 0)

    const closedBbox = new THREE.Box3(
      new THREE.Vector3(-boxL / 2, 0,    -boxW / 2),
      new THREE.Vector3( boxL / 2, boxH,  boxW / 2),
    )
    const dimGroup = createDimensionAnnotations({
      bbox: closedBbox,
      dimensions: { L: boxL, W: boxW, H: boxH },
      offsetFactor: 0.12,
    })
    scene.add(dimGroup)
    dimGroupRef.current = dimGroup

    const flatSheetSpan = Math.max(maxX - minX, maxY - minY)
    // No floor plane or grid — white scene.background is static and doesn't
    // appear to rotate when the camera orbits past horizontal.
    floorGroupRef.current = null

    controls.minPolarAngle = 0
    controls.maxPolarAngle = Math.PI

    const rootFx = (rootGroup as any).userData.rootFlatX ?? cx
    const rootFz = (rootGroup as any).userData.rootFlatZ ?? cy
    const flatCenterX = cx - rootFx
    const flatCenterZ = cy - rootFz
    const orbitCenter = new THREE.Vector3(
      (boxCenter.x + flatCenterX) / 2,
      boxCenter.y / 2,
      (boxCenter.z + flatCenterZ) / 2,
    )
    const framingDim = Math.max(boxMaxDim, flatSheetSpan * 0.7)
    fitDimRef.current = framingDim
    sceneCenterRef.current.copy(orbitCenter)

    camera.position.set(
      orbitCenter.x + framingDim * 1.2,
      orbitCenter.y + framingDim * 0.9,
      orbitCenter.z + framingDim * 1.2,
    )
    controls.target.copy(orbitCenter)
    controls.update()
  }, [tree, dims, thickness])

  // ── Apply rotations whenever progress changes ──────────────
  useEffect(() => {
    for (const stage of scheduleRef.current) {
      const entry = panelGroupsRef.current.get(stage.panelId)
      if (!entry) {
        console.warn('[Box3D] schedule has panelId not in panelGroupsRef:', stage.panelId)
        continue
      }
      const angleDeg = angleAt(stage, progress)
      const angleRad = (angleDeg * Math.PI) / 180
      const ud = (entry.hingeGroup as any).userData
      const axis = ud.hingeAxis as 'x' | 'z' | undefined
      const offsetX = (ud.offsetX as number) || 0
      const offsetZ = (ud.offsetZ as number) || 0
      if (!axis) {
        console.warn('[Box3D] panelId has no hingeAxis (will not rotate):', stage.panelId, 'shapeType:', ud.shapeType)
      }
      if (axis === 'z') {
        const sign = offsetX >= 0 ? 1 : -1
        entry.hingeGroup.rotation.set(0, 0, sign * angleRad)
      } else if (axis === 'x') {
        const sign = offsetZ >= 0 ? -1 : 1
        entry.hingeGroup.rotation.set(sign * angleRad, 0, 0)
      }
    }

    const smooth = (t: number) => t * t * (3 - 2 * t)

    // Fade out inner-liner flap outlines as the box shuts. Their dark edge lines
    // sit in the same plane as the outer wall/lid and would otherwise bleed
    // through the closed box (polygonOffset can't push lines back). Outer-shell
    // panels (rank 0) keep full outlines; inner liners (rank > 0) fade to nothing
    // over the last stretch of the close, so a packed box looks solid from
    // outside — just like real board where the tucked flaps are hidden inside.
    const linerFade = smooth(Math.max(0, Math.min(1, (progress - 0.7) / 0.3)))
    for (const [panelId, rank] of occlusionRankRef.current) {
      if (rank <= 0) continue
      const entry = panelGroupsRef.current.get(panelId)
      if (!entry) continue
      const line = entry.panelMesh.children.find((c: any) => c.isLineSegments) as any
      if (!line?.material) continue
      line.material.transparent = true
      line.material.opacity = 0.85 * (1 - linerFade)
      line.material.visible = line.material.opacity > 0.02
    }

    // Push inner flaps into the box on the SAME close ramp, so every panel is
    // flush at flat/open (fold lines stay seamless — no cut/gap) and the inset
    // only grows as the box actually shuts and those flaps need hiding.
    for (const [panelId, insetY] of insetRef.current) {
      const entry = panelGroupsRef.current.get(panelId)
      if (entry) entry.panelMesh.position.y = insetY * linerFade
    }

    const dimGroup = dimGroupRef.current
    if (dimGroup) {
      const op = showDims ? smooth(Math.max(0, Math.min(1, (progress - 0.5) / 0.4))) : 0
      dimGroup.traverse((node: any) => {
        if (node.isLine && node.material) {
          node.material.transparent = true
          node.material.opacity = op
        }
        if (node.isCSS2DObject && node.element) {
          node.element.style.opacity = String(op)
        }
      })
    }
  }, [progress, showDims, tree, dims])

  // ── Camera preset handler exposed to parent ────────────────
  const handlePreset = useCallback((preset: CameraPreset) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    controls.autoRotate = false
    setCameraPreset({
      camera,
      controls,
      center: sceneCenterRef.current,
      fitDim: fitDimRef.current,
      preset,
      defaultMultipliers: [1.0, 0.75, 1.0],
    })
  }, [])
  useEffect(() => { onPresetReady?.(handlePreset) }, [handlePreset, onPresetReady])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', position: 'relative' }} />
}

// ─── Mesh factory ──────────────────────────────────────────
function makePanelMesh(panel: HingedPanel, thickness: number): THREE.Mesh {
  const cx = panel.rect.x + panel.rect.w / 2
  const cy = panel.rect.y + panel.rect.h / 2
  const localPts = panel.outline
    .map(p => new THREE.Vector2(p.x - cx, -(p.y - cy)))
    .reverse()
  const shape = new THREE.Shape(localPts)
  const geom = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geom.rotateX(-Math.PI / 2)
  geom.translate(0, thickness / 2, 0)

  // polygonOffset is enabled here but left at 0; computeOcclusionOffsets sets the
  // real per-panel value once the closed-state geometry is known, so inner-liner
  // flaps get pushed behind the outer wall/lid they lie against (faces AND edges).
  const mat = new THREE.MeshStandardMaterial({
    color: PANEL_COLOR,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 0,
    polygonOffsetUnits: 0,
  })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  const edges = new THREE.EdgesGeometry(geom)
  // Inner-liner outlines can't be hidden with polygonOffset (WebGL only offsets
  // filled triangles, not lines), so the fold effect fades this material's
  // opacity to 0 for inner flaps as the box shuts. See occlusionRankRef.
  const lineMat = new THREE.LineBasicMaterial({
    color: PANEL_EDGE,
    transparent: true,
    opacity: 0.85,
  })
  mesh.add(new THREE.LineSegments(edges, lineMat))
  return mesh
}
