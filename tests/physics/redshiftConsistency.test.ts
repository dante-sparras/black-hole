import { describe, expect, test } from 'bun:test'
import {
  circularOmega,
  circularU_t,
  equatorialMetric,
  orbitingRedshiftFactor,
} from '../../src/physics/geodesic/doppler'
import { DISK_EMISSION } from '../../src/physics/disk'
import { beamIntensity, colorRedshiftFactor } from '../../src/physics/diskDisplay'

/**
 * GPU dens path (orbitingDiskG / processDiskVolumeSample) must match this CPU
 * formula bit-for-bit in the analytic limits (floors differ only deep in well).
 */
function gpuStyleG(options: {
  mass: number
  r: number
  spinLength: number
  charge: number
  mu: number
  prograde: boolean
}): number {
  const { mass, r, spinLength, charge, mu, prograde } = options
  const rho = Math.max(r, 1e-5)
  const Omega = circularOmega(mass, rho, spinLength, prograde)
  const { g_tt, g_tphi, g_phiphi } = equatorialMetric(mass, rho, spinLength, charge)
  const X = -g_tt - 2 * Omega * g_tphi - Omega * Omega * g_phiphi
  const u_t = 1 / Math.sqrt(Math.max(X, 1e-8))
  const lambda = rho * Math.min(1, Math.max(-1, mu))
  // GPU floor on denom → g ≳ 0.08 (display-safe)
  return 1 / Math.max(u_t * (1 - Omega * lambda), 0.08)
}

describe('redshift consistency (CPU ↔ dens GPU recipe)', () => {
  test('face-on Schw r=6M: g = √(1−3M/r) = 1/√2', () => {
    const { g } = orbitingRedshiftFactor({ mass: 1, r: 6, mu: 0 })
    const gGpu = gpuStyleG({
      mass: 1,
      r: 6,
      spinLength: 0,
      charge: 0,
      mu: 0,
      prograde: true,
    })
    expect(g).toBeCloseTo(Math.SQRT1_2, 5)
    expect(gGpu).toBeCloseTo(g, 5)
  })

  test('approaching (μ>0) blueshifts vs receding', () => {
    const blue = orbitingRedshiftFactor({ mass: 1, r: 10, mu: 0.55 })
    const red = orbitingRedshiftFactor({ mass: 1, r: 10, mu: -0.55 })
    const blueG = gpuStyleG({
      mass: 1,
      r: 10,
      spinLength: 0,
      charge: 0,
      mu: 0.55,
      prograde: true,
    })
    const redG = gpuStyleG({
      mass: 1,
      r: 10,
      spinLength: 0,
      charge: 0,
      mu: -0.55,
      prograde: true,
    })
    expect(blue.g).toBeGreaterThan(red.g)
    expect(blueG).toBeGreaterThan(redG)
    expect(blueG).toBeCloseTo(blue.g, 4)
    expect(redG).toBeCloseTo(red.g, 4)
  })

  test('Kerr prograde face-on g matches circularU_t inverse', () => {
    const a = 0.9
    const r = 8
    const ut = circularU_t(1, r, a, 0, true)
    const { g } = orbitingRedshiftFactor({
      mass: 1,
      r,
      spinLength: a,
      mu: 0,
      prograde: true,
    })
    expect(g).toBeCloseTo(1 / ut, 5)
    expect(
      gpuStyleG({
        mass: 1,
        r,
        spinLength: a,
        charge: 0,
        mu: 0,
        prograde: true,
      }),
    ).toBeCloseTo(g, 5)
  })

  test('color uses g^1 (Wien); ideal beam uses g^3', () => {
    expect(DISK_EMISSION.gColorExponent).toBe(1)
    expect(DISK_EMISSION.beamExponentIdeal).toBe(3)
    expect(colorRedshiftFactor(1.4)).toBeCloseTo(1.4, 5)
    expect(beamIntensity(1.4, true)).toBeCloseTo(Math.pow(1.4, 3), 5)
    expect(beamIntensity(1.4, false)).toBeCloseTo(Math.pow(1.4, 2), 5)
  })

  test('nObs convention: μ = ê_φ · (−rayDir) so approaching μ>0 for prograde +x side', () => {
    // ê_φ at +x is +z; photon toward camera from +x disk with nObs = +z → μ>0
    // orbitingRedshiftFactor docs: mu = ê_φ · n̂_obs
    const approach = orbitingRedshiftFactor({ mass: 1, r: 12, mu: 0.4 })
    const recede = orbitingRedshiftFactor({ mass: 1, r: 12, mu: -0.4 })
    expect(approach.g).toBeGreaterThan(1 * 0.5) // still can be <1 from grav
    expect(approach.g).toBeGreaterThan(recede.g)
  })
})
