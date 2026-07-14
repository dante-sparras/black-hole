import { describe, expect, test } from 'bun:test'
import { knHorizon, rnPhotonSphere } from '../../src/physics/kn'
import {
  knNullAccel,
  traceKnNull,
} from '../../src/physics/geodesic/kerrNull'
import { schwarzschildNullAccel } from '../../src/physics/geodesic/schwarzschildNull'
import { vec3 } from '../../src/physics/geodesic/vec3'

describe('knNullAccel families', () => {
  test('a=0,Q=0 matches Schwarzschild', () => {
    const pos = vec3(10, 1, 2)
    const vel = vec3(0.1, 0.2, 0.9)
    const kn = knNullAccel(pos, vel, 1, 0, 0)
    const s = schwarzschildNullAccel(pos, vel, 2)
    expect(kn.x).toBeCloseTo(s.x, 10)
    expect(kn.y).toBeCloseTo(s.y, 10)
    expect(kn.z).toBeCloseTo(s.z, 10)
  })

  test('RN charge weakens attraction vs Schw at same r (Binet +2Q² term)', () => {
    const pos = vec3(8, 0, 0)
    const vel = vec3(0, 0, 1)
    const schw = knNullAccel(pos, vel, 1, 0, 0)
    const rn = knNullAccel(pos, vel, 1, 0, 0.6)
    // Radial accel is along −x for orbiting light; RN less negative (weaker pull)
    expect(rn.x).toBeGreaterThan(schw.x) // schw.x < 0, rn.x less negative
  })

  test('Kerr LT still present with charge (KN)', () => {
    const pos = vec3(8, 0, 0)
    const vel = vec3(0, 0, 1)
    const rn = knNullAccel(pos, vel, 1, 0, 0.4)
    const kn = knNullAccel(pos, vel, 1, 0.8, 0.4)
    expect(Math.abs(kn.x - rn.x) + Math.abs(kn.z - rn.z)).toBeGreaterThan(1e-6)
  })
})

describe('traceKnNull', () => {
  const M = 1

  test('RN head-on captures inside r+', () => {
    const Q = 0.5
    const rPlus = knHorizon(M, 0, Q)
    const result = traceKnNull({
      mass: M,
      spinLength: 0,
      charge: Q,
      origin: vec3(0, 0, -40),
      direction: vec3(0, 0, 1),
      maxSteps: 5000,
    })
    expect(result.fate).toBe('captured')
    expect(result.minR).toBeLessThanOrEqual(rPlus * 1.05)
  })

  test('near-extremal RN still captures head-on', () => {
    const Q = 0.95
    const rPlus = knHorizon(M, 0, Q)
    expect(rPlus).toBeLessThan(1.4)
    const result = traceKnNull({
      mass: M,
      spinLength: 0,
      charge: Q,
      origin: vec3(0, 0, -50),
      direction: vec3(0, 0, 1),
      maxSteps: 6000,
    })
    expect(result.fate).toBe('captured')
  })

  test('RN high impact escapes', () => {
    const result = traceKnNull({
      mass: M,
      spinLength: 0,
      charge: 0.5,
      origin: vec3(12, 0, -80),
      direction: vec3(0, 0, 1),
      maxSteps: 8000,
      stepSize: 0.1 * M,
      escapeRadius: 200 * M,
    })
    expect(result.fate).toBe('escaped')
  })

  test('KN with spin+charge captures radial', () => {
    const a = 0.5
    const Q = 0.3
    const result = traceKnNull({
      mass: M,
      spinLength: a,
      charge: Q,
      origin: vec3(0, 0, -40),
      direction: vec3(0, 0, 1),
      maxSteps: 5000,
    })
    expect(result.fate).toBe('captured')
  })
})

describe('rnPhotonSphere / knHorizon', () => {
  test('Q=0 photon sphere is 3M', () => {
    expect(rnPhotonSphere(1, 0)).toBeCloseTo(3, 10)
  })

  test('charge shrinks photon sphere', () => {
    expect(rnPhotonSphere(1, 0.7)).toBeLessThan(3)
    expect(rnPhotonSphere(1, 0.7)).toBeGreaterThan(2)
  })

  test('RN horizon shrinks with |Q|', () => {
    expect(knHorizon(1, 0, 0)).toBeCloseTo(2, 10)
    expect(knHorizon(1, 0, 0.8)).toBeLessThan(2)
  })

  test('KN horizon uses a and Q', () => {
    const r = knHorizon(1, 0.5, 0.3)
    const disc = 1 - 0.25 - 0.09
    expect(r).toBeCloseTo(1 + Math.sqrt(disc), 10)
  })
})
