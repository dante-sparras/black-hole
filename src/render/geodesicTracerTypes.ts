import type { Mesh, MeshBasicNodeMaterial } from 'three/webgpu'
import type { SkyState } from '../state/sky'

/** GPU no-hair + disk snapshot (not full SpacetimeUniforms / derived). */
export type SpacetimeTraceParams = {
  mass: number
  spinStar: number
  charge: number
  mdot: number
  /** r_ISCO / M from CPU diskIsco */
  rIscoOverM: number
  /** Disk outer radius in units of M */
  outerM: number
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
}
