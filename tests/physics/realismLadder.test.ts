import { describe, expect, test } from 'bun:test'
import {
  DISK_TEXTURE,
  frameDragPhase,
  logNormalUnitMean,
  photonRingSilk,
} from '../../src/physics/diskTexture'

describe('realism ladder helpers', () => {
  test('logNormalUnitMean is ~1 at n=0.5 and positive', () => {
    const mid = logNormalUnitMean(0.5, 0.55)
    expect(mid).toBeCloseTo(Math.exp(-0.5 * 0.55 * 0.55), 5)
    expect(logNormalUnitMean(0, 0.55)).toBeGreaterThan(0)
    expect(logNormalUnitMean(1, 0.55)).toBeGreaterThan(logNormalUnitMean(0, 0.55))
  })

  test('logNormalUnitMean sigma=0 is 1', () => {
    expect(logNormalUnitMean(0.2, 0)).toBeCloseTo(1, 10)
  })

  test('frameDragPhase scales with a★ and falls with r', () => {
    const near = frameDragPhase(0.9, 3)
    const far = frameDragPhase(0.9, 30)
    const zero = frameDragPhase(0, 3)
    expect(zero).toBe(0)
    expect(near).toBeGreaterThan(far)
    expect(near).toBeCloseTo(DISK_TEXTURE.frameDragGain * 0.9 / 3, 5)
  })

  test('photonRingSilk boosts multi-wrap near r~3M', () => {
    const first = photonRingSilk(0, 3)
    const wrapNear = photonRingSilk(2, 3)
    const wrapFar = photonRingSilk(2, 20)
    expect(first).toBe(1)
    expect(wrapNear).toBeGreaterThan(wrapFar)
    expect(wrapNear).toBeGreaterThan(1.3)
    expect(wrapNear).toBeLessThanOrEqual(2.4)
  })
})
