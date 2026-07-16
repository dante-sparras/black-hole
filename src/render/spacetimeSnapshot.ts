import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import type { DiskParams } from '../physics/diskParams'

/**
 * CPU-side spacetime + disk snapshot for tests / diagnostics / HUD tooling.
 *
 * Not the GPU upload path — the tracer uses SpacetimeTraceParams
 * (mass, spinStar, charge, mdot, rIscoOverM, outerM) via setSpacetime.
 * This shape keeps derived geometry (r±, r_ISCO absolute, spin length).
 */
export type SpacetimeSnapshot = {
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

export function toSpacetimeSnapshot(
  p: BlackHoleParams,
  d: DerivedGeometry,
  disk: DiskParams,
): SpacetimeSnapshot {
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
