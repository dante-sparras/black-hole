/**
 * Analytic photon-sphere radii and critical impact parameters.
 *
 * Single source for DerivedGeometry + HUD shadowDiagnostics.
 * The *image* silhouette comes from the real-time null integrator
 * (knNullAccel), not these closed forms — see geodesic tests for
 * how close the integrator sits to analytic b_c.
 *
 * Geometric units G = c = 1.
 */
import { criticalImpacts as kerrCriticalImpacts, photonSphereRadii } from './kerr'
import type { BlackHoleParams } from './types'

const EPS = 1e-12

/**
 * Outer RN photon-sphere radius (a = 0):
 * r_ph = [3M + √(9M² − 8Q²)] / 2   (requires 9M² ≥ 8Q²)
 */
export function rnPhotonSphere(mass: number, charge: number): number {
  const M = mass
  const Q = charge
  const disc = 9 * M * M - 8 * Q * Q
  if (disc < 0) {
    // No unstable photon orbit (near-extremal naked / pathological) — floor at horizon scale
    return 2 * M
  }
  return 0.5 * (3 * M + Math.sqrt(disc))
}

/**
 * RN critical impact (static circular photon orbit):
 * b_c = r_ph / √f(r_ph),  f = 1 − 2M/r + Q²/r²
 */
export function rnCriticalImpact(mass: number, charge: number): number {
  const M = mass
  const Q = charge
  const rph = rnPhotonSphere(M, Q)
  const f = 1 - (2 * M) / rph + (Q * Q) / (rph * rph)
  if (f <= 1e-12) return 3 * Math.sqrt(3) * M
  return rph / Math.sqrt(f)
}

/** Mild charge shrink of Kerr critical curve (display / HUD for KN). */
export function knCriticalShrink(mass: number, charge: number): number {
  const qhat = Math.min(Math.abs(charge) / Math.max(mass, 1e-12), 0.99)
  return 1 - 0.15 * qhat * qhat
}

/**
 * Primary photon-sphere radius for display (prograde when spinning).
 * - Schw: 3M
 * - Kerr / KN: Bardeen prograde equatorial
 * - RN: closed-form RN photon sphere
 */
export function familyPhotonSphere(
  params: Pick<BlackHoleParams, 'mass' | 'spinStar' | 'charge'>,
): number {
  const M = params.mass
  const hasA = Math.abs(params.spinStar) >= EPS
  const hasQ = Math.abs(params.charge) >= EPS

  if (!hasA && !hasQ) return 3 * M
  if (hasA && !hasQ) return photonSphereRadii(M, params.spinStar).prograde
  if (!hasA && hasQ) return rnPhotonSphere(M, params.charge)
  // KN: Kerr prograde (full KN photon orbits not closed-form here)
  return photonSphereRadii(M, params.spinStar).prograde
}

/**
 * Critical impacts b_c^± for HUD / DerivedGeometry.
 * Prograde = co-rotating side (shrinks with a★ > 0).
 */
export function familyCriticalImpacts(
  params: Pick<BlackHoleParams, 'mass' | 'spinStar' | 'charge'>,
): { prograde: number; retrograde: number } {
  const M = params.mass
  const hasA = Math.abs(params.spinStar) >= EPS
  const hasQ = Math.abs(params.charge) >= EPS

  if (!hasA && !hasQ) {
    const b = 3 * Math.sqrt(3) * M
    return { prograde: b, retrograde: b }
  }
  if (hasA && !hasQ) {
    return kerrCriticalImpacts(M, params.spinStar)
  }
  if (!hasA && hasQ) {
    const b = rnCriticalImpact(M, params.charge)
    return { prograde: b, retrograde: b }
  }
  // KN: Kerr curve with mild charge shrink
  const b = kerrCriticalImpacts(M, params.spinStar)
  const s = knCriticalShrink(M, params.charge)
  return { prograde: b.prograde * s, retrograde: b.retrograde * s }
}

/** Prograde / co-rotating critical impact (single scalar for DerivedGeometry). */
export function familyCriticalImpact(
  params: Pick<BlackHoleParams, 'mass' | 'spinStar' | 'charge'>,
): number {
  return familyCriticalImpacts(params).prograde
}
