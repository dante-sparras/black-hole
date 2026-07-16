/**
 * Thin accretion disk: ISCO by metric family + Novikov–Thorne-style emission.
 * Geometric units G = c = 1.
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

/**
 * Novikov–Thorne / zero-torque flux factor (shape only):
 *   F̃(r) = r⁻³ (1 − √(r_in / r))   for r > r_in
 * Physical flux F ∝ ṁ · F̃.
 */
export function novikovThorneFluxFactor(r: number, rIsco: number): number {
  if (!(r > rIsco) || rIsco <= 0) return 0
  const gap = 1 - Math.sqrt(rIsco / r)
  if (gap <= 0) return 0
  return gap / (r * r * r)
}

/**
 * Peak effective temperature [K] at the NT flux maximum (look-dev scale).
 *
 * T_PEAK_REF_K is an optical visualization reference (~9000 K), not the
 * keV-scale T_eff of a stellar-mass X-ray binary.
 *
 * Higher spin → smaller r_ISCO → hotter via T ∝ r_in^{-3/4} only
 * (no extra spinEta factor — that double-counted).
 *
 * Reference: ṁ = 0.1, r_ISCO = 6M (Schw), a★ = 0 → T_peak = T_PEAK_REF_K.
 */
export const T_PEAK_REF_K = 9_000
export const T_PEAK_MDOT_REF = 0.1
/** Schwarzschild ISCO in units of M (reference for spin heating). */
export const R_ISCO_SCHW_OVER_M = 6

/**
 * Shared emission/display constants — CPU + GPU tracer must stay in lockstep.
 * Do not hardcode these in geodesicTracer.ts.
 *
 * HONESTY: these are *optical display* curves for interactive GRRT, not SI
 * bolometric transfer. Physical structure (NT shape, T∝ṁ^{1/4}, orbiting g)
 * is preserved; exponents/floors are softened so cool disks stay visible and
 * high-spin faces are not wiped by full g³ + Wien cutoff.
 */
export const DISK_EMISSION = {
  /** T ∝ (r_ISCO_Schw / r_ISCO)^{ISCO_HOT_POWER} — sole spin-heating channel */
  iscoHotPower: 0.75,
  /**
   * Extra η-style spin factor: 1 + spinEtaNudge * a★.
   * Keep 0 — r_ISCO heating already encodes higher spin → hotter disk.
   * Non-zero re-introduces double-counting vs iscoHotPower.
   */
  spinEtaNudge: 0,
  /** Soft g exponent on color temperature (full g over-redshifts high spin) */
  gColorExponent: 0.45,
  gColorFloor: 0.35,
  /** Optical color temperature clamp [K] for max-norm chroma */
  tColorMinK: 1800,
  tColorMaxK: 45_000,
  /**
   * Doppler beam I ∝ g^{beamExponent}.
   * Default = soft display (2). Ideal bolometric GRRT uses 3 (toggle).
   */
  beamExponent: 2.0,
  /** Ideal invariant I_ν/ν³ → I ∝ g³ for bolometric-like display */
  beamExponentIdeal: 3.0,
  beamFloor: 0.4,
  /** Slightly lower floor when ideal g³ so dim side is not clipped as hard */
  beamFloorIdeal: 0.3,
  /** Soft radial flux for display: fluxVis = fluxRel^{fluxVisPower} */
  fluxVisPower: 0.5,
  fluxVisFloor: 0.2,
  /** Overall HDR gain into ACES */
  intensityGain: 2.2,
  /**
   * Display brightness: base + scale * (ṁ/0.1)^{power}
   * Soft curve keeps min-ṁ disks visible (not pure F∝ṁ).
   */
  mdotBrightBase: 0.4,
  mdotBrightScale: 1.2,
  mdotBrightPower: 0.35,
  mdotBrightFloor: 0.01,
  /** NT peak radius ≈ (49/36) r_in */
  ntPeakOverRin: 49 / 36,
} as const

/** Approx peak of simple NT flux: r ≈ (49/36) r_in */
export function novikovThornePeakRadius(rIsco: number): number {
  return DISK_EMISSION.ntPeakOverRin * rIsco
}

/**
 * Peak T [K] from ṁ and r_ISCO/M (and mild residual spin factor).
 * Dominant effect: iscoHot = (6 / (r_ISCO/M))^{3/4}
 */
export function diskPeakTemperatureK(
  mdot: number,
  rIscoOverM = R_ISCO_SCHW_OVER_M,
  spinStar = 0,
): number {
  const m = Math.max(mdot, 1e-8)
  const rinM = Math.max(rIscoOverM, 1.05)
  const { iscoHotPower, spinEtaNudge } = DISK_EMISSION
  const iscoHot = Math.pow(R_ISCO_SCHW_OVER_M / rinM, iscoHotPower)
  const spinFac = 1 + spinEtaNudge * Math.max(0, Math.min(spinStar, 0.998))
  return (
    T_PEAK_REF_K *
    Math.pow(m / T_PEAK_MDOT_REF, 0.25) *
    iscoHot *
    spinFac
  )
}

/**
 * Rest-frame effective temperature [K] from NT profile:
 *   T(r) = T_peak · (F̃(r) / F̃_peak)^{1/4}
 */
export function diskTemperatureK(
  r: number,
  rIsco: number,
  mdot: number,
  spinStar = 0,
  mass = 1,
): number {
  const F = novikovThorneFluxFactor(r, rIsco)
  if (F <= 0) return 0
  const rPeak = novikovThornePeakRadius(rIsco)
  const Fmax = novikovThorneFluxFactor(rPeak, rIsco)
  if (!(Fmax > 0)) return 0
  const rIscoOverM = rIsco / Math.max(mass, 1e-12)
  const Tpeak = diskPeakTemperatureK(mdot, rIscoOverM, spinStar)
  return Tpeak * Math.pow(F / Fmax, 0.25)
}

/**
 * Observed color temperature after frequency shift g:
 *   T_obs ≈ g · T_rest  (thermal spectrum scaling)
 */
export function observedTemperatureK(tRestK: number, g: number): number {
  return Math.max(0, tRestK) * Math.max(g, 0)
}

/** Soft g used for disk *color* (not full intensity beam). */
export function colorRedshiftFactor(g: number): number {
  const { gColorExponent, gColorFloor } = DISK_EMISSION
  return Math.pow(Math.max(g, gColorFloor), gColorExponent)
}

/**
 * Intensity beam power: display g² vs ideal bolometric g³.
 * Color path stays soft (colorRedshiftFactor) regardless.
 */
export function beamIntensityExponent(idealBolometric: boolean): number {
  return idealBolometric
    ? DISK_EMISSION.beamExponentIdeal
    : DISK_EMISSION.beamExponent
}

export function beamIntensityFloor(idealBolometric: boolean): number {
  return idealBolometric
    ? DISK_EMISSION.beamFloorIdeal
    : DISK_EMISSION.beamFloor
}

/** I ∝ g^n with mode-dependent n and floor. */
export function beamIntensity(g: number, idealBolometric = false): number {
  const floor = beamIntensityFloor(idealBolometric)
  const n = beamIntensityExponent(idealBolometric)
  return Math.pow(Math.max(g, floor), n)
}

/** Clamp T for optical chroma sampling (matches GPU). */
export function clampDiskColorTemperatureK(tKelvin: number): number {
  const { tColorMinK, tColorMaxK } = DISK_EMISSION
  if (!Number.isFinite(tKelvin)) return tColorMinK
  return Math.min(tColorMaxK, Math.max(tColorMinK, tKelvin))
}

/** Temperature scale from Eddington ratio: T ∝ ṁ^{1/4}. */
export function mdotTemperatureScale(mdot: number): number {
  const m = Math.max(mdot, 1e-8)
  return Math.pow(m, 0.25)
}

/**
 * Display brightness weight for ṁ.
 * Ensures min-slider disks stay visible (thick thermal surface) while
 * still brightening toward high ṁ. Not pure F∝ṁ (that + ACES → black).
 */
export function mdotDisplayBrightness(mdot: number): number {
  const {
    mdotBrightBase,
    mdotBrightScale,
    mdotBrightPower,
    mdotBrightFloor,
  } = DISK_EMISSION
  const x = Math.max(mdot / T_PEAK_MDOT_REF, mdotBrightFloor)
  return mdotBrightBase + mdotBrightScale * Math.pow(x, mdotBrightPower)
}

/** Flux / bolometric intensity scale: F ∝ ṁ. */
export function mdotFluxScale(mdot: number): number {
  return Math.max(mdot, 1e-8)
}

/** Log-space slider (0…1000) ↔ ṁ ∈ [mdotMin, mdotMax]. */
export function mdotFromSlider(
  t: number,
  mdotMin: number,
  mdotMax: number,
): number {
  const u = Math.min(1, Math.max(0, t / 1000))
  const logMin = Math.log10(mdotMin)
  const logMax = Math.log10(mdotMax)
  return 10 ** (logMin + u * (logMax - logMin))
}

export function sliderFromMdot(
  mdot: number,
  mdotMin: number,
  mdotMax: number,
): number {
  const m = Math.min(mdotMax, Math.max(mdotMin, mdot))
  const logMin = Math.log10(mdotMin)
  const logMax = Math.log10(mdotMax)
  const u = (Math.log10(m) - logMin) / (logMax - logMin)
  return Math.round(Math.min(1, Math.max(0, u)) * 1000)
}

/**
 * Relative NT temperature profile factor (T / T_peak), independent of ṁ scale.
 * Kept for tests / diagnostics.
 */
export function novikovThorneTemperature(
  r: number,
  rIsco: number,
  _mass: number,
  spinStar = 0,
  mdot = 0.1,
): number {
  // Return T / T_PEAK_REF so order-unity; use diskTemperatureK for Kelvin.
  const T = diskTemperatureK(r, rIsco, mdot, spinStar)
  return T / T_PEAK_REF_K
}
