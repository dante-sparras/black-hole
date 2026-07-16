/**
 * Shadow / critical-curve diagnostics for HUD and science readout.
 *
 * Analytic closed forms (familyCriticalImpacts / familyPhotonSphere).
 * The rendered shadow is from the real-time integrator — not a painted b_c mask.
 * Geometric units G = c = 1.
 */

import {
  familyCriticalImpacts,
  familyPhotonSphere,
} from './criticalCurve'
import { knHorizon } from './kn'
import type { BlackHoleParams, DerivedGeometry } from './types'
import { spinLength } from './types'
import { diskIsco } from './disk'

export { rnCriticalImpact, rnPhotonSphere } from './criticalCurve'

export type ShadowDiagnostics = {
  /** Outer horizon r₊ */
  rPlus: number
  /** Photon-sphere / prograde circular-photon radius */
  rPhoton: number
  /** Prograde thin-disk ISCO (or counter if diagnostics called with diskCoRotating=false) */
  rIsco: number
  /** Critical impact b_c (prograde / co-rotating side) */
  bCritPro: number
  /** Critical impact b_c (retrograde side) */
  bCritRet: number
  /**
   * Approximate shadow diameter in the observer sky (impact-parameter space).
   * Schw: 2 · 3√3 M; Kerr: b_c^pro + b_c^ret (asymmetric silhouette).
   * Analytic estimate — image may differ slightly under the real-time force model.
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
 * Build diagnostics from live params (and optional precomputed geometry).
 * @param diskCoRotating — disk fluid L ‖ hole J (default true). Sets r_ISCO for disk HUD.
 */
export function shadowDiagnostics(
  params: BlackHoleParams,
  derived?: DerivedGeometry,
  diskCoRotating = true,
): ShadowDiagnostics {
  const M = params.mass
  const a = spinLength(params)
  const Q = params.charge

  const rPlus = derived?.rPlus ?? knHorizon(M, a, Q)
  // Prefer live disk ISCO (pro/retro sense); fall back to derived co-rotating
  const rIsco = diskIsco(params, diskCoRotating)
  const rPhoton = derived?.rPhotonSphere ?? familyPhotonSphere(params)
  const { prograde: bCritPro, retrograde: bCritRet } =
    familyCriticalImpacts(params)

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
