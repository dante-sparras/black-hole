import { describe, expect, test } from 'bun:test'
import {
  blackbodyIntensityScale,
  blackbodyRgb,
  blackbodyRgbFromTobs,
  isBlueDominated,
  isBlueish,
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
})

describe('Tobs power-law mapping spans red → blue', () => {
  test('cool low-ṁ NT is red/orange', () => {
    const tCool = novikovThorneTemperature(18, 6, 1, 0, 0.015)
    const c = blackbodyRgbFromTobs(tCool)
    expect(c.r).toBeGreaterThan(c.b)
    expect(toobsToKelvin(tCool)).toBeLessThan(4000)
  })

  test('default ṁ mid disk is orange/white not deep blue', () => {
    const tMid = novikovThorneTemperature(10, 6, 1, 0.5, 0.1)
    const TK = toobsToKelvin(tMid)
    expect(TK).toBeGreaterThan(3000)
    expect(TK).toBeLessThan(9000)
    const c = blackbodyRgb(TK)
    // not strongly blue-only
    expect(c.r).toBeGreaterThan(0.55)
  })

  test('high ṁ peak can reach blueish chromaticity', () => {
    const tHot = novikovThorneTemperature(8, 6, 1, 0.9, 0.8)
    // mild blueshift boost like Doppler approaching side
    const tObs = tHot * 1.35
    const c = blackbodyRgbFromTobs(tObs)
    expect(toobsToKelvin(tObs)).toBeGreaterThan(8000)
    expect(isBlueish(c) || c.b > c.r).toBe(true)
  })

  test('very low Tobs → red', () => {
    expect(isRedDominated(blackbodyRgbFromTobs(0.3))).toBe(true)
  })

  test('very high Tobs → blue', () => {
    expect(isBlueDominated(blackbodyRgbFromTobs(3.0))).toBe(true)
  })

  test('Kelvin increases with Tobs', () => {
    expect(toobsToKelvin(1.2)).toBeGreaterThan(toobsToKelvin(0.5))
  })
})

describe('intensity scale', () => {
  test('increases with temperature', () => {
    expect(blackbodyIntensityScale(8000)).toBeGreaterThan(
      blackbodyIntensityScale(3000),
    )
  })
})
