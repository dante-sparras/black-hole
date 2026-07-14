import { describe, expect, test } from 'bun:test'
import { deriveGeometry } from '../../src/physics/derive'
import { normalizeParams } from '../../src/physics/validate'

describe('deriveGeometry', () => {
  test('spin=0,Q=0 → schwarzschild', () => {
    const g = deriveGeometry(normalizeParams({ mass: 1, spinStar: 0, charge: 0 }))
    expect(g.family).toBe('schwarzschild')
    expect(g.rPlus).toBeCloseTo(2, 12)
  })

  test('spin≠0,Q=0 → kerr', () => {
    const g = deriveGeometry(normalizeParams({ mass: 1, spinStar: 0.5, charge: 0 }))
    expect(g.family).toBe('kerr')
  })

  test('Q≠0,spin=0 → reissner-nordstrom', () => {
    const g = deriveGeometry(normalizeParams({ mass: 1, spinStar: 0, charge: 0.2 }))
    expect(g.family).toBe('reissner-nordstrom')
  })

  test('Q≠0,spin≠0 → kerr-newman', () => {
    const g = deriveGeometry(normalizeParams({ mass: 1, spinStar: 0.3, charge: 0.2 }))
    expect(g.family).toBe('kerr-newman')
  })
})
