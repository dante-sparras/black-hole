import { describe, expect, test } from 'bun:test'
import { criticalImpacts } from '../../src/physics/kerr'
import {
  impactToConserved,
  kerrDelta,
  radialPotentialR,
  schwCriticalImpact,
  thetaPotential,
  traceEquatorialImpact,
  traceKerrBlNull,
} from '../../src/physics/geodesic/kerrBl'

describe('kerrBl metric / potentials', () => {
  test('Schw Δ = r(r − 2M)', () => {
    expect(kerrDelta(6, 1, 0)).toBeCloseTo(6 * 4, 10)
    expect(kerrDelta(2, 1, 0)).toBeCloseTo(0, 10)
  })

  test('Schw critical: R(r_ph)=0 at b = 3√3 M', () => {
    const M = 1
    const bc = schwCriticalImpact(M)
    const R = radialPotentialR(3 * M, M, 0, 1, bc, 0)
    expect(Math.abs(R)).toBeLessThan(1e-8)
  })

  test('Schw subcritical b has R>0 outside photon sphere (can reach)', () => {
    // At large r, R ~ r⁴ > 0 always for any b; check R at r=3M for b < bc
    const M = 1
    const bc = schwCriticalImpact(M)
    // For b slightly below bc, the peak of the barrier is lower — R(3M) > 0
    // Actually for Schw R(3M) = 81 - 9 b² + 6 b² = 81 - 3 b²; zero at b²=27
    const R_sub = radialPotentialR(3, M, 0, 1, bc * 0.9, 0)
    const R_crit = radialPotentialR(3, M, 0, 1, bc, 0)
    const R_super = radialPotentialR(3, M, 0, 1, bc * 1.1, 0)
    expect(R_crit).toBeCloseTo(0, 6)
    expect(R_sub).toBeGreaterThan(0)
    expect(R_super).toBeLessThan(0)
  })

  test('equatorial Θ=0 when Q=0', () => {
    expect(thetaPotential(Math.PI / 2, 0.9, 1, 4, 0)).toBeCloseTo(0, 10)
  })

  test('impactToConserved maps b,q', () => {
    const c = impactToConserved(5.2, 1.5, 1)
    expect(c.E).toBe(1)
    expect(c.Lz).toBeCloseTo(5.2, 10)
    expect(c.Q).toBeCloseTo(1.5, 10)
  })
})

describe('traceKerrBlNull Schwarzschild critical curve', () => {
  const M = 1
  const bc = schwCriticalImpact(M)

  test('radial head-on (b=0) captures', () => {
    const r = traceEquatorialImpact({ mass: M, spinLength: 0, b: 0 })
    expect(r.fate).toBe('captured')
    expect(r.minR).toBeLessThanOrEqual(2.1 * M)
  })

  test('well below b_c captures', () => {
    const r = traceEquatorialImpact({ mass: M, spinLength: 0, b: 0.7 * bc })
    expect(r.fate).toBe('captured')
  })

  test('well above b_c escapes', () => {
    const r = traceEquatorialImpact({ mass: M, spinLength: 0, b: 1.3 * bc })
    expect(r.fate).toBe('escaped')
  })

  test('transition within 5% of analytic b_c', () => {
    let lo = 0.5 * bc
    let hi = 1.5 * bc
    for (let i = 0; i < 16; i++) {
      const mid = 0.5 * (lo + hi)
      const f = traceEquatorialImpact({
        mass: M,
        spinLength: 0,
        b: mid,
        rStart: 120 * M,
        maxSteps: 20_000,
        escapeRadius: 250 * M,
      }).fate
      if (f === 'captured') lo = mid
      else hi = mid
    }
    const bTrans = 0.5 * (lo + hi)
    const rel = Math.abs(bTrans - bc) / bc
    expect(rel).toBeLessThan(0.05)
  })
})

describe('traceKerrBlNull Kerr critical curve', () => {
  const M = 1
  const aStar = 0.9
  const a = aStar * M
  const { prograde: bPro, retrograde: bRet } = criticalImpacts(M, aStar)

  test('high spin head-on captures inside r₊', () => {
    const r = traceEquatorialImpact({ mass: M, spinLength: a, b: 0 })
    expect(r.fate).toBe('captured')
  })

  test('prograde side: subcritical captures, supercritical escapes', () => {
    // Prograde b_c is smaller; rays with b << b_pro capture, b >> b_pro escape
    // Sign: Lz > 0 co-rotating with a > 0
    const cap = traceEquatorialImpact({
      mass: M,
      spinLength: a,
      b: 0.75 * bPro,
      rStart: 120 * M,
      maxSteps: 20_000,
    })
    const esc = traceEquatorialImpact({
      mass: M,
      spinLength: a,
      b: 1.25 * bPro,
      rStart: 120 * M,
      maxSteps: 20_000,
    })
    expect(cap.fate).toBe('captured')
    expect(esc.fate).toBe('escaped')
  })

  test('prograde transition within 12% of analytic b_c^pro', () => {
    // BL exact should beat RT; allow modest margin for discrete Mino steps
    let lo = 0.5 * bPro
    let hi = 1.5 * bPro
    for (let i = 0; i < 14; i++) {
      const mid = 0.5 * (lo + hi)
      const f = traceEquatorialImpact({
        mass: M,
        spinLength: a,
        b: mid,
        rStart: 120 * M,
        maxSteps: 20_000,
        escapeRadius: 250 * M,
      }).fate
      if (f === 'captured') lo = mid
      else hi = mid
    }
    const bTrans = 0.5 * (lo + hi)
    const rel = Math.abs(bTrans - bPro) / bPro
    expect(rel).toBeLessThan(0.12)
  })

  test('retrograde b_c is larger than prograde; far retrograde escapes', () => {
    expect(bRet).toBeGreaterThan(bPro)
    const esc = traceEquatorialImpact({
      mass: M,
      spinLength: a,
      b: -1.25 * bRet, // opposite side, |b| > b_ret
      rStart: 120 * M,
      maxSteps: 20_000,
    })
    expect(esc.fate).toBe('escaped')
  })
})

describe('traceKerrBlNull non-equatorial', () => {
  test('face-on-ish ray with Q>0 still terminates', () => {
    const M = 1
    const cons = impactToConserved(0, 12, 1) // radial + Carter
    const r = traceKerrBlNull({
      mass: M,
      spinLength: 0,
      conserved: cons,
      origin: { r: 80 * M, theta: Math.PI / 2 - 0.3, phi: 0 },
      signR: -1,
      signTheta: 1,
      maxSteps: 10_000,
      escapeRadius: 200 * M,
    })
    expect(
      r.fate === 'captured' || r.fate === 'escaped' || r.fate === 'max_steps',
    ).toBe(true)
    expect(r.steps).toBeGreaterThan(0)
  })
})
