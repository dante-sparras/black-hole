/**
 * Thin accretion disk parameters — NOT black-hole hair.
 *
 * No-hair = (M, a★, Q) only. The disk is matter outside the horizon:
 *   - ṁ sets accretion power (NT flux ∝ ṁ, T ∝ ṁ^{1/4})
 *   - outerM is the emission cutoff in units of M (model truncation)
 *   - prograde: orbital sense L ‖ J (co-rotating) vs counter-rotating
 *   - tiltRad / tiltNodeRad: midplane inclination vs BH spin (+Y)
 *   - jetPower: optional bipolar funnel (0 = off)
 *   - gamma / plasmaBeta: expert EOS + MRI dens proxy
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
  /** Disk midplane tilt vs BH spin axis (radians, main free param) */
  readonly tiltRad: number
  /** Line-of-nodes azimuth for tilt (radians, about +Y) */
  readonly tiltNodeRad: number
  /** Optional jet power 0…1 (0 = off) */
  readonly jetPower: number
  /**
   * Adiabatic index Γ (expert). Drives derived thin-disk H/R.
   * Typical: 5/3 (non-rel gas) or 4/3 (radiation-dominated).
   */
  readonly gamma: number
  /**
   * Plasma β = P_gas/P_mag proxy (expert). Lower β → stronger MRI dens variance.
   */
  readonly plasmaBeta: number
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
  tiltRad: 0,
  tiltNodeRad: 0,
  jetPower: 0,
  gamma: 5 / 3,
  plasmaBeta: 10,
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
  shearRate: { min: 0, max: 4 },
  /** Tilt up to ~40° — dramatic but still thin-disk-ish */
  tiltRad: { min: 0, max: (40 * Math.PI) / 180 },
  tiltNodeRad: { min: 0, max: Math.PI * 2 },
  jetPower: { min: 0, max: 1 },
  gamma: { min: 4 / 3, max: 5 / 3 },
  /** Log-friendly range: strongly magnetized → weakly magnetized */
  plasmaBeta: { min: 0.1, max: 100 },
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
  const tiltRad = clamp(
    Number.isFinite(input.tiltRad as number)
      ? (input.tiltRad as number)
      : DEFAULT_DISK.tiltRad,
    DISK_LIMITS.tiltRad.min,
    DISK_LIMITS.tiltRad.max,
  )
  let tiltNodeRad = Number.isFinite(input.tiltNodeRad as number)
    ? (input.tiltNodeRad as number)
    : DEFAULT_DISK.tiltNodeRad
  // wrap to [0, 2π)
  const twoPi = Math.PI * 2
  tiltNodeRad = ((tiltNodeRad % twoPi) + twoPi) % twoPi
  const jetPower = clamp(
    Number.isFinite(input.jetPower as number)
      ? (input.jetPower as number)
      : DEFAULT_DISK.jetPower,
    DISK_LIMITS.jetPower.min,
    DISK_LIMITS.jetPower.max,
  )
  const gamma = clamp(
    Number.isFinite(input.gamma as number)
      ? (input.gamma as number)
      : DEFAULT_DISK.gamma,
    DISK_LIMITS.gamma.min,
    DISK_LIMITS.gamma.max,
  )
  const plasmaBeta = clamp(
    Number.isFinite(input.plasmaBeta as number)
      ? (input.plasmaBeta as number)
      : DEFAULT_DISK.plasmaBeta,
    DISK_LIMITS.plasmaBeta.min,
    DISK_LIMITS.plasmaBeta.max,
  )
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
    tiltRad,
    tiltNodeRad,
    jetPower,
    gamma,
    plasmaBeta,
  }
}

/**
 * Effective texture contrasts after master structure mix.
 * structure=0 → smooth; structure=1 → full arms/clumps/dust settings.
 * plasmaBeta scales turb contrast (low β → more MRI dens variance).
 */
export function effectiveDiskStructure(d: DiskParams): {
  armContrast: number
  turbContrast: number
  dustContrast: number
  scaleHeight: number
  shearRate: number
  animate: boolean
  mriTurbScale: number
} {
  const s = d.structure
  const mriTurbScale = plasmaBetaToMriScale(d.plasmaBeta)
  return {
    armContrast: s * d.arms,
    turbContrast: s * d.clumps * mriTurbScale,
    dustContrast: s * d.dust,
    scaleHeight: d.scaleHeight,
    shearRate: d.animate ? d.shearRate : 0,
    animate: d.animate,
    mriTurbScale,
  }
}

/**
 * Map plasma β → MRI dens variance scale.
 * β=10 (default) → 1; lower β (stronger B) → up to ~2.2; high β → down to ~0.45.
 */
export function plasmaBetaToMriScale(plasmaBeta: number): number {
  const b = Math.max(plasmaBeta, 0.05)
  // ∝ 1/√(β/10) clipped
  const s = Math.sqrt(10 / b)
  return Math.min(2.2, Math.max(0.45, s))
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
