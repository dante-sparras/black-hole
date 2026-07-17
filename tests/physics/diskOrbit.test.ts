import { describe, expect, test } from 'bun:test'
import { DEFAULT_DISK, DISK_LIMITS, normalizeDisk } from '../../src/physics/diskParams'

describe('disk params (expert free bases)', () => {
  test('defaults free bases', () => {
    const d = normalizeDisk({})
    expect(d.mdot).toBe(DEFAULT_DISK.mdot)
    expect(d.rho0).toBe(1)
    expect(d.scaleHeight).toBe(DEFAULT_DISK.scaleHeight)
    expect(d.gamma).toBe(DEFAULT_DISK.gamma)
    expect(d.rinOverM).toBe(6)
    expect(d.plasmaBeta).toBe(100)
    expect(d.jetBoost).toBe(0)
    expect(d.tiltRad).toBe(0)
  })

  test('clamps free bases', () => {
    const d = normalizeDisk({
      jetBoost: 5,
      rho0: 0.01,
      scaleHeight: 1,
      gamma: 3,
      rinOverM: 100,
      outerM: 20,
    })
    expect(d.jetBoost).toBe(1)
    expect(d.rho0).toBe(DISK_LIMITS.rho0.min)
    expect(d.scaleHeight).toBe(DISK_LIMITS.scaleHeight.max)
    expect(d.gamma).toBe(DISK_LIMITS.gamma.max)
    expect(d.rinOverM).toBeLessThan(d.outerM)
  })
})
