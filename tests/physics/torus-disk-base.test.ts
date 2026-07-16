import { describe, expect, test } from 'bun:test'
import { normalizeParams } from '../../src/physics/validate'
import {
  densPeakRadiusM,
  normalizeDisk,
  plasmaBetaToMriScale,
  polyTemperatureScale,
} from '../../src/physics/diskParams'
import { effectiveDiskGeom } from '../../src/physics/diskGeometry'

describe('torus-style disk base params', () => {
  test('defaults include rho0, free H/r, Γ, K, ℓ, β, ISCO mode', () => {
    const d = normalizeDisk({})
    expect(d.rho0).toBe(1)
    expect(d.scaleHeight).toBeGreaterThan(0)
    expect(d.gamma).toBeCloseTo(5 / 3, 5)
    expect(d.polyK).toBe(1)
    expect(d.specificL).toBeCloseTo(Math.sqrt(6), 5)
    expect(d.plasmaBeta).toBe(100)
    expect(d.rinFree).toBe(false)
    expect(d.magGeometry).toBe('single-loop')
    expect(d.magnetState).toBe('sane')
  })

  test('effective geom uses ISCO when rinFree=false', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const d = normalizeDisk({ rinFree: false, rinM: 12 })
    const g = effectiveDiskGeom(p, d)
    expect(g.rinOverM).toBeCloseTo(6, 3)
    expect(g.iscoOverM).toBeCloseTo(6, 3)
  })

  test('effective geom uses free rin when enabled', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const d = normalizeDisk({ rinFree: true, rinM: 10 })
    const g = effectiveDiskGeom(p, d)
    expect(g.rinOverM).toBeCloseTo(10, 3)
  })

  test('free rin floors above horizon for high spin', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.98, charge: 0 })
    const d = normalizeDisk({ rinFree: true, rinM: 1.5 })
    const g = effectiveDiskGeom(p, d)
    expect(g.rinOverM).toBeGreaterThan(g.rPlusOverM)
  })

  test('ℓ̃ dens peak between rin and rout', () => {
    const r = densPeakRadiusM(4, 3, 40)
    expect(r).toBeGreaterThan(3)
    expect(r).toBeLessThan(40)
  })

  test('poly T scale rises with K and ρ₀', () => {
    const a = polyTemperatureScale(1, 1, 5 / 3)
    const b = polyTemperatureScale(2, 2, 5 / 3)
    expect(b).toBeGreaterThan(a)
  })

  test('MAD mri scale > SANE at same β', () => {
    expect(plasmaBetaToMriScale(10, 'mad')).toBeGreaterThan(
      plasmaBetaToMriScale(10, 'sane'),
    )
  })

  test('clamps H/r up to 0.3', () => {
    expect(normalizeDisk({ scaleHeight: 0.9 }).scaleHeight).toBe(0.3)
  })
})
