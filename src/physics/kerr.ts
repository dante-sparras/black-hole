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

/**
 * Prograde/retrograde ISCO radii for Kerr (Bardeen et al. 1972).
 * a★ > 0 → prograde ISCO moves in; retrograde moves out.
 */
export function iscoRadii(
  mass: number,
  spinStar: number,
): { prograde: number; retrograde: number } {
  const M = mass
  const aStar = Math.min(0.999, Math.max(-0.999, spinStar))
  const a2 = aStar * aStar
  const Z1 =
    1 +
    Math.pow(1 - a2, 1 / 3) *
      (Math.pow(1 + aStar, 1 / 3) + Math.pow(1 - aStar, 1 / 3))
  const Z2 = Math.sqrt(3 * a2 + Z1 * Z1)
  const rPro =
    M * (3 + Z2 - Math.sign(aStar || 1) * Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2)))
  // Retrograde: flip spin sign in the formula
  const aR = -aStar
  const Z1r =
    1 +
    Math.pow(1 - aR * aR, 1 / 3) *
      (Math.pow(1 + aR, 1 / 3) + Math.pow(1 - aR, 1 / 3))
  const Z2r = Math.sqrt(3 * aR * aR + Z1r * Z1r)
  const rRet =
    M *
    (3 +
      Z2r -
      Math.sign(aR || 1) * Math.sqrt((3 - Z1r) * (3 + Z1r + 2 * Z2r)))
  return { prograde: rPro, retrograde: rRet }
}

/** Event horizon r₊ = M + √(M² − a²) for Kerr (Q=0). */
export function kerrHorizon(mass: number, spinLengthA: number): number {
  const disc = mass * mass - spinLengthA * spinLengthA
  if (disc < 0) return Number.NaN
  return mass + Math.sqrt(disc)
}

/**
 * Approximate equatorial critical impact parameters for photons
 * (Bardeen 1973). Used for HUD / diagnostics.
 *
 * b_c^± / M = ∓ a★ + 6 cos( (1/3) arccos(∓ a★) )
 * Prograde (co-rotating) uses the upper signs → smaller b for a★ > 0.
 */
export function criticalImpacts(
  mass: number,
  spinStar: number,
): { prograde: number; retrograde: number } {
  const aStar = Math.min(0.999, Math.max(-0.999, spinStar))
  // Prograde: −a★ + 6 cos(⅓ arccos(−a★))
  const bProM = -aStar + 6 * Math.cos((1 / 3) * Math.acos(-aStar))
  // Retrograde: +a★ + 6 cos(⅓ arccos(+a★))
  const bRetM = aStar + 6 * Math.cos((1 / 3) * Math.acos(+aStar))
  return {
    prograde: Math.abs(bProM) * mass,
    retrograde: Math.abs(bRetM) * mass,
  }
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
  const { prograde: bPro } = criticalImpacts(M, params.spinStar)
  const { prograde: rIsco } = iscoRadii(M, params.spinStar)

  const family: MetricFamily =
    Math.abs(params.spinStar) < 1e-12 ? 'schwarzschild' : 'kerr'

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
    criticalImpact: bPro,
    rIsco,
    hasHorizon,
    extremalityDelta: disc,
  }
}
