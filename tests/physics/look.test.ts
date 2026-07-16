import { describe, expect, test } from 'bun:test'
import {
  getLook,
  LOOK_DEFAULTS,
  LOOK_LIMITS,
  setLook,
} from '../../src/state/look'

describe('look store (bloom)', () => {
  test('defaults enable soft bloom (singularity-style glow)', () => {
    expect(LOOK_DEFAULTS.bloomEnabled).toBe(true)
    expect(LOOK_DEFAULTS.bloomStrength).toBeLessThanOrEqual(0.35)
    expect(LOOK_DEFAULTS.bloomThreshold).toBeGreaterThanOrEqual(0.35)
  })

  test('clamps strength / radius / threshold / exposure', () => {
    const l = setLook({
      bloomStrength: 99,
      bloomRadius: -1,
      bloomThreshold: 50,
      exposure: 0,
    })
    expect(l.bloomStrength).toBe(LOOK_LIMITS.bloomStrength.max)
    expect(l.bloomRadius).toBe(LOOK_LIMITS.bloomRadius.min)
    expect(l.bloomThreshold).toBe(LOOK_LIMITS.bloomThreshold.max)
    expect(l.exposure).toBe(LOOK_LIMITS.exposure.min)
  })

  test('toggle bloom', () => {
    setLook({ bloomEnabled: false })
    expect(getLook().bloomEnabled).toBe(false)
    setLook({ bloomEnabled: true })
    expect(getLook().bloomEnabled).toBe(true)
  })

  test('restores sensible demo defaults after tests', () => {
    setLook({ ...LOOK_DEFAULTS })
    expect(getLook().bloomStrength).toBe(LOOK_DEFAULTS.bloomStrength)
  })
})
