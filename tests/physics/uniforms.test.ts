import { describe, expect, test } from 'bun:test'
import { deriveGeometry } from '../../src/physics/derive'
import { DEFAULT_DISK } from '../../src/physics/diskParams'
import { normalizeParams } from '../../src/physics/validate'
import { toUniforms } from '../../src/render/uniforms'

describe('toUniforms', () => {
  test('maps no-hair + disk + derived fields', () => {
    const p = normalizeParams({ mass: 2, spinStar: 0.5, charge: 0.1 })
    const d = deriveGeometry(p)
    const disk = { ...DEFAULT_DISK, mdot: 0.25, outerM: 30 }
    const u = toUniforms(p, d, disk)
    expect(u.mass).toBe(2)
    expect(u.spinStar).toBeCloseTo(0.5, 5)
    expect(u.charge).toBeCloseTo(0.1, 5)
    expect(u.mdot).toBe(0.25)
    expect(u.outerM).toBe(30)
    expect(u.rIsco).toBe(d.rIsco)
    expect(u.rPlus).toBe(d.rPlus)
  })
})
