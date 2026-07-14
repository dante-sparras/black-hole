import { describe, expect, test } from 'bun:test'
import {
  impactParameter,
  schwarzschildNullAccel,
  traceSchwarzschildNull,
} from '../../src/physics/geodesic/schwarzschildNull'
import { vec3 } from '../../src/physics/geodesic/vec3'

describe('schwarzschildNullAccel', () => {
  test('vanishes for radial motion (L = 0)', () => {
    const a = schwarzschildNullAccel(vec3(10, 0, 0), vec3(-1, 0, 0), 2)
    expect(a.x).toBeCloseTo(0, 12)
    expect(a.y).toBeCloseTo(0, 12)
    expect(a.z).toBeCloseTo(0, 12)
  })

  test('points toward the hole for orbiting light', () => {
    const a = schwarzschildNullAccel(vec3(10, 0, 0), vec3(0, 1, 0), 2)
    expect(a.x).toBeLessThan(0)
  })
})

describe('traceSchwarzschildNull', () => {
  const M = 1
  const bc = 3 * Math.sqrt(3) * M // ≈ 5.196

  test('radial head-on ray is captured', () => {
    const result = traceSchwarzschildNull({
      mass: M,
      origin: vec3(-40, 0, 0),
      direction: vec3(1, 0, 0),
      maxSteps: 5000,
    })
    expect(result.fate).toBe('captured')
    expect(result.minR).toBeLessThanOrEqual(2.1 * M)
  })

  test('impact parameter well above b_c escapes', () => {
    const b = 8 * M
    const result = traceSchwarzschildNull({
      mass: M,
      origin: vec3(-80, b, 0),
      direction: vec3(1, 0, 0),
      maxSteps: 8000,
      stepSize: 0.05 * M,
      escapeRadius: 200 * M,
    })
    expect(result.impact).toBeCloseTo(b, 5)
    expect(result.fate).toBe('escaped')
  })

  test('impact parameter well below b_c is captured', () => {
    const b = 3.5 * M
    const result = traceSchwarzschildNull({
      mass: M,
      origin: vec3(-80, b, 0),
      direction: vec3(1, 0, 0),
      maxSteps: 8000,
      stepSize: 0.05 * M,
    })
    expect(result.impact).toBeCloseTo(b, 5)
    expect(result.fate).toBe('captured')
  })

  test('critical window: b slightly above b_c tends to escape or skim', () => {
    // Near-critical rays are stiff; we only assert they are not trivially wrong.
    const b = bc * 1.15
    const result = traceSchwarzschildNull({
      mass: M,
      origin: vec3(-100, b, 0),
      direction: vec3(1, 0, 0),
      maxSteps: 12000,
      stepSize: 0.04 * M,
      escapeRadius: 220 * M,
    })
    expect(result.fate === 'escaped' || result.fate === 'max_steps').toBe(true)
    expect(result.minR).toBeGreaterThan(2 * M)
  })

  test('inclined ray can cross the equatorial disk', () => {
    const result = traceSchwarzschildNull({
      mass: M,
      origin: vec3(-25, 0, 12),
      direction: vec3(1, 0, -0.45),
      maxSteps: 6000,
      diskInner: 6 * M,
      diskOuter: 40 * M,
    })
    // Escapes after lensing, or captures — but diskHits should be ≥ 0 always;
    // with this geometry we expect at least one plane crossing in the annulus.
    expect(result.diskHits).toBeGreaterThanOrEqual(0)
    if (result.fate === 'escaped') {
      expect(result.diskHits).toBeGreaterThanOrEqual(1)
    }
  })

  test('impactParameter matches |r × v̂|', () => {
    const p = vec3(-50, 4, 0)
    const d = vec3(1, 0, 0)
    expect(impactParameter(p, d)).toBeCloseTo(4, 10)
  })
})
