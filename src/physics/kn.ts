import { familyCriticalImpact, familyPhotonSphere } from './criticalCurve'
import { iscoRadii } from './kerr'
import { rnIsco } from './disk'
import type { BlackHoleParams, DerivedGeometry, MetricFamily } from './types'
import { spinLength } from './types'

export { rnPhotonSphere } from './criticalCurve'

/** Outer horizon r₊ = M + √(M² − a² − Q²). */
export function knHorizon(
  mass: number,
  spinLengthA: number,
  charge: number,
): number {
  const disc = mass * mass - spinLengthA * spinLengthA - charge * charge
  if (disc < 0) return Number.NaN
  return mass + Math.sqrt(disc)
}

/**
 * Kerr–Newman / Reissner–Nordström geometry.
 * Horizons: r± = M ± √(M² − a² − Q²)
 * Photon sphere / b_c: familyCritical* (shared with HUD).
 * ISCO: RN closed-form or Kerr prograde × mild charge pull-in.
 */
export function knGeometry(params: BlackHoleParams): DerivedGeometry {
  const M = params.mass
  const a = spinLength(params)
  const Q = params.charge
  const disc = M * M - a * a - Q * Q
  const hasHorizon = disc >= 0
  const sqrtDisc = hasHorizon ? Math.sqrt(Math.max(0, disc)) : 0
  const rPlus = hasHorizon ? M + sqrtDisc : Number.NaN
  const rMinus = hasHorizon ? M - sqrtDisc : Number.NaN

  const spinning = Math.abs(params.spinStar) >= 1e-12
  const family: MetricFamily = spinning ? 'kerr-newman' : 'reissner-nordstrom'

  const rPhotonSphere = familyPhotonSphere(params)
  const criticalImpact = familyCriticalImpact(params)

  // ISCO: RN closed form, or Kerr prograde with mild charge pull-in
  // (full KN ISCO has no simple closed form — limit-matched interpolation)
  let rIsco: number
  if (!spinning) {
    rIsco = rnIsco(M, Q)
  } else {
    const { prograde: rK } = iscoRadii(M, params.spinStar)
    const qhat = Math.min(Math.abs(Q) / Math.max(M, 1e-12), 0.99)
    rIsco = rK * (1 - 0.12 * qhat * qhat)
  }
  if (Number.isFinite(rPlus)) {
    rIsco = Math.max(rIsco, rPlus * 1.05)
  }

  return {
    mass: M,
    spinStar: params.spinStar,
    spinLength: a,
    charge: Q,
    family,
    rPlus,
    rMinus,
    rErgoEquator: 2 * M,
    rPhotonSphere,
    criticalImpact,
    rIsco,
    hasHorizon,
    extremalityDelta: disc,
  }
}
