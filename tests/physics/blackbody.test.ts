import { describe, expect, test } from 'bun:test'
import {
  blackbodyIntensityScale,
  blackbodyRgb,
  blackbodyRgbFromTobs,
  DEFAULT_T_REF_K,
  isBlueDominated,
  isRedDominated,
  planckBLambdaRel,
  toobsToKelvin,
} from '../../src/physics/blackbody'
import { novikovThorneTemperature } from '../../src/physics/disk'

describe('planckBLambdaRel', () => {
  test('positive for optical wavelengths at 5000 K', () => {
    expect(planckBLambdaRel(550, 5000)).toBeGreaterThan(0)
  })

  test('hotter → more short-wave relative to long-wave', () => {
    const cool = planckBLambdaRel(440, 3000) / planckBLambdaRel(680, 3000)
    const hot = planckBLambdaRel(440, 15000) / planckBLambdaRel(680, 15000)
    expect(hot).toBeGreaterThan(cool)
  })
})

describe('blackbodyRgb', () => {
  test('cool gas is red-dominated', () => {
    const c = blackbodyRgb(2000)
    expect(isRedDominated(c)).toBe(true)
    expect(c.r).toBeCloseTo(1, 5)
  })

  test('hot gas is blue-dominated', () => {
    const c = blackbodyRgb(20_000)
    expect(isBlueDominated(c)).toBe(true)
    expect(c.b).toBeCloseTo(1, 5)
  })

  test('mid temperature is closer to white (channels comparable)', () => {
    const c = blackbodyRgb(6500)
    expect(c.r).toBeGreaterThan(0.5)
    expect(c.g).toBeGreaterThan(0.5)
    expect(c.b).toBeGreaterThan(0.35)
  })

  test('channels in [0,1]', () => {
    for (const T of [1000, 3000, 6500, 12000, 30000]) {
      const c = blackbodyRgb(T)
      expect(c.r).toBeGreaterThanOrEqual(0)
      expect(c.g).toBeGreaterThanOrEqual(0)
      expect(c.b).toBeGreaterThanOrEqual(0)
      expect(c.r).toBeLessThanOrEqual(1 + 1e-9)
      expect(c.g).toBeLessThanOrEqual(1 + 1e-9)
      expect(c.b).toBeLessThanOrEqual(1 + 1e-9)
    }
  })
})

describe('Tobs mapping (calibrated)', () => {
  test('DEFAULT_T_REF keeps typical cool Tobs red/orange', () => {
    // Approximate cool outer-disk Tobs at low ṁ (no g)
    const tCool = novikovThorneTemperature(18, 6, 1, 0, 0.015)
    const c = blackbodyRgbFromTobs(tCool)
    expect(c.r).toBeGreaterThan(c.b)
    expect(toobsToKelvin(tCool)).toBeLessThan(4500)
  })

  test('DEFAULT_T_REF keeps mid ṁ more orange/white than blue', () => {
    const tMid = novikovThorneTemperature(10, 6, 1, 0.5, 0.1)
    const c = blackbodyRgbFromTobs(tMid)
    // Should not be strongly blue-dominated at default ṁ
    expect(c.b).toBeLessThanOrEqual(c.r + 0.15)
    expect(toobsToKelvin(tMid)).toBeLessThan(8000)
  })

  test('high Tobs can still reach blue-white', () => {
    const c = blackbodyRgbFromTobs(4.0, DEFAULT_T_REF_K)
    expect(c.b).toBeGreaterThan(0.7)
  })

  test('low Tobs → red', () => {
    const c = blackbodyRgbFromTobs(0.4, DEFAULT_T_REF_K)
    expect(isRedDominated(c)).toBe(true)
  })
})

describe('intensity scale', () => {
  test('increases with temperature', () => {
    expect(blackbodyIntensityScale(5000)).toBeGreaterThan(
      blackbodyIntensityScale(2500),
    )
  })
})
