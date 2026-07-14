import { photonSphereRadii } from './kerr'
import type { BlackHoleParams, DerivedGeometry, MetricFamily } from './types'
import { spinLength } from './types'

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
  // RN (a=0): photon sphere is more involved; display 3M as interim for a=0
  const rPhotonSphere = spinning ? prograde : 3 * M

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
    criticalImpact: 3 * Math.sqrt(3) * M,
    hasHorizon,
    extremalityDelta: disc,
  }
}
