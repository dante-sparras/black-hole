import { describe, expect, test } from 'bun:test'
import {
  diskIsco,
  diskPeakTemperatureK,
} from '../../src/physics/disk'
import { normalizeParams } from '../../src/physics/validate'
import { CAMERA_DEFAULTS, getCamera } from '../../src/state/camera'
import { getDisk } from '../../src/state/disk'
import { getLook, LOOK_DEFAULTS } from '../../src/state/look'
import { getParams } from '../../src/state/params'
import {
  ALL_PRESETS,
  applyPreset,
  getPresetById,
  listPresetIds,
  PRESET_COOL,
  PRESET_DEFAULT,
  PRESET_EXTREMAL,
  PRESET_HOT,
  PRESET_INTERSTELLAR,
  PRESET_RN,
  PRESET_SCHWARZSCHILD,
  type ScenePreset,
} from '../../src/state/presets'

function peakT(preset: ScenePreset): number {
  const p = normalizeParams(preset.params)
  const rIsco = diskIsco(p)
  const rIscoOverM = rIsco / p.mass
  return diskPeakTemperatureK(preset.disk.mdot, rIscoOverM, p.spinStar)
}

describe('presets', () => {
  test('all presets have unique ids', () => {
    const ids = listPresetIds()
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(7)
  })

  test('getPresetById finds interstellar', () => {
    expect(getPresetById('interstellar')?.label).toBe('Interstellar')
  })

  test('every preset declares full no-hair + disk snapshot', () => {
    for (const p of ALL_PRESETS) {
      expect(p.params.mass).toBeGreaterThan(0)
      expect(p.params.spinStar).toBeGreaterThanOrEqual(0)
      expect(p.params.spinStar).toBeLessThanOrEqual(0.998)
      expect(p.disk.mdot).toBeGreaterThan(0)
      expect(p.disk.outerM).toBeGreaterThan(6)
      expect(Number.isFinite(p.params.charge)).toBe(true)
    }
  })

  test('apply interstellar sets near-extremal spin, no charge', () => {
    applyPreset(PRESET_INTERSTELLAR)
    expect(getParams().spinStar).toBeCloseTo(0.998, 3)
    expect(getParams().charge).toBe(0)
    expect(getDisk().mdot).toBeCloseTo(0.1, 5)
    expect(getLook().bloomEnabled).toBe(true)
    expect(getLook().exposure).toBeLessThan(1.1)
    expect(getLook().bloomStrength).toBeLessThan(0.5)
  })

  test('apply hot raises ṁ without nuking the shadow with bloom', () => {
    applyPreset(PRESET_HOT)
    expect(getDisk().mdot).toBeGreaterThan(1)
    expect(getLook().bloomStrength).toBeLessThan(0.5)
    expect(getLook().bloomThreshold).toBeGreaterThanOrEqual(0.7)
  })

  test('apply cool is low ṁ', () => {
    applyPreset(PRESET_COOL)
    expect(getDisk().mdot).toBeLessThan(0.05)
    expect(getLook().bloomStrength).toBeLessThanOrEqual(0.25)
  })

  test('apply schwarzschild zeros spin and charge', () => {
    applyPreset(PRESET_SCHWARZSCHILD)
    expect(getParams().spinStar).toBe(0)
    expect(getParams().charge).toBe(0)
  })

  test('apply RN has charge and no spin', () => {
    applyPreset(PRESET_RN)
    expect(getParams().spinStar).toBe(0)
    expect(getParams().charge).toBeGreaterThan(0.5)
  })

  test('apply extremal by id string', () => {
    applyPreset('extremal')
    expect(getParams().spinStar).toBeCloseTo(PRESET_EXTREMAL.params.spinStar, 3)
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
      expect(getDisk().mdot).toBeGreaterThan(0)
      const a = phys.spinStar * phys.mass
      expect(phys.mass * phys.mass).toBeGreaterThanOrEqual(
        a * a + phys.charge * phys.charge - 1e-9,
      )
    }
  })

  test('preset peak-T ladder is physical', () => {
    const cool = peakT(PRESET_COOL)
    const schw = peakT(PRESET_SCHWARZSCHILD)
    const rn = peakT(PRESET_RN)
    const def = peakT(PRESET_DEFAULT)
    const inter = peakT(PRESET_INTERSTELLAR)
    const ext = peakT(PRESET_EXTREMAL)
    const hot = peakT(PRESET_HOT)

    expect(cool).toBeLessThan(schw)
    expect(schw).toBeLessThanOrEqual(rn * 1.001)
    expect(rn).toBeLessThan(def)
    expect(def).toBeLessThan(inter)
    expect(inter).toBeLessThan(ext)
    expect(ext).toBeLessThan(hot)
  })

  test('Hot is hottest; Cool is coolest', () => {
    const temps = ALL_PRESETS.map((p) => ({ id: p.id, T: peakT(p) }))
    const hottest = temps.reduce((a, b) => (b.T > a.T ? b : a))
    const coolest = temps.reduce((a, b) => (b.T < a.T ? b : a))
    expect(hottest.id).toBe('hot')
    expect(coolest.id).toBe('cool')
  })

  test('Interstellar hotter than Default at similar ṁ (spin heating)', () => {
    expect(peakT(PRESET_INTERSTELLAR)).toBeGreaterThan(peakT(PRESET_DEFAULT) * 1.5)
  })

  test('apply clears charge when switching RN → Schwarzschild', () => {
    applyPreset(PRESET_RN)
    expect(getParams().charge).toBeGreaterThan(0)
    applyPreset(PRESET_SCHWARZSCHILD)
    expect(getParams().charge).toBe(0)
    expect(getParams().spinStar).toBe(0)
  })

  test('apply clears spin when switching Extremal → Cool', () => {
    applyPreset(PRESET_EXTREMAL)
    expect(getParams().spinStar).toBeCloseTo(0.998, 2)
    applyPreset(PRESET_COOL)
    expect(getParams().spinStar).toBeLessThan(0.3)
    expect(getDisk().mdot).toBeLessThan(0.05)
  })
})
