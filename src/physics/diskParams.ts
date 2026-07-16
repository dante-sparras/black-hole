/**
 * Thin accretion disk parameters — NOT black-hole hair.
 *
 * No-hair = (M, a★, Q) only. The disk is matter outside the horizon:
 *   - ṁ sets accretion power (NT flux ∝ ṁ, T ∝ ṁ^{1/4})
 *   - outerM is the emission cutoff in units of M (model truncation)
 *   - prograde: orbital sense L ‖ J (co-rotating) vs counter-rotating
 *   - structure knobs: gas/plasma/dust look (not hair)
 *   - inner edge is derived: family ISCO for that sense (not a free slider)
 *
 * Geometric units G = c = 1.
 */
import { DEFAULT_MDOT, MDOT_MAX, MDOT_MIN } from './constants'
import { RT } from './geodesic/rtConstants'
import { DISK_TEXTURE } from './diskTexture'

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
  /**
   * Orbital sense relative to hole spin (+Y / a★ > 0):
   * true  = prograde / co-rotating (default) — smaller ISCO, Ω > 0 form
   * false = retrograde / counter-rotating — larger ISCO, flipped Doppler
   */
  readonly prograde: boolean
  /**
   * Master structure mix: 0 = smooth Novikov–Thorne only, 1 = full texture.
   * Scales arms / clumps / dust together.
   */
  readonly structure: number
  /** Spiral arm (gas filament) contrast 0–1 */
  readonly arms: number
  /** Plasma turbulence / clump contrast 0–1 */
  readonly clumps: number
  /** Outer dust-lane contrast 0–1 */
  readonly dust: number
  /** H/R scale-height for path-length thickness (edge-on look) */
  readonly scaleHeight: number
  /** Pattern shear rate (visual Keplerian wind of structure) */
  readonly shearRate: number
  /** Animate structure with differential rotation */
  readonly animate: boolean
}

export const DEFAULT_DISK: DiskParams = {
  mdot: DEFAULT_MDOT,
  outerM: RT.diskOuterM,
  prograde: true,
  structure: 1,
  arms: DISK_TEXTURE.armContrast,
  clumps: DISK_TEXTURE.turbContrast,
  dust: DISK_TEXTURE.dustContrast,
  scaleHeight: DISK_TEXTURE.scaleHeight,
  shearRate: DISK_TEXTURE.shearRate,
  animate: true,
}

export const DISK_LIMITS = {
  mdot: { min: MDOT_MIN, max: MDOT_MAX },
  /** Keep outside typical ISCO (≲6M) and inside wide-field camera */
  outerM: { min: 8, max: 80 },
  structure: { min: 0, max: 1 },
  arms: { min: 0, max: 1 },
  clumps: { min: 0, max: 1 },
  dust: { min: 0, max: 1 },
  scaleHeight: { min: 0.02, max: 0.18 },
  shearRate: { min: 0, max: 1.2 },
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
  const prograde =
    typeof input.prograde === 'boolean' ? input.prograde : DEFAULT_DISK.prograde
  const structure = clamp(
    Number.isFinite(input.structure as number)
      ? (input.structure as number)
      : DEFAULT_DISK.structure,
    DISK_LIMITS.structure.min,
    DISK_LIMITS.structure.max,
  )
  const arms = clamp(
    Number.isFinite(input.arms as number) ? (input.arms as number) : DEFAULT_DISK.arms,
    DISK_LIMITS.arms.min,
    DISK_LIMITS.arms.max,
  )
  const clumps = clamp(
    Number.isFinite(input.clumps as number)
      ? (input.clumps as number)
      : DEFAULT_DISK.clumps,
    DISK_LIMITS.clumps.min,
    DISK_LIMITS.clumps.max,
  )
  const dust = clamp(
    Number.isFinite(input.dust as number) ? (input.dust as number) : DEFAULT_DISK.dust,
    DISK_LIMITS.dust.min,
    DISK_LIMITS.dust.max,
  )
  const scaleHeight = clamp(
    Number.isFinite(input.scaleHeight as number)
      ? (input.scaleHeight as number)
      : DEFAULT_DISK.scaleHeight,
    DISK_LIMITS.scaleHeight.min,
    DISK_LIMITS.scaleHeight.max,
  )
  const shearRate = clamp(
    Number.isFinite(input.shearRate as number)
      ? (input.shearRate as number)
      : DEFAULT_DISK.shearRate,
    DISK_LIMITS.shearRate.min,
    DISK_LIMITS.shearRate.max,
  )
  const animate =
    typeof input.animate === 'boolean' ? input.animate : DEFAULT_DISK.animate
  return {
    mdot,
    outerM,
    prograde,
    structure,
    arms,
    clumps,
    dust,
    scaleHeight,
    shearRate,
    animate,
  }
}

/**
 * Effective texture contrasts after master structure mix.
 * structure=0 → smooth; structure=1 → full arms/clumps/dust settings.
 */
export function effectiveDiskStructure(d: DiskParams): {
  armContrast: number
  turbContrast: number
  dustContrast: number
  scaleHeight: number
  shearRate: number
  animate: boolean
} {
  const s = d.structure
  return {
    armContrast: s * d.arms,
    turbContrast: s * d.clumps,
    dustContrast: s * d.dust,
    scaleHeight: d.scaleHeight,
    shearRate: d.animate ? d.shearRate : 0,
    animate: d.animate,
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
