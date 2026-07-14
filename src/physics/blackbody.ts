/**
 * Blackbody spectrum → linear RGB (physics look, not film palette).
 * Uses Planck B_λ at three representative wavelengths, then max-normalizes
 * for chromaticity. Intensity is applied separately by the renderer.
 *
 * Temperature in Kelvin. Geometric-sim Tobs is mapped via T_K = Tobs · T_REF.
 */

/** Second radiation constant hc/k in nm·K */
export const PLANCK_C2_NM_K = 1.4387769e7

/** Default: dimensionless Tobs ≈ 1 → 12 000 K (blue-white AGN-ish) */
export const DEFAULT_T_REF_K = 12_000

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
  // underflow / overflow guards
  if (x > 80) return 0
  if (x < 1e-6) {
    // Rayleigh–Jeans: B ∝ T / λ⁴  (relative; drop constants)
    return tKelvin / (lambdaNm * lambdaNm * lambdaNm * lambdaNm)
  }
  const denom = Math.expm1(x) // e^x - 1
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
 * Cool → red; ~6500–8000 K → white; hot → blue-white.
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
 * Bolometric-style intensity scale ∝ T⁴ (Stefan–Boltzmann), relative.
 * Used so hotter gas is brighter as well as bluer.
 */
export function blackbodyIntensityScale(tKelvin: number, tPivotK = 8000): number {
  const T = clampColorTemperatureK(tKelvin)
  const p = Math.max(tPivotK, 1)
  const x = T / p
  return x * x * x * x
}
