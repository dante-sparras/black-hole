import type { BlackHoleParams, DerivedGeometry } from '../physics/types'

/** CPU-side spacetime snapshot uploaded when params change. */
export type SpacetimeUniforms = {
  mass: number
  spinStar: number
  spinLength: number
  charge: number
  rPlus: number
  rMinus: number
}

export function toUniforms(p: BlackHoleParams, d: DerivedGeometry): SpacetimeUniforms {
  return {
    mass: p.mass,
    spinStar: p.spinStar,
    spinLength: d.spinLength,
    charge: p.charge,
    rPlus: d.rPlus,
    rMinus: d.rMinus,
  }
}
