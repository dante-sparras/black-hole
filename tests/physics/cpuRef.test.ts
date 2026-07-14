import { describe, expect, test } from 'bun:test'
import { RT, rtStepSize } from '../../src/physics/geodesic/rtConstants'
import { renderCpuRef } from '../../src/physics/geodesic/cpuRef'

describe('rtConstants', () => {
  test('adapt floor prevents microscopic steps', () => {
    // Near photon sphere r~3M, floor dominates
    const ds = rtStepSize(3, 1)
    expect(ds).toBeGreaterThanOrEqual(RT.baseStepM * RT.adaptFloor * 0.99)
    expect(RT.adaptFloor).toBeGreaterThanOrEqual(0.2)
  })

  test('step grows with radius but clamps', () => {
    const near = rtStepSize(3, 1)
    const far = rtStepSize(100, 1)
    expect(far).toBeGreaterThan(near)
    expect(far).toBeLessThanOrEqual(RT.baseStepM * RT.adaptMax * 1.001)
  })
})

describe('cpuRef topology', () => {
  test('Schwarzschild center pixel is capture', () => {
    const ref = renderCpuRef({
      params: { mass: 1, spinStar: 0, charge: 0 },
      width: 64,
      height: 36,
    })
    expect(ref.center.fate).toBe('capture')
    expect(ref.counts.capture).toBeGreaterThan(0)
  })

  test('has escapes and non-dominant max (step floor healthy)', () => {
    const ref = renderCpuRef({
      params: { mass: 1, spinStar: 0, charge: 0 },
      width: 64,
      height: 36,
    })
    expect(ref.counts.escape).toBeGreaterThan(0)
    // max should not dominate — stalled rays are the classic failure mode
    const total = Object.values(ref.counts).reduce((a, b) => a + b, 0)
    expect(ref.counts.max).toBeLessThan(total * 0.25)
  })

  test('disk hits exist at default inclination', () => {
    const ref = renderCpuRef({
      params: { mass: 1, spinStar: 0, charge: 0 },
      width: 80,
      height: 45,
    })
    expect(ref.counts.disk).toBeGreaterThan(0)
  })

  test('Kerr spin still produces capture + escape', () => {
    const ref = renderCpuRef({
      params: { mass: 1, spinStar: 0.9, charge: 0 },
      width: 48,
      height: 28,
    })
    expect(ref.counts.capture).toBeGreaterThan(0)
    expect(ref.counts.escape).toBeGreaterThan(0)
    expect(ref.center.fate === 'capture' || ref.center.fate === 'disk').toBe(
      true,
    )
  })

  test('RN charge still produces capture (center may graze disk)', () => {
    const ref = renderCpuRef({
      params: { mass: 1, spinStar: 0, charge: 0.5 },
      width: 48,
      height: 28,
    })
    expect(ref.counts.capture).toBeGreaterThan(0)
    expect(
      ref.center.fate === 'capture' || ref.center.fate === 'disk',
    ).toBe(true)
  })
})
