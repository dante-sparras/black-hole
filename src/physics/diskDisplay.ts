/**
 * Display / eye curves on top of physical disk emission.
 * Compressive ṁ brightness, beam I∝g^n, auto exposure, log slider maps.
 * Uses DISK_EMISSION for CPU↔GPU lockstep floors and powers.
 */
import {
  DISK_EMISSION,
  T_PEAK_MDOT_REF,
  novikovThorneEfficiency,
} from './diskEmission'

/**
 * Auto tone-mapping exposure — human eye adapts to scene brightness.
 *
 * Proxy scene power ∝ η_NT · ṁ (disk luminosity scale).
 * High ṁ / high spin → lower exposure so the hole + ring stay readable
 * and disk keeps color instead of pure white.
 */
export function autoExposureFromPhysics(
  aStar: number,
  mdot: number,
  prograde = true,
): number {
  const eta = novikovThorneEfficiency(aStar, prograde)
  const power = eta * Math.max(mdot, 1e-4)
  const e = 1.0 / Math.sqrt(1 + 18 * power)
  return Math.min(1.2, Math.max(0.28, e))
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
 * Display brightness weight for ṁ (photopic / eye-like).
 *
 * Physical flux still scales ∝ ṁ in the NT F factor for relative T(r).
 * This map is compressive so super-Eddington ṁ does not explode HDR into white.
 * Low ṁ stays visible via base floor.
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
