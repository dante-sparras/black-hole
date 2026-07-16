import { describe, expect, test } from 'bun:test'
import { DEFAULT_DISK, normalizeDisk } from '../../src/physics/diskParams'

describe('disk params (collapsed free bases)', () => {
  test('defaults free bases only', () => {
    const d = normalizeDisk({})
    expect(d.mdot).toBe(DEFAULT_DISK.mdot)
    expect(d.rho0).toBe(1)
    expect(d.plasmaBeta).toBe(100)
    expect(d.jetBoost).toBe(0)
    expect(d.tiltRad).toBe(0)
    expect(d.structure).toBe(1)
  })

  test('clamps jetBoost and ignores unknown free rin fields', () => {
    const d = normalizeDisk({ jetBoost: 5, rho0: 0.01 })
    expect(d.jetBoost).toBe(1)
    expect(d.rho0).toBe(0.05)
  })
})
