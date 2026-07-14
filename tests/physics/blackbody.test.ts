import { describe, expect, test } from 'bun:test'
import {
  blackbodyRgb,
  isBlueDominated,
  isRedDominated,
  planckBLambdaRel,
} from '../../src/physics/blackbody'
import {
  diskPeakTemperatureK,
  diskTemperatureK,
  novikovThorneFluxFactor,
  novikovThornePeakRadius,
  observedTemperatureK,
  T_PEAK_REF_K,
} from '../../src/physics/disk'

describe('planckBLambdaRel', () => {
  test('positive at 5000 K optical', () => {
    expect(planckBLambdaRel(550, 5000)).toBeGreaterThan(0)
  })

  test('hotter spectrum is bluer', () => {
    const cool = planckBLambdaRel(440, 3000) / planckBLambdaRel(680, 3000)
    const hot = planckBLambdaRel(440, 15000) / planckBLambdaRel(680, 15000)
    expect(hot).toBeGreaterThan(cool)
  })
})

describe('blackbodyRgb (true Kelvin)', () => {
  test('2000 K is red-dominated', () => {
    expect(isRedDominated(blackbodyRgb(2000))).toBe(true)
  })

  test('20000 K is blue-dominated', () => {
    expect(isBlueDominated(blackbodyRgb(20000))).toBe(true)
  })
})

describe('diskTemperatureK (physical NT path)', () => {
  test('peak T at ṁ=0.1, a★=0 is T_PEAK_REF', () => {
    const rIsco = 6
    const rPeak = novikovThornePeakRadius(rIsco)
    const T = diskTemperatureK(rPeak, rIsco, 0.1, 0)
    expect(T).toBeCloseTo(T_PEAK_REF_K, 0)
  })

  test('T ∝ ṁ^{1/4}', () => {
    const rIsco = 6
    const rPeak = novikovThornePeakRadius(rIsco)
    const t1 = diskTemperatureK(rPeak, rIsco, 0.1, 0)
    const t2 = diskTemperatureK(rPeak, rIsco, 0.8, 0)
    expect(t2 / t1).toBeCloseTo(Math.pow(8, 0.25), 2)
  })

  test('outer disk cooler than peak', () => {
    const rIsco = 6
    const rPeak = novikovThornePeakRadius(rIsco)
    const tPeak = diskTemperatureK(rPeak, rIsco, 0.1, 0)
    const tOuter = diskTemperatureK(18, rIsco, 0.1, 0)
    expect(tOuter).toBeLessThan(tPeak)
    expect(tOuter).toBeGreaterThan(0)
  })

  test('cool ṁ outer → redder chromaticity than hot peak', () => {
    const coolOuter = blackbodyRgb(diskTemperatureK(18, 6, 0.03, 0))
    const hotPeak = blackbodyRgb(
      diskTemperatureK(novikovThornePeakRadius(6), 6, 0.8, 0.9),
    )
    expect(coolOuter.r / Math.max(coolOuter.b, 1e-6)).toBeGreaterThan(
      hotPeak.r / Math.max(hotPeak.b, 1e-6),
    )
  })

  test('flux factor peaks near 49/36 r_in', () => {
    const rIsco = 6
    const rPeak = novikovThornePeakRadius(rIsco)
    const Fpeak = novikovThorneFluxFactor(rPeak, rIsco)
    const Fnear = novikovThorneFluxFactor(rPeak * 1.15, rIsco)
    expect(Fpeak).toBeGreaterThan(Fnear)
  })

  test('observed T scales with g', () => {
    expect(observedTemperatureK(10000, 1.5)).toBeCloseTo(15000, 5)
  })

  test('diskPeakTemperatureK higher at small r_ISCO (high spin)', () => {
    const schw = diskPeakTemperatureK(0.1, 6, 0)
    const kerr = diskPeakTemperatureK(0.1, 1.5, 0.998)
    expect(kerr).toBeGreaterThan(schw * 1.5)
  })

  test('fixed ṁ: extremal Kerr peak hotter than Schwarzschild', () => {
    // r_ISCO(a★=0)=6M; near-extremal prograde ~1.2–1.5M
    const tSchw = diskTemperatureK(novikovThornePeakRadius(6), 6, 0.1, 0, 1)
    const rIscoK = 1.45
    const tKerr = diskTemperatureK(
      novikovThornePeakRadius(rIscoK),
      rIscoK,
      0.1,
      0.998,
      1,
    )
    expect(tKerr).toBeGreaterThan(tSchw)
  })
})
