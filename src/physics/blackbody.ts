/**
 * Blackbody spectrum → linear RGB for thermal disk emission.
 *
 * Physics path (no film palette, no Tobs power-law hacks):
 *   1. Effective temperature T [K] from Novikov–Thorne + ṁ (see disk.ts)
 *   2. Observed T_obs ≈ g · T_rest (gravitational + Doppler)
 *   3. Planck B_λ at three optical wavelengths → chromaticity
 *   4. Intensity handled separately (∝ F · g³), not double-counted here
 */

/** Second radiation constant hc/k in nm·K */
export const PLANCK_C2_NM_K = 1.4387769e7

/** Representative wavelengths (nm) for simple B_λ RGB sampling */
export const LAMBDA_R_NM = 680
export const LAMBDA_G_NM = 550
export const LAMBDA_B_NM = 440

export type Rgb = { r: number; g: number; b: number }

/**
 * Spectral radiance ∝ B_λ(T) (relative).
 * B_λ ∝ λ⁻⁵ / (e^{c₂/(λT)} − 1)
 */
export function planckBLambdaRel(lambdaNm: number, tKelvin: number): number {
  if (!(lambdaNm > 0) || !(tKelvin > 0)) return 0
  const x = PLANCK_C2_NM_K / (lambdaNm * tKelvin)
  if (x > 80) return 0
  if (x < 1e-6) {
    return tKelvin / (lambdaNm * lambdaNm * lambdaNm * lambdaNm)
  }
  const denom = Math.expm1(x)
  if (!(denom > 0)) return 0
  const l2 = lambdaNm * lambdaNm
  const l5 = l2 * l2 * lambdaNm
  return 1 / (l5 * denom)
}

/** Clamp to a range where optical RGB sampling is defined. */
export function clampColorTemperatureK(tKelvin: number): number {
  if (!Number.isFinite(tKelvin) || tKelvin <= 0) return 800
  return Math.min(100_000, Math.max(800, tKelvin))
}

/**
 * Linear RGB chromaticity of a blackbody (max channel = 1).
 * Uses true Kelvin — no dimensionless stretch.
 */
export function blackbodyRgb(tKelvin: number): Rgb {
  const T = clampColorTemperatureK(tKelvin)
  const r = planckBLambdaRel(LAMBDA_R_NM, T)
  const g = planckBLambdaRel(LAMBDA_G_NM, T)
  const b = planckBLambdaRel(LAMBDA_B_NM, T)
  const m = Math.max(r, g, b, 1e-30)
  return { r: r / m, g: g / m, b: b / m }
}

/**
 * Optical-band relative brightness proxy: mean of unnormalized B_λ samples.
 * Prefer using NT flux for bolometric intensity; this is for tests only.
 */
export function blackbodyBandMean(tKelvin: number): number {
  const T = clampColorTemperatureK(tKelvin)
  const r = planckBLambdaRel(LAMBDA_R_NM, T)
  const g = planckBLambdaRel(LAMBDA_G_NM, T)
  const b = planckBLambdaRel(LAMBDA_B_NM, T)
  return (r + g + b) / 3
}

export function isRedDominated(rgb: Rgb): boolean {
  return rgb.r >= rgb.g && rgb.r >= rgb.b
}

export function isBlueDominated(rgb: Rgb): boolean {
  return rgb.b > rgb.r && rgb.b >= rgb.g
}
