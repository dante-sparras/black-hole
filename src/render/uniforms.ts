import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import type { DiskParams } from '../physics/diskParams'

/** CPU-side spacetime + disk snapshot uploaded when params change. */
export type SpacetimeUniforms = {
  mass: number
  spinStar: number
  spinLength: number
  charge: number
  mdot: number
  outerM: number
  rPlus: number
  rMinus: number
  rIsco: number
}

export function toUniforms(
  p: BlackHoleParams,
  d: DerivedGeometry,
  disk: DiskParams,
): SpacetimeUniforms {
  return {
    mass: p.mass,
    spinStar: p.spinStar,
    spinLength: d.spinLength,
    charge: p.charge,
    mdot: disk.mdot,
    outerM: disk.outerM,
    rPlus: d.rPlus,
    rMinus: d.rMinus,
    rIsco: d.rIsco,
  }
}
