import { familyCriticalImpact, familyPhotonSphere } from './criticalCurve'
import { rnIsco } from './disk'
import {
  equatorialErgosphere,
  horizonPlus,
  knIscoFromKerr,
} from './geometry'
import { coRotatingIscoRadii } from './kerr'
import type { BlackHoleParams, DerivedGeometry, MetricFamily } from './types'
import { spinLength } from './types'

export { rnPhotonSphere } from './criticalCurve'
export { horizonPlus as knHorizon }

/**
 * Kerr–Newman / Reissner–Nordström geometry.
 * Horizons: r± = M ± √(M² − a² − Q²)
 * Photon sphere / b_c: familyCritical* (shared with HUD).
 * ISCO: RN approx or Kerr co-rotating × mild charge pull-in (knIscoFromKerr).
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

  let rIsco: number
  if (!spinning) {
    rIsco = rnIsco(M, Q)
    if (Number.isFinite(rPlus)) rIsco = Math.max(rIsco, rPlus * 1.05)
  } else {
    const { coRotating: rK } = coRotatingIscoRadii(M, params.spinStar)
    rIsco = knIscoFromKerr(rK, M, Q, rPlus)
  }

  return {
    mass: M,
    spinStar: params.spinStar,
    spinLength: a,
    charge: Q,
    family,
    rPlus,
    rMinus,
    rErgoEquator: equatorialErgosphere(M, Q),
    rPhotonSphere,
    criticalImpact,
    rIsco,
    hasHorizon,
    extremalityDelta: disc,
  }
}
