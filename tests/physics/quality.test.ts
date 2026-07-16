import { describe, expect, test } from 'bun:test'
import { photonSphereProximity, RT, rtStepSize } from '../../src/physics/geodesic/rtConstants'
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

  test('photonSphereProximity peaks near 3M', () => {
    expect(photonSphereProximity(3)).toBeGreaterThan(photonSphereProximity(10))
    expect(photonSphereProximity(3)).toBeGreaterThan(0.9)
  })
})
