import { describe, expect, test } from 'bun:test'
import {
  azimuthSeamDelta,
  diskTemperatureJitter,
  diskTextureFactor,
  hash2,
  turbulence2,
  valueNoise2,
} from '../../src/physics/diskTexture'

describe('disk texture primitives', () => {
  test('hash2 in [0,1)', () => {
    for (let i = 0; i < 20; i++) {
      const h = hash2(i * 1.3, i * 0.7)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(1)
    }
  })

  test('valueNoise2 in [0,1]', () => {
    const n = valueNoise2(1.5, 2.3, 2)
    expect(n).toBeGreaterThanOrEqual(0)
    expect(n).toBeLessThanOrEqual(1)
  })

  test('turbulence2 finite', () => {
    expect(Number.isFinite(turbulence2(3, 1.2))).toBe(true)
  })
})

describe('diskTextureFactor', () => {
  test('positive and bounded', () => {
    const f = diskTextureFactor(10, 2, 1)
    expect(f).toBeGreaterThan(0.15)
    expect(f).toBeLessThan(2.5)
  })

  test('zero arm contrast → near unity base (still mild ripple/turb)', () => {
    const f = diskTextureFactor(12, 0, 1, {
      armContrast: 0,
      turbContrast: 0,
      dustContrast: 0,
      streamContrast: 0,
    })
    expect(f).toBeGreaterThan(0.7)
    expect(f).toBeLessThan(1.3)
  })

  test('varies with azimuth (spiral structure)', () => {
    const samples: number[] = []
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2
      samples.push(diskTextureFactor(10 * Math.cos(ang), 10 * Math.sin(ang), 1))
    }
    const min = Math.min(...samples)
    const max = Math.max(...samples)
    expect(max - min).toBeGreaterThan(0.08)
  })

  test('seamless across atan2 branch cut (no radial seam)', () => {
    for (const rho of [6, 10, 14, 20]) {
      expect(azimuthSeamDelta(rho, 1)).toBeLessThan(1e-3)
      expect(azimuthSeamDelta(rho, 1, { time: 3.5, prograde: false })).toBeLessThan(1e-3)
    }
  })

  test('continuous when walking around the circle', () => {
    const rho = 12
    let maxStep = 0
    let prev = diskTextureFactor(rho, 0, 1)
    for (let i = 1; i <= 128; i++) {
      const ang = (i / 128) * Math.PI * 2
      const f = diskTextureFactor(rho * Math.cos(ang), rho * Math.sin(ang), 1)
      maxStep = Math.max(maxStep, Math.abs(f - prev))
      prev = f
    }
    // Closing the loop
    const first = diskTextureFactor(rho, 0, 1)
    maxStep = Math.max(maxStep, Math.abs(prev - first))
    // Smooth walk: no single step jump like a branch-cut seam
    expect(maxStep).toBeLessThan(0.15)
  })

  test('Keplerian shear changes pattern over time at fixed point', () => {
    const f0 = diskTextureFactor(10, 2, 1, { time: 0 })
    const f1 = diskTextureFactor(10, 2, 1, { time: 2 })
    // With shearGain, motion is visible within a couple of seconds
    expect(Math.abs(f1 - f0)).toBeGreaterThan(0.03)
  })

  test('inner radius shears faster than outer (differential rotation)', () => {
    // Phase advance ∝ Ω ∝ r^{-3/2}: same Δt moves pattern more at small r
    const dt = 1.5
    const dInner = Math.abs(
      diskTextureFactor(6, 0, 1, { time: dt }) - diskTextureFactor(6, 0, 1, { time: 0 }),
    )
    const dOuter = Math.abs(
      diskTextureFactor(20, 0, 1, { time: dt }) - diskTextureFactor(20, 0, 1, { time: 0 }),
    )
    expect(dInner).toBeGreaterThan(dOuter * 0.9)
  })
})

describe('diskTemperatureJitter', () => {
  test('near 1', () => {
    const j = diskTemperatureJitter(10, 3, 1)
    expect(j).toBeGreaterThan(0.8)
    expect(j).toBeLessThan(1.25)
  })
})
