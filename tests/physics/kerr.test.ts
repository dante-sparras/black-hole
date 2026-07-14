import { describe, expect, test } from 'bun:test'
import { kerrGeometry, photonSphereRadii } from '../../src/physics/kerr'
import { normalizeParams } from '../../src/physics/validate'

describe('kerrGeometry', () => {
  test('a★=0 reduces to Schwarzschild family', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const g = kerrGeometry(p)
    expect(g.rPlus).toBeCloseTo(2, 10)
    expect(g.rMinus).toBeCloseTo(0, 10)
    expect(g.family).toBe('schwarzschild')
  })

  test('near-extremal a★=0.998 has r+ ≈ M', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.998, charge: 0 })
    const g = kerrGeometry(p)
    expect(g.rPlus).toBeGreaterThan(1)
    expect(g.rPlus).toBeLessThan(1.1)
    expect(g.rMinus).toBeLessThan(g.rPlus)
    expect(g.hasHorizon).toBe(true)
    expect(g.family).toBe('kerr')
  })

  test('prograde photon orbit decreases with spin', () => {
    const slow = photonSphereRadii(1, 0)
    const fast = photonSphereRadii(1, 0.9)
    expect(fast.prograde).toBeLessThan(slow.prograde)
    expect(fast.retrograde).toBeGreaterThan(slow.retrograde)
    expect(slow.prograde).toBeCloseTo(3, 10)
  })
})
