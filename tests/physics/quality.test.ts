import { describe, expect, test } from 'bun:test'
import { photonSphereProximity, RT, rtMaxStepsForCamera, rtStepSize } from '../../src/physics/geodesic/rtConstants'
import {
  getQuality,
  QUALITY_PRESETS,
  setQuality,
} from '../../src/state/quality'

describe('quality + photon-ring steps', () => {
  test('quality presets only change numerics', () => {
    setQuality('low')
    expect(getQuality().maxSteps).toBe(QUALITY_PRESETS.low.maxSteps)
    setQuality('high')
    expect(getQuality().dpr).toBe(QUALITY_PRESETS.high.dpr)
    setQuality('med')
    expect(getQuality().level).toBe('med')
  })

  test('rtStepSize refines near photon sphere', () => {
    const dsFar = rtStepSize(40, 1)
    const dsPh = rtStepSize(3, 1)
    expect(dsPh).toBeLessThan(dsFar)
    expect(RT.adaptFloor).toBeGreaterThanOrEqual(0.2)
  })

  test('far vacuum steps are large enough for zoom-out (adaptMax)', () => {
    // Cruise from D=120M must not need more than RT.maxSteps at adaptMax
    const ds = rtStepSize(80, 1)
    expect(ds).toBeGreaterThan(0.5) // far steps ≫ near-hole floor
    expect(RT.adaptMax).toBeGreaterThanOrEqual(6)
    const stepsFor120 = 120 / (RT.baseStepM * RT.adaptMax * 0.9)
    expect(stepsFor120 + 120).toBeLessThanOrEqual(RT.maxSteps)
  })

  test('rtMaxStepsForCamera grows with distance', () => {
    const near = rtMaxStepsForCamera(20, 1, 340)
    const far = rtMaxStepsForCamera(120, 1, 340)
    expect(far).toBeGreaterThanOrEqual(near)
    expect(far).toBeLessThanOrEqual(RT.maxSteps)
    expect(far).toBeGreaterThanOrEqual(340)
  })

  test('photonSphereProximity peaks near 3M', () => {
    expect(photonSphereProximity(3)).toBeGreaterThan(photonSphereProximity(10))
    expect(photonSphereProximity(3)).toBeGreaterThan(0.9)
  })
})
