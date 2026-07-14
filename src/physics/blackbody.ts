/**
 * Blackbody spectrum → linear RGB (physics look, not film palette).
 * Uses Planck B_λ at three representative wavelengths, then max-normalizes
 * for chromaticity. Intensity is applied separately by the renderer.
 *
 * Dimensionless sim temperature Tobs (order-unity from NT + g) maps via:
 *   T_K = clamp(Tobs · T_REF)
 *
 * T_REF is calibrated so typical disks span red → orange → white → blue-white
 * as ṁ / Tobs rise (not always blue).
 */

/** Second radiation constant hc/k in nm·K */
export const PLANCK_C2_NM_K = 1.4387769e7

/**
 * Kelvin per unit dimensionless Tobs.
 * NT Tobs is typically ~0.4–1.5 for ṁ~0.01–0.8; with T_REF=2800:
 *   cool ~1100–2000 K (red/orange), mid ~2500–4000 K, hot+Doppler → white/blue.
 */
export const DEFAULT_T_REF_K = 2800

/** Representative wavelengths (nm) for a simple RGB sampling of B_λ */
export const LAMBDA_R_NM = 680
export const LAMBDA_G_NM = 550
export const LAMBDA_B_NM = 440

export type Rgb = { r: number; g: number; b: number }

/**
 * Spectral radiance ∝ B_λ(T) (relative). Returns 0 for non-physical inputs.
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

/** Clamp Kelvin to a range where RGB sampling is meaningful. */
export function clampColorTemperatureK(tKelvin: number): number {
  if (!Number.isFinite(tKelvin) || tKelvin <= 0) return 1000
  return Math.min(40_000, Math.max(800, tKelvin))
}

/**
 * Map dimensionless observed temperature scale → Kelvin.
 * T_K = clamp(Tobs · T_ref)
 */
export function toobsToKelvin(tObs: number, tRefK = DEFAULT_T_REF_K): number {
  const t = Math.max(tObs, 0) * Math.max(tRefK, 1)
  return clampColorTemperatureK(t)
}

/**
 * Linear RGB chromaticity of a blackbody (max channel = 1).
 * Cool → red; ~5500–7000 K → white; hot → blue-white.
 */
export function blackbodyRgb(tKelvin: number): Rgb {
  const T = clampColorTemperatureK(tKelvin)
  const r = planckBLambdaRel(LAMBDA_R_NM, T)
  const g = planckBLambdaRel(LAMBDA_G_NM, T)
  const b = planckBLambdaRel(LAMBDA_B_NM, T)
  const m = Math.max(r, g, b, 1e-30)
  return { r: r / m, g: g / m, b: b / m }
}

/** Convenience: dimensionless Tobs → linear RGB chromaticity. */
export function blackbodyRgbFromTobs(tObs: number, tRefK = DEFAULT_T_REF_K): Rgb {
  return blackbodyRgb(toobsToKelvin(tObs, tRefK))
}

/**
 * Relative intensity scale. Uses soft power < 4 so cool gas stays visible
 * and hot gas doesn't force ACES into pure white.
 * Pivot ~3500 K ≈ orange-white mid disk.
 */
export function blackbodyIntensityScale(tKelvin: number, tPivotK = 3500): number {
  const T = clampColorTemperatureK(tKelvin)
  const p = Math.max(tPivotK, 1)
  const x = T / p
  // ≈ T^{2.5} — between Rayleigh–Jeans and Stefan–Boltzmann for viz balance
  return Math.pow(x, 2.5)
}

/** True if RGB is red-dominated (cool). */
export function isRedDominated(rgb: Rgb): boolean {
  return rgb.r >= rgb.g && rgb.r >= rgb.b
}

/** True if RGB is blue-dominated (hot). */
export function isBlueDominated(rgb: Rgb): boolean {
  return rgb.b > rgb.r && rgb.b >= rgb.g
}
