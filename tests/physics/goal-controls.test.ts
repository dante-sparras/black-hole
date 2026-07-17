import { describe, expect, test } from 'bun:test'
import {
  diskCylindricalRho,
  diskMidplaneHeight,
  labToDiskFrame,
} from '../../src/physics/tiltFrame'
import {
  jetCoreColor,
  jetEffectivePower,
  jetFunnelWeight,
} from '../../src/physics/jets'
import {
  DISK_LIMITS,
  normalizeDisk,
  plasmaBetaToMriScale,
} from '../../src/physics/diskParams'
import { thinDiskScaleHeight } from '../../src/physics/disk'
import { normalizeParams } from '../../src/physics/validate'
import { DEFAULT_SPIN_STAR, MAX_SPIN_STAR } from '../../src/physics/constants'

describe('signed spin defaults', () => {
  test('default a★ is +0.9', () => {
    expect(DEFAULT_SPIN_STAR).toBeCloseTo(0.9, 10)
    const p = normalizeParams({})
    expect(p.spinStar).toBeCloseTo(0.9, 10)
  })

  test('clamps negative spin to −MAX', () => {
    const p = normalizeParams({ spinStar: -2 })
    expect(p.spinStar).toBeCloseTo(-MAX_SPIN_STAR, 10)
  })

  test('accepts a★ = −0.9', () => {
    const p = normalizeParams({ spinStar: -0.9 })
    expect(p.spinStar).toBeCloseTo(-0.9, 10)
  })
})

describe('tiltFrame', () => {
  test('tilt=0,node=0 is identity', () => {
    const d = labToDiskFrame(3, 1.5, -2, 0, 0)
    expect(d.x).toBeCloseTo(3, 10)
    expect(d.y).toBeCloseTo(1.5, 10)
    expect(d.z).toBeCloseTo(-2, 10)
  })

  test('90° tilt maps +Y toward −Z (about +X)', () => {
    const d = labToDiskFrame(0, 1, 0, Math.PI / 2, 0)
    expect(d.x).toBeCloseTo(0, 8)
    expect(d.y).toBeCloseTo(0, 8)
    expect(d.z).toBeCloseTo(1, 8)
  })

  test('midplane height zero on tilted plane sample', () => {
    const tilt = 0.3
    expect(Math.abs(diskMidplaneHeight(5, 0, 0, tilt, 0))).toBeLessThan(1e-9)
    expect(diskCylindricalRho(5, 0, 0, 0, 0)).toBeCloseTo(5, 10)
  })
})

describe('jets helpers', () => {
  test('jetBoost=0 → effective 0', () => {
    expect(jetEffectivePower({ jetBoost: 0, spinStar: 0.9, mdot: 0.1 })).toBe(0)
  })

  test('high spin stronger than low spin', () => {
    const hi = jetEffectivePower({ jetBoost: 1, spinStar: 0.95, mdot: 0.1 })
    const lo = jetEffectivePower({ jetBoost: 1, spinStar: 0.1, mdot: 0.1 })
    expect(hi).toBeGreaterThan(lo)
  })

  test('funnel weight peaks on axis, zero inside horizon', () => {
    const onAxis = jetFunnelWeight(0.01, 20, 0, 1, 2)
    const midplane = jetFunnelWeight(20, 0.01, 0, 1, 2)
    const inside = jetFunnelWeight(0, 1.5, 0, 1, 2)
    expect(onAxis).toBeGreaterThan(midplane)
    expect(inside).toBe(0)
  })

  test('jet color is cool blue-ish', () => {
    const c = jetCoreColor(0.1)
    expect(c.b).toBeGreaterThan(c.r)
  })
})

describe('derived Γ / β helpers', () => {
  test('Γ=4/3 thicker H/R than Γ=5/3', () => {
    const h53 = thinDiskScaleHeight(0.1, 6, 5 / 3)
    const h43 = thinDiskScaleHeight(0.1, 6, 4 / 3)
    expect(h43).toBeGreaterThan(h53)
  })

  test('low β → higher MRI scale', () => {
    expect(plasmaBetaToMriScale(1)).toBeGreaterThan(plasmaBetaToMriScale(100))
    expect(plasmaBetaToMriScale(100)).toBeCloseTo(1, 5)
  })

  test('normalizeDisk clamps free bases', () => {
    const d = normalizeDisk({
      tiltRad: 9,
      jetBoost: 5,
      plasmaBeta: 1e-6,
      scaleHeight: 9,
      gamma: 1,
      rinOverM: 0.5,
    })
    expect(d.tiltRad).toBeLessThanOrEqual((40 * Math.PI) / 180 + 1e-9)
    expect(d.jetBoost).toBe(1)
    expect(d.plasmaBeta).toBeCloseTo(DISK_LIMITS.plasmaBeta.min, 5)
    expect(d.scaleHeight).toBe(DISK_LIMITS.scaleHeight.max)
    expect(d.gamma).toBe(DISK_LIMITS.gamma.min)
    expect(d.rinOverM).toBeGreaterThanOrEqual(DISK_LIMITS.rinOverM.min)
  })
})
