import type { DerivedGeometry } from './types'

/** Analytic Schwarzschild geometry (a = 0, Q = 0), G = c = 1. */
export function schwarzschildGeometry(mass: number): DerivedGeometry {
  const M = mass
  return {
    mass: M,
    spinStar: 0,
    spinLength: 0,
    charge: 0,
    family: 'schwarzschild',
    rPlus: 2 * M,
    rMinus: 0,
    rErgoEquator: 2 * M,
    rPhotonSphere: 3 * M,
    criticalImpact: 3 * Math.sqrt(3) * M,
    hasHorizon: true,
    extremalityDelta: M * M,
  }
}
