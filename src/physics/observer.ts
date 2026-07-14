/**
 * Observer / camera defaults (not black-hole hair).
 * Shared by state/camera store, GPU tracer, and CPU ref renderer.
 */
export type ObserverCamera = {
  /** Distance from BH center, in units of M */
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
