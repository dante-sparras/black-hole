import { describe, expect, test } from 'bun:test'
import {
  rnCriticalImpact,
  shadowDiagnostics,
} from '../../src/physics/diagnostics'
import { normalizeParams } from '../../src/physics/validate'
import { deriveGeometry } from '../../src/physics/derive'

describe('shadowDiagnostics', () => {
  test('Schwarzschild: b_c = 3√3 M, diameter 6√3 M', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const d = shadowDiagnostics(p)
    expect(d.bCritPro).toBeCloseTo(3 * Math.sqrt(3), 5)
    expect(d.bCritRet).toBeCloseTo(3 * Math.sqrt(3), 5)
    expect(d.shadowDiameter).toBeCloseTo(6 * Math.sqrt(3), 5)
    expect(d.rPhotonOverM).toBeCloseTo(3, 5)
    expect(d.rIscoOverM).toBeCloseTo(6, 5)
    expect(d.rPlusOverM).toBeCloseTo(2, 5)
  })

  test('scales with M', () => {
    const p = normalizeParams({ mass: 2, spinStar: 0, charge: 0 })
    const d = shadowDiagnostics(p)
    expect(d.bCritPro).toBeCloseTo(6 * Math.sqrt(3), 5)
    expect(d.shadowDiameter).toBeCloseTo(12 * Math.sqrt(3), 5)
  })

  test('Kerr: prograde b_c shrinks, retrograde grows', () => {
    const p0 = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const p9 = normalizeParams({ mass: 1, spinStar: 0.9, charge: 0 })
    const d0 = shadowDiagnostics(p0)
    const d9 = shadowDiagnostics(p9)
    expect(d9.bCritPro).toBeLessThan(d0.bCritPro)
    expect(d9.bCritRet).toBeGreaterThan(d0.bCritRet)
    expect(d9.shadowDiameter).toBeGreaterThan(0)
  })

  test('RN: charge reduces b_c vs Schw', () => {
    const schw = shadowDiagnostics(normalizeParams({ mass: 1, spinStar: 0, charge: 0 }))
    const rn = shadowDiagnostics(normalizeParams({ mass: 1, spinStar: 0, charge: 0.6 }))
    expect(rn.bCritPro).toBeLessThan(schw.bCritPro)
    expect(rn.rPlus).toBeLessThan(schw.rPlus)
  })

  test('uses derived geometry when provided', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.5, charge: 0.2 })
    const g = deriveGeometry(p)
    const d = shadowDiagnostics(p, g)
    expect(d.rIsco).toBe(g.rIsco)
    expect(d.rPlus).toBe(g.rPlus)
  })
})

describe('rnCriticalImpact', () => {
  test('Q=0 recovers 3√3', () => {
    expect(rnCriticalImpact(1, 0)).toBeCloseTo(3 * Math.sqrt(3), 3)
  })
})
