/**
 * Effective disk geometry from free bases + BH state.
 * Free r_in/M = luminous / zero-torque edge (floored above horizon).
 * Family ISCO is reference only — not forced for emission or T heating.
 */
import type { BlackHoleParams } from './types'
import { diskIsco } from './diskIsco'
import { rIscoOverM } from './metricFamily'
import type { DiskParams } from './diskParams'
import { densPeakRadiusM, keplerSpecificL } from './diskParams'
import { horizonPlus } from './geometry'
import { spinLength } from './types'

export type EffectiveDiskGeom = {
  /** Effective luminous inner edge / M (free, clamped) */
  readonly rinOverM: number
  readonly rIn: number
  /** Family co-rot ISCO / M (reference — not forced) */
  readonly iscoOverM: number
  readonly rPeakOverM: number
  readonly rPlusOverM: number
  /** ℓ̃ ≈ √(r_in/M) derived from free r_in */
  readonly specificL: number
}

/**
 * Luminous inner edge = free r_in/M, floored above ~1.05 r₊ and below r_out.
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

  let rinOverM = Math.max(disk.rinOverM, floor)
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
