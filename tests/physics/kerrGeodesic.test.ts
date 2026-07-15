import { describe, expect, test } from 'bun:test'
import {
  iscoRadii,
  kerrHorizon,
  photonSphereRadii,
} from '../../src/physics/kerr'
import { knNullAccel, traceKnNull } from '../../src/physics/geodesic/kerrNull'
import { schwarzschildNullAccel } from '../../src/physics/geodesic/schwarzschildNull'
import { vec3 } from '../../src/physics/geodesic/vec3'

describe('knNullAccel', () => {
  test('a=0 matches Schwarzschild accel', () => {
    const pos = vec3(10, 0, 2)
    const vel = vec3(0, 0.3, 0.9)
    const k = knNullAccel(pos, vel, 1, 0, 0)
    const s = schwarzschildNullAccel(pos, vel, 2)
    expect(k.x).toBeCloseTo(s.x, 10)
    expect(k.y).toBeCloseTo(s.y, 10)
    expect(k.z).toBeCloseTo(s.z, 10)
  })

  test('nonzero spin adds frame-drag (xz coupling on vx/vz)', () => {
    const pos = vec3(8, 0, 0)
    const vel = vec3(0, 0, 1)
    const k0 = knNullAccel(pos, vel, 1, 0, 0)
    const k = knNullAccel(pos, vel, 1, 0.9, 0)
    // LT: a_x = 2 Ω vz ≠ 0 when spin ≠ 0
    expect(Math.abs(k.x - k0.x)).toBeGreaterThan(1e-6)
  })
})

describe('traceKnNull (Kerr)', () => {
  const M = 1

  test('a=0 radial ray is captured', () => {
    const result = traceKnNull({
      mass: M,
      spinLength: 0,
      origin: vec3(0, 0, -40),
      direction: vec3(0, 0, 1),
      maxSteps: 5000,
      diskAxis: 'y',
    })
    expect(result.fate).toBe('captured')
  })

  test('a=0 high impact escapes', () => {
    const b = 10 * M
    const result = traceKnNull({
      mass: M,
      spinLength: 0,
      origin: vec3(b, 0, -80),
      direction: vec3(0, 0, 1),
      maxSteps: 8000,
      escapeRadius: 200 * M,
    })
    expect(result.fate).toBe('escaped')
  })

  test('high spin still captures head-on', () => {
    const a = 0.95 * M
    const rPlus = kerrHorizon(M, a)
    const result = traceKnNull({
      mass: M,
      spinLength: a,
      origin: vec3(0, 0, -50),
      direction: vec3(0, 0, 1),
      maxSteps: 6000,
    })
    expect(result.fate).toBe('captured')
    expect(result.minR).toBeLessThanOrEqual(rPlus * 1.05)
  })

  test('spin breaks left/right capture symmetry', () => {
    const a = 0.9 * M
    const b = 4.5 * M
    // Rays offset ±x (equatorial plane y=0), coming from -z
    const left = traceKnNull({
      mass: M,
      spinLength: a,
      origin: vec3(-b, 0, -80),
      direction: vec3(0, 0, 1),
      maxSteps: 10000,
      escapeRadius: 200 * M,
    })
    const right = traceKnNull({
      mass: M,
      spinLength: a,
      origin: vec3(+b, 0, -80),
      direction: vec3(0, 0, 1),
      maxSteps: 10000,
      escapeRadius: 200 * M,
    })
    // At least one of fate or minR should differ (asymmetry)
    const sameFate = left.fate === right.fate
    const minRDiff = Math.abs(left.minR - right.minR)
    expect(sameFate && minRDiff < 0.05).toBe(false)
  })
})

describe('Kerr radii helpers', () => {
  test('a=0 photon sphere is 3M', () => {
    const { prograde, retrograde } = photonSphereRadii(1, 0)
    expect(prograde).toBeCloseTo(3, 5)
    expect(retrograde).toBeCloseTo(3, 5)
  })

  test('prograde photon sphere shrinks with spin', () => {
    const { prograde, retrograde } = photonSphereRadii(1, 0.9)
    expect(prograde).toBeLessThan(3)
    expect(retrograde).toBeGreaterThan(3)
  })

  test('a=0 ISCO is 6M', () => {
    const { prograde, retrograde } = iscoRadii(1, 0)
    expect(prograde).toBeCloseTo(6, 3)
    expect(retrograde).toBeCloseTo(6, 3)
  })

  test('prograde ISCO shrinks with spin', () => {
    const { prograde } = iscoRadii(1, 0.98)
    expect(prograde).toBeLessThan(2.5)
    expect(prograde).toBeGreaterThan(1)
  })

  test('horizon shrinks with spin', () => {
    expect(kerrHorizon(1, 0)).toBeCloseTo(2, 10)
    expect(kerrHorizon(1, 0.9)).toBeLessThan(2)
    expect(kerrHorizon(1, 0.9)).toBeGreaterThan(1)
  })
})
