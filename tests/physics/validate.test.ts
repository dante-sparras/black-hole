import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_MDOT,
  MAX_SPIN_STAR,
  MDOT_MAX,
  MDOT_MIN,
} from '../../src/physics/constants'
import { isExtremalOk, normalizeParams } from '../../src/physics/validate'

describe('normalizeParams', () => {
  test('defaults to Schwarzschild unit mass + default ṁ', () => {
    const p = normalizeParams({})
    expect(p.mass).toBe(1)
    expect(p.spinStar).toBe(0)
    expect(p.charge).toBe(0)
    expect(p.mdot).toBe(DEFAULT_MDOT)
  })

  test('clamps spinStar to MAX_SPIN_STAR', () => {
    const p = normalizeParams({ mass: 1, spinStar: 2, charge: 0 })
    expect(p.spinStar).toBe(MAX_SPIN_STAR)
  })

  test('clamps charge so M² ≥ a² + Q²', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.9, charge: 0.8 })
    const a = p.spinStar * p.mass
    expect(p.mass * p.mass).toBeGreaterThanOrEqual(a * a + p.charge * p.charge - 1e-12)
  })

  test('rejects non-positive mass by clamping to epsilon', () => {
    const p = normalizeParams({ mass: 0, spinStar: 0, charge: 0 })
    expect(p.mass).toBeGreaterThan(0)
  })

  test('clamps ṁ to [MDOT_MIN, MDOT_MAX]', () => {
    expect(normalizeParams({ mdot: 1e-9 }).mdot).toBe(MDOT_MIN)
    expect(normalizeParams({ mdot: 100 }).mdot).toBe(MDOT_MAX)
    expect(normalizeParams({ mdot: 0.25 }).mdot).toBeCloseTo(0.25, 10)
  })
})

describe('isExtremalOk', () => {
  test('Schwarzschild ok', () => {
    expect(isExtremalOk({ mass: 1, spinStar: 0, charge: 0 })).toBe(true)
  })

  test('naked singularity not ok', () => {
    expect(isExtremalOk({ mass: 1, spinStar: 1.1, charge: 0 })).toBe(false)
  })
})
