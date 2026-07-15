import { describe, expect, test } from 'bun:test'
import {
  metricFamilyFromParams,
  realtimeModeTag,
  rIscoOverM,
} from '../../src/physics/metricFamily'
import { equatorialErgosphere } from '../../src/physics/geometry'
import { coRotatingIscoRadii, iscoRadii } from '../../src/physics/kerr'
import { diskIsco } from '../../src/physics/disk'
import {
  getGeodesicIntegrator,
  setGeodesicIntegrator,
} from '../../src/state/geodesic'
import { getScene, setScene } from '../../src/state/scene'

describe('metricFamily', () => {
  test('routes four families', () => {
    expect(metricFamilyFromParams({ spinStar: 0, charge: 0 })).toBe(
      'schwarzschild',
    )
    expect(metricFamilyFromParams({ spinStar: 0.5, charge: 0 })).toBe('kerr')
    expect(metricFamilyFromParams({ spinStar: 0, charge: 0.3 })).toBe(
      'reissner-nordstrom',
    )
    expect(metricFamilyFromParams({ spinStar: 0.5, charge: 0.2 })).toBe(
      'kerr-newman',
    )
  })

  test('realtime mode tags RT / BL / approx', () => {
    expect(realtimeModeTag({ spinStar: 0, charge: 0 })).toBe('schw-RT')
    expect(realtimeModeTag({ spinStar: 0.9, charge: 0 })).toBe('kerr-RT~')
    expect(realtimeModeTag({ spinStar: 0, charge: 0.5 })).toBe('rn-RT')
    expect(realtimeModeTag({ spinStar: 0.7, charge: 0.2 })).toBe('kn-RT~')
    expect(realtimeModeTag({ spinStar: 0, charge: 0 }, 'bl')).toBe('schw-BL')
    expect(realtimeModeTag({ spinStar: 0.9, charge: 0 }, 'bl')).toBe('kerr-BL')
    expect(realtimeModeTag({ spinStar: 0, charge: 0.5 }, 'bl')).toBe('rn-BL~')
    expect(realtimeModeTag({ spinStar: 0.7, charge: 0.2 }, 'bl')).toBe('kn-BL~')
  })

  test('rIscoOverM normalizes by mass', () => {
    expect(rIscoOverM(6, 1)).toBeCloseTo(6, 10)
    expect(rIscoOverM(12, 2)).toBeCloseTo(6, 10)
  })
})

describe('ergosphere + signed spin', () => {
  test('equatorial ergosphere: Kerr 2M, RN = r₊', () => {
    expect(equatorialErgosphere(1, 0)).toBeCloseTo(2, 10)
    // RN Q=0.6: r₊ = 1+√(1-0.36)=1+√0.64=1.8
    expect(equatorialErgosphere(1, 0.6)).toBeCloseTo(1.8, 10)
  })

  test('co-rotating ISCO uses |a★| (smaller radius)', () => {
    const pos = coRotatingIscoRadii(1, 0.9).coRotating
    const neg = coRotatingIscoRadii(1, -0.9).coRotating
    expect(pos).toBeCloseTo(neg, 8)
    expect(pos).toBeLessThan(iscoRadii(1, -0.9).prograde)
    expect(diskIsco({ mass: 1, spinStar: -0.9, charge: 0 })).toBeCloseTo(
      diskIsco({ mass: 1, spinStar: 0.9, charge: 0 }),
      5,
    )
  })
})

describe('geodesic integrator store', () => {
  test('defaults to rt and toggles bl', () => {
    setGeodesicIntegrator('rt')
    expect(getGeodesicIntegrator()).toBe('rt')
    setGeodesicIntegrator('bl')
    expect(getGeodesicIntegrator()).toBe('bl')
    expect(getScene().geodesic).toBe('bl')
    setScene({ geodesic: 'rt' })
    expect(getGeodesicIntegrator()).toBe('rt')
  })
})
