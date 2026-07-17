import { describe, expect, test } from 'bun:test'
import {
  blackbodyRgb,
  isBlueDominated,
  isRedDominated,
} from '../../src/physics/blackbody'
import {
  densRestTemperatureK,
  diskPeakTemperatureK,
  novikovThornePeakRadius,
  observedTemperatureK,
  T_PEAK_REF_K,
} from '../../src/physics/disk'
import { colorRedshiftFactor } from '../../src/physics/diskDisplay'

describe('densRestTemperatureK (CPU mirror of dens BB path)', () => {
  test('peak near NT r_peak at ṁ=0.1, r_in=6M ≈ T_PEAK_REF', () => {
    const rin = 6
    const rPeak = novikovThornePeakRadius(rin)
    const T = densRestTemperatureK(rPeak, rin, 0.1, 1)
    expect(T).toBeCloseTo(T_PEAK_REF_K, 0)
  })

  test('T ∝ ṁ^{1/4} at fixed r', () => {
    const rin = 6
    const r = novikovThornePeakRadius(rin)
    const t1 = densRestTemperatureK(r, rin, 0.1, 1)
    const t2 = densRestTemperatureK(r, rin, 0.8, 1)
    expect(t2 / t1).toBeCloseTo(Math.pow(8, 0.25), 2)
  })

  test('outer cooler than peak', () => {
    const rin = 6
    const rPeak = novikovThornePeakRadius(rin)
    const tPeak = densRestTemperatureK(rPeak, rin, 0.1, 1)
    const tOuter = densRestTemperatureK(18, rin, 0.1, 1)
    expect(tOuter).toBeLessThan(tPeak)
    expect(tOuter).toBeGreaterThan(0)
  })

  test('zero inside free r_in', () => {
    expect(densRestTemperatureK(5, 6, 0.1, 1)).toBe(0)
  })

  test('smaller free r_in → hotter peak (edge heating)', () => {
    const tWide = diskPeakTemperatureK(0.1, 6, 0)
    const tTight = diskPeakTemperatureK(0.1, 2, 0)
    expect(tTight).toBeGreaterThan(tWide * 1.5)
  })

  test('cool ṁ outer redder chromaticity than hot peak', () => {
    const coolOuter = blackbodyRgb(densRestTemperatureK(18, 6, 0.03, 1))
    const hotPeak = blackbodyRgb(
      densRestTemperatureK(novikovThornePeakRadius(2), 2, 1.2, 1),
    )
    expect(coolOuter.r / Math.max(coolOuter.b, 1e-6)).toBeGreaterThan(
      hotPeak.r / Math.max(hotPeak.b, 1e-6),
    )
  })

  test('observed T scales with g (Wien)', () => {
    const tRest = densRestTemperatureK(novikovThornePeakRadius(6), 6, 0.1, 1)
    expect(observedTemperatureK(tRest, 1.5)).toBeCloseTo(tRest * 1.5, 5)
    expect(colorRedshiftFactor(1.5)).toBeCloseTo(1.5, 5)
  })

  test('hot peak is blue-dominated; cool outer red-dominated', () => {
    const hot = blackbodyRgb(
      densRestTemperatureK(novikovThornePeakRadius(2), 2, 1.5, 1),
    )
    const cool = blackbodyRgb(densRestTemperatureK(22, 6, 0.02, 1))
    expect(isBlueDominated(hot) || hot.b >= hot.r).toBe(true)
    expect(isRedDominated(cool) || cool.r >= cool.b).toBe(true)
  })
})
