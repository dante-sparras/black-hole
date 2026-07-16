import { describe, expect, test } from 'bun:test'
import {
  convertDistanceOnScaleFreeToggle,
  resolveCameraDistance,
} from '../../src/physics/observer'

describe('resolveCameraDistance', () => {
  test('scale-free: D = d * M', () => {
    expect(resolveCameraDistance(2, 60, true)).toBeCloseTo(120, 10)
    expect(resolveCameraDistance(0.5, 60, true)).toBeCloseTo(30, 10)
  })

  test('fixed-D: D = d independent of M', () => {
    expect(resolveCameraDistance(2, 60, false)).toBeCloseTo(60, 10)
    expect(resolveCameraDistance(0.5, 60, false)).toBeCloseTo(60, 10)
  })

  test('M=1 both modes equal', () => {
    expect(resolveCameraDistance(1, 60, true)).toBeCloseTo(
      resolveCameraDistance(1, 60, false),
      10,
    )
  })
})

describe('convertDistanceOnScaleFreeToggle', () => {
  test('round-trip preserves geometric D', () => {
    const M = 2
    const dScale = 60 // D/M
    const D = convertDistanceOnScaleFreeToggle(dScale, M, false)
    expect(D).toBeCloseTo(120, 10)
    const back = convertDistanceOnScaleFreeToggle(D, M, true)
    expect(back).toBeCloseTo(60, 10)
  })
})
