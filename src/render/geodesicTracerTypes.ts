import type { Mesh, MeshBasicNodeMaterial } from 'three/webgpu'
import type { SkyState } from '../state/sky'

/** GPU no-hair + disk snapshot (not full SpacetimeUniforms / derived). */
export type SpacetimeTraceParams = {
  mass: number
  spinStar: number
  charge: number
  mdot: number
  /** r_ISCO / M from CPU diskIsco (matches orbital sense) */
  rIscoOverM: number
  /** Disk outer radius in units of M */
  outerM: number
  /** true = prograde/co-rotating Ω; false = retrograde */
  prograde: boolean
  /** Master structure 0–1 */
  structure: number
  arms: number
  clumps: number
  dust: number
  scaleHeight: number
  shearRate: number
  /** 1 = animate shear with time */
  animate: boolean
}

export type CameraTraceParams = {
  distanceM: number
  inclination: number
  azimuth: number
  fov: number
}

/**
 * Full-screen geodesic material + uniform upload surface.
 * Prefer batch setters (setSpacetime / setCamera / setSky); no per-field setters.
 */
export type GeodesicTracer = {
  material: MeshBasicNodeMaterial
  mesh: Mesh
  setSpacetime: (p: SpacetimeTraceParams) => void
  setCamera: (c: CameraTraceParams) => void
  setSky: (s: SkyState) => void
  setDebugMode: (mode: number) => void
  /** 0 = real-time Cartesian (default), 1 = Boyer–Lindquist Mino */
  setIntegratorMode: (mode: 0 | 1) => void
  /** true = D = distanceM · M; false = fixed geometric D */
  setScaleFree: (on: boolean) => void
  /** true = ideal I ∝ g³; false = soft display I ∝ g² */
  setIdealBeam: (on: boolean) => void
  /** Animation time (seconds) for Keplerian disk shear */
  setTime: (seconds: number) => void
  /** Numerical quality only (steps / stride / base step) */
  setQuality: (q: { maxSteps: number; volumeStride: number; baseStepM: number }) => void
}
