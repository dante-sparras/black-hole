/**
 * Real-time null integration constants shared by:
 *   - GPU TSL geodesicTracer
 *   - CPU knNull / cpuRef topology checks
 *
 * CRITICAL: step adapt floor must stay ≳ 0.2M or rays stall at the photon sphere.
 * Balance: enough steps for far-side/lensed disk; lean enough for ~60–100fps.
 */
export const RT = {
  /** Max integrator steps per ray (GPU). Need multi-wrap for far-side above shadow. */
  maxSteps: 460,
  /** Base step size multiplier: ds = baseStepM * M * adapt */
  baseStepM: 0.14,
  /** Adaptive ds clamp: min(adaptMax, max(adaptFloor, r/(adaptScale * M))) */
  adaptFloor: 0.24,
  adaptMax: 1.85,
  adaptScale: 11,
  /** Capture just outside r₊ */
  captureMargin: 1.02,
  /** Escape when r > escapeCamFactor * camD and outbound */
  escapeCamFactor: 3,
  /** Unfinished rays with minR < stalledCapture * M → treat as capture */
  stalledCaptureM: 3.2,
  /** Default disk outer radius in units of M */
  diskOuterM: 22,
  /** Floor ISCO above horizon */
  iscoHorizonMargin: 1.05,
  /**
   * Volume disk sample stride (GPU). 3 balances FPS vs ring banding.
   * Weight scaled by stride so brightness holds.
   */
  volumeStride: 3,
  /**
   * Soft optical depth scale for Beer's law (weight ∝ e^{−α τ}).
   * α < 1 keeps far-side / lensed disk visible after near-side hits.
   * α = 1 was fully blacking the top bridge over the shadow.
   */
  beerSoft: 0.72,
  /** τ gate for continued sampling */
  tauSampleMax: 2.8,
} as const

/** Adaptive step size in geometric units. */
export function rtStepSize(r: number, mass: number): number {
  const M = Math.max(mass, 1e-12)
  const adapt = Math.min(
    RT.adaptMax,
    Math.max(RT.adaptFloor, r / (RT.adaptScale * M)),
  )
  return RT.baseStepM * M * adapt
}
