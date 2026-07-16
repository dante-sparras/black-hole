/**
 * Effective disk geometry from free bases + BH state (thin-disk policy).
 */
import type { BlackHoleParams } from './types'
import { diskIsco } from './disk'
import { rIscoOverM } from './metricFamily'
import type { DiskParams } from './diskParams'
import { densPeakRadiusM, keplerSpecificL } from './diskParams'
import { horizonPlus } from './geometry'
import { spinLength } from './types'

export type EffectiveDiskGeom = {
  readonly rinOverM: number
  readonly rIn: number
  readonly iscoOverM: number
  readonly rPeakOverM: number
  readonly rPlusOverM: number
  readonly specificL: number
}

/**
 * Luminous inner edge = co-rotating ISCO, floored above ~1.05 r₊.
 */
export function effectiveDiskGeom(
  params: BlackHoleParams,
  disk: DiskParams,
): EffectiveDiskGeom {
  const M = Math.max(params.mass, 1e-12)
  const isco = diskIsco(params, true)
  const iscoOverM = rIscoOverM(isco, M)
  const a = spinLength(params)
  const rPlus = horizonPlus(M, a, params.charge)
  const rPlusOverM = Number.isFinite(rPlus) ? rPlus / M : 2
  const floor = Math.max(rPlusOverM * 1.05, 1.35)

  let rinOverM = Math.max(iscoOverM, floor)
  rinOverM = Math.min(rinOverM, disk.outerM - 0.5)

  const specificL = keplerSpecificL(rinOverM)
  const rPeakOverM = densPeakRadiusM(specificL, rinOverM, disk.outerM)

  return {
    rinOverM,
    rIn: rinOverM * M,
    iscoOverM,
    rPeakOverM,
    rPlusOverM,
    specificL,
  }
}
