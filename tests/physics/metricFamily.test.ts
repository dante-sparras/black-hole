import { describe, expect, test } from 'bun:test'
import {
  metricFamilyFromParams,
  realtimeModeTag,
  rIscoOverM,
} from '../../src/physics/metricFamily'
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

  test('realtime mode tags match family (RT default)', () => {
    expect(realtimeModeTag({ spinStar: 0, charge: 0 })).toBe('schw-RT')
    expect(realtimeModeTag({ spinStar: 0.9, charge: 0 })).toBe('kerr-RT')
    expect(realtimeModeTag({ spinStar: 0, charge: 0.5 })).toBe('rn-RT')
    expect(realtimeModeTag({ spinStar: 0.7, charge: 0.2 })).toBe('kn-RT')
  })

  test('BL mode tags', () => {
    expect(realtimeModeTag({ spinStar: 0, charge: 0 }, 'bl')).toBe('schw-BL')
    expect(realtimeModeTag({ spinStar: 0.9, charge: 0 }, 'bl')).toBe('kerr-BL')
    expect(realtimeModeTag({ spinStar: 0, charge: 0.5 }, 'bl')).toBe('rn-BL')
    expect(realtimeModeTag({ spinStar: 0.7, charge: 0.2 }, 'bl')).toBe('kn-BL')
  })

  test('rIscoOverM normalizes by mass', () => {
    expect(rIscoOverM(6, 1)).toBeCloseTo(6, 10)
    expect(rIscoOverM(12, 2)).toBeCloseTo(6, 10)
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
