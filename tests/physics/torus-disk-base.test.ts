import { describe, expect, test } from 'bun:test'
import { normalizeParams } from '../../src/physics/validate'
import {
  densPeakRadiusM,
  DISK_GAMMA,
  DEFAULT_DISK,
  keplerSpecificL,
  magnetClassFromBeta,
  normalizeDisk,
  plasmaBetaToMriScale,
  rhoTemperatureScale,
} from '../../src/physics/diskParams'
import { effectiveDiskGeom } from '../../src/physics/diskGeometry'
import { jetEffectivePower } from '../../src/physics/jets'

describe('expert free DiskParams + geometry', () => {
  test('defaults include free H/r, Γ, r_in', () => {
    const d = normalizeDisk({})
    expect(d.scaleHeight).toBe(DEFAULT_DISK.scaleHeight)
    expect(d.gamma).toBe(DISK_GAMMA)
    expect(d.rinOverM).toBe(6)
    expect(d.jetBoost).toBe(0)
    expect('prograde' in d).toBe(false)
  })

  test('effective r_in uses free base (floored above horizon)', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const d = normalizeDisk({ rinOverM: 8, outerM: 40 })
    const g = effectiveDiskGeom(p, d)
    expect(g.rinOverM).toBeCloseTo(8, 3)
    expect(g.iscoOverM).toBeCloseTo(6, 3)
    expect(g.specificL).toBeCloseTo(Math.sqrt(8), 5)
  })

  test('r_in floors above r₊ when set too low', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const d = normalizeDisk({ rinOverM: 1.4 })
    const g = effectiveDiskGeom(p, d)
    expect(g.rinOverM).toBeGreaterThanOrEqual(2 * 1.05 - 1e-6)
  })

  test('free H/r and Γ clamp', () => {
    const d = normalizeDisk({ scaleHeight: 9, gamma: 2, rinOverM: 100, outerM: 20 })
    expect(d.scaleHeight).toBeLessThanOrEqual(0.2)
    expect(d.gamma).toBeCloseTo(5 / 3, 5)
    expect(d.rinOverM).toBeLessThan(d.outerM)
  })

  test('ρ₀ T scale uses free Γ', () => {
    const soft = rhoTemperatureScale(2, 4 / 3)
    const stiff = rhoTemperatureScale(2, 5 / 3)
    expect(stiff).toBeGreaterThan(soft)
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

  test('jet strength API', () => {
    expect(jetEffectivePower({ jetBoost: 0, spinStar: 0.9, mdot: 0.1 })).toBe(0)
    const hi = jetEffectivePower({ jetBoost: 1, spinStar: 0.95, mdot: 0.1 })
    const lo = jetEffectivePower({ jetBoost: 1, spinStar: 0.1, mdot: 0.1 })
    expect(hi).toBeGreaterThan(lo)
  })

  test('MRI scale from β', () => {
    expect(plasmaBetaToMriScale(1)).toBeGreaterThan(plasmaBetaToMriScale(100))
  })
})
