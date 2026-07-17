import { describe, expect, test } from 'bun:test'
import {
  diskIsco,
  diskPeakTemperatureK,
} from '../../src/physics/disk'
import { normalizeDisk } from '../../src/physics/diskParams'
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
  PRESET_HOT,
  PRESET_INTERSTELLAR,
  PRESET_MASS,
  type ScenePreset,
} from '../../src/state/presets'

function peakT(preset: ScenePreset): number {
  const p = normalizeParams(preset.params)
  const d = normalizeDisk(preset.disk)
  const rIsco = diskIsco(p)
  const rIscoOverM = rIsco / p.mass
  return diskPeakTemperatureK(d.mdot, rIscoOverM, p.spinStar)
}

describe('presets', () => {
  test('UI presets are Cool · Interstellar · Hot only', () => {
    const ids = listPresetIds()
    expect(ids).toEqual(['cool', 'interstellar', 'hot'])
    expect(new Set(ids).size).toBe(3)
  })

  test('getPresetById finds interstellar', () => {
    expect(getPresetById('interstellar')?.label).toBe('Interstellar')
  })

  test('every preset declares full no-hair + disk free bases', () => {
    for (const p of ALL_PRESETS) {
      expect(p.params.mass).toBe(PRESET_MASS)
      expect(p.params.spinStar).toBeGreaterThanOrEqual(-0.998)
      expect(p.params.spinStar).toBeLessThanOrEqual(0.998)
      expect(p.disk.outerM).toBeGreaterThan(6)
      expect(Number.isFinite(p.params.charge)).toBe(true)
      const d = normalizeDisk(p.disk)
      expect(d.mdot).toBeGreaterThan(0)
    }
  })

  test('apply interstellar sets near-extremal spin, no charge, locked M', () => {
    applyPreset(PRESET_INTERSTELLAR)
    expect(getParams().mass).toBe(PRESET_MASS)
    expect(getParams().spinStar).toBeCloseTo(0.998, 3)
    expect(getParams().charge).toBe(0)
    expect(getDisk().mdot).toBeCloseTo(0.1, 2)
    expect(getLook().bloomEnabled).toBe(true)
    expect(getLook().exposure).toBeLessThan(1.1)
    expect(getLook().bloomStrength).toBeLessThan(0.5)
  })

  test('apply hot raises ṁ via free dens/H without nuking bloom', () => {
    applyPreset(PRESET_HOT)
    expect(getParams().mass).toBe(PRESET_MASS)
    expect(getDisk().mdot).toBeGreaterThan(0.8)
    expect(getDisk().rho0).toBeGreaterThan(2)
    expect(getLook().bloomStrength).toBeLessThan(0.5)
    expect(getLook().bloomThreshold).toBeGreaterThanOrEqual(0)
  })

  test('apply cool is low ṁ via thin dens', () => {
    applyPreset(PRESET_COOL)
    expect(getDisk().mdot).toBeLessThan(0.05)
    expect(getLook().bloomStrength).toBeLessThanOrEqual(0.25)
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
      expect(look.bloomThreshold).toBeGreaterThanOrEqual(0)
    }
  })

  test('defaults stay subtle', () => {
    expect(LOOK_DEFAULTS.bloomStrength).toBeLessThanOrEqual(0.35)
    expect(LOOK_DEFAULTS.bloomThreshold).toBeLessThanOrEqual(0.5)
  })

  test('every preset applies without throw and stays physical', () => {
    for (const p of ALL_PRESETS) {
      applyPreset(p)
      const phys = getParams()
      expect(phys.mass).toBe(PRESET_MASS)
      expect(phys.spinStar).toBeGreaterThanOrEqual(-0.998)
      expect(phys.spinStar).toBeLessThanOrEqual(0.998)
      expect(getDisk().mdot).toBeGreaterThan(0)
      const a = phys.spinStar * phys.mass
      expect(phys.mass * phys.mass).toBeGreaterThanOrEqual(
        a * a + phys.charge * phys.charge - 1e-9,
      )
    }
  })

  test('peak-T ladder Cool < Interstellar < Hot', () => {
    const cool = peakT(PRESET_COOL)
    const inter = peakT(PRESET_INTERSTELLAR)
    const hot = peakT(PRESET_HOT)
    expect(cool).toBeLessThan(inter)
    expect(inter).toBeLessThan(hot)
  })

  test('Hot is hottest; Cool is coolest', () => {
    const temps = ALL_PRESETS.map((p) => ({ id: p.id, T: peakT(p) }))
    const hottest = temps.reduce((a, b) => (b.T > a.T ? b : a))
    const coolest = temps.reduce((a, b) => (b.T < a.T ? b : a))
    expect(hottest.id).toBe('hot')
    expect(coolest.id).toBe('cool')
  })

  test('apply clears spin when switching Hot → Cool', () => {
    applyPreset(PRESET_HOT)
    expect(getParams().spinStar).toBeGreaterThan(0.8)
    applyPreset(PRESET_COOL)
    expect(getParams().spinStar).toBeLessThan(0.3)
    expect(getDisk().mdot).toBeLessThan(0.05)
  })
})
