/**
 * Analytic photon-sphere radii and critical impact parameters.
 *
 * Single source for DerivedGeometry + HUD shadowDiagnostics.
 * The *image* silhouette comes from the null integrator (RT or BL),
 * not these closed forms.
 *
 * Geometric units G = c = 1.
 */
import {
  coRotatingCriticalImpacts,
  coRotatingPhotonSphereRadii,
} from './kerr'
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

/** Mild charge shrink of Kerr critical curve (display / HUD for KN — approx). */
export function knCriticalShrink(mass: number, charge: number): number {
  const qhat = Math.min(Math.abs(charge) / Math.max(mass, 1e-12), 0.99)
  return 1 - 0.15 * qhat * qhat
}

/**
 * Primary photon-sphere radius for display (co-rotating when spinning).
 */
export function familyPhotonSphere(
  params: Pick<BlackHoleParams, 'mass' | 'spinStar' | 'charge'>,
): number {
  const M = params.mass
  const hasA = Math.abs(params.spinStar) >= EPS
  const hasQ = Math.abs(params.charge) >= EPS

  if (!hasA && !hasQ) return 3 * M
  if (hasA && !hasQ) {
    return coRotatingPhotonSphereRadii(M, params.spinStar).coRotating
  }
  if (!hasA && hasQ) return rnPhotonSphere(M, params.charge)
  return coRotatingPhotonSphereRadii(M, params.spinStar).coRotating
}

/**
 * Critical impacts b_c^± for HUD / DerivedGeometry.
 * prograde field = co-rotating (smaller for |a★|>0); retrograde = counter.
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
    const b = coRotatingCriticalImpacts(M, params.spinStar)
    return { prograde: b.coRotating, retrograde: b.counterRotating }
  }
  if (!hasA && hasQ) {
    const b = rnCriticalImpact(M, params.charge)
    return { prograde: b, retrograde: b }
  }
  // KN: Kerr co-rotating curve with mild charge shrink (approx)
  const b = coRotatingCriticalImpacts(M, params.spinStar)
  const s = knCriticalShrink(M, params.charge)
  return {
    prograde: b.coRotating * s,
    retrograde: b.counterRotating * s,
  }
}

export function familyCriticalImpact(
  params: Pick<BlackHoleParams, 'mass' | 'spinStar' | 'charge'>,
): number {
  return familyCriticalImpacts(params).prograde
}
