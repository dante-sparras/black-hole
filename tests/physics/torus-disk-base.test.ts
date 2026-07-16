import { describe, expect, test } from 'bun:test'
import { normalizeParams } from '../../src/physics/validate'
import {
  densPeakRadiusM,
  keplerSpecificL,
  magnetClassFromBeta,
  normalizeDisk,
  plasmaBetaToMriScale,
} from '../../src/physics/diskParams'
import { effectiveDiskGeom } from '../../src/physics/diskGeometry'
import { thinDiskScaleHeight } from '../../src/physics/disk'

describe('thin-disk control policy', () => {
  test('normalize locks rinFree, gamma, B geom, tilt node', () => {
    const d = normalizeDisk({
      rinFree: true,
      gamma: 4 / 3,
      magGeometry: 'vertical',
      tiltNodeRad: 1.2,
      plasmaBeta: 100,
    })
    expect(d.rinFree).toBe(false)
    expect(d.gamma).toBeCloseTo(5 / 3, 5)
    expect(d.magGeometry).toBe('single-loop')
    expect(d.tiltNodeRad).toBe(0)
    expect(d.magnetState).toBe('sane')
  })

  test('effective r_in is always ISCO (ignore free rinM)', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const d = normalizeDisk({ rinM: 12, rinFree: true })
    const g = effectiveDiskGeom(p, d)
    expect(g.rinOverM).toBeCloseTo(6, 3)
  })

  test('H/r is thin-disk derived', () => {
    const h = thinDiskScaleHeight(0.1, 6, 5 / 3)
    expect(h).toBeGreaterThan(0.02)
    expect(h).toBeLessThan(0.2)
  })

  test('ℓ̃ from r_in', () => {
    expect(keplerSpecificL(6)).toBeCloseTo(Math.sqrt(6), 5)
  })

  test('MAD class from low β', () => {
    expect(magnetClassFromBeta(1)).toBe('mad')
    expect(magnetClassFromBeta(100)).toBe('sane')
  })

  test('dens peak from ℓ', () => {
    const r = densPeakRadiusM(4, 3, 40)
    expect(r).toBeGreaterThan(3)
    expect(r).toBeLessThan(40)
  })

  test('MRI scale from β', () => {
    expect(plasmaBetaToMriScale(1)).toBeGreaterThan(plasmaBetaToMriScale(100))
  })
})
