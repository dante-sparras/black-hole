/**
 * Thin accretion disk: ISCO by metric family + Novikov–Thorne-style emission.
 * Geometric units G = c = 1.
 */

import { iscoRadii } from './kerr'
import type { BlackHoleParams } from './types'
import { spinLength } from './types'

function horizonPlus(mass: number, spinLengthA: number, charge: number): number {
  const disc = mass * mass - spinLengthA * spinLengthA - charge * charge
  if (disc < 0) return Number.NaN
  return mass + Math.sqrt(disc)
}

/**
 * RN ISCO (equatorial, timelike), limits:
 *   Q → 0  → 6M
 *   |Q| → M → 4M (extremal)
 * Interpolation: r/M = 4 + 2 √(1 − q²)  with q = Q/M
 */
export function rnIsco(mass: number, charge: number): number {
  const M = mass
  const q = Math.min(Math.abs(charge) / Math.max(M, 1e-12), 0.999)
  return M * (4 + 2 * Math.sqrt(Math.max(0, 1 - q * q)))
}

/**
 * Prograde disk inner edge (ISCO) for the no-hair parameters.
 * - Schw: 6M
 * - Kerr: Bardeen prograde
 * - RN: rnIsco
 * - KN: Kerr prograde × mild charge correction, floored above r₊
 */
export function diskIsco(params: BlackHoleParams, prograde = true): number {
  const M = params.mass
  const a = spinLength(params)
  const Q = params.charge
  const aStar = params.spinStar
  const hasA = Math.abs(aStar) >= 1e-12
  const hasQ = Math.abs(Q) >= 1e-12

  let r: number
  if (!hasA && !hasQ) {
    r = 6 * M
  } else if (hasA && !hasQ) {
    const { prograde: rp, retrograde: rr } = iscoRadii(M, aStar)
    r = prograde ? rp : rr
  } else if (!hasA && hasQ) {
    r = rnIsco(M, Q)
  } else {
    const { prograde: rp, retrograde: rr } = iscoRadii(M, aStar)
    const rK = prograde ? rp : rr
    const qhat = Math.min(Math.abs(Q) / Math.max(M, 1e-12), 0.99)
    r = rK * (1 - 0.12 * qhat * qhat)
  }

  const rPlus = horizonPlus(M, a, Q)
  if (Number.isFinite(rPlus)) {
    r = Math.max(r, rPlus * 1.05)
  }
  return r
}

/**
 * Novikov–Thorne / zero-torque flux factor:
 *   F̃(r) = r⁻³ (1 − √(r_in / r))   for r > r_in
 */
export function novikovThorneFluxFactor(r: number, rIsco: number): number {
  if (!(r > rIsco) || rIsco <= 0) return 0
  const gap = 1 - Math.sqrt(rIsco / r)
  if (gap <= 0) return 0
  return gap / (r * r * r)
}

/**
 * Dimensionless temperature scale T ∝ F̃^{1/4}.
 * Normalized for the renderer; spin raises efficiency slightly.
 */
export function novikovThorneTemperature(
  r: number,
  rIsco: number,
  mass: number,
  spinStar = 0,
): number {
  const F = novikovThorneFluxFactor(r, rIsco)
  if (F <= 0) return 0
  const Fm = F * mass * mass * mass
  const T0 = Math.pow(Fm * 8000, 0.25)
  const eff = 1 + 0.35 * Math.max(0, Math.min(spinStar, 0.998))
  return T0 * eff
}

/** Approx peak of simple NT flux: r ≈ (49/36) r_in */
export function novikovThornePeakRadius(rIsco: number): number {
  return (49 / 36) * rIsco
}
