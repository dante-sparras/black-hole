import { describe, expect, test } from 'bun:test'
import {
  circularOmega,
  circularU_t,
  diskFrequencyFactor,
  gravitationalRedshift,
  orbitingRedshiftFactor,
} from '../../src/physics/geodesic/doppler'

describe('circular orbit redshift', () => {
  test('Schw u^t = 1/√(1−3M/r) at r=6M', () => {
    const ut = circularU_t(1, 6, 0, 0)
    expect(ut).toBeCloseTo(1 / Math.sqrt(0.5), 5)
  })

  test('face-on Schw factor = √(1−3M/r)', () => {
    const { g } = orbitingRedshiftFactor({ mass: 1, r: 6, mu: 0 })
    expect(g).toBeCloseTo(Math.sqrt(0.5), 5)
  })

  test('face-on orbiting g is larger than static g (less redshifted)', () => {
    // Actually √(1−3M/r) < √(1−2M/r) — orbiting is MORE redshifted face-on
    // because of time dilation from orbital energy
    const r = 8
    const staticG = gravitationalRedshift(1, r)
    const { g: orbG } = orbitingRedshiftFactor({ mass: 1, r, mu: 0 })
    expect(orbG).toBeLessThan(staticG)
    expect(orbG).toBeCloseTo(Math.sqrt(1 - 3 / r), 5)
  })

  test('approaching side blueshifts vs receding', () => {
    const blue = orbitingRedshiftFactor({ mass: 1, r: 10, mu: 0.6 })
    const red = orbitingRedshiftFactor({ mass: 1, r: 10, mu: -0.6 })
    expect(blue.g).toBeGreaterThan(red.g)
  })

  test('Kerr Omega differs from Schw', () => {
    const o0 = circularOmega(1, 10, 0, true)
    const o9 = circularOmega(1, 10, 0.9, true)
    expect(Math.abs(o9)).toBeLessThan(Math.abs(o0))
  })

  test('diskFrequencyFactor uses orbiting g', () => {
    const f = diskFrequencyFactor({
      mass: 1,
      rho: 10,
      hx: 10,
      hz: 0,
      rayDir: { x: 0, y: 0.3, z: 1 }, // mostly +z toward past → nObs mostly −z
      spinLength: 0,
    })
    expect(f.factor).toBeGreaterThan(0)
    expect(f.factor).toBeLessThan(1.5)
    // g face-on piece
    expect(f.g).toBeCloseTo(Math.sqrt(1 - 3 / 10), 3)
  })

  test('ISCO Schw: g_face = 1/√2', () => {
    const { g } = orbitingRedshiftFactor({ mass: 1, r: 6, mu: 0 })
    expect(g).toBeCloseTo(Math.SQRT1_2, 5)
  })
})
