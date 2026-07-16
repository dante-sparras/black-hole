import { describe, expect, test } from 'bun:test'
import {
  azimuthSeamDelta,
  DISK_TEXTURE,
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
    expect(f).toBeGreaterThanOrEqual(DISK_TEXTURE.texMin - 1e-6)
    expect(f).toBeLessThanOrEqual(DISK_TEXTURE.texMax + 1e-6)
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
      expect(azimuthSeamDelta(rho, 1)).toBeLessThan(2e-3)
      // With shear, value-noise grid can have small jumps at φ=±π; keep tight
      expect(azimuthSeamDelta(rho, 1, { time: 3.5, prograde: false })).toBeLessThan(3e-3)
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
    let maxDiff = 0
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      const x = 12 * Math.cos(ang)
      const z = 12 * Math.sin(ang)
      const f0 = diskTextureFactor(x, z, 1, { time: 0 })
      const f1 = diskTextureFactor(x, z, 1, { time: 1.5 })
      maxDiff = Math.max(maxDiff, Math.abs(f1 - f0))
    }
    expect(maxDiff).toBeGreaterThan(0.015)
  })

  test('inner radius shears faster than outer (differential rotation)', () => {
    // Phase advance ∝ (r/M)^{-3/2}: same Δt moves pattern more at small r.
    // Average |Δf| over azimuth so high-contrast structure doesn't flip the inequality.
    const dt = 0.2
    let dInner = 0
    let dOuter = 0
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2
      const ci = Math.cos(ang)
      const si = Math.sin(ang)
      dInner += Math.abs(
        diskTextureFactor(9 * ci, 9 * si, 1, { time: dt }) -
          diskTextureFactor(9 * ci, 9 * si, 1, { time: 0 }),
      )
      dOuter += Math.abs(
        diskTextureFactor(28 * ci, 28 * si, 1, { time: dt }) -
          diskTextureFactor(28 * ci, 28 * si, 1, { time: 0 }),
      )
    }
    expect(dInner).toBeGreaterThan(dOuter * 0.75)
  })

  test('animation rate at fixed r/M is independent of mass', () => {
    // Bug: geometric Ω∝1/M froze the disk at high mass. Dimless Ω̃ fixes it.
    const opts = { time: 1.2, shearRate: 1.2 }
    // Same Cartesian (x,z) scaled with M so r/M matches
    const d1 = Math.abs(
      diskTextureFactor(10, 2, 1, opts) - diskTextureFactor(10, 2, 1, { ...opts, time: 0 }),
    )
    const d10 = Math.abs(
      diskTextureFactor(100, 20, 10, opts) - diskTextureFactor(100, 20, 10, { ...opts, time: 0 }),
    )
    // Same fractional radii → similar |Δf| (allow noise variance)
    expect(d10).toBeGreaterThan(d1 * 0.35)
    expect(d1).toBeGreaterThan(d10 * 0.35)
  })
})

describe('diskTemperatureJitter', () => {
  test('near 1', () => {
    const j = diskTemperatureJitter(10, 3, 1)
    expect(j).toBeGreaterThan(0.8)
    expect(j).toBeLessThan(1.25)
  })
})
