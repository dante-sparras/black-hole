import { knGeometry } from './kn'
import { kerrGeometry } from './kerr'
import { metricFamilyFromParams } from './metricFamily'
import { schwarzschildGeometry } from './schwarzschild'
import type { BlackHoleParams, DerivedGeometry } from './types'

/**
 * Derive analytic geometry from no-hair parameters.
 * Routing mirrors metricFamilyFromParams (schw → kerr → rn/kn).
 */
export function deriveGeometry(params: BlackHoleParams): DerivedGeometry {
  const family = metricFamilyFromParams(params)
  switch (family) {
    case 'schwarzschild':
      return schwarzschildGeometry(params.mass)
    case 'kerr':
      return kerrGeometry(params)
    case 'reissner-nordstrom':
    case 'kerr-newman':
      return knGeometry(params)
  }
}
