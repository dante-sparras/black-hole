import { describe, expect, test } from 'bun:test'
import { OBSERVER_DEFAULTS } from '../../src/physics/observer'
import {
  blOrbitingRedshiftG,
  schwCriticalImpact,
} from '../../src/physics/geodesic/kerrBl'
import { traceCameraRayBl } from '../../src/physics/geodesic/blCamera'
import { renderCpuRef } from '../../src/physics/geodesic/cpuRef'
import { orbitingRedshiftFactor } from '../../src/physics/geodesic/doppler'

describe('blOrbitingRedshiftG', () => {
  test('face-on Schw at r=6M: g = 1/√2 when λ=0', () => {
    const g = blOrbitingRedshiftG(1, 6, 0, 1, 0)
    expect(g).toBeCloseTo(Math.SQRT1_2, 5)
  })

  test('matches orbitingRedshiftFactor at μ=0', () => {
    const gBl = blOrbitingRedshiftG(1, 10, 0, 1, 0)
    const { g } = orbitingRedshiftFactor({ mass: 1, r: 10, mu: 0 })
    expect(gBl).toBeCloseTo(g, 5)
  })

  test('approaching (Lz>0 with prograde Ω) blueshifts vs receding', () => {
    // λ = Lz/E; larger positive λ → larger g for prograde disk
    const blue = blOrbitingRedshiftG(1, 12, 0, 1, 6)
    const red = blOrbitingRedshiftG(1, 12, 0, 1, -6)
    expect(blue).toBeGreaterThan(red)
  })
})

describe('BL disk hits from camera', () => {
  const M = 1

  test('default inclined camera has some disk hits off-center', () => {
    // Scan a grid; thin-disk crossings need non-equatorial path (Q≠0)
    let totalHits = 0
    for (const ndcY of [-0.15, 0, 0.15]) {
      for (const ndcX of [-0.45, -0.3, -0.15, 0.15, 0.3, 0.45]) {
        const r = traceCameraRayBl({
          mass: M,
          spinLength: 0,
          ndcX,
          ndcY,
          diskInner: 6 * M,
          diskOuter: 22 * M,
        })
        totalHits += r.diskHits
      }
    }
    expect(totalHits).toBeGreaterThan(0)
  })

  test('disk hit records positive g < 1.5', () => {
    let found = false
    for (const ndcX of [-0.4, -0.25, 0.25, 0.4]) {
      const r = traceCameraRayBl({
        mass: M,
        spinLength: 0,
        ndcX,
        ndcY: 0.05,
        diskInner: 6 * M,
        diskOuter: 22 * M,
      })
      if (r.diskHits > 0 && r.firstDiskG > 0) {
        found = true
        expect(r.firstDiskG).toBeGreaterThan(0.2)
        expect(r.firstDiskG).toBeLessThan(1.5)
        expect(r.diskHitList[0].r).toBeGreaterThanOrEqual(6 * M)
        expect(r.diskHitList[0].r).toBeLessThanOrEqual(22 * M)
        break
      }
    }
    expect(found).toBe(true)
  })

  test('center capture still has diskHits ≥ 0', () => {
    const r = traceCameraRayBl({
      mass: M,
      spinLength: 0,
      ndcX: 0,
      ndcY: 0,
    })
    expect(r.fate).toBe('captured')
    expect(r.diskHits).toBeGreaterThanOrEqual(0)
  })

  test('Kerr: left/right firstDiskG can differ when both hit', () => {
    const left = traceCameraRayBl({
      mass: M,
      spinLength: 0.9,
      ndcX: -0.3,
      ndcY: 0,
    })
    const right = traceCameraRayBl({
      mass: M,
      spinLength: 0.9,
      ndcX: 0.3,
      ndcY: 0,
    })
    if (left.diskHits > 0 && right.diskHits > 0) {
      // Doppler asymmetry expected when both sample the disk
      expect(Math.abs(left.firstDiskG - right.firstDiskG)).toBeGreaterThan(1e-4)
    } else {
      // At least topology is finite
      expect(left.steps + right.steps).toBeGreaterThan(0)
    }
  })
})

describe('cpuRef integrator mode bl', () => {
  test('BL mode center is capture or disk', () => {
    const ref = renderCpuRef({
      params: { mass: 1, spinStar: 0, charge: 0 },
      integrator: 'bl',
      width: 32,
      height: 18,
    })
    expect(ref.integrator).toBe('bl')
    expect(
      ref.center.fate === 'capture' || ref.center.fate === 'disk',
    ).toBe(true)
    expect(ref.counts.capture + ref.counts.disk).toBeGreaterThan(0)
  })

  test('BL mode produces escapes and disk hits at default inclination', () => {
    const ref = renderCpuRef({
      params: { mass: 1, spinStar: 0, charge: 0 },
      integrator: 'bl',
      width: 40,
      height: 22,
    })
    expect(ref.counts.escape).toBeGreaterThan(0)
    expect(ref.counts.disk).toBeGreaterThan(0)
  })

  test('RT mode still works (default)', () => {
    const ref = renderCpuRef({
      params: { mass: 1, spinStar: 0, charge: 0 },
      width: 48,
      height: 28,
    })
    expect(ref.integrator).toBe('rt')
    expect(ref.center.fate).toBe('capture')
  })

  test('BL wide pixel has impact above b_c scale', () => {
    const bc = schwCriticalImpact(1)
    // Sanity: default camera distance and fov yield large |Lz| off-axis
    const ray = traceCameraRayBl({
      mass: 1,
      spinLength: 0,
      camera: OBSERVER_DEFAULTS,
      ndcX: 1.0,
      ndcY: 0,
    })
    expect(ray.impactB).toBeGreaterThan(bc * 0.5)
  })
})
