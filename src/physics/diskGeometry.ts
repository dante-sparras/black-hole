/**
 * Effective disk geometry from free base params + BH state.
 * Pure TS — used by sceneBridge, HUD, tests.
 */
import type { BlackHoleParams } from './types'
import { diskIsco } from './disk'
import { rIscoOverM } from './metricFamily'
import type { DiskParams } from './diskParams'
import { densPeakRadiusM } from './diskParams'
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
 * Resolve luminous inner edge:
 * - rinFree=false → family ISCO (co/counter from disk.prograde)
 * - rinFree=true  → free rinM, floored above ~1.05 r₊
 */
export function effectiveDiskGeom(
  params: BlackHoleParams,
  disk: DiskParams,
): EffectiveDiskGeom {
  const M = Math.max(params.mass, 1e-12)
  const isco = diskIsco(params, disk.prograde)
  const iscoOverM = rIscoOverM(isco, M)
  const a = spinLength(params)
  const rPlus = horizonPlus(M, a, params.charge)
  const rPlusOverM = Number.isFinite(rPlus) ? rPlus / M : 2
  const floor = Math.max(rPlusOverM * 1.05, 1.35)

  let rinOverM: number
  if (disk.rinFree) {
    rinOverM = Math.max(disk.rinM, floor)
  } else {
    rinOverM = Math.max(iscoOverM, floor)
  }
  rinOverM = Math.min(rinOverM, disk.outerM - 0.5)

  const rPeakOverM = densPeakRadiusM(disk.specificL, rinOverM, disk.outerM)

  return {
    rinOverM,
    rIn: rinOverM * M,
    iscoOverM,
    rPeakOverM,
    rPlusOverM,
  }
}
