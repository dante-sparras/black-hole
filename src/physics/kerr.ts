import type { BlackHoleParams, DerivedGeometry, MetricFamily } from './types'
import { spinLength } from './types'

/**
 * Equatorial circular photon-orbit radii (Bardeen, Press & Teukolsky).
 * r_ph^± / M = 2 ( 1 + cos( (2/3) arccos(∓ a★) ) )
 * prograde uses −a★ inside arccos; retrograde uses +a★.
 */
export function photonSphereRadii(
  mass: number,
  spinStar: number,
): { prograde: number; retrograde: number } {
  const M = mass
  const aStar = Math.min(1, Math.max(-1, spinStar))
  const prograde = 2 * M * (1 + Math.cos((2 / 3) * Math.acos(-aStar)))
  const retrograde = 2 * M * (1 + Math.cos((2 / 3) * Math.acos(+aStar)))
  return { prograde, retrograde }
}

/** Kerr geometry (Q = 0). When |a★| ≈ 0, family is reported as schwarzschild. */
export function kerrGeometry(params: BlackHoleParams): DerivedGeometry {
  const M = params.mass
  const a = spinLength(params)
  const a2 = a * a
  const disc = M * M - a2
  const hasHorizon = disc >= 0
  const sqrtDisc = hasHorizon ? Math.sqrt(Math.max(0, disc)) : 0
  const rPlus = hasHorizon ? M + sqrtDisc : Number.NaN
  const rMinus = hasHorizon ? M - sqrtDisc : Number.NaN
  const { prograde } = photonSphereRadii(M, params.spinStar)

  const family: MetricFamily =
    Math.abs(params.spinStar) < 1e-12 ? 'schwarzschild' : 'kerr'

  // Outer ergosphere: M + √(M² − a² cos²θ); equator cosθ = 0 → 2M
  const rErgoEquator = 2 * M

  return {
    mass: M,
    spinStar: params.spinStar,
    spinLength: a,
    charge: 0,
    family,
    rPlus,
    rMinus,
    rErgoEquator,
    rPhotonSphere: prograde,
    // Placeholder until Kerr critical impact parameters land with the ray tracer
    criticalImpact: 3 * Math.sqrt(3) * M,
    hasHorizon,
    extremalityDelta: disc,
  }
}
