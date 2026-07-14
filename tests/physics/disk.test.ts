import { describe, expect, test } from 'bun:test'
import {
  diskIsco,
  novikovThorneFluxFactor,
  novikovThornePeakRadius,
  novikovThorneTemperature,
  rnIsco,
} from '../../src/physics/disk'
import { deriveGeometry } from '../../src/physics/derive'
import { normalizeParams } from '../../src/physics/validate'

describe('diskIsco', () => {
  test('Schwarzschild is 6M', () => {
    expect(diskIsco({ mass: 1, spinStar: 0, charge: 0 })).toBeCloseTo(6, 5)
  })

  test('Kerr prograde ISCO shrinks with spin', () => {
    const r0 = diskIsco({ mass: 1, spinStar: 0, charge: 0 })
    const r9 = diskIsco({ mass: 1, spinStar: 0.9, charge: 0 })
    expect(r9).toBeLessThan(r0)
    expect(r9).toBeGreaterThan(1.5)
  })

  test('RN ISCO between 4M and 6M', () => {
    const r = diskIsco({ mass: 1, spinStar: 0, charge: 0.7 })
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
    // flux at peak > flux farther out and > just outside ISCO
    const fPeak = novikovThorneFluxFactor(peak, rin)
    const fNear = novikovThorneFluxFactor(rin * 1.05, rin)
    const fFar = novikovThorneFluxFactor(peak * 3, rin)
    expect(fPeak).toBeGreaterThan(fNear)
    expect(fPeak).toBeGreaterThan(fFar)
  })

  test('higher spin → hotter at fixed r (efficiency boost)', () => {
    const rinK = diskIsco({ mass: 1, spinStar: 0.9, charge: 0 })
    const t0 = novikovThorneTemperature(12, 6, 1, 0)
    const t9 = novikovThorneTemperature(12, rinK, 1, 0.9)
    // Different rin; just check spin boost at same rin
    const a = novikovThorneTemperature(12, 6, 1, 0)
    const b = novikovThorneTemperature(12, 6, 1, 0.9)
    expect(b).toBeGreaterThan(a)
    expect(t9).toBeGreaterThan(0)
    expect(t0).toBeGreaterThan(0)
  })
})
