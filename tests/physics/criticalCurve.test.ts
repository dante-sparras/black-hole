import { describe, expect, test } from 'bun:test'
import {
  familyCriticalImpact,
  familyCriticalImpacts,
  familyPhotonSphere,
  rnCriticalImpact,
  rnPhotonSphere,
} from '../../src/physics/criticalCurve'
import { criticalImpacts } from '../../src/physics/kerr'
import { normalizeParams } from '../../src/physics/validate'

describe('criticalCurve family helpers', () => {
  test('Schw: b_c = 3√3 M, r_ph = 3M', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    expect(familyPhotonSphere(p)).toBeCloseTo(3, 10)
    expect(familyCriticalImpact(p)).toBeCloseTo(3 * Math.sqrt(3), 10)
    const both = familyCriticalImpacts(p)
    expect(both.prograde).toBeCloseTo(both.retrograde, 10)
  })

  test('Kerr matches Bardeen criticalImpacts', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.9, charge: 0 })
    const fam = familyCriticalImpacts(p)
    const kerr = criticalImpacts(1, 0.9)
    expect(fam.prograde).toBeCloseTo(kerr.prograde, 10)
    expect(fam.retrograde).toBeCloseTo(kerr.retrograde, 10)
    expect(fam.prograde).toBeLessThan(fam.retrograde)
  })

  test('RN Q=0 recovers Schw', () => {
    expect(rnCriticalImpact(1, 0)).toBeCloseTo(3 * Math.sqrt(3), 3)
    expect(rnPhotonSphere(1, 0)).toBeCloseTo(3, 10)
  })

  test('RN charge reduces b_c and r_ph', () => {
    const b0 = rnCriticalImpact(1, 0)
    const b = rnCriticalImpact(1, 0.6)
    expect(b).toBeLessThan(b0)
    expect(rnPhotonSphere(1, 0.6)).toBeLessThan(3)
  })

  test('scales with M', () => {
    const p = normalizeParams({ mass: 2, spinStar: 0, charge: 0 })
    expect(familyCriticalImpact(p)).toBeCloseTo(6 * Math.sqrt(3), 10)
    expect(familyPhotonSphere(p)).toBeCloseTo(6, 10)
  })
})
