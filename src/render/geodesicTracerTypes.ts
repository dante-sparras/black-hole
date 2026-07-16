import type { Mesh, MeshBasicNodeMaterial } from 'three/webgpu'
import type { SkyState } from '../state/sky'

/** GPU no-hair + disk snapshot (not full SpacetimeUniforms / derived). */
export type SpacetimeTraceParams = {
  mass: number
  spinStar: number
  charge: number
  mdot: number
  /** Effective r_in / M (ISCO or free) */
  rIscoOverM: number
  outerM: number
  prograde: boolean
  structure: number
  arms: number
  clumps: number
  dust: number
  /** Free H/r */
  scaleHeight: number
  shearRate: number
  animate: boolean
  tiltRad: number
  tiltNodeRad: number
  jetPower: number
  mriTurbScale: number
  /** Density normalization ρ₀ */
  rho0: number
  /** Polytropic T scale K ρ^{Γ−1} */
  polyTScale: number
  /** Dens peak radius / M from ℓ̃ */
  rPeakOverM: number
  /** Mag geometry code: 0 single-loop, 1 multi, 2 vertical */
  magGeom: number
  /** MAD boost on jets 0…1 */
  madBoost: number
  /** Perturbation amplitude */
  perturbAmp: number
}

export type CameraTraceParams = {
  distanceM: number
  inclination: number
  azimuth: number
  fov: number
}

export type GeodesicTracer = {
  material: MeshBasicNodeMaterial
  mesh: Mesh
  setSpacetime: (p: SpacetimeTraceParams) => void
  setCamera: (c: CameraTraceParams) => void
  setSky: (s: SkyState) => void
  setDebugMode: (mode: number) => void
  setIntegratorMode: (mode: 0 | 1) => void
  setScaleFree: (on: boolean) => void
  setIdealBeam: (on: boolean) => void
  setTime: (seconds: number) => void
  setQuality: (q: { maxSteps: number; volumeStride: number; baseStepM: number }) => void
  setGrmhdCube: (
    gpu: {
      texture: import('three').Data3DTexture
      origin: { x: number; y: number; z: number }
      extent: { x: number; y: number; z: number }
      densScale: number
    } | null,
    mix: number,
  ) => void
}
