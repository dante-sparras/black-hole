/**
 * Accretion disk parameters — NOT black-hole hair.
 *
 * Base torus / thin-disk free inputs (GRMHD-init style):
 *   ρ₀, H/r, Γ, K, ℓ (specific ang. mom.), β₀, B geometry, r_in,
 *   tilt, jet power, MAD/SANE, perturbation, ṁ, r_out, orbit.
 *
 * No-hair = (M, a★, Q) only. Geometric units G = c = 1.
 */
import { DEFAULT_MDOT, MDOT_MAX, MDOT_MIN } from './constants'
import { RT } from './geodesic/rtConstants'
import { DISK_TEXTURE } from './diskTexture'

/** Seed magnetic topology for dens / jet coupling (proxy, not full MHD). */
export type MagGeometry = 'single-loop' | 'multi-loop' | 'vertical'

/** High-level magnetization target. */
export type MagnetState = 'sane' | 'mad'

export type DiskParams = {
  /**
   * Eddington ratio ṁ = Ṁ/Ṁ_Edd (accretion power).
   * Thin-disk: F ∝ ṁ, T_eff ∝ ṁ^{1/4}. Also scales with ρ₀ for brightness.
   */
  readonly mdot: number
  /**
   * Density normalization ρ₀ (relative). Scales optical depth & emission weight.
   * 1 = reference; log-friendly range ~0.05…20.
   */
  readonly rho0: number
  /** Outer disk radius in units of M (emission cutoff). */
  readonly outerM: number
  /**
   * Free inner radius in units of M (torus / disk inner edge).
   * Clamped above horizon at apply time; default ~6 (Schw ISCO).
   */
  readonly rinM: number
  /**
   * true  = use free rinM
   * false = lock inner edge to family ISCO (co/counter from prograde)
   */
  readonly rinFree: boolean
  /**
   * Orbital sense relative to hole spin (+Y / a★ > 0):
   * true = co-rotating; false = counter-rotating.
   */
  readonly prograde: boolean
  /**
   * Specific angular momentum parameter ℓ̃ = ℓ/(M c) (dimensionless proxy).
   * FM-style: larger ℓ → rotation support farther out (affects dens peak radius).
   * Typical thin-disk Keplerian at r~r_in: ℓ̃ ~ √(r_in/M).
   */
  readonly specificL: number
  /** Free disk aspect ratio H/r (geometric thickness). */
  readonly scaleHeight: number
  /** Adiabatic index Γ (EOS). 4/3 radiation … 5/3 gas. */
  readonly gamma: number
  /**
   * Polytropic constant K in p = K ρ^Γ (relative).
   * Scales pressure / temperature proxy at fixed ρ.
   */
  readonly polyK: number
  /** Initial plasma β₀ = p_gas / p_mag. Low β → MAD-like dens variance / jets. */
  readonly plasmaBeta: number
  /** Magnetic seed geometry. */
  readonly magGeometry: MagGeometry
  /** SANE vs MAD magnetization target (sets β floor coupling + jet boost). */
  readonly magnetState: MagnetState
  /** MRI / turbulence seed amplitude 0…1. */
  readonly perturbAmp: number
  /** Disk midplane tilt vs BH spin (rad). */
  readonly tiltRad: number
  /** Line of nodes about +Y (rad). */
  readonly tiltNodeRad: number
  /** Optional jet power 0…1 (0 = off). */
  readonly jetPower: number
  /** Master structure mix 0–1 (texture). */
  readonly structure: number
  readonly arms: number
  readonly clumps: number
  readonly dust: number
  readonly shearRate: number
  readonly animate: boolean
}

export const DEFAULT_DISK: DiskParams = {
  mdot: DEFAULT_MDOT,
  rho0: 1,
  outerM: RT.diskOuterM,
  rinM: 6,
  rinFree: false,
  prograde: true,
  specificL: Math.sqrt(6), // ~ Keplerian ℓ at r=6M
  scaleHeight: DISK_TEXTURE.scaleHeight,
  gamma: 5 / 3,
  polyK: 1,
  plasmaBeta: 100, // SANE-ish default
  magGeometry: 'single-loop',
  magnetState: 'sane',
  perturbAmp: 0.35,
  tiltRad: 0,
  tiltNodeRad: 0,
  jetPower: 0,
  structure: 1,
  arms: DISK_TEXTURE.armContrast,
  clumps: DISK_TEXTURE.turbContrast,
  dust: DISK_TEXTURE.dustContrast,
  shearRate: DISK_TEXTURE.shearRate,
  animate: true,
}

export const DISK_LIMITS = {
  mdot: { min: MDOT_MIN, max: MDOT_MAX },
  rho0: { min: 0.05, max: 20 },
  outerM: { min: 8, max: 80 },
  rinM: { min: 1.5, max: 30 },
  specificL: { min: 1.5, max: 12 },
  scaleHeight: { min: 0.01, max: 0.3 },
  gamma: { min: 4 / 3, max: 5 / 3 },
  polyK: { min: 0.1, max: 10 },
  plasmaBeta: { min: 0.3, max: 1000 },
  perturbAmp: { min: 0, max: 1 },
  tiltRad: { min: 0, max: (40 * Math.PI) / 180 },
  tiltNodeRad: { min: 0, max: Math.PI * 2 },
  jetPower: { min: 0, max: 1 },
  structure: { min: 0, max: 1 },
  arms: { min: 0, max: 1 },
  clumps: { min: 0, max: 1 },
  dust: { min: 0, max: 1 },
  shearRate: { min: 0, max: 4 },
} as const

export type DiskInput = Partial<DiskParams>

const MAG_GEOMS: readonly MagGeometry[] = ['single-loop', 'multi-loop', 'vertical']
const MAG_STATES: readonly MagnetState[] = ['sane', 'mad']

export function normalizeDisk(input: DiskInput = {}): DiskParams {
  const mdot = clamp(
    num(input.mdot, DEFAULT_DISK.mdot),
    DISK_LIMITS.mdot.min,
    DISK_LIMITS.mdot.max,
  )
  const rho0 = clamp(
    num(input.rho0, DEFAULT_DISK.rho0),
    DISK_LIMITS.rho0.min,
    DISK_LIMITS.rho0.max,
  )
  const outerM = clamp(
    num(input.outerM, DEFAULT_DISK.outerM),
    DISK_LIMITS.outerM.min,
    DISK_LIMITS.outerM.max,
  )
  const rinMRaw = clamp(
    num(input.rinM, DEFAULT_DISK.rinM),
    DISK_LIMITS.rinM.min,
    DISK_LIMITS.rinM.max,
  )
  const rinClamped = Math.min(rinMRaw, outerM - 1)
  const prograde =
    typeof input.prograde === 'boolean' ? input.prograde : DEFAULT_DISK.prograde
  const scaleHeight = clamp(
    num(input.scaleHeight, DEFAULT_DISK.scaleHeight),
    DISK_LIMITS.scaleHeight.min,
    DISK_LIMITS.scaleHeight.max,
  )
  const plasmaBeta = clamp(
    num(input.plasmaBeta, DEFAULT_DISK.plasmaBeta),
    DISK_LIMITS.plasmaBeta.min,
    DISK_LIMITS.plasmaBeta.max,
  )
  const tiltRad = clamp(
    num(input.tiltRad, DEFAULT_DISK.tiltRad),
    DISK_LIMITS.tiltRad.min,
    DISK_LIMITS.tiltRad.max,
  )
  const jetPower = clamp(
    num(input.jetPower, DEFAULT_DISK.jetPower),
    DISK_LIMITS.jetPower.min,
    DISK_LIMITS.jetPower.max,
  )
  const structure = clamp(
    num(input.structure, DEFAULT_DISK.structure),
    DISK_LIMITS.structure.min,
    DISK_LIMITS.structure.max,
  )
  const arms = clamp(num(input.arms, DEFAULT_DISK.arms), DISK_LIMITS.arms.min, DISK_LIMITS.arms.max)
  const clumps = clamp(
    num(input.clumps, DEFAULT_DISK.clumps),
    DISK_LIMITS.clumps.min,
    DISK_LIMITS.clumps.max,
  )
  const dust = clamp(num(input.dust, DEFAULT_DISK.dust), DISK_LIMITS.dust.min, DISK_LIMITS.dust.max)
  const shearRate = clamp(
    num(input.shearRate, DEFAULT_DISK.shearRate),
    DISK_LIMITS.shearRate.min,
    DISK_LIMITS.shearRate.max,
  )
  const animate =
    typeof input.animate === 'boolean' ? input.animate : DEFAULT_DISK.animate

  // Thin-disk locks (not free UI)
  const magnetState = magnetClassFromBeta(plasmaBeta)
  const perturbAmp = perturbFromBeta(plasmaBeta)
  const specificL = keplerSpecificL(rinClamped)

  return {
    mdot,
    rho0,
    outerM,
    rinM: rinClamped,
    rinFree: false,
    prograde,
    specificL,
    scaleHeight,
    gamma: 5 / 3,
    polyK: 1,
    plasmaBeta,
    magGeometry: 'single-loop',
    magnetState,
    perturbAmp,
    tiltRad,
    tiltNodeRad: 0,
    jetPower,
    structure,
    arms,
    clumps,
    dust,
    shearRate,
    animate,
  }
}

/**
 * Effective MRI dens variance scale from β₀ and MAD/SANE.
 * β=100 → ~1; lower β → higher turbulence (capped); MAD boosts further.
 */
export function plasmaBetaToMriScale(
  plasmaBeta: number,
  magnetState: MagnetState = 'sane',
): number {
  const b = Math.max(plasmaBeta, 0.2)
  // √(β_ref / β) with β_ref=100 (SANE-ish)
  const s = Math.sqrt(100 / b)
  const base = Math.min(2.8, Math.max(0.35, s))
  return magnetState === 'mad' ? Math.min(3.2, base * 1.35) : base
}

/** Mag geometry → dens modulation code 0,1,2 for GPU. */
export function magGeometryCode(g: MagGeometry): number {
  if (g === 'multi-loop') return 1
  if (g === 'vertical') return 2
  return 0
}

/**
 * Temperature proxy scale from polytrope: T ∝ K ρ^{Γ−1}.
 * At ρ=ρ₀ reference, T_scale = K * ρ₀^{Γ−1} (relative to K=1,ρ=1,Γ=5/3).
 */
export function polyTemperatureScale(polyK: number, rho0: number, gamma: number): number {
  const g = Math.min(5 / 3, Math.max(4 / 3, gamma))
  const r = Math.max(rho0, 0.05)
  const t = polyK * Math.pow(r, g - 1)
  return Math.min(8, Math.max(0.15, t))
}

/**
 * Fishbone–Moncrief-ish dens peak radius from specific ℓ̃ (units of M).
 * r_peak / M ≈ ℓ̃² (Newtonian circular). Clamped to disk annulus.
 */
export function densPeakRadiusM(specificL: number, rinM: number, outerM: number): number {
  const r = specificL * specificL
  return Math.min(outerM * 0.85, Math.max(rinM * 1.05, r))
}

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
  const mriTurbScale = plasmaBetaToMriScale(d.plasmaBeta, d.magnetState)
  const p = 0.35 + 0.65 * d.perturbAmp
  return {
    armContrast: s * d.arms * p,
    turbContrast: s * d.clumps * mriTurbScale * p,
    dustContrast: s * d.dust,
    scaleHeight: d.scaleHeight,
    shearRate: d.animate ? d.shearRate : 0,
    animate: d.animate,
    mriTurbScale,
  }
}

function num(v: number | undefined, fallback: number): number {
  return Number.isFinite(v as number) ? (v as number) : fallback
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function parseMagGeom(v: unknown): MagGeometry {
  if (typeof v === 'string' && (MAG_GEOMS as readonly string[]).includes(v)) {
    return v as MagGeometry
  }
  return DEFAULT_DISK.magGeometry
}

function parseMagState(v: unknown): MagnetState {
  if (typeof v === 'string' && (MAG_STATES as readonly string[]).includes(v)) {
    return v as MagnetState
  }
  return DEFAULT_DISK.magnetState
}

/** SANE vs MAD class from plasma β₀ (info only). */
export function magnetClassFromBeta(plasmaBeta: number): MagnetState {
  return plasmaBeta < 10 ? 'mad' : 'sane'
}

/** Turbulence seed from β₀ (replaces free perturb control). */
export function perturbFromBeta(plasmaBeta: number): number {
  const mri = plasmaBetaToMriScale(plasmaBeta, magnetClassFromBeta(plasmaBeta))
  return Math.min(0.95, Math.max(0.2, 0.25 + 0.25 * mri))
}

/** Keplerian ℓ̃ ≈ √(r/M) at circular radius (thin-disk / Newtonian proxy). */
export function keplerSpecificL(rinOverM: number): number {
  return Math.sqrt(Math.max(rinOverM, 1.2))
}
