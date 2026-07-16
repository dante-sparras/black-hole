import { describe, expect, test } from 'bun:test'
import {
  BHCM_MAGIC,
  cubePeakDensity,
  decodeBhcm,
  encodeBhcm,
  sampleGrmhdCube,
  synthesizeGrmhdLikeCube,
} from '../../src/physics/grmhdCube'

describe('grmhdCube BHCM', () => {
  test('encode/decode roundtrip', () => {
    const c = synthesizeGrmhdLikeCube({ n: 24, halfBoxM: 20, zHalfM: 6, seed: 1 })
    const buf = encodeBhcm(c)
    expect(new DataView(buf).getUint32(0, true)).toBe(BHCM_MAGIC)
    const d = decodeBhcm(buf)
    expect(d.nx).toBe(c.nx)
    expect(d.ny).toBe(c.ny)
    expect(d.nz).toBe(c.nz)
    expect(d.data.length).toBe(c.data.length)
    expect(d.data[0]).toBeCloseTo(c.data[0]!, 5)
  })

  test('sample midplane dens > outside box', () => {
    const c = synthesizeGrmhdLikeCube({ n: 32, halfBoxM: 25, zHalfM: 8, rInM: 3, rOutM: 20 })
    const mid = sampleGrmhdCube(c, 10, 0, 0)
    const far = sampleGrmhdCube(c, 100, 0, 0)
    const pole = sampleGrmhdCube(c, 10, 50, 0)
    expect(mid).toBeGreaterThan(0.01)
    expect(far).toBe(0)
    expect(pole).toBe(0)
    expect(cubePeakDensity(c)).toBeGreaterThan(0.5)
  })

  test('rejects bad magic', () => {
    const bad = new ArrayBuffer(64)
    expect(() => decodeBhcm(bad)).toThrow()
  })
})
