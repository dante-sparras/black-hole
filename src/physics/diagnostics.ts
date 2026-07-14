/**
 * Shadow / critical-curve diagnostics for HUD and science readout.
 * Geometric units G = c = 1.
 */

import { criticalImpacts, photonSphereRadii } from './kerr'
import { knHorizon, rnPhotonSphere } from './kn'
import type { BlackHoleParams, DerivedGeometry } from './types'
import { spinLength } from './types'
import { diskIsco } from './disk'

export type ShadowDiagnostics = {
  /** Outer horizon r₊ */
  rPlus: number
  /** Photon-sphere / prograde circular-photon radius */
  rPhoton: number
  /** Prograde thin-disk ISCO */
  rIsco: number
  /** Critical impact b_c (prograde / co-rotating side) */
  bCritPro: number
  /** Critical impact b_c (retrograde side) */
  bCritRet: number
  /**
   * Approximate shadow diameter in the observer sky (impact-parameter space).
   * Schw: 2 · 3√3 M; Kerr: b_c^pro + b_c^ret (asymmetric silhouette).
   */
  shadowDiameter: number
  /** Mean shadow radius ≈ diameter/2 */
  shadowRadius: number
  /** r₊ / M, r_ph / M, r_ISCO / M, b_c^pro / M for scale-free compare */
  rPlusOverM: number
  rPhotonOverM: number
  rIscoOverM: number
  bCritProOverM: number
  bCritRetOverM: number
}

/**
 * RN critical impact (photon sphere → b_c = r_ph / √(f(r_ph)) for static).
 * f = 1 − 2M/r + Q²/r²; equatorial null circular.
 */
export function rnCriticalImpact(mass: number, charge: number): number {
  const M = mass
  const Q = charge
  const rph = rnPhotonSphere(M, Q)
  const f = 1 - (2 * M) / rph + (Q * Q) / (rph * rph)
  if (f <= 1e-12) return 3 * Math.sqrt(3) * M
  // b_c = L/E = r / √f for circular photon orbit in RN
  return rph / Math.sqrt(f)
}

/**
 * Build diagnostics from live params (and optional precomputed geometry).
 */
export function shadowDiagnostics(
  params: BlackHoleParams,
  derived?: DerivedGeometry,
): ShadowDiagnostics {
  const M = params.mass
  const a = spinLength(params)
  const Q = params.charge
  const aStar = params.spinStar
  const hasA = Math.abs(aStar) >= 1e-12
  const hasQ = Math.abs(Q) >= 1e-12

  const rPlus = derived?.rPlus ?? knHorizon(M, a, Q)
  const rIsco = derived?.rIsco ?? diskIsco(params)

  let rPhoton: number
  let bCritPro: number
  let bCritRet: number

  if (!hasA && !hasQ) {
    rPhoton = 3 * M
    bCritPro = 3 * Math.sqrt(3) * M
    bCritRet = bCritPro
  } else if (hasA && !hasQ) {
    const ph = photonSphereRadii(M, aStar)
    rPhoton = ph.prograde
    const b = criticalImpacts(M, aStar)
    bCritPro = b.prograde
    bCritRet = b.retrograde
  } else if (!hasA && hasQ) {
    rPhoton = rnPhotonSphere(M, Q)
    const b = rnCriticalImpact(M, Q)
    bCritPro = b
    bCritRet = b
  } else {
    // KN: Kerr critical curve with mild charge shrink
    const ph = photonSphereRadii(M, aStar)
    rPhoton = ph.prograde
    const b = criticalImpacts(M, aStar)
    const qhat = Math.min(Math.abs(Q) / Math.max(M, 1e-12), 0.99)
    const shrink = 1 - 0.15 * qhat * qhat
    bCritPro = b.prograde * shrink
    bCritRet = b.retrograde * shrink
  }

  const shadowDiameter = bCritPro + bCritRet
  const shadowRadius = 0.5 * shadowDiameter

  return {
    rPlus,
    rPhoton,
    rIsco,
    bCritPro,
    bCritRet,
    shadowDiameter,
    shadowRadius,
    rPlusOverM: rPlus / M,
    rPhotonOverM: rPhoton / M,
    rIscoOverM: rIsco / M,
    bCritProOverM: bCritPro / M,
    bCritRetOverM: bCritRet / M,
  }
}
