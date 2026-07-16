/**
 * Real-time null integration constants shared by GPU TSL + CPU knNull.
 *
 * CRITICAL: adapt floor ≳ 0.2M or rays stall at the photon sphere.
 * Photon-ring multi-wrap needs finer steps near r ~ 1.5–6 M.
 */
export const RT = {
  /** Hard loop ceiling (GPU). Effective steps clamped by uMaxSteps quality. */
  maxSteps: 720,
  /** Default effective max steps (med quality) */
  defaultMaxSteps: 540,
  baseStepM: 0.12,
  adaptFloor: 0.21,
  adaptMax: 1.85,
  adaptScale: 10.5,
  /**
   * Extra refinement near photon sphere: adaptFloor *= (1 − phRefine * nearPh).
   * nearPh peaks at r≈3M — enables nested rings from geometry, not fake glow.
   */
  phRefine: 0.58,
  phCenterM: 3.0,
  phWidthM: 2.0,
  captureMargin: 1.02,
  escapeCamFactor: 3,
  stalledCaptureM: 3.2,
  diskOuterM: 24,
  iscoHorizonMargin: 1.05,
  volumeStride: 2,
  beerSoft: 0.78,
  tauSampleMax: 2.6,
  /** Allow more multi-wrap disk samples (secondary images) */
  maxDiskHits: 18,
} as const

/** Adaptive step size in geometric units (CPU twin). */
export function rtStepSize(r: number, mass: number): number {
  const M = Math.max(mass, 1e-12)
  const rM = r / M
  const nearPh = Math.exp(
    -Math.abs(rM - RT.phCenterM) / Math.max(RT.phWidthM, 0.5),
  )
  const floor = RT.adaptFloor * (1 - RT.phRefine * nearPh)
  const adapt = Math.min(RT.adaptMax, Math.max(floor, r / (RT.adaptScale * M)))
  return RT.baseStepM * M * adapt
}

/** Photon-sphere proximity ∈ [0,1] for CPU diagnostics. */
export function photonSphereProximity(rOverM: number): number {
  return Math.exp(-Math.abs(rOverM - RT.phCenterM) / Math.max(RT.phWidthM, 0.5))
}
