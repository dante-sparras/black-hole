/**
 * Observer / camera defaults (not black-hole hair).
 * Shared by state/camera store, GPU tracer, and CPU ref renderer.
 */
export type ObserverCamera = {
  /**
   * Distance slider value.
   * - scale-free ON: D/M (multiples of mass)
   * - scale-free OFF: absolute geometric length D (G=c=1)
   * Resolve with resolveCameraDistance().
   */
  distanceM: number
  /** Polar angle from +Y (spin axis), radians. 0 = face-on, π/2 = edge-on */
  inclination: number
  /** Azimuth around spin axis, radians */
  azimuth: number
  /** Half-screen FOV scale (ray offset strength) */
  fov: number
}

export const OBSERVER_DEFAULTS: ObserverCamera = {
  distanceM: 60,
  inclination: 1.25, // ~72° from face-on
  azimuth: 0,
  fov: 0.9,
}

export const OBSERVER_LIMITS = {
  distanceM: { min: 8, max: 120 },
  inclination: { min: 0.05, max: Math.PI - 0.05 },
  fov: { min: 0.2, max: 1.4 },
} as const

/**
 * Geometric camera distance from BH center (G=c=1 length).
 * scaleFree: D = distanceM * mass  (distanceM is in units of M)
 * !scaleFree: D = distanceM          (distanceM is absolute geometric length)
 */
export function resolveCameraDistance(
  mass: number,
  distanceM: number,
  scaleFree: boolean,
): number {
  const m = Math.max(mass, 1e-12)
  const d = Math.max(distanceM, 1e-12)
  return scaleFree ? d * m : d
}

/**
 * Keep on-screen distance continuous when flipping scale-free mode.
 * nextScaleFree true: store was absolute D → want d = D/M
 * nextScaleFree false: store was d = D/M → want D = d*M
 */
export function convertDistanceOnScaleFreeToggle(
  distanceM: number,
  mass: number,
  nextScaleFree: boolean,
): number {
  const m = Math.max(mass, 1e-12)
  const d = Math.max(distanceM, 1e-12)
  return nextScaleFree ? d / m : d * m
}
