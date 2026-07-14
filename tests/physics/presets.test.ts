import { describe, expect, test } from 'bun:test'
import { getCamera } from '../../src/state/camera'
import { getLook } from '../../src/state/look'
import { getParams } from '../../src/state/params'
import {
  ALL_PRESETS,
  applyPreset,
  getPresetById,
  listPresetIds,
  PRESET_EXTREMAL,
  PRESET_HOT,
  PRESET_INTERSTELLAR,
  PRESET_SCHWARZSCHILD,
} from '../../src/state/presets'

describe('presets', () => {
  test('all presets have unique ids', () => {
    const ids = listPresetIds()
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(5)
  })

  test('getPresetById finds interstellar', () => {
    expect(getPresetById('interstellar')?.label).toBe('Interstellar')
  })

  test('apply interstellar sets high spin and warm look', () => {
    applyPreset(PRESET_INTERSTELLAR)
    expect(getParams().spinStar).toBeCloseTo(0.998, 3)
    expect(getParams().charge).toBe(0)
    expect(getLook().bloomEnabled).toBe(true)
    expect(getLook().exposure).toBeLessThan(1.05)
    expect(getCamera().distanceM).toBeGreaterThan(10)
  })

  test('apply hot raises ṁ and exposure', () => {
    applyPreset(PRESET_HOT)
    expect(getParams().mdot).toBeGreaterThan(0.3)
    expect(getLook().exposure).toBeGreaterThan(1.1)
    expect(getLook().bloomStrength).toBeGreaterThan(1)
  })

  test('apply schwarzschild zeros spin and charge', () => {
    applyPreset(PRESET_SCHWARZSCHILD)
    expect(getParams().spinStar).toBe(0)
    expect(getParams().charge).toBe(0)
  })

  test('apply extremal by id string', () => {
    applyPreset('extremal')
    expect(getParams().spinStar).toBeCloseTo(PRESET_EXTREMAL.params.spinStar!, 3)
  })

  test('unknown id throws', () => {
    expect(() => applyPreset('nope-does-not-exist')).toThrow()
  })

  test('every preset applies without throw and stays physical', () => {
    for (const p of ALL_PRESETS) {
      applyPreset(p)
      const phys = getParams()
      expect(phys.mass).toBeGreaterThan(0)
      expect(phys.spinStar).toBeGreaterThanOrEqual(0)
      expect(phys.spinStar).toBeLessThanOrEqual(0.998)
      expect(phys.mdot).toBeGreaterThan(0)
      // Extremality M² ≥ a² + Q²
      const a = phys.spinStar * phys.mass
      expect(phys.mass * phys.mass).toBeGreaterThanOrEqual(
        a * a + phys.charge * phys.charge - 1e-9,
      )
    }
  })
})
