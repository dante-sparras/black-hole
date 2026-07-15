import type { BlackHoleParams, DerivedGeometry, MetricFamily } from './types'
import { spinLength } from './types'
import { equatorialErgosphere } from './geometry'

/**
 * Equatorial circular photon-orbit radii (Bardeen, Press & Teukolsky).
 * r_ph^± / M = 2 ( 1 + cos( (2/3) arccos(∓ a★) ) )
 * “prograde” = L > 0 branch (coordinate); for co-rotating with any sign(a★)
 * use coRotatingPhotonSphereRadii.
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
 * Coordinate L>0 / L<0 branches. For co-rotating fluid (L ‖ J) at any
 * sign(a★), use coRotatingIscoRadii.
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
    M *
    (3 +
      Z2 -
      Math.sign(aStar || 1) * Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2)))
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

/**
 * Co-rotating / counter-rotating ISCO for any sign of a★.
 * Uses |a★| so co-rotating is always the smaller ISCO (fluid L ‖ J).
 */
export function coRotatingIscoRadii(
  mass: number,
  spinStar: number,
): { coRotating: number; counterRotating: number } {
  const { prograde, retrograde } = iscoRadii(mass, Math.abs(spinStar))
  return { coRotating: prograde, counterRotating: retrograde }
}

/**
 * Co-rotating / counter-rotating photon-sphere radii (any sign of a★).
 */
export function coRotatingPhotonSphereRadii(
  mass: number,
  spinStar: number,
): { coRotating: number; counterRotating: number } {
  const { prograde, retrograde } = photonSphereRadii(mass, Math.abs(spinStar))
  return { coRotating: prograde, counterRotating: retrograde }
}

/**
 * Co-rotating / counter-rotating critical impacts b_c (any sign of a★).
 */
export function coRotatingCriticalImpacts(
  mass: number,
  spinStar: number,
): { coRotating: number; counterRotating: number } {
  const { prograde, retrograde } = criticalImpacts(mass, Math.abs(spinStar))
  return { coRotating: prograde, counterRotating: retrograde }
}

/** Event horizon r₊ = M + √(M² − a²) for Kerr (Q=0). */
export function kerrHorizon(mass: number, spinLengthA: number): number {
  const disc = mass * mass - spinLengthA * spinLengthA
  if (disc < 0) return Number.NaN
  return mass + Math.sqrt(disc)
}

/**
 * Equatorial critical impact parameters for photons (Bardeen 1973).
 * Analytic / HUD — image silhouette is from the integrator.
 *
 * b_c^± / M = ∓ a★ + 6 cos( (1/3) arccos(∓ a★) )
 * Coordinate prograde (L>0). Co-rotating: coRotatingCriticalImpacts.
 */
export function criticalImpacts(
  mass: number,
  spinStar: number,
): { prograde: number; retrograde: number } {
  const aStar = Math.min(0.999, Math.max(-0.999, spinStar))
  const bProM = -aStar + 6 * Math.cos((1 / 3) * Math.acos(-aStar))
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
  const { coRotating: rIsco } = coRotatingIscoRadii(M, params.spinStar)
  const { coRotating: rPh } = coRotatingPhotonSphereRadii(M, params.spinStar)
  const { coRotating: bPro } = coRotatingCriticalImpacts(M, params.spinStar)

  const family: MetricFamily =
    Math.abs(params.spinStar) < 1e-12 ? 'schwarzschild' : 'kerr'

  return {
    mass: M,
    spinStar: params.spinStar,
    spinLength: a,
    charge: 0,
    family,
    rPlus,
    rMinus,
    rErgoEquator: equatorialErgosphere(M, 0),
    rPhotonSphere: rPh,
    criticalImpact: bPro,
    rIsco,
    hasHorizon,
    extremalityDelta: disc,
  }
}
