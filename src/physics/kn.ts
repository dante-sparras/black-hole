import { photonSphereRadii } from './kerr'
import type { BlackHoleParams, DerivedGeometry, MetricFamily } from './types'
import { spinLength } from './types'

/**
 * Outer RN photon-sphere radius (a = 0):
 * r_ph = [3M + √(9M² − 8Q²)] / 2   (requires 9M² ≥ 8Q²)
 */
export function rnPhotonSphere(mass: number, charge: number): number {
  const M = mass
  const Q = charge
  const disc = 9 * M * M - 8 * Q * Q
  if (disc < 0) {
    // No circular photon orbit (near-extremal RN) — fall back near 2M
    return 2 * M
  }
  return 0.5 * (3 * M + Math.sqrt(disc))
}

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

  const { prograde } = photonSphereRadii(M, params.spinStar)
  const rPhotonSphere = spinning ? prograde : rnPhotonSphere(M, Q)

  // Critical impact rough: Schw scale, shrink slightly with |Q|/M
  const qhat = Math.min(Math.abs(Q) / Math.max(M, 1e-12), 0.99)
  const criticalImpact = 3 * Math.sqrt(3) * M * (1 - 0.2 * qhat * qhat)

  return {
    mass: M,
    spinStar: params.spinStar,
    spinLength: a,
    charge: Q,
    family,
    rPlus,
    rMinus,
    rErgoEquator: 2 * M, // equatorial ergosphere unchanged at leading order for display
    rPhotonSphere,
    criticalImpact,
    hasHorizon,
    extremalityDelta: disc,
  }
}
