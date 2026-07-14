import { knGeometry } from './kn'
import { kerrGeometry } from './kerr'
import { schwarzschildGeometry } from './schwarzschild'
import type { BlackHoleParams, DerivedGeometry } from './types'

const EPS = 1e-12

/** Derive analytic geometry from no-hair parameters. */
export function deriveGeometry(params: BlackHoleParams): DerivedGeometry {
  const a = Math.abs(params.spinStar)
  const q = Math.abs(params.charge)

  if (q < EPS && a < EPS) {
    return schwarzschildGeometry(params.mass)
  }
  if (q < EPS) {
    return kerrGeometry(params)
  }
  return knGeometry(params)
}
