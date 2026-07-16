import { describe, expect, test } from 'bun:test'
import {
  beamIntensity,
  beamIntensityExponent,
  DISK_EMISSION,
} from '../../src/physics/disk'
import { bolometricBeaming } from '../../src/physics/geodesic/doppler'
import {
  getIdealBeam,
  IDEAL_BEAM_DEFAULT,
  setIdealBeam,
  subscribeIdealBeam,
} from '../../src/state/idealBeam'
import { applyPreset } from '../../src/state/presets'
import { getScene } from '../../src/state/scene'

describe('beamIntensity (display g² vs ideal g³)', () => {
  test('exponents match DISK_EMISSION', () => {
    expect(beamIntensityExponent(false)).toBe(DISK_EMISSION.beamExponent)
    expect(beamIntensityExponent(true)).toBe(DISK_EMISSION.beamExponentIdeal)
    expect(DISK_EMISSION.beamExponentIdeal).toBe(3)
    expect(DISK_EMISSION.beamExponent).toBe(2)
  })

  test('ideal is stronger contrast for g>1', () => {
    const g = 1.4
    expect(beamIntensity(g, true)).toBeGreaterThan(beamIntensity(g, false))
    expect(beamIntensity(g, true)).toBeCloseTo(g ** 3, 10)
    expect(beamIntensity(g, false)).toBeCloseTo(g ** 2, 10)
  })

  test('ideal dims more for g<1', () => {
    const g = 0.7
    expect(beamIntensity(g, true)).toBeLessThan(beamIntensity(g, false))
  })
})

describe('bolometricBeaming dual mode', () => {
  test('default ideal is g³', () => {
    expect(bolometricBeaming(1.5)).toBeCloseTo(1.5 ** 3, 10)
  })
  test('display mode is g²', () => {
    expect(bolometricBeaming(1.5, false)).toBeCloseTo(1.5 ** 2, 10)
  })
})

describe('idealBeam store (global, not per-preset)', () => {
  test('defaults off', () => {
    setIdealBeam(IDEAL_BEAM_DEFAULT)
    expect(getIdealBeam()).toBe(false)
    expect(IDEAL_BEAM_DEFAULT).toBe(false)
  })

  test('subscribe + toggle', () => {
    let n = 0
    const u = subscribeIdealBeam(() => {
      n++
    })
    expect(n).toBeGreaterThanOrEqual(1)
    const before = n
    setIdealBeam(true)
    expect(getIdealBeam()).toBe(true)
    expect(n).toBeGreaterThan(before)
    setIdealBeam(false)
    u()
  })

  test('presets do not change idealBeam', () => {
    setIdealBeam(true)
    applyPreset('cool')
    expect(getIdealBeam()).toBe(true)
    setIdealBeam(false)
  })

  test('scene snapshot includes idealBeam', () => {
    expect(typeof getScene().idealBeam).toBe('boolean')
  })
})
