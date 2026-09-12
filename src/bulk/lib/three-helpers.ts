/**
 * Shared Three.js helpers for 3D visualization components
 * - Dimension annotations (L/W/H labels with lines + tick marks)
 * - Camera preset views (Top, Front, Side, Default)
 */

import * as THREE from 'three'

// @ts-ignore
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer'

// ─── Types ───────────────────────────────────────────────────

export type CameraPreset = 'top' | 'front' | 'side' | 'default'

interface DimensionAnnotationOptions {
  /** Bounding box of the object to annotate */
  bbox: THREE.Box3
  /** Dimensions to display as labels (in mm) */
  dimensions: {
    L: number // Length (X-axis)
    W: number // Width (Z-axis)
    H: number // Height (Y-axis)
  }
  /** Optional offset multiplier for label distance from the object (default 0.12) */
  offsetFactor?: number
}

interface CameraPresetOptions {
  camera: THREE.PerspectiveCamera
  controls: any // OrbitControls
  center: THREE.Vector3
  fitDim: number
  preset: CameraPreset
  /** Multipliers for the default isometric view [x, y, z] */
  defaultMultipliers?: [number, number, number]
}

// ─── Scene Cleanup ──────────────────────────────────────────

/**
 * Properly clears scene children (keeping `keepCount` first items, e.g. lights),
 * disposing CSS2DObject DOM elements that the CSS2DRenderer leaves behind.
 *
 * @param labelRendererDom — pass `labelRenderer.domElement` so we can nuke
 *   any orphaned label divs the CSS2DRenderer appended but failed to clean up.
 */
export function clearSceneKeeping(
  scene: THREE.Scene,
  keepCount: number,
  labelRendererDom?: HTMLElement | null,
): void {
  while (scene.children.length > keepCount) {
    const child = scene.children[keepCount]
    // Detach CSS2DObject DOM elements before removing from scene
    child.traverse((node: any) => {
      if (node.isCSS2DObject && node.element?.parentNode) {
        node.element.parentNode.removeChild(node.element)
      }
    })
    scene.remove(child)
  }

  // Belt-and-suspenders: wipe any orphan divs left in the label renderer overlay
  if (labelRendererDom) {
    while (labelRendererDom.firstChild) {
      labelRendererDom.removeChild(labelRendererDom.firstChild)
    }
  }
}

// ─── Dimension Annotations ───────────────────────────────────

/**
 * Creates dimension annotation lines + labels using CSS2DRenderer.
 * Returns a THREE.Group that should be added to the scene.
 *
 * Layout:
 * - Length (L) label: along X-axis, below and in front of the object
 * - Width (W) label: along Z-axis, below and to the right of the object
 * - Height (H) label: along Y-axis, to the right and in front of the object
 */
export function createDimensionAnnotations(options: DimensionAnnotationOptions): THREE.Group {
  const { bbox, dimensions, offsetFactor = 0.12 } = options
  const group = new THREE.Group()
  group.name = 'dimension-annotations'

  const size = bbox.getSize(new THREE.Vector3())
  const min = bbox.min.clone()
  const max = bbox.max.clone()

  // Offset distance from the object edges
  const offset = Math.max(size.x, size.y, size.z) * offsetFactor
  const tickLen = offset * 0.3

  const lineMat = new THREE.LineBasicMaterial({ color: 0x555555 })

  // ── Helper: create a dimension line with tick marks and a label ──
  // Each created node is tagged `userData.dimAxis = 'L' | 'W' | 'H'` so a
  // consumer (e.g. an animating folding viewer) can fade specific axes
  // independently — useful for hiding H while the box is still flat.
  const addDimension = (
    axis: 'L' | 'W' | 'H',
    start: THREE.Vector3,
    end: THREE.Vector3,
    label: string,
    tickDir: THREE.Vector3 // direction perpendicular to the line for tick marks
  ) => {
    const tag = (obj: any) => { obj.userData.dimAxis = axis; return obj }

    // Main line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end])
    group.add(tag(new THREE.Line(lineGeo, lineMat)))

    // Tick marks at start and end
    const tickHalf = tickDir.clone().multiplyScalar(tickLen / 2)
    const tick1Geo = new THREE.BufferGeometry().setFromPoints([
      start.clone().add(tickHalf),
      start.clone().sub(tickHalf),
    ])
    group.add(tag(new THREE.Line(tick1Geo, lineMat)))

    const tick2Geo = new THREE.BufferGeometry().setFromPoints([
      end.clone().add(tickHalf),
      end.clone().sub(tickHalf),
    ])
    group.add(tag(new THREE.Line(tick2Geo, lineMat)))

    // CSS2D label at midpoint
    const mid = start.clone().add(end).multiplyScalar(0.5)
    const labelDiv = document.createElement('div')
    labelDiv.textContent = label
    labelDiv.style.cssText =
      'font-size:11px;font-weight:600;color:#333;background:rgba(255,255,255,0.85);' +
      'padding:1px 4px;border-radius:3px;pointer-events:none;white-space:nowrap;' +
      'border:1px solid rgba(0,0,0,0.12);'
    const css2dLabel = new CSS2DObject(labelDiv)
    css2dLabel.position.copy(mid)
    group.add(tag(css2dLabel))
  }

  // ── Length (X-axis) — runs along bottom-front edge ──
  const lY = min.y - offset
  const lZ = max.z + offset * 0.4
  addDimension(
    'L',
    new THREE.Vector3(min.x, lY, lZ),
    new THREE.Vector3(max.x, lY, lZ),
    `L: ${Math.round(dimensions.L)} mm`,
    new THREE.Vector3(0, 1, 0)
  )

  // ── Width (Z-axis) — runs along bottom-right edge ──
  const wX = max.x + offset
  const wY = min.y - offset
  addDimension(
    'W',
    new THREE.Vector3(wX, wY, min.z),
    new THREE.Vector3(wX, wY, max.z),
    `W: ${Math.round(dimensions.W)} mm`,
    new THREE.Vector3(0, 1, 0)
  )

  // ── Height (Y-axis) — runs along right-front vertical edge ──
  const hX = max.x + offset
  const hZ = max.z + offset * 0.4
  addDimension(
    'H',
    new THREE.Vector3(hX, min.y, hZ),
    new THREE.Vector3(hX, max.y, hZ),
    `H: ${Math.round(dimensions.H)} mm`,
    new THREE.Vector3(0, 0, 1)
  )

  return group
}

// ─── Camera Presets ──────────────────────────────────────────

/**
 * Sets camera to a preset view position and updates OrbitControls target.
 * After calling, the controls and camera are updated — caller should trigger a render.
 */
export function setCameraPreset(options: CameraPresetOptions): void {
  const { camera, controls, center, fitDim, preset, defaultMultipliers = [1.0, 0.75, 1.0] } = options

  const d = fitDim * 1.6 // Distance factor for good framing

  switch (preset) {
    case 'top':
      // Looking down from above (L x W face)
      camera.position.set(center.x, center.y + d, center.z)
      break
    case 'front':
      // Looking at front face (L x H face)
      camera.position.set(center.x, center.y, center.z + d)
      break
    case 'side':
      // Looking at side face (W x H face)
      camera.position.set(center.x + d, center.y, center.z)
      break
    case 'default':
      // Isometric-like view using component-specific multipliers
      camera.position.set(
        center.x + fitDim * defaultMultipliers[0],
        center.y + fitDim * defaultMultipliers[1],
        center.z + fitDim * defaultMultipliers[2]
      )
      break
  }

  camera.up.set(0, 1, 0)
  controls.target.copy(center)
  controls.update()
  camera.lookAt(center)
}
