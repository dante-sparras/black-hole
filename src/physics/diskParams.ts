/**
 * Accretion disk parameters — NOT black-hole hair.
 *
 * Free (UI): ρ₀, H/r, Γ, β₀, r_in/M, r_out/M, tilt, jet strength
 * Derived: ṁ from free bases (normalizeDisk); ℓ̃ from r_in; MAD class, …
 * Model defaults (not free UI): structure, arms, clumps, dust, shear, animate
 *
 * No-hair = (M, a★, Q) only. G = c = 1.
 */
import { DEFAULT_MDOT, MDOT_MAX, MDOT_MIN } from './constants'
import { RT } from './geodesic/rtConstants'
import { DISK_TEXTURE } from './diskTexture'
import { clamp, finiteNumber } from './math'

/** Thin-disk / torus free bases + internal texture model (not free UI). */
export type DiskParams = {
  /** Eddington ratio ṁ = Ṁ/Ṁ_Edd — derived from free bases (not free UI). */
  readonly mdot: number
  /** Density normalization ρ₀ (relative dens / OD weight). */
  readonly rho0: number
  /** Free scale height H/r (aspect ratio). */
  readonly scaleHeight: number
  /** Adiabatic index Γ (EOS). */
  readonly gamma: number
  /** Plasma β₀ = p_gas/p_mag seed. */
  readonly plasmaBeta: number
  /** Free luminous inner edge / M (not forced to ISCO). */
  readonly rinOverM: number
  /** Outer disk radius in units of M. */
  readonly outerM: number
  /** Disk midplane tilt vs BH spin (rad). */
  readonly tiltRad: number
  /** Jet strength 0…1 (scales BZ-like funnel; 0 = off). */
  readonly jetBoost: number
  /** Texture master 0–1 (preset/model; not free UI). */
  readonly structure: number
  readonly arms: number
  readonly clumps: number
  readonly dust: number
  readonly shearRate: number
  readonly animate: boolean
}

export type MagnetClass = 'sane' | 'mad'

/** Default Γ (also fallback when callers omit gamma). */
export const DISK_GAMMA = 5 / 3

/** Default free r_in/M ≈ Schwarzschild ISCO. */
export const DEFAULT_RIN_OVER_M = 6

export const DEFAULT_DISK: DiskParams = {
  mdot: DEFAULT_MDOT,
  rho0: 1,
  scaleHeight: 0.06,
  gamma: DISK_GAMMA,
  plasmaBeta: 100,
  rinOverM: DEFAULT_RIN_OVER_M,
  outerM: RT.diskOuterM,
  tiltRad: 0,
  jetBoost: 0,
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
  scaleHeight: { min: 0.02, max: 0.2 },
  gamma: { min: 4 / 3, max: 5 / 3 },
  plasmaBeta: { min: 0.3, max: 1000 },
  rinOverM: { min: 1.35, max: 40 },
  outerM: { min: 8, max: 80 },
  tiltRad: { min: 0, max: (40 * Math.PI) / 180 },
  jetBoost: { min: 0, max: 1 },
  structure: { min: 0, max: 1 },
  arms: { min: 0, max: 1 },
  clumps: { min: 0, max: 1 },
  dust: { min: 0, max: 1 },
  shearRate: { min: 0, max: 4 },
} as const

export type DiskInput = Partial<DiskParams>

/**
 * Derive ṁ / ṁ_Edd from free disk bases (order-of-magnitude continuity proxy).
 *
 * Reference (defaults): ρ₀=1, H/r=0.06, Γ=5/3, β=100, r_in=6 → ṁ ≈ 0.1
 *
 * Scaling (soft for usable sliders):
 *   ṁ ∝ ρ₀^{0.6} · (H/r)² · (Γ_ref/Γ)^{0.4} · (β_ref/β)^{0.12} · (6/r_in)^{0.25}
 *
 * Physical intuition: denser + thicker + stronger MRI (low β) + smaller r_in
 * → higher effective accretion rate. Not a full SS solution — expert readout.
 */
export function deriveMdotFromBases(d: {
  rho0: number
  scaleHeight: number
  gamma: number
  plasmaBeta: number
  rinOverM: number
}): number {
  const rhoRef = 1
  const hRef = 0.06
  const gRef = 5 / 3
  const betaRef = 100
  const rinRef = 6
  const mdotRef = DEFAULT_MDOT

  const rho = Math.max(d.rho0, DISK_LIMITS.rho0.min)
  const h = Math.max(d.scaleHeight, DISK_LIMITS.scaleHeight.min)
  const g = clamp(d.gamma, DISK_LIMITS.gamma.min, DISK_LIMITS.gamma.max)
  const beta = Math.max(d.plasmaBeta, DISK_LIMITS.plasmaBeta.min)
  const rin = Math.max(d.rinOverM, DISK_LIMITS.rinOverM.min)

  const densFac = Math.pow(rho / rhoRef, 0.6)
  const hFac = Math.pow(h / hRef, 2)
  const gFac = Math.pow(gRef / g, 0.4)
  const betaFac = Math.pow(betaRef / beta, 0.12)
  const rinFac = Math.pow(rinRef / rin, 0.25)

  return clamp(mdotRef * densFac * hFac * gFac * betaFac * rinFac, MDOT_MIN, MDOT_MAX)
}

export function normalizeDisk(input: DiskInput = {}): DiskParams {
  const outerM = clamp(
    finiteNumber(input.outerM, DEFAULT_DISK.outerM),
    DISK_LIMITS.outerM.min,
    DISK_LIMITS.outerM.max,
  )
  // r_in must sit inside the annulus (leave room for outer edge)
  const rinMax = Math.min(DISK_LIMITS.rinOverM.max, outerM - 0.5)
  const rinOverM = clamp(
    finiteNumber(input.rinOverM, DEFAULT_DISK.rinOverM),
    DISK_LIMITS.rinOverM.min,
    Math.max(DISK_LIMITS.rinOverM.min, rinMax),
  )
  const rho0 = clamp(
    finiteNumber(input.rho0, DEFAULT_DISK.rho0),
    DISK_LIMITS.rho0.min,
    DISK_LIMITS.rho0.max,
  )
  const scaleHeight = clamp(
    finiteNumber(input.scaleHeight, DEFAULT_DISK.scaleHeight),
    DISK_LIMITS.scaleHeight.min,
    DISK_LIMITS.scaleHeight.max,
  )
  const gamma = clamp(
    finiteNumber(input.gamma, DEFAULT_DISK.gamma),
    DISK_LIMITS.gamma.min,
    DISK_LIMITS.gamma.max,
  )
  const plasmaBeta = clamp(
    finiteNumber(input.plasmaBeta, DEFAULT_DISK.plasmaBeta),
    DISK_LIMITS.plasmaBeta.min,
    DISK_LIMITS.plasmaBeta.max,
  )

  // Always derived — free bases own ṁ (ignore input.mdot)
  const mdot = deriveMdotFromBases({
    rho0,
    scaleHeight,
    gamma,
    plasmaBeta,
    rinOverM,
  })

  return {
    mdot,
    rho0,
    scaleHeight,
    gamma,
    plasmaBeta,
    rinOverM,
    outerM,
    tiltRad: clamp(
      finiteNumber(input.tiltRad, DEFAULT_DISK.tiltRad),
      DISK_LIMITS.tiltRad.min,
      DISK_LIMITS.tiltRad.max,
    ),
    jetBoost: clamp(
      finiteNumber(input.jetBoost, DEFAULT_DISK.jetBoost),
      DISK_LIMITS.jetBoost.min,
      DISK_LIMITS.jetBoost.max,
    ),
    structure: clamp(
      finiteNumber(input.structure, DEFAULT_DISK.structure),
      DISK_LIMITS.structure.min,
      DISK_LIMITS.structure.max,
    ),
    arms: clamp(
      finiteNumber(input.arms, DEFAULT_DISK.arms),
      DISK_LIMITS.arms.min,
      DISK_LIMITS.arms.max,
    ),
    clumps: clamp(
      finiteNumber(input.clumps, DEFAULT_DISK.clumps),
      DISK_LIMITS.clumps.min,
      DISK_LIMITS.clumps.max,
    ),
    dust: clamp(
      finiteNumber(input.dust, DEFAULT_DISK.dust),
      DISK_LIMITS.dust.min,
      DISK_LIMITS.dust.max,
    ),
    shearRate: clamp(
      finiteNumber(input.shearRate, DEFAULT_DISK.shearRate),
      DISK_LIMITS.shearRate.min,
      DISK_LIMITS.shearRate.max,
    ),
    animate: typeof input.animate === 'boolean' ? input.animate : DEFAULT_DISK.animate,
  }
}

/** SANE vs MAD class from plasma β₀ (derived). */
export function magnetClassFromBeta(plasmaBeta: number): MagnetClass {
  return plasmaBeta < 10 ? 'mad' : 'sane'
}

/**
 * MRI dens variance scale from β₀.
 * β=100 → ~1; lower β → higher turbulence (capped); MAD boosts further.
 */
export function plasmaBetaToMriScale(
  plasmaBeta: number,
  magnetClass: MagnetClass = magnetClassFromBeta(plasmaBeta),
): number {
  const b = Math.max(plasmaBeta, 0.2)
  const s = Math.sqrt(100 / b)
  const base = Math.min(2.8, Math.max(0.35, s))
  return magnetClass === 'mad' ? Math.min(3.2, base * 1.35) : base
}

/** Turbulence seed from β₀ (derived). */
export function perturbFromBeta(plasmaBeta: number): number {
  const mri = plasmaBetaToMriScale(plasmaBeta)
  return Math.min(0.95, Math.max(0.2, 0.25 + 0.25 * mri))
}

/** Keplerian ℓ̃ ≈ √(r/M) at circular radius (derived from free r_in). */
export function keplerSpecificL(rinOverM: number): number {
  return Math.sqrt(Math.max(rinOverM, 1.2))
}

/**
 * Dens peak radius / M from ℓ̃ (Newtonian circular proxy).
 * Clamped to disk annulus.
 */
export function densPeakRadiusM(specificL: number, rinM: number, outerM: number): number {
  const r = specificL * specificL
  return Math.min(outerM * 0.85, Math.max(rinM * 1.05, r))
}

/** Relative T scale from ρ₀ and free Γ (poly-like). */
export function rhoTemperatureScale(rho0: number, gamma: number = DISK_GAMMA): number {
  const r = Math.max(rho0, 0.05)
  const g = clamp(gamma, DISK_LIMITS.gamma.min, DISK_LIMITS.gamma.max)
  const t = Math.pow(r, g - 1)
  return Math.min(8, Math.max(0.15, t))
}

export function effectiveDiskStructure(d: DiskParams): {
  armContrast: number
  turbContrast: number
  dustContrast: number
  shearRate: number
  animate: boolean
  mriTurbScale: number
} {
  const s = d.structure
  const mriTurbScale = plasmaBetaToMriScale(d.plasmaBeta)
  const p = 0.35 + 0.65 * perturbFromBeta(d.plasmaBeta)
  return {
    armContrast: s * d.arms * p,
    turbContrast: s * d.clumps * mriTurbScale * p,
    dustContrast: s * d.dust,
    shearRate: d.animate ? d.shearRate : 0,
    animate: d.animate,
    mriTurbScale,
  }
}
