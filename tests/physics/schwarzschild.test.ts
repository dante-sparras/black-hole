import { describe, expect, test } from 'bun:test'
import { schwarzschildGeometry } from '../../src/physics/schwarzschild'

describe('schwarzschildGeometry', () => {
  test('unit mass', () => {
    const g = schwarzschildGeometry(1)
    expect(g.rPlus).toBeCloseTo(2, 12)
    expect(g.rMinus).toBe(0)
    expect(g.rPhotonSphere).toBeCloseTo(3, 12)
    expect(g.criticalImpact).toBeCloseTo(3 * Math.sqrt(3), 12)
    expect(g.family).toBe('schwarzschild')
  })

  test('scales with M', () => {
    const g = schwarzschildGeometry(2)
    expect(g.rPlus).toBeCloseTo(4, 12)
    expect(g.rPhotonSphere).toBeCloseTo(6, 12)
    expect(g.criticalImpact).toBeCloseTo(6 * Math.sqrt(3), 12)
  })
})
