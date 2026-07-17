/**
 * Physical thin-disk emission: Page–Thorne / Novikov–Thorne flux, T(r),
 * efficiency, scale height, Kerr Ω. Shared DISK_EMISSION constants for CPU↔GPU.
 * Geometric units G = c = 1.
 */
import { coRotatingIscoRadii } from './kerr'

/**
 * Peak effective temperature [K] at the NT flux maximum (optical viz scale).
 *
 * Real XRBs peak in X-rays (keV); this is a multi-color optical display scale
 * so Cool→Default→Hot ladders red→white→blue-white at 60fps BB sampling.
 *
 * Physics shape (not film): T ∝ ṁ^{1/4} · (r_in/M)^{-3/4} · F̃(r)^{1/4}.
 *
 * Reference: ṁ = 0.1, r_ISCO = 6M (Schw), a★ = 0 → T_peak = T_PEAK_REF_K.
 */
export const T_PEAK_REF_K = 7_000
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
  gColorFloor: 0.1,
  /** Optical color temperature clamp [K] for max-norm chroma */
  tColorMinK: 1500,
  tColorMaxK: 52_000,
  beamExponent: 2.0,
  beamExponentIdeal: 3.0,
  beamFloor: 0.12,
  beamFloorIdeal: 0.08,
  /** fluxVis = fluxRel^{fluxVisPower} — 1 = true NT radial profile */
  fluxVisPower: 1.0,
  fluxVisFloor: 0.015,
  /**
   * Pre-tone intensity into HDR (before eye adaptation).
   * Keep moderate — high ṁ must not white-out; exposure + final tonemap carry range.
   */
  intensityGain: 1.25,
  /**
   * Display brightness vs ṁ (eye-like compressive, not pure F∝ṁ).
   */
  mdotBrightBase: 0.22,
  mdotBrightScale: 0.85,
  mdotBrightPower: 0.4,
  mdotBrightFloor: 0.006,
  eyeTonemapKnee: 0.38,
  sampleKnee: 0.28,
  mdotOpacityBoost: 0.9,
  mdotWeightCompress: 0.5,
  mdotPhotScale: 0.85,
  photMidSuppress: 0.65,
  structureBoostMdot: 0.5,
  outerDustCool: 0.3,
  /**
   * Film grade — MUST stay 0. Realism: pure blackbody chroma from T(r,ṁ).
   * Nonzero re-paints gold and freezes palette vs free bases / ṁ.
   */
  filmGrade: 0,
  /** Display emission scale */
  filmEmission: 1.0,
  filmBiasR: 0.04,
  filmBiasG: 0.035,
  filmBiasB: 0.025,
  /** Soft warm anchors (only used if filmGrade > 0) */
  filmWarmR: 0.95,
  filmWarmG: 0.71,
  filmWarmB: 0.44,
  filmMidR: 0.14,
  filmMidG: 0.05,
  filmMidB: 0.03,
  filmDarkR: 0.0,
  filmDarkG: 0.0,
  filmDarkB: 0.0,
  tonemapMid: 0.2,
  tonemapHigh: 0.5,
  tonemapSat: 1.15,
  ntPeakOverRin: 49 / 36,
} as const

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
    if (!(argNum * argDen > 0)) return 0
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
    const r = rIsco * (1.02 + t * t * (rMax / rIsco - 1.02))
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
 * Peak T [K] from ṁ and free emission-edge r_in/M (and mild residual spin factor).
 * Dominant: edgeHot = (6 / (r_in/M))^{3/4}.
 *
 * Policy: free r_in is the zero-torque / luminous edge for T and F̃.
 * Family Kerr ISCO is HUD reference only (not forced heating).
 */
export function diskPeakTemperatureK(
  mdot: number,
  rinOverM = R_ISCO_SCHW_OVER_M,
  spinStar = 0,
): number {
  const m = Math.max(mdot, 1e-8)
  const rinM = Math.max(rinOverM, 1.05)
  const { iscoHotPower, spinEtaNudge } = DISK_EMISSION
  const edgeHot = Math.pow(R_ISCO_SCHW_OVER_M / rinM, iscoHotPower)
  const spinFac = 1 + spinEtaNudge * Math.max(0, Math.min(spinStar, 0.998))
  return (
    T_PEAK_REF_K * Math.pow(m / T_PEAK_MDOT_REF, 0.25) * edgeHot * spinFac
  )
}

/**
 * Rest-frame effective temperature [K] from Page–Thorne / NT profile:
 *   T(r) = T_peak · (F̃(r) / F̃_peak)^{1/4}
 * Peak radius from true Kerr F_max when spinning.
 * rIsco here is the emission inner edge (free r_in), not forced family ISCO.
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
  const rinOverM = rIsco / Math.max(mass, 1e-12)
  const Tpeak = diskPeakTemperatureK(mdot, rinOverM, spinStar)
  return Tpeak * Math.pow(F / Fmax, 0.25)
}

/**
 * Dens-path rest T [K] — CPU mirror of singularityDisk (Schw NT F̃ shape).
 * Uses free r_in as zero-torque edge (same policy as GPU dens).
 */
export function densRestTemperatureK(
  r: number,
  rin: number,
  mdot: number,
  mass = 1,
): number {
  const F = novikovThorneFluxFactor(r, rin)
  if (F <= 0) return 0
  const rPeak = novikovThornePeakRadius(rin)
  const Fmax = novikovThorneFluxFactor(rPeak, rin)
  if (!(Fmax > 0)) return 0
  const rinOverM = rin / Math.max(mass, 1e-12)
  const Tpeak = diskPeakTemperatureK(mdot, rinOverM, 0)
  return Tpeak * Math.pow(F / Fmax, 0.25)
}

/**
 * Observed color temperature after frequency shift g:
 *   T_obs ≈ g · T_rest  (thermal spectrum scaling)
 * Matches DISK_EMISSION.gColorExponent via colorRedshiftFactor when soft.
 */
export function observedTemperatureK(tRestK: number, g: number): number {
  return Math.max(0, tRestK) * Math.max(g, 0)
}

/**
 * Thin-disk scale-height H/R from ṁ and r_ISCO/M (α-disk inspired).
 * Gas-pressure branch (low ṁ): H/R ∼ ṁ^{1/8} · (r_in/6M)^{-1/5}.
 * Radiation-pressure tendency (high ṁ): slightly thicker.
 * Γ (adiabatic index): stiffer EOS (higher Γ) → slightly thinner disk.
 * Clamped to thin-disk regime [0.03, 0.09].
 */
export function thinDiskScaleHeight(
  mdot: number,
  rIscoOverM: number,
  gamma = 5 / 3,
): number {
  const m = Math.max(mdot, 1e-4)
  const rinM = Math.max(rIscoOverM, 1.2)
  let h =
    0.052 *
    Math.pow(m / T_PEAK_MDOT_REF, 0.125) *
    Math.pow(R_ISCO_SCHW_OVER_M / rinM, 0.2)
  // Mild radiation-pressure thickening above ~0.3 ṁ_Edd
  // Keep weak — large H + volume RT → polar hourglass at high ṁ (Hot preset)
  if (m > 0.3) {
    h *= 1 + 0.12 * Math.log10(m / 0.3)
  }
  const g = Math.min(5 / 3, Math.max(4 / 3, gamma))
  h *= Math.pow(5 / 3 / g, 0.45)
  return Math.min(0.09, Math.max(0.03, h))
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
  const T = diskTemperatureK(r, rIsco, mdot, spinStar)
  return T / T_PEAK_REF_K
}
