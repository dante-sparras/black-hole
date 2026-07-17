import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_DISK,
  DISK_LIMITS,
  effectiveDiskStructure,
  normalizeDisk,
} from '../../src/physics/diskParams'
import { getDisk, setDisk } from '../../src/state/disk'

describe('disk structure realism knobs (model defaults)', () => {
  test('defaults match texture-backed structure', () => {
    const d = normalizeDisk({})
    expect(d.structure).toBe(1)
    expect(d.arms).toBe(DEFAULT_DISK.arms)
    expect(d.clumps).toBe(DEFAULT_DISK.clumps)
    expect(d.dust).toBe(DEFAULT_DISK.dust)
    expect(d.shearRate).toBe(DEFAULT_DISK.shearRate)
    expect(d.animate).toBe(true)
  })

  test('clamps structure knobs', () => {
    const d = normalizeDisk({
      structure: 9,
      arms: -1,
      clumps: 2,
      dust: -0.5,
      shearRate: 99,
    })
    expect(d.structure).toBe(DISK_LIMITS.structure.max)
    expect(d.arms).toBe(DISK_LIMITS.arms.min)
    expect(d.clumps).toBe(DISK_LIMITS.clumps.max)
    expect(d.dust).toBe(DISK_LIMITS.dust.min)
    expect(d.shearRate).toBe(DISK_LIMITS.shearRate.max)
  })

  test('structure=0 zeros effective contrasts', () => {
    const e = effectiveDiskStructure(
      normalizeDisk({ structure: 0, arms: 0.8, clumps: 0.7, dust: 0.5 }),
    )
    expect(e.armContrast).toBe(0)
    expect(e.turbContrast).toBe(0)
    expect(e.dustContrast).toBe(0)
  })

  test('animate false zeros shear rate in effective', () => {
    const e = effectiveDiskStructure(
      normalizeDisk({ animate: false, shearRate: 0.9 }),
    )
    expect(e.shearRate).toBe(0)
    expect(e.animate).toBe(false)
  })

  test('store patches structure without losing free dens', () => {
    setDisk({
      rho0: 2,
      scaleHeight: 0.06,
      gamma: 5 / 3,
      plasmaBeta: 100,
      rinOverM: 6,
      structure: 0.5,
      arms: 0.4,
    })
    const d = getDisk()
    expect(d.rho0).toBeCloseTo(2, 5)
    expect(d.structure).toBeCloseTo(0.5, 5)
    expect(d.arms).toBeCloseTo(0.4, 5)
    expect(d.mdot).toBeGreaterThan(0.1) // denser → higher derived ṁ
    setDisk(DEFAULT_DISK)
  })
})
