import { describe, expect, test } from 'bun:test'
import { DEFAULT_DISK, DISK_LIMITS, normalizeDisk } from '../../src/physics/diskParams'

describe('disk params (expert free bases)', () => {
  test('ṁ derived from free bases at defaults', () => {
    const d = normalizeDisk({})
    expect(d.mdot).toBeCloseTo(DEFAULT_DISK.mdot, 5)
  })

  test('ṁ rises with dens and H/r', () => {
    const { deriveMdotFromBases } = require('../../src/physics/diskParams') as typeof import('../../src/physics/diskParams')
    const lo = deriveMdotFromBases({
      rho0: 0.5,
      scaleHeight: 0.04,
      gamma: 5 / 3,
      plasmaBeta: 100,
      rinOverM: 6,
    })
    const hi = deriveMdotFromBases({
      rho0: 3,
      scaleHeight: 0.12,
      gamma: 5 / 3,
      plasmaBeta: 100,
      rinOverM: 6,
    })
    expect(hi).toBeGreaterThan(lo * 2)
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
