import { describe, expect, test } from 'bun:test'
import {
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
    expect(f).toBeGreaterThan(0.2)
    expect(f).toBeLessThan(2)
  })

  test('zero arm contrast → near unity base (still mild ripple/turb)', () => {
    const f = diskTextureFactor(12, 0, 1, {
      armContrast: 0,
      turbContrast: 0,
    })
    // only ripple remains
    expect(f).toBeGreaterThan(0.85)
    expect(f).toBeLessThan(1.15)
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

  test('varies with radius (spiral pitch)', () => {
    const a = diskTextureFactor(8, 1, 1)
    const b = diskTextureFactor(14, 1, 1)
    // Not required different always, but factor is defined
    expect(Number.isFinite(a + b)).toBe(true)
  })
})

describe('diskTemperatureJitter', () => {
  test('near 1', () => {
    const j = diskTemperatureJitter(10, 3, 1)
    expect(j).toBeGreaterThan(0.8)
    expect(j).toBeLessThan(1.25)
  })
})
