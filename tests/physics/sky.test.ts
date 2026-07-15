import { describe, expect, test } from 'bun:test'
import {
  getSky,
  resetSky,
  setSky,
  SKY_DEFAULTS,
  SKY_LIMITS,
  subscribeSky,
} from '../../src/state/sky'
import { applyPreset, PRESET_HOT, PRESET_COOL } from '../../src/state/presets'

describe('sky store (global, not per-preset)', () => {
  test('defaults match SKY_DEFAULTS', () => {
    resetSky()
    const s = getSky()
    expect(s.starDensity).toBe(SKY_DEFAULTS.starDensity)
    expect(s.starBrightness).toBe(SKY_DEFAULTS.starBrightness)
    expect(s.nebula).toBe(SKY_DEFAULTS.nebula)
    expect(s.milky).toBe(SKY_DEFAULTS.milky)
  })

  test('clamps to limits', () => {
    setSky({ starDensity: 99, nebula: -1 })
    expect(getSky().starDensity).toBe(SKY_LIMITS.starDensity.max)
    expect(getSky().nebula).toBe(SKY_LIMITS.nebula.min)
    resetSky()
  })

  test('presets do not change sky', () => {
    setSky({ starDensity: 1.8, nebula: 0.4 })
    applyPreset(PRESET_HOT)
    expect(getSky().starDensity).toBeCloseTo(1.8, 5)
    expect(getSky().nebula).toBeCloseTo(0.4, 5)
    applyPreset(PRESET_COOL)
    expect(getSky().starDensity).toBeCloseTo(1.8, 5)
    resetSky()
  })

  test('subscribe fires', () => {
    resetSky()
    let n = 0
    const unsub = subscribeSky(() => {
      n++
    })
    expect(n).toBeGreaterThanOrEqual(1)
    const before = n
    setSky({ milky: 1.1 })
    expect(n).toBeGreaterThan(before)
    unsub()
    resetSky()
  })
})
