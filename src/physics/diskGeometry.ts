/**
 * Effective disk geometry from free base params + BH state.
 * Pure TS — used by sceneBridge, HUD, tests.
 */
import type { BlackHoleParams } from './types'
import { diskIsco } from './disk'
import { rIscoOverM } from './metricFamily'
import type { DiskParams } from './diskParams'
import { densPeakRadiusM, keplerSpecificL } from './diskParams'
import { horizonPlus } from './geometry'
import { spinLength } from './types'

export type EffectiveDiskGeom = {
  /** Inner edge used for emission (units of M) */
  readonly rinOverM: number
  /** Absolute inner radius */
  readonly rIn: number
  /** Family ISCO / M (always reported) */
  readonly iscoOverM: number
  /** Dens peak cylindrical radius / M from ℓ̃ */
  readonly rPeakOverM: number
  /** Horizon outer / M */
  readonly rPlusOverM: number
}

/**
 * Resolve luminous inner edge (thin-disk policy):
 * always family ISCO (co/counter from disk.prograde), floored above ~1.05 r₊.
 * Free r_in is not a user control.
 */
export function effectiveDiskGeom(
  params: BlackHoleParams,
  disk: DiskParams,
): EffectiveDiskGeom {
  const M = Math.max(params.mass, 1e-12)
  const isco = diskIsco(params, true) // co-rotating ISCO; a★ sign handled in helpers
  const iscoOverM = rIscoOverM(isco, M)
  const a = spinLength(params)
  const rPlus = horizonPlus(M, a, params.charge)
  const rPlusOverM = Number.isFinite(rPlus) ? rPlus / M : 2
  const floor = Math.max(rPlusOverM * 1.05, 1.35)

  let rinOverM = Math.max(iscoOverM, floor)
  rinOverM = Math.min(rinOverM, disk.outerM - 0.5)

  const ell = keplerSpecificL(rinOverM)
  const rPeakOverM = densPeakRadiusM(ell, rinOverM, disk.outerM)

  return {
    rinOverM,
    rIn: rinOverM * M,
    iscoOverM,
    rPeakOverM,
    rPlusOverM,
  }
}
