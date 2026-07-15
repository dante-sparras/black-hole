import { describe, expect, test } from 'bun:test'
import { DEFAULT_MASS, DEFAULT_SPIN_STAR, MASS_MIN, MAX_SPIN_STAR } from '../../src/physics/constants'
import { isExtremalOk, normalizeParams } from '../../src/physics/validate'
import { DEFAULT_DISK, DISK_LIMITS, normalizeDisk } from '../../src/physics/diskParams'

describe('normalizeParams (no-hair only)', () => {
  test('defaults to Schwarzschild unit mass', () => {
    const p = normalizeParams({})
    expect(p.mass).toBe(DEFAULT_MASS)
    expect(p.spinStar).toBe(DEFAULT_SPIN_STAR)
    expect(p.charge).toBe(0)
  })

  test('clamps spinStar to MAX_SPIN_STAR', () => {
    const p = normalizeParams({ spinStar: 2 })
    expect(p.spinStar).toBe(MAX_SPIN_STAR)
  })

  test('clamps charge so M² ≥ a² + Q²', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.9, charge: 10 })
    expect(isExtremalOk(p)).toBe(true)
    expect(Math.abs(p.charge)).toBeLessThanOrEqual(Math.sqrt(1 - 0.9 * 0.9) + 1e-9)
  })

  test('rejects non-positive mass by clamping to epsilon', () => {
    const p = normalizeParams({ mass: -1 })
    expect(p.mass).toBe(MASS_MIN)
  })
})

describe('isExtremalOk', () => {
  test('Schwarzschild ok', () => {
    expect(isExtremalOk({ mass: 1, spinStar: 0, charge: 0 })).toBe(true)
  })

  test('naked singularity not ok', () => {
    expect(isExtremalOk({ mass: 1, spinStar: 0.99, charge: 0.5 })).toBe(false)
  })
})

describe('normalizeDisk (not hair)', () => {
  test('defaults', () => {
    const d = normalizeDisk({})
    expect(d.mdot).toBe(DEFAULT_DISK.mdot)
    expect(d.outerM).toBe(DEFAULT_DISK.outerM)
  })

  test('clamps ṁ', () => {
    expect(normalizeDisk({ mdot: 1e-9 }).mdot).toBe(DISK_LIMITS.mdot.min)
    expect(normalizeDisk({ mdot: 99 }).mdot).toBe(DISK_LIMITS.mdot.max)
  })

  test('clamps outer radius', () => {
    expect(normalizeDisk({ outerM: 1 }).outerM).toBe(DISK_LIMITS.outerM.min)
    expect(normalizeDisk({ outerM: 500 }).outerM).toBe(DISK_LIMITS.outerM.max)
  })
})
