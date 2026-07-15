/**
 * Shared geometry helpers for horizons, ergosphere, and KN ISCO.
 * Geometric units G = c = 1.
 *
 * Co-rotating orbit helpers live in kerr.ts (same module as Bardeen roots)
 * to avoid circular imports.
 */

/** Outer horizon r₊ = M + √(M² − a² − Q²). */
export function horizonPlus(
  mass: number,
  spinLengthA: number,
  charge: number,
): number {
  const disc = mass * mass - spinLengthA * spinLengthA - charge * charge
  if (disc < 0) return Number.NaN
  return mass + Math.sqrt(disc)
}

/**
 * Equatorial static-limit (ergosphere outer edge).
 * Kerr/KN: r_e = M + √(M² − Q²) at θ=π/2 (a terms vanish on equator).
 * RN (a=0): coincides with r₊. Pure Kerr (Q=0): 2M.
 */
export function equatorialErgosphere(mass: number, charge: number): number {
  const M = mass
  const Q = charge
  const disc = M * M - Q * Q
  if (disc < 0) return M
  return M + Math.sqrt(disc)
}

/**
 * Mild charge pull-in on Kerr ISCO for KN (no closed form).
 * Single source — used by diskIsco + knGeometry.
 */
export function knIscoFromKerr(
  rKerr: number,
  mass: number,
  charge: number,
  rPlus?: number,
): number {
  const qhat = Math.min(Math.abs(charge) / Math.max(mass, 1e-12), 0.99)
  let r = rKerr * (1 - 0.12 * qhat * qhat)
  if (rPlus !== undefined && Number.isFinite(rPlus)) {
    r = Math.max(r, rPlus * 1.05)
  }
  return r
}
