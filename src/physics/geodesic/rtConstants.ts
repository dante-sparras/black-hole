/**
 * Real-time null integration constants shared by GPU TSL + CPU knNull.
 *
 * CRITICAL: adapt floor ≳ 0.2M or rays stall at the photon sphere.
 * Photon-ring multi-wrap needs finer steps near r ~ 1.5–6 M.
 * Far vacuum must allow large adaptMax or distant cameras run out of
 * steps and the shadow paints as "escaped" sky (zoom-out vanish bug).
 */
export const RT = {
  /** Hard loop ceiling (GPU). Effective steps clamped by uMaxSteps quality. */
  maxSteps: 720,
  /** Default effective max steps (med quality) */
  defaultMaxSteps: 540,
  baseStepM: 0.12,
  adaptFloor: 0.21,
  /**
   * Cap on adaptive multiplier. Must be high enough that a cruise from
   * OBSERVER_LIMITS.distanceM.max reaches the hole within maxSteps:
   *   steps ≈ (D/M) / (baseStepM · adaptMax)
   * With D/M=120, base=0.12, adaptMax=8.5 → ~120 vacuum steps + margin.
   * Old adaptMax=1.85 needed ~540 steps and failed at far zoom.
   */
  adaptMax: 8.5,
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
  /** Impact-parameter (units of M) below which incomplete rays paint capture */
  stalledShadowImpactM: 6.8,
  diskOuterM: 24,
  iscoHorizonMargin: 1.05,
  volumeStride: 2,
  beerSoft: 0.98,
  tauSampleMax: 0.9,
  /**
   * Max disk hits: higher-order images face-on appear as concentric rings.
   */
  maxDiskHits: 40,
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

/**
 * Effective max steps for a camera at geometric distance D and mass M.
 * Ensures vacuum travel from D to the hole fits the step budget.
 */
export function rtMaxStepsForCamera(
  camDistance: number,
  mass: number,
  qualityMaxSteps: number,
): number {
  const M = Math.max(mass, 1e-12)
  const dOverM = Math.max(camDistance, M) / M
  // Cruise step ≈ baseStepM · adaptMax (far vacuum)
  const cruise = Math.max(RT.baseStepM * RT.adaptMax * 0.9, 0.15)
  const need = Math.ceil(dOverM / cruise + 120)
  return Math.min(RT.maxSteps, Math.max(qualityMaxSteps, need))
}

/** Photon-sphere proximity ∈ [0,1] for CPU diagnostics. */
export function photonSphereProximity(rOverM: number): number {
  return Math.exp(-Math.abs(rOverM - RT.phCenterM) / Math.max(RT.phWidthM, 0.5))
}
