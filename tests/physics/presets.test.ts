import { describe, expect, test } from 'bun:test'
import { CAMERA_DEFAULTS, getCamera } from '../../src/state/camera'
import { getLook, LOOK_DEFAULTS } from '../../src/state/look'
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
    expect(getLook().bloomStrength).toBeLessThan(0.5)
  })

  test('apply hot raises ṁ without nuking the shadow with bloom', () => {
    applyPreset(PRESET_HOT)
    expect(getParams().mdot).toBeGreaterThan(0.3)
    expect(getLook().exposure).toBeGreaterThanOrEqual(0.95)
    expect(getLook().bloomStrength).toBeLessThan(0.5)
    expect(getLook().bloomThreshold).toBeGreaterThanOrEqual(0.7)
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

  test('every preset uses shared camera defaults', () => {
    for (const p of ALL_PRESETS) {
      applyPreset(p)
      const cam = getCamera()
      expect(cam.distanceM).toBe(CAMERA_DEFAULTS.distanceM)
      expect(cam.inclination).toBe(CAMERA_DEFAULTS.inclination)
      expect(cam.azimuth).toBe(CAMERA_DEFAULTS.azimuth)
      expect(cam.fov).toBe(CAMERA_DEFAULTS.fov)
    }
  })

  test('every preset keeps bloom subtle (shadow readable)', () => {
    for (const p of ALL_PRESETS) {
      applyPreset(p)
      const look = getLook()
      expect(look.bloomStrength).toBeLessThanOrEqual(0.45)
      expect(look.bloomThreshold).toBeGreaterThanOrEqual(0.5)
    }
  })

  test('defaults stay subtle', () => {
    expect(LOOK_DEFAULTS.bloomStrength).toBeLessThanOrEqual(0.35)
    expect(LOOK_DEFAULTS.bloomThreshold).toBeGreaterThanOrEqual(0.6)
  })

  test('every preset applies without throw and stays physical', () => {
    for (const p of ALL_PRESETS) {
      applyPreset(p)
      const phys = getParams()
      expect(phys.mass).toBeGreaterThan(0)
      expect(phys.spinStar).toBeGreaterThanOrEqual(0)
      expect(phys.spinStar).toBeLessThanOrEqual(0.998)
      expect(phys.mdot).toBeGreaterThan(0)
      const a = phys.spinStar * phys.mass
      expect(phys.mass * phys.mass).toBeGreaterThanOrEqual(
        a * a + phys.charge * phys.charge - 1e-9,
      )
    }
  })
})
