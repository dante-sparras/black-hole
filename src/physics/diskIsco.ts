/**
 * Disk inner edge (ISCO) by metric family.
 * Geometric units G = c = 1. Not black-hole hair.
 */
import { horizonPlus, knIscoFromKerr } from './geometry'
import { coRotatingIscoRadii } from './kerr'
import type { BlackHoleParams } from './types'

/**
 * RN ISCO (equatorial, timelike) — endpoint fit, not exact literature root:
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
 * Disk inner edge (ISCO) for the no-hair parameters.
 * @param coRotating — fluid L ‖ hole J (default true). Uses |a★| so signed
 *   spin still picks the smaller (co-rotating) or larger (counter) radius.
 * - Schw: 6M
 * - Kerr: Bardeen co-/counter-rotating
 * - RN: rnIsco (approx)
 * - KN: Kerr × mild charge correction, floored above r₊
 */
export function diskIsco(params: BlackHoleParams, coRotating = true): number {
  const M = params.mass
  const a = params.spinStar * M
  const Q = params.charge
  const aStar = params.spinStar
  const hasA = Math.abs(aStar) >= 1e-12
  const hasQ = Math.abs(Q) >= 1e-12

  let r: number
  if (!hasA && !hasQ) {
    r = 6 * M
  } else if (hasA && !hasQ) {
    const { coRotating: rCo, counterRotating: rCounter } = coRotatingIscoRadii(
      M,
      aStar,
    )
    r = coRotating ? rCo : rCounter
  } else if (!hasA && hasQ) {
    r = rnIsco(M, Q)
  } else {
    const { coRotating: rCo, counterRotating: rCounter } = coRotatingIscoRadii(
      M,
      aStar,
    )
    const rK = coRotating ? rCo : rCounter
    const rPlus = horizonPlus(M, a, Q)
    r = knIscoFromKerr(rK, M, Q, rPlus)
    return r
  }

  const rPlus = horizonPlus(M, a, Q)
  if (Number.isFinite(rPlus)) {
    r = Math.max(r, rPlus * 1.05)
  }
  return r
}
