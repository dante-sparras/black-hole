import type { Mesh, MeshBasicNodeMaterial } from 'three/webgpu'
import type { SkyState } from '../state/sky'

/** GPU no-hair + disk snapshot. */
export type SpacetimeTraceParams = {
  mass: number
  spinStar: number
  charge: number
  mdot: number
  /** Effective r_in / M (ISCO) */
  rIscoOverM: number
  outerM: number
  structure: number
  arms: number
  clumps: number
  dust: number
  /** Derived H/r */
  scaleHeight: number
  shearRate: number
  animate: boolean
  tiltRad: number
  jetBoost: number
  mriTurbScale: number
  rho0: number
  /** Relative T scale from ρ₀ */
  polyTScale: number
  rPeakOverM: number
  madBoost: number
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
