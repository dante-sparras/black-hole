import { describe, expect, test } from 'bun:test'
import {
  colorRedshiftFactor,
  diskIsco,
  DISK_EMISSION,
  mdotDisplayBrightness,
  mdotFluxScale,
  mdotFromSlider,
  mdotTemperatureScale,
  novikovThorneFluxFactor,
  novikovThornePeakRadius,
  novikovThorneTemperature,
  pageThorneFluxFactor,
  rnIsco,
  sliderFromMdot,
} from '../../src/physics/disk'
import { deriveGeometry } from '../../src/physics/derive'
import { normalizeParams } from '../../src/physics/validate'
import { MDOT_MAX, MDOT_MIN } from '../../src/physics/constants'

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

  test('Kerr counter-rotating ISCO grows with spin', () => {
    const rPro = diskIsco({ mass: 1, spinStar: 0.9, charge: 0 }, true)
    const rRet = diskIsco({ mass: 1, spinStar: 0.9, charge: 0 }, false)
    expect(rRet).toBeGreaterThan(rPro)
    expect(rRet).toBeGreaterThan(6)
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

  test('pageThorne a→0 matches Schw NT shape', () => {
    for (const r of [7, 10, 20, 40]) {
      const a0 = pageThorneFluxFactor(r, 1, 0, 6)
      const schw = novikovThorneFluxFactor(r, 6)
      expect(a0).toBeCloseTo(schw, 10)
    }
  })

  test('pageThorne Kerr is finite and positive outside ISCO', () => {
    const rIsco = diskIsco({ mass: 1, spinStar: 0.9, charge: 0 }, true)
    const F = pageThorneFluxFactor(rIsco * 1.5, 1, 0.9, rIsco)
    expect(F).toBeGreaterThan(0)
    expect(Number.isFinite(F)).toBe(true)
    expect(pageThorneFluxFactor(rIsco * 0.9, 1, 0.9, rIsco)).toBe(0)
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

  test('smaller r_ISCO → hotter peak (spin heating via ISCO only)', () => {
    // Physical channel: T ∝ r_in^{-3/4}. No extra spinEta nudge.
    const tSchw = novikovThorneTemperature(12, 6, 1, 0, 0.1)
    // Evaluate at the NT peak for a high-spin ISCO
    const rInKerr = 1.5
    const rPeak = novikovThornePeakRadius(rInKerr)
    const tKerr = novikovThorneTemperature(rPeak, rInKerr, 1, 0.9, 0.1)
    expect(tKerr).toBeGreaterThan(tSchw)
  })

  test('T scales as ṁ^{1/4}', () => {
    const t01 = novikovThorneTemperature(12, 6, 1, 0, 0.1)
    const t1 = novikovThorneTemperature(12, 6, 1, 0, 1.0)
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

  test('mdotDisplayBrightness rises with ṁ (near F∝ṁ)', () => {
    const a = mdotDisplayBrightness(0.001)
    const b = mdotDisplayBrightness(0.1)
    const c = mdotDisplayBrightness(1)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
    // Low ṁ still finite (ACES visibility floor), but not a huge soft floor
    expect(a).toBeGreaterThan(0.05)
    expect(a).toBeLessThan(0.5)
    expect(b / a).toBeGreaterThan(2)
  })

  test('DISK_EMISSION powers stay physical / display-honest', () => {
    expect(DISK_EMISSION.iscoHotPower).toBeCloseTo(0.75, 5)
    expect(DISK_EMISSION.spinEtaNudge).toBe(0)
    expect(DISK_EMISSION.beamExponent).toBeGreaterThanOrEqual(1.5)
    expect(DISK_EMISSION.beamExponent).toBeLessThanOrEqual(3)
    expect(DISK_EMISSION.beamExponentIdeal).toBe(3)
    expect(DISK_EMISSION.fluxVisPower).toBeGreaterThanOrEqual(0.8)
    expect(DISK_EMISSION.gColorExponent).toBeGreaterThanOrEqual(0.8)
    expect(DISK_EMISSION.mdotBrightPower).toBeGreaterThanOrEqual(0.7)
    expect(DISK_EMISSION.tColorMinK).toBeGreaterThanOrEqual(1000)
    expect(DISK_EMISSION.intensityGain).toBeGreaterThan(0)
  })

  test('colorRedshiftFactor tracks g (near-physical)', () => {
    const full = 0.5
    const soft = colorRedshiftFactor(full)
    // g^0.9 still < 1 for g<1, closer to full g than old g^0.45
    expect(soft).toBeGreaterThan(full)
    expect(soft).toBeLessThan(1)
    expect(soft).toBeLessThan(Math.pow(full, 0.45) + 0.01)
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
