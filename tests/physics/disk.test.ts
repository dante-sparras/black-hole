import { describe, expect, test } from 'bun:test'
import {
  diskIsco,
  mdotFluxScale,
  mdotFromSlider,
  mdotTemperatureScale,
  novikovThorneFluxFactor,
  novikovThornePeakRadius,
  novikovThorneTemperature,
  rnIsco,
  sliderFromMdot,
} from '../../src/physics/disk'
import { deriveGeometry } from '../../src/physics/derive'
import { normalizeParams } from '../../src/physics/validate'
import { MDOT_MAX, MDOT_MIN } from '../../src/physics/constants'

describe('diskIsco', () => {
  test('Schwarzschild is 6M', () => {
    expect(diskIsco({ mass: 1, spinStar: 0, charge: 0, mdot: 0.1 })).toBeCloseTo(6, 5)
  })

  test('Kerr prograde ISCO shrinks with spin', () => {
    const r0 = diskIsco({ mass: 1, spinStar: 0, charge: 0, mdot: 0.1 })
    const r9 = diskIsco({ mass: 1, spinStar: 0.9, charge: 0, mdot: 0.1 })
    expect(r9).toBeLessThan(r0)
    expect(r9).toBeGreaterThan(1.5)
  })

  test('RN ISCO between 4M and 6M', () => {
    const r = diskIsco({ mass: 1, spinStar: 0, charge: 0.7, mdot: 0.1 })
    expect(r).toBeLessThan(6)
    expect(r).toBeGreaterThan(4)
  })

  test('extremal RN limit approaches 4M', () => {
    expect(rnIsco(1, 0.999)).toBeLessThan(4.2)
    expect(rnIsco(1, 0.999)).toBeGreaterThan(4)
    expect(rnIsco(1, 0)).toBeCloseTo(6, 5)
  })

  test('KN floors above horizon', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.9, charge: 0.3 })
    const g = deriveGeometry(p)
    expect(g.rIsco).toBeGreaterThan(g.rPlus)
  })

  test('derived geometry carries rIsco', () => {
    const g = deriveGeometry(normalizeParams({ mass: 2, spinStar: 0, charge: 0 }))
    expect(g.rIsco).toBeCloseTo(12, 5)
  })
})

describe('Novikov–Thorne flux / temperature', () => {
  test('zero inside ISCO', () => {
    expect(novikovThorneFluxFactor(5, 6)).toBe(0)
    expect(novikovThorneTemperature(5, 6, 1)).toBe(0)
  })

  test('positive outside ISCO', () => {
    expect(novikovThorneFluxFactor(10, 6)).toBeGreaterThan(0)
    expect(novikovThorneTemperature(10, 6, 1)).toBeGreaterThan(0)
  })

  test('flux falls at large r', () => {
    const near = novikovThorneFluxFactor(10, 6)
    const far = novikovThorneFluxFactor(40, 6)
    expect(far).toBeLessThan(near)
  })

  test('peak radius is outside ISCO', () => {
    const rin = 6
    const peak = novikovThornePeakRadius(rin)
    expect(peak).toBeGreaterThan(rin)
    const fPeak = novikovThorneFluxFactor(peak, rin)
    const fNear = novikovThorneFluxFactor(rin * 1.05, rin)
    const fFar = novikovThorneFluxFactor(peak * 3, rin)
    expect(fPeak).toBeGreaterThan(fNear)
    expect(fPeak).toBeGreaterThan(fFar)
  })

  test('higher spin → hotter at fixed r (efficiency boost)', () => {
    const a = novikovThorneTemperature(12, 6, 1, 0, 0.1)
    const b = novikovThorneTemperature(12, 6, 1, 0.9, 0.1)
    expect(b).toBeGreaterThan(a)
  })

  test('T scales as ṁ^{1/4}', () => {
    const t01 = novikovThorneTemperature(12, 6, 1, 0, 0.1)
    const t1 = novikovThorneTemperature(12, 6, 1, 0, 1.0)
    // (1/0.1)^{1/4} = 10^{0.25} ≈ 1.778
    expect(t1 / t01).toBeCloseTo(Math.pow(10, 0.25), 3)
  })
})

describe('mdot scales', () => {
  test('temperature scale is ṁ^{1/4}', () => {
    expect(mdotTemperatureScale(1)).toBeCloseTo(1, 10)
    expect(mdotTemperatureScale(0.1)).toBeCloseTo(Math.pow(0.1, 0.25), 10)
    expect(mdotTemperatureScale(16)).toBeCloseTo(2, 10)
  })

  test('flux scale is ṁ', () => {
    expect(mdotFluxScale(0.25)).toBe(0.25)
  })
})

describe('log ṁ slider map', () => {
  test('round-trip endpoints', () => {
    expect(mdotFromSlider(0, MDOT_MIN, MDOT_MAX)).toBeCloseTo(MDOT_MIN, 8)
    expect(mdotFromSlider(1000, MDOT_MIN, MDOT_MAX)).toBeCloseTo(MDOT_MAX, 5)
  })

  test('round-trip mid values', () => {
    for (const m of [0.001, 0.01, 0.1, 1, 3]) {
      const back = mdotFromSlider(sliderFromMdot(m, MDOT_MIN, MDOT_MAX), MDOT_MIN, MDOT_MAX)
      expect(back).toBeCloseTo(m, 2)
    }
  })
})
