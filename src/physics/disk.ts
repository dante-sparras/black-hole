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

/** Approx peak of simple NT flux: r ≈ (49/36) r_in */
export function novikovThornePeakRadius(rIsco: number): number {
  return (49 / 36) * rIsco
}

/**
 * Peak effective temperature [K] at the NT flux maximum.
 *
 * Note on realism: true stellar-mass thin disks often peak at ~0.1–1 keV
 * (millions of K), so a pure optical blackbody would be blue-white almost
 * everywhere. For a multi-color disk *in optical-like color space* we set
 * T_peak so the radial profile spans the optical color locus (~few×10³–10⁴ K),
 * with T ∝ ṁ^{1/4} as in thin-disk theory.
 *
 * Reference: ṁ = 0.1, a★ = 0 → T_peak = T_PEAK_REF_K.
 */
export const T_PEAK_REF_K = 8_500
export const T_PEAK_MDOT_REF = 0.1

export function diskPeakTemperatureK(mdot: number, spinStar = 0): number {
  const m = Math.max(mdot, 1e-8)
  const spinFac = 1 + 0.25 * Math.max(0, Math.min(spinStar, 0.998))
  return (
    T_PEAK_REF_K *
    Math.pow(m / T_PEAK_MDOT_REF, 0.25) *
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
): number {
  const F = novikovThorneFluxFactor(r, rIsco)
  if (F <= 0) return 0
  const rPeak = novikovThornePeakRadius(rIsco)
  const Fmax = novikovThorneFluxFactor(rPeak, rIsco)
  if (!(Fmax > 0)) return 0
  const Tpeak = diskPeakTemperatureK(mdot, spinStar)
  return Tpeak * Math.pow(F / Fmax, 0.25)
}

/**
 * Observed color temperature after frequency shift g:
 *   T_obs ≈ g · T_rest  (thermal spectrum scaling)
 */
export function observedTemperatureK(tRestK: number, g: number): number {
  return Math.max(0, tRestK) * Math.max(g, 0)
}

/** Temperature scale from Eddington ratio: T ∝ ṁ^{1/4}. */
export function mdotTemperatureScale(mdot: number): number {
  const m = Math.max(mdot, 1e-8)
  return Math.pow(m, 0.25)
}

/**
 * Display brightness weight for ṁ (not pure linear — keeps cool chromaticity
 * visible under tone-mapping while still dimming at low accretion).
 * Physical bolometric F∝ṁ; this is the renderer’s optical presentation curve.
 */
export function mdotDisplayBrightness(mdot: number): number {
  const x = Math.max(mdot / 0.1, 0.008)
  return Math.pow(x, 0.42)
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
