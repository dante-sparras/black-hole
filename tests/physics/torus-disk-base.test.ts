import { describe, expect, test } from 'bun:test'
import { normalizeParams } from '../../src/physics/validate'
import {
  densPeakRadiusM,
  DISK_GAMMA,
  keplerSpecificL,
  magnetClassFromBeta,
  normalizeDisk,
  plasmaBetaToMriScale,
} from '../../src/physics/diskParams'
import { effectiveDiskGeom } from '../../src/physics/diskGeometry'
import { thinDiskScaleHeight } from '../../src/physics/disk'
import { jetEffectivePower } from '../../src/physics/jets'

describe('collapsed DiskParams + derived geometry', () => {
  test('normalize has no rinFree/prograde/gamma fields', () => {
    const d = normalizeDisk({})
    expect('rinFree' in d).toBe(false)
    expect('prograde' in d).toBe(false)
    expect('gamma' in d).toBe(false)
    expect('jetPower' in d).toBe(false)
    expect(d.jetBoost).toBe(0)
  })

  test('effective r_in is co-rot ISCO', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const d = normalizeDisk({})
    const g = effectiveDiskGeom(p, d)
    expect(g.rinOverM).toBeCloseTo(6, 3)
    expect(g.specificL).toBeCloseTo(Math.sqrt(6), 5)
  })

  test('H/r derived with DISK_GAMMA', () => {
    const h = thinDiskScaleHeight(0.1, 6, DISK_GAMMA)
    expect(h).toBeGreaterThan(0.02)
    expect(h).toBeLessThan(0.1)
  })

  test('ℓ̃ and dens peak', () => {
    expect(keplerSpecificL(6)).toBeCloseTo(Math.sqrt(6), 5)
    const r = densPeakRadiusM(4, 3, 40)
    expect(r).toBeGreaterThan(3)
    expect(r).toBeLessThan(40)
  })

  test('MAD class from low β', () => {
    expect(magnetClassFromBeta(1)).toBe('mad')
    expect(magnetClassFromBeta(100)).toBe('sane')
  })

  test('jet boost API', () => {
    expect(jetEffectivePower({ jetBoost: 0, spinStar: 0.9, mdot: 0.1 })).toBe(0)
    const hi = jetEffectivePower({ jetBoost: 1, spinStar: 0.95, mdot: 0.1 })
    const lo = jetEffectivePower({ jetBoost: 1, spinStar: 0.1, mdot: 0.1 })
    expect(hi).toBeGreaterThan(lo)
  })

  test('MRI scale from β', () => {
    expect(plasmaBetaToMriScale(1)).toBeGreaterThan(plasmaBetaToMriScale(100))
  })
})
