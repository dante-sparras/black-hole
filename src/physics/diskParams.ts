/**
 * Thin accretion disk parameters — NOT black-hole hair.
 *
 * No-hair = (M, a★, Q) only. The disk is matter outside the horizon:
 *   - ṁ sets accretion power (NT flux ∝ ṁ, T ∝ ṁ^{1/4})
 *   - outerM is the emission cutoff in units of M (model truncation)
 *   - inner edge is derived: family ISCO (not a free slider — realism)
 *
 * Geometric units G = c = 1.
 */
import { DEFAULT_MDOT, MDOT_MAX, MDOT_MIN } from './constants'
import { RT } from './geodesic/rtConstants'

export type DiskParams = {
  /**
   * Eddington ratio ṁ = Ṁ/Ṁ_Edd.
   * Thin-disk: F ∝ ṁ, T_eff ∝ ṁ^{1/4}.
   */
  readonly mdot: number
  /**
   * Outer disk radius in units of M (emission cutoff).
   * Physical disks extend far; this is the modeled luminous outer edge.
   */
  readonly outerM: number
}

export const DEFAULT_DISK: DiskParams = {
  mdot: DEFAULT_MDOT,
  outerM: RT.diskOuterM,
}

export const DISK_LIMITS = {
  mdot: { min: MDOT_MIN, max: MDOT_MAX },
  /** Keep outside typical ISCO (≲6M) and inside wide-field camera */
  outerM: { min: 8, max: 80 },
} as const

export type DiskInput = Partial<DiskParams>

export function normalizeDisk(input: DiskInput = {}): DiskParams {
  const mdot = clamp(
    Number.isFinite(input.mdot as number)
      ? (input.mdot as number)
      : DEFAULT_DISK.mdot,
    DISK_LIMITS.mdot.min,
    DISK_LIMITS.mdot.max,
  )
  const outerM = clamp(
    Number.isFinite(input.outerM as number)
      ? (input.outerM as number)
      : DEFAULT_DISK.outerM,
    DISK_LIMITS.outerM.min,
    DISK_LIMITS.outerM.max,
  )
  return { mdot, outerM }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
