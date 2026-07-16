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
 * Novikov–Thorne / zero-torque flux factor (Schwarzschild shape):
 *   F̃(r) = r⁻³ (1 − √(r_in / r))   for r > r_in
 * Prefer pageThorneFluxFactor for Kerr.
 */
export function novikovThorneFluxFactor(r: number, rIsco: number): number {
  if (!(r > rIsco) || rIsco <= 0) return 0
  const gap = 1 - Math.sqrt(rIsco / r)
  if (gap <= 0) return 0
  return gap / (r * r * r)
}

/**
 * Page–Thorne (1974) / Novikov–Thorne Kerr flux shape.
 * aStarSigned: +a★ prograde, −a★ retrograde (L sense vs hole spin).
 * Returns F̃(r) > 0 for r > r_ISCO; physical F ∝ ṁ · F̃.
 * a→0 reduces to the classic Schw factor.
 */
export function pageThorneFluxFactor(
  r: number,
  mass: number,
  aStarSigned: number,
  rIsco: number,
): number {
  const M = Math.max(mass, 1e-12)
  if (!(r > rIsco) || rIsco <= 0) return 0
  const a = Math.max(-0.998, Math.min(0.998, aStarSigned))
  if (Math.abs(a) < 1e-5) {
    return novikovThorneFluxFactor(r, rIsco)
  }

  const x = Math.sqrt(r / M)
  const x0 = Math.sqrt(rIsco / M)
  // Cubic roots (Page & Thorne)
  const th = Math.acos(Math.max(-1, Math.min(1, a)))
  const x1 = 2 * Math.cos((th - Math.PI) / 3)
  const x2 = 2 * Math.cos((th + Math.PI) / 3)
  const x3 = -2 * Math.cos(th / 3)

  const B = 1 + a / (x * x * x)
  const C = 1 - 3 / (x * x) + (2 * a) / (x * x * x)
  if (!(B > 0) || !(C > 0)) return 0

  const ln = (num: number, den: number): number => {
    if (!(num > 0) || !(den > 0)) return 0
    return Math.log(num / den)
  }

  const term = (xi: number, xj: number, xk: number): number => {
    const den = xi * (xi - xj) * (xi - xk)
    if (Math.abs(den) < 1e-14) return 0
    const argNum = x - xi
    const argDen = x0 - xi
    if (!(argNum * argDen > 0)) return 0 // same sign required for real log of ratio if both negative OK
    // Use abs carefully: Page–Thorne uses ln((x-xi)/(x0-xi))
    const ratio = argNum / argDen
    if (!(ratio > 0)) return 0
    return (3 * (xi - a) * (xi - a) * Math.log(ratio)) / den
  }

  const Q =
    x -
    x0 -
    1.5 * a * ln(x, x0) -
    term(x1, x2, x3) -
    term(x2, x1, x3) -
    term(x3, x1, x2)

  if (!(Q > 0)) return 0
  // F ∝ Q / (r³ B √C)  with r = M x²
  const shape = Q / (B * Math.sqrt(C))
  return shape / (r * r * r)
}

/**
 * Specific energy Ẽ of a circular equatorial Kerr geodesic (M = 1 units).
 * rOverM = r/M, aStar = a/M signed (+ prograde L, − retrograde L).
 * Bardeen / Page–Thorne.
 */
export function kerrCircularEnergy(rOverM: number, aStar: number): number {
  const r = Math.max(rOverM, 1.05)
  const a = Math.max(-0.998, Math.min(0.998, aStar))
  const s = Math.sqrt(r)
  // Ẽ = (r^{3/2} − 2 r^{1/2} + a) / ( r^{3/4} √(r^{3/2} − 3 r^{1/2} + 2a) )
  const num = r * s - 2 * s + a
  const denIn = r * s - 3 * s + 2 * a
  if (!(denIn > 1e-12) || !(num > 0)) return 1
  const den = Math.pow(r, 0.75) * Math.sqrt(denIn)
  return Math.max(0, Math.min(1, num / den))
}

/**
 * Novikov–Thorne radiative efficiency η = 1 − Ẽ_ISCO.
 * prograde = fluid L ‖ hole J. Schw → ~5.7%; near-extremal pro → ~42%.
 */
export function novikovThorneEfficiency(aStar: number, prograde = true): number {
  const aAbs = Math.min(0.998, Math.max(0, Math.abs(aStar)))
  const { coRotating, counterRotating } = coRotatingIscoRadii(1, aAbs)
  const rIscoM = prograde ? coRotating : counterRotating
  const aSigned = prograde ? aAbs : -aAbs
  const E = kerrCircularEnergy(rIscoM, aSigned)
  return Math.max(0, Math.min(0.42, 1 - E))
}

/**
 * Peak effective temperature [K] at the NT flux maximum (optical viz scale).
 *
 * T_PEAK_REF_K is an optical visualization reference (~9000 K), not the
 * keV-scale T_eff of a stellar-mass X-ray binary.
 *
 * Higher spin → smaller r_ISCO → hotter via T ∝ r_in^{-3/4} only.
 *
 * Reference: ṁ = 0.1, r_ISCO = 6M (Schw), a★ = 0 → T_peak = T_PEAK_REF_K.
 */
export const T_PEAK_REF_K = 9_000
export const T_PEAK_MDOT_REF = 0.1
/** Schwarzschild ISCO in units of M (reference for spin heating). */
export const R_ISCO_SCHW_OVER_M = 6

/**
 * Shared emission constants — CPU + GPU tracer lockstep.
 *
 * Physical structure first (NT shape, T∝ṁ^{1/4}, orbiting g, I∝g³).
 * Display floors only prevent pure numerical black — not film grade.
 */
export const DISK_EMISSION = {
  /** T ∝ (r_ISCO_Schw / r_ISCO)^{ISCO_HOT_POWER} — sole spin-heating channel */
  iscoHotPower: 0.75,
  /**
   * Extra η-style spin factor: keep 0 — r_ISCO heating already encodes spin.
   */
  spinEtaNudge: 0,
  /**
   * Observed color temperature ∝ g^{gColorExponent}.
   * Physical Wien shift uses ~1; slightly soft so high-spin faces stay readable.
   */
  gColorExponent: 1.0,
  gColorFloor: 0.12,
  /** Optical color temperature clamp [K] for max-norm chroma */
  tColorMinK: 1600,
  tColorMaxK: 48_000,
  beamExponent: 2.0,
  beamExponentIdeal: 3.0,
  beamFloor: 0.15,
  beamFloorIdeal: 0.1,
  /** fluxVis = fluxRel^{fluxVisPower} — 1 = true NT radial profile */
  fluxVisPower: 1.0,
  fluxVisFloor: 0.02,
  /** Overall HDR gain into ACES (not a fake fill of the shadow) */
  intensityGain: 1.75,
  /**
   * Brightness vs ṁ: closer to F∝ṁ (power→1) with mild base so low-ṁ not pure black.
   */
  mdotBrightBase: 0.12,
  mdotBrightScale: 1.15,
  mdotBrightPower: 0.85,
  mdotBrightFloor: 0.008,
  /** NT peak radius ≈ (49/36) r_in */
  ntPeakOverRin: 49 / 36,
} as const

/** Approx peak of simple NT flux: r ≈ (49/36) r_in (Schw). Prefer pageThornePeakRadius for Kerr. */
export function novikovThornePeakRadius(rIsco: number): number {
  return DISK_EMISSION.ntPeakOverRin * rIsco
}

/**
 * Radius of maximum Page–Thorne flux for Kerr (numeric search on F̃).
 * Falls back to Schw 49/36 rin when a→0.
 */
export function pageThornePeakRadius(
  rIsco: number,
  mass: number,
  aStarSigned: number,
): number {
  const M = Math.max(mass, 1e-12)
  if (!(rIsco > 0)) return novikovThornePeakRadius(Math.max(rIsco, 6 * M))
  if (Math.abs(aStarSigned) < 1e-5) {
    return novikovThornePeakRadius(rIsco)
  }
  let bestR = rIsco * 1.2
  let bestF = 0
  const rMax = Math.max(rIsco * 8, 40 * M)
  const n = 48
  for (let i = 1; i <= n; i++) {
    const t = i / n
    // denser samples near ISCO
    const r = rIsco * (1.02 + t * t * ((rMax / rIsco) - 1.02))
    const F = pageThorneFluxFactor(r, M, aStarSigned, rIsco)
    if (F > bestF) {
      bestF = F
      bestR = r
    }
  }
  return bestR
}

/**
 * α-disk midplane estimates (relative units for viz, not cgs tables).
 * Gas-pressure (low ṁ) vs radiation-pressure tendency (high ṁ).
 */
export function alphaDiskMidplane(
  mdot: number,
  rOverM: number,
  rIscoOverM: number,
): { TcRel: number; rhoRel: number; regime: 'gas' | 'rad' } {
  const m = Math.max(mdot, 1e-4)
  const x = Math.max(rOverM / Math.max(rIscoOverM, 1.2), 1)
  const regime: 'gas' | 'rad' = m > 0.35 ? 'rad' : 'gas'
  // Relative central T and dens (order-unity at r~few r_in, ṁ=0.1)
  const f = Math.max(0, 1 - Math.sqrt(1 / x))
  const TcRel =
    regime === 'gas'
      ? Math.pow(m / 0.1, 0.3) * Math.pow(x, -0.75) * Math.pow(f + 1e-4, 0.3)
      : Math.pow(m / 0.1, 0.2) * Math.pow(x, -0.375) * Math.pow(f + 1e-4, 0.2)
  const rhoRel =
    regime === 'gas'
      ? Math.pow(m / 0.1, 0.55) * Math.pow(x, -15 / 8) * Math.pow(f + 1e-4, 0.5)
      : Math.pow(m / 0.1, 0.4) * Math.pow(x, -3) * Math.pow(f + 1e-4, 0.4)
  return {
    TcRel: Math.min(3, Math.max(0.05, TcRel)),
    rhoRel: Math.min(4, Math.max(0.02, rhoRel)),
    regime,
  }
}

/**
 * Auto tone-mapping exposure from radiative power proxy η · ṁ.
 * Keeps ACES readable without a film exposure slider.
 */
export function autoExposureFromPhysics(
  aStar: number,
  mdot: number,
  prograde = true,
): number {
  const eta = novikovThorneEfficiency(aStar, prograde)
  const power = eta * Math.max(mdot, 1e-4)
  // Map power ~0.005..0.4 → exposure ~1.15..0.7
  const e = 1.05 - 0.35 * Math.log10(1 + 40 * power)
  return Math.min(1.35, Math.max(0.55, e))
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
 * Rest-frame effective temperature [K] from Page–Thorne / NT profile:
 *   T(r) = T_peak · (F̃(r) / F̃_peak)^{1/4}
 * Peak radius from true Kerr F_max when spinning.
 */
export function diskTemperatureK(
  r: number,
  rIsco: number,
  mdot: number,
  spinStar = 0,
  mass = 1,
  prograde = true,
): number {
  const a = prograde ? spinStar : -spinStar
  const F = pageThorneFluxFactor(r, mass, a, rIsco)
  if (F <= 0) return 0
  const rPeak = pageThornePeakRadius(rIsco, mass, a)
  const Fmax = pageThorneFluxFactor(rPeak, mass, a, rIsco)
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

/**
 * Thin-disk scale-height H/R from ṁ and r_ISCO/M (α-disk inspired).
 *
 * Gas-pressure branch (low ṁ): H/R ∼ ṁ^{1/8} · (r_in/6M)^{-1/5}
 * Radiation-pressure tendency (high ṁ): slightly thicker.
 * Clamped to thin-disk regime [0.03, 0.14].
 */
export function thinDiskScaleHeight(mdot: number, rIscoOverM: number): number {
  const m = Math.max(mdot, 1e-4)
  const rinM = Math.max(rIscoOverM, 1.2)
  // Gas-pressure base
  let h =
    0.052 *
    Math.pow(m / T_PEAK_MDOT_REF, 0.125) *
    Math.pow(R_ISCO_SCHW_OVER_M / rinM, 0.2)
  // Mild radiation-pressure thickening above ~0.3 ṁ_Edd
  if (m > 0.3) {
    h *= 1 + 0.25 * Math.log10(m / 0.3)
  }
  return Math.min(0.14, Math.max(0.03, h))
}

/**
 * Exact Kerr equatorial circular angular velocity Ω (geometric units).
 * Prograde: +√M/(r^{3/2}+a√M); retrograde: −√M/(r^{3/2}−a√M).
 */
export function kerrCircularOmega(
  r: number,
  mass: number,
  aStar: number,
  prograde = true,
): number {
  const M = Math.max(mass, 1e-12)
  const a = aStar * M
  const sqrtM = Math.sqrt(M)
  const r32 = Math.pow(Math.max(r, 1e-6), 1.5)
  if (prograde) {
    return sqrtM / (r32 + a * sqrtM + 1e-12)
  }
  const den = r32 - a * sqrtM
  return -sqrtM / (Math.abs(den) < 1e-12 ? 1e-12 : den)
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
