import { describe, expect, test } from 'bun:test'
import { deriveGeometry } from '../../src/physics/derive'
import { normalizeParams } from '../../src/physics/validate'
import { toUniforms } from '../../src/render/uniforms'

describe('toUniforms', () => {
  test('maps params and derived fields', () => {
    const p = normalizeParams({ mass: 2, spinStar: 0.5, charge: 0.1 })
    const d = deriveGeometry(p)
    const u = toUniforms(p, d)
    expect(u.mass).toBe(p.mass)
    expect(u.spinStar).toBe(p.spinStar)
    expect(u.spinLength).toBe(d.spinLength)
    expect(u.charge).toBe(p.charge)
    expect(u.rPlus).toBe(d.rPlus)
    expect(u.rMinus).toBe(d.rMinus)
  })
})
