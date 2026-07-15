import { describe, expect, test } from 'bun:test'
import { OBSERVER_DEFAULTS } from '../../src/physics/observer'
import { schwCriticalImpact } from '../../src/physics/geodesic/kerrBl'
import {
  cameraBasis,
  cameraBlPosition,
  cameraRayImpactB,
  cameraRayToBl,
  sphericalBasis,
  traceCameraRayBl,
} from '../../src/physics/geodesic/blCamera'
import { length3, vec3 } from '../../src/physics/geodesic/vec3'

describe('blCamera geometry', () => {
  test('cameraBlPosition matches OBSERVER_DEFAULTS scale', () => {
    const p = cameraBlPosition(OBSERVER_DEFAULTS, 1, 0)
    expect(p.r).toBeCloseTo(OBSERVER_DEFAULTS.distanceM, 10)
    expect(p.theta).toBeCloseTo(OBSERVER_DEFAULTS.inclination, 10)
    expect(p.phi).toBeCloseTo(OBSERVER_DEFAULTS.azimuth, 10)
  })

  test('cameraBasis forward points toward origin', () => {
    const { origin, forward } = cameraBasis(OBSERVER_DEFAULTS, 1)
    const toOrigin = {
      x: -origin.x,
      y: -origin.y,
      z: -origin.z,
    }
    const len = length3(toOrigin)
    expect(forward.x).toBeCloseTo(toOrigin.x / len, 10)
    expect(forward.y).toBeCloseTo(toOrigin.y / len, 10)
    expect(forward.z).toBeCloseTo(toOrigin.z / len, 10)
  })

  test('sphericalBasis at +X is θ=π/2, φ=0', () => {
    const b = sphericalBasis(vec3(10, 0, 0))
    expect(b.theta).toBeCloseTo(Math.PI / 2, 10)
    expect(b.phi).toBeCloseTo(0, 10)
    expect(b.rHat.x).toBeCloseTo(1, 10)
  })
})

describe('cameraRayToBl conserved quantities', () => {
  test('center ray is nearly radial: small |Lz|, small Q', () => {
    const ray = cameraRayToBl({
      mass: 1,
      spinLength: 0,
      ndcX: 0,
      ndcY: 0,
    })
    expect(Math.abs(ray.conserved.Lz)).toBeLessThan(0.5)
    expect(Math.abs(ray.conserved.Q)).toBeLessThan(50) // not huge at θ~72°
    expect(ray.signR).toBe(-1)
    expect(ray.conserved.E).toBe(1)
  })

  test('horizontal offset increases |Lz|', () => {
    const c = cameraRayToBl({ mass: 1, spinLength: 0, ndcX: 0, ndcY: 0 })
    const r = cameraRayToBl({ mass: 1, spinLength: 0, ndcX: 0.4, ndcY: 0 })
    expect(Math.abs(r.conserved.Lz)).toBeGreaterThan(Math.abs(c.conserved.Lz))
  })

  test('impactCart scales with |ndc| roughly', () => {
    const a = cameraRayToBl({ mass: 1, spinLength: 0, ndcX: 0.1, ndcY: 0 })
    const b = cameraRayToBl({ mass: 1, spinLength: 0, ndcX: 0.2, ndcY: 0 })
    expect(b.impactCart).toBeGreaterThan(a.impactCart)
  })

  test('face-on camera: center Q can be nonzero structure but Lz~0', () => {
    const ray = cameraRayToBl({
      mass: 1,
      spinLength: 0,
      camera: { ...OBSERVER_DEFAULTS, inclination: 0.15, azimuth: 0 },
      ndcX: 0,
      ndcY: 0,
    })
    expect(Math.abs(ray.conserved.Lz)).toBeLessThan(1)
    expect(ray.signR).toBe(-1)
  })
})

describe('traceCameraRayBl', () => {
  const M = 1
  const bc = schwCriticalImpact(M)

  test('default camera center ray captures (Schw)', () => {
    const r = traceCameraRayBl({
      mass: M,
      spinLength: 0,
      ndcX: 0,
      ndcY: 0,
    })
    expect(r.fate).toBe('captured')
    expect(r.minR).toBeLessThanOrEqual(2.1 * M)
  })

  test('large NDC offset escapes (Schw)', () => {
    // fov~0.9, ndc=1.2 → impact well above b_c at D=60M
    const r = traceCameraRayBl({
      mass: M,
      spinLength: 0,
      ndcX: 1.2,
      ndcY: 0,
    })
    expect(r.fate).toBe('escaped')
    expect(r.minR).toBeGreaterThan(bc * 0.5)
  })

  test('impact B for wide ray exceeds analytic b_c', () => {
    const b = cameraRayImpactB({
      mass: M,
      spinLength: 0,
      ndcX: 1.2,
      ndcY: 0,
    })
    expect(b).toBeGreaterThan(bc)
  })

  test('Kerr high spin: center still captures', () => {
    const r = traceCameraRayBl({
      mass: M,
      spinLength: 0.9,
      ndcX: 0,
      ndcY: 0,
    })
    expect(r.fate).toBe('captured')
  })

  test('Kerr: left/right rays differ in Lz sign or magnitude path', () => {
    const left = cameraRayToBl({
      mass: M,
      spinLength: 0.9,
      ndcX: -0.35,
      ndcY: 0,
    })
    const right = cameraRayToBl({
      mass: M,
      spinLength: 0.9,
      ndcX: 0.35,
      ndcY: 0,
    })
    // Opposite screen sides → opposite Lz at this camera azimuth
    expect(Math.sign(left.conserved.Lz) * Math.sign(right.conserved.Lz)).toBeLessThan(
      0,
    )
  })

  test('closer camera still center-captures', () => {
    const r = traceCameraRayBl({
      mass: M,
      spinLength: 0,
      camera: { ...OBSERVER_DEFAULTS, distanceM: 30 },
      ndcX: 0,
      ndcY: 0,
    })
    expect(r.fate).toBe('captured')
  })
})
