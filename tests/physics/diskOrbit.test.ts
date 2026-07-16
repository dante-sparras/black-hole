import { describe, expect, test } from 'bun:test'
import { DEFAULT_DISK, normalizeDisk } from '../../src/physics/diskParams'
import { getDisk, setDisk } from '../../src/state/disk'

describe('disk orbital sense (locked co-rotating)', () => {
  test('defaults prograde / co-rotating', () => {
    expect(DEFAULT_DISK.prograde).toBe(true)
    expect(normalizeDisk({}).prograde).toBe(true)
  })

  test('normalizeDisk forces co-rotating even if false requested', () => {
    expect(normalizeDisk({ prograde: false }).prograde).toBe(true)
  })

  test('store cannot keep counter-rotating after normalize', () => {
    setDisk({ prograde: false })
    expect(getDisk().prograde).toBe(true)
    setDisk({ prograde: true })
    expect(getDisk().prograde).toBe(true)
  })
})
