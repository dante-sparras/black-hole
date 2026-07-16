/**
 * Real-time null integration constants shared by:
 *   - GPU TSL geodesicTracer
 *   - CPU knNull / cpuRef topology checks
 *
 * CRITICAL: step adapt floor must stay ≳ 0.2M or rays stall at the photon sphere.
 * Performance: maxSteps / baseStepM / volumeStride dominate GPU cost per pixel.
 */
export const RT = {
  /** Max integrator steps per ray (GPU). Lower = more FPS. */
  maxSteps: 380,
  /** Base step size multiplier: ds = baseStepM * M * adapt */
  baseStepM: 0.16,
  /** Adaptive ds clamp: min(adaptMax, max(adaptFloor, r/(adaptScale * M))) */
  adaptFloor: 0.3,
  adaptMax: 2.0,
  adaptScale: 10,
  /** Capture just outside r₊ */
  captureMargin: 1.02,
  /** Escape when r > escapeCamFactor * camD and outbound */
  escapeCamFactor: 2.8,
  /** Unfinished rays with minR < stalledCapture * M → treat as capture */
  stalledCaptureM: 3.2,
  /** Default disk outer radius in units of M */
  diskOuterM: 22,
  /** Floor ISCO above horizon */
  iscoHorizonMargin: 1.05,
  /**
   * Volume disk sample stride (GPU). Every Nth step when inside the slab.
   * Higher = faster; weight scaled by stride so brightness holds.
   */
  volumeStride: 5,
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
