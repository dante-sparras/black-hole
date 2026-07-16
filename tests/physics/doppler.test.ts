import { describe, expect, test } from 'bun:test'
import {
  bolometricBeaming,
  diskFrequencyFactor,
  gravitationalRedshift,
  keplerOrbitalSpeed,
  kerrOrbitalSpeed,
  progradeDirAboutY,
  specialRelDoppler,
} from '../../src/physics/geodesic/doppler'
import { blackbodyRgb } from '../../src/physics/blackbody'
import { vec3 } from '../../src/physics/geodesic/vec3'

describe('keplerOrbitalSpeed', () => {
  test('at r = 6M is 1/√6', () => {
    expect(keplerOrbitalSpeed(1, 6)).toBeCloseTo(1 / Math.sqrt(6), 5)
  })

  test('falls with radius', () => {
    expect(keplerOrbitalSpeed(1, 20)).toBeLessThan(keplerOrbitalSpeed(1, 8))
  })
})

describe('specialRelDoppler', () => {
  test('β=0 → D=1', () => {
    expect(specialRelDoppler(0, 0.5)).toBeCloseTo(1, 10)
  })

  test('approaching (μ>0) blueshifts D>1', () => {
    const D = specialRelDoppler(0.3, 0.8)
    expect(D).toBeGreaterThan(1)
  })

  test('receding (μ<0) redshifts D<1', () => {
    const D = specialRelDoppler(0.3, -0.8)
    expect(D).toBeLessThan(1)
  })

  test('left/right symmetry: opposite μ are inverse up to γ', () => {
    const beta = 0.4
    const Dp = specialRelDoppler(beta, 0.7)
    const Dm = specialRelDoppler(beta, -0.7)
    // Not exact inverses because of γ, but product pattern holds:
    // D(+μ) > 1 > D(−μ)
    expect(Dp).toBeGreaterThan(1)
    expect(Dm).toBeLessThan(1)
  })
})

describe('gravitationalRedshift', () => {
  test('at infinity → 1', () => {
    expect(gravitationalRedshift(1, 1e6)).toBeCloseTo(1, 5)
  })

  test('at r=6M is √(1-1/3)=√(2/3)', () => {
    expect(gravitationalRedshift(1, 6)).toBeCloseTo(Math.sqrt(2 / 3), 5)
  })

  test('deeper in well → smaller g', () => {
    expect(gravitationalRedshift(1, 4)).toBeLessThan(gravitationalRedshift(1, 12))
  })
})

describe('progradeDirAboutY', () => {
  test('at +x is +z direction', () => {
    const d = progradeDirAboutY(5, 0)
    expect(d.x).toBeCloseTo(0, 10)
    expect(d.z).toBeCloseTo(1, 10)
  })

  test('at +z is −x direction', () => {
    const d = progradeDirAboutY(0, 5)
    expect(d.x).toBeCloseTo(-1, 10)
    expect(d.z).toBeCloseTo(0, 10)
  })
})

describe('diskFrequencyFactor left vs right', () => {
  test('opposite sides of disk get opposite Doppler signs', () => {
    // Ray coming from -z toward origin (backward from camera on +z side... use rayDir +z)
    // Camera at +z looking at origin: rayDir ≈ (0,0,-1) toward hole.
    // Hit on +x: ê_φ = (0,0,1); nObs = -rayDir = (0,0,1); μ > 0 → blue
    // Hit on -x: ê_φ = (0,0,-1); nObs = (0,0,1); μ < 0 → red
    const rayDir = vec3(0, 0, -1)
    const blue = diskFrequencyFactor({
      mass: 1,
      rho: 10,
      hx: 10,
      hz: 0,
      rayDir,
    })
    const red = diskFrequencyFactor({
      mass: 1,
      rho: 10,
      hx: -10,
      hz: 0,
      rayDir,
    })
    expect(blue.D).toBeGreaterThan(1)
    expect(red.D).toBeLessThan(1)
    expect(blue.factor).toBeGreaterThan(red.factor)
  })
})

describe('kerrOrbitalSpeed', () => {
  test('a=0 matches Kepler', () => {
    expect(kerrOrbitalSpeed(1, 10, 0, true)).toBeCloseTo(keplerOrbitalSpeed(1, 10), 5)
  })

  test('prograde Ω smaller than Schw at fixed r; retrograde larger', () => {
    // Ω = √M / (r^{3/2} ± a√M) → prograde denominator larger
    const schw = kerrOrbitalSpeed(1, 8, 0, true)
    const pro = kerrOrbitalSpeed(1, 8, 0.9, true)
    const ret = kerrOrbitalSpeed(1, 8, 0.9, false)
    expect(pro).toBeLessThan(schw)
    expect(ret).toBeGreaterThan(schw)
  })
})

describe('bolometricBeaming / blackbodyRgb', () => {
  test('D>1 boosts intensity (ideal g³)', () => {
    expect(bolometricBeaming(1.5)).toBeGreaterThan(bolometricBeaming(1))
    expect(bolometricBeaming(1.5)).toBeCloseTo(1.5 ** 3, 10)
  })

  test('display mode is softer g²', () => {
    expect(bolometricBeaming(1.5, false)).toBeCloseTo(1.5 ** 2, 10)
  })

  test('hotter Kelvin is bluer (max-norm Planck)', () => {
    const cold = blackbodyRgb(2500)
    const hot = blackbodyRgb(12000)
    expect(hot.b / (hot.r + 1e-6)).toBeGreaterThan(cold.b / (cold.r + 1e-6))
  })
})
