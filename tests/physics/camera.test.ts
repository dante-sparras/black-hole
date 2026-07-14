import { describe, expect, test } from 'bun:test'
import {
  CAMERA_LIMITS,
  getCamera,
  setCamera,
} from '../../src/state/camera'

describe('camera store', () => {
  test('clamps distance', () => {
    setCamera({ distanceM: 1 })
    expect(getCamera().distanceM).toBe(CAMERA_LIMITS.distanceM.min)
    setCamera({ distanceM: 999 })
    expect(getCamera().distanceM).toBe(CAMERA_LIMITS.distanceM.max)
  })

  test('wraps azimuth', () => {
    setCamera({ azimuth: Math.PI * 3 })
    expect(getCamera().azimuth).toBeGreaterThanOrEqual(0)
    expect(getCamera().azimuth).toBeLessThan(Math.PI * 2)
  })

  test('clamps inclination away from poles singularity only softly', () => {
    setCamera({ inclination: -1 })
    expect(getCamera().inclination).toBe(CAMERA_LIMITS.inclination.min)
    setCamera({ inclination: 10 })
    expect(getCamera().inclination).toBe(CAMERA_LIMITS.inclination.max)
  })
})
