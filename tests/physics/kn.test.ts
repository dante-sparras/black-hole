import { describe, expect, test } from 'bun:test'
import { knGeometry } from '../../src/physics/kn'
import { shadowDiagnostics } from '../../src/physics/diagnostics'
import { normalizeParams } from '../../src/physics/validate'

describe('knGeometry', () => {
  test('RN unit mass Q=0.5', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0.5 })
    const g = knGeometry(p)
    expect(g.family).toBe('reissner-nordstrom')
    expect(g.rPlus).toBeCloseTo(1 + Math.sqrt(0.75), 10)
    expect(g.rMinus).toBeCloseTo(1 - Math.sqrt(0.75), 10)
    expect(g.hasHorizon).toBe(true)
  })

  test('KN with spin and charge', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.5, charge: 0.3 })
    const g = knGeometry(p)
    expect(g.family).toBe('kerr-newman')
    const a = p.spinStar * p.mass
    const disc = p.mass * p.mass - a * a - p.charge * p.charge
    expect(g.rPlus).toBeCloseTo(p.mass + Math.sqrt(disc), 10)
  })

  test('DerivedGeometry.criticalImpact matches diagnostics for RN', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0.5 })
    const g = knGeometry(p)
    const d = shadowDiagnostics(p, g)
    expect(g.criticalImpact).toBeCloseTo(d.bCritPro, 10)
    expect(g.rPhotonSphere).toBeCloseTo(d.rPhoton, 10)
  })

  test('DerivedGeometry.criticalImpact matches diagnostics for KN', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.6, charge: 0.3 })
    const g = knGeometry(p)
    const d = shadowDiagnostics(p, g)
    expect(g.criticalImpact).toBeCloseTo(d.bCritPro, 10)
  })
})
