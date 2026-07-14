/**
 * Blackbody spectrum → linear RGB (physics look, not film palette).
 * Uses Planck B_λ at three representative wavelengths, then max-normalizes
 * for chromaticity. Intensity is applied separately by the renderer.
 *
 * Dimensionless sim Tobs (order-unity from NT + g) is mapped with a
 * power-law stretch so the limited NT dynamic range still spans
 * red → orange → white → blue-white as ṁ / Doppler rise.
 */

/** Second radiation constant hc/k in nm·K */
export const PLANCK_C2_NM_K = 1.4387769e7

/**
 * Pivot for Tobs → Kelvin power-law:
 *   T_K = T_PIVOT_K · (Tobs / T_PIVOT_OBS)^GAMMA
 * Typical mid-disk default-ṁ Tobs ≈ 0.7–0.9 → orange-white.
 * Gamma > 1 stretches the hot end into blue-white.
 */
export const T_PIVOT_OBS = 0.75
export const T_PIVOT_K = 4500
export const T_OBS_GAMMA = 1.75

/** @deprecated use power-law pivots; kept as approx mid-scale for docs/tests */
export const DEFAULT_T_REF_K = T_PIVOT_K / T_PIVOT_OBS

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
 * Map dimensionless observed temperature → Kelvin (power-law stretch).
 * Cool NT → red/orange; high ṁ + blueshift → white/blue-white.
 */
export function toobsToKelvin(
  tObs: number,
  tPivotObs = T_PIVOT_OBS,
  tPivotK = T_PIVOT_K,
  gamma = T_OBS_GAMMA,
): number {
  const t = Math.max(tObs, 1e-8)
  const pObs = Math.max(tPivotObs, 1e-8)
  const pK = Math.max(tPivotK, 1)
  const g = Math.max(gamma, 0.1)
  const TK = pK * (t / pObs) ** g
  return clampColorTemperatureK(TK)
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
export function blackbodyRgbFromTobs(tObs: number): Rgb {
  return blackbodyRgb(toobsToKelvin(tObs))
}

/**
 * Relative intensity. Soft power so cool gas stays visible and hot
 * doesn't force ACES into pure desaturated white (which kills blue).
 */
export function blackbodyIntensityScale(tKelvin: number, tPivotK = 4500): number {
  const T = clampColorTemperatureK(tKelvin)
  const p = Math.max(tPivotK, 1)
  const x = T / p
  return Math.pow(x, 2.2)
}

/** True if RGB is red-dominated (cool). */
export function isRedDominated(rgb: Rgb): boolean {
  return rgb.r >= rgb.g && rgb.r >= rgb.b
}

/** True if blue is the strongest channel (hot). */
export function isBlueDominated(rgb: Rgb): boolean {
  return rgb.b > rgb.r && rgb.b >= rgb.g
}

/** True if clearly blue-white (blue high, not red). */
export function isBlueish(rgb: Rgb): boolean {
  return rgb.b > 0.85 && rgb.b > rgb.r
}
