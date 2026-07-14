import { describe, expect, test } from 'bun:test'
import {
  blackbodyIntensityScale,
  blackbodyRgb,
  blackbodyRgbFromTobs,
  DEFAULT_T_REF_K,
  planckBLambdaRel,
  toobsToKelvin,
} from '../../src/physics/blackbody'

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
    expect(c.r).toBeGreaterThan(c.g)
    expect(c.g).toBeGreaterThanOrEqual(c.b - 1e-9)
    expect(c.r).toBeCloseTo(1, 5) // max-normalized
  })

  test('hot gas is blue-dominated', () => {
    const c = blackbodyRgb(20_000)
    expect(c.b).toBeGreaterThan(c.r)
    expect(c.b).toBeCloseTo(1, 5)
  })

  test('mid temperature is closer to white (channels comparable)', () => {
    const c = blackbodyRgb(6500)
    // all channels reasonably high after normalize
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

describe('Tobs mapping', () => {
  test('toobsToKelvin scales with T_ref', () => {
    expect(toobsToKelvin(1, 12_000)).toBe(12_000)
    expect(toobsToKelvin(0.5, 12_000)).toBe(6000)
  })

  test('high Tobs → blue-white chromaticity', () => {
    const c = blackbodyRgbFromTobs(2.5, DEFAULT_T_REF_K)
    expect(c.b).toBeGreaterThan(c.r)
  })

  test('low Tobs → red', () => {
    const c = blackbodyRgbFromTobs(0.15, DEFAULT_T_REF_K)
    expect(c.r).toBeGreaterThan(c.b)
  })
})

describe('intensity scale', () => {
  test('scales as T⁴ relative to pivot', () => {
    expect(blackbodyIntensityScale(8000, 8000)).toBeCloseTo(1, 5)
    expect(blackbodyIntensityScale(16_000, 8000)).toBeCloseTo(16, 3)
  })
})
