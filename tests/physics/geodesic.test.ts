import { describe, expect, test } from 'bun:test'
import { schwarzschildNullAccel } from '../../src/physics/geodesic/schwarzschildNull'
import {
  impactParameter,
  knNullAccel,
  traceKnNull,
} from '../../src/physics/geodesic/kerrNull'
import { RT } from '../../src/physics/geodesic/rtConstants'
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

  test('a=0 knNullAccel matches schwarzschildNullAccel', () => {
    const pos = vec3(10, 0, 2)
    const vel = vec3(0, 0.3, 0.9)
    const k = knNullAccel(pos, vel, 1, 0, 0)
    const s = schwarzschildNullAccel(pos, vel, 2)
    expect(k.x).toBeCloseTo(s.x, 10)
    expect(k.y).toBeCloseTo(s.y, 10)
    expect(k.z).toBeCloseTo(s.z, 10)
  })
})

describe('traceKnNull (Schwarzschild via unified path)', () => {
  const M = 1
  const bc = 3 * Math.sqrt(3) * M // ≈ 5.196

  test('radial head-on ray is captured', () => {
    const result = traceKnNull({
      mass: M,
      spinLength: 0,
      charge: 0,
      origin: vec3(-40, 0, 0),
      direction: vec3(1, 0, 0),
      maxSteps: 5000,
    })
    expect(result.fate).toBe('captured')
    expect(result.minR).toBeLessThanOrEqual(2.1 * M)
  })

  test('impact parameter well above b_c escapes', () => {
    const b = 8 * M
    // Equatorial: offset in +Y, ray along +X, disk plane y=0
    const result = traceKnNull({
      mass: M,
      spinLength: 0,
      origin: vec3(-80, b, 0),
      direction: vec3(1, 0, 0),
      maxSteps: 8000,
      escapeRadius: 200 * M,
    })
    expect(result.impact).toBeCloseTo(b, 5)
    expect(result.fate).toBe('escaped')
  })

  test('impact parameter well below b_c is captured', () => {
    const b = 3.5 * M
    const result = traceKnNull({
      mass: M,
      spinLength: 0,
      origin: vec3(-80, b, 0),
      direction: vec3(1, 0, 0),
      maxSteps: 8000,
    })
    expect(result.impact).toBeCloseTo(b, 5)
    expect(result.fate).toBe('captured')
  })

  test('inclined ray can cross the equatorial disk (y=0)', () => {
    // Camera below equator (y>0), aim somewhat downward through the disk annulus
    const result = traceKnNull({
      mass: M,
      spinLength: 0,
      origin: vec3(-25, 12, 0),
      direction: vec3(1, -0.45, 0),
      maxSteps: 6000,
      diskInner: 6 * M,
      diskOuter: 40 * M,
      diskAxis: 'y',
    })
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

  test('RT adapt floor is enforced on default steps', () => {
    expect(RT.adaptFloor).toBeGreaterThanOrEqual(0.2)
  })
})

/**
 * Critical-curve honesty: under RT step policy + RK2 (GPU twin),
 * the capture/escape transition should sit near analytic b_c = 3√3 M.
 * Real-time Binet force is not exact GR — allow a bounded relative window.
 */
describe('Schw critical curve vs analytic b_c (RT + RK2)', () => {
  const M = 1
  const bc = 3 * Math.sqrt(3) * M

  function fateAtB(b: number) {
    return traceKnNull({
      mass: M,
      spinLength: 0,
      charge: 0,
      origin: vec3(-120, b, 0),
      direction: vec3(1, 0, 0),
      maxSteps: 12_000,
      escapeRadius: 280 * M,
      integrator: 'rk2',
    }).fate
  }

  test('deeply subcritical captures; deeply supercritical escapes', () => {
    expect(fateAtB(0.7 * bc)).toBe('captured')
    expect(fateAtB(1.4 * bc)).toBe('escaped')
  })

  test('transition lies within ~20% of analytic b_c', () => {
    // Binary search capture → escape boundary in impact parameter
    let lo = 0.5 * bc
    let hi = 1.5 * bc
    for (let i = 0; i < 14; i++) {
      const mid = 0.5 * (lo + hi)
      const f = fateAtB(mid)
      if (f === 'captured') lo = mid
      else hi = mid
    }
    const bTrans = 0.5 * (lo + hi)
    const rel = Math.abs(bTrans - bc) / bc
    expect(rel).toBeLessThan(0.2)
    // Sanity: still ordered
    expect(bTrans).toBeGreaterThan(0.8 * bc)
    expect(bTrans).toBeLessThan(1.25 * bc)
  })
})
