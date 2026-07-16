import { describe, expect, test } from 'bun:test'
import { DEFAULT_DISK, normalizeDisk } from '../../src/physics/diskParams'
import { getDisk, setDisk } from '../../src/state/disk'

describe('disk orbital sense', () => {
  test('defaults prograde', () => {
    expect(DEFAULT_DISK.prograde).toBe(true)
    expect(normalizeDisk({}).prograde).toBe(true)
  })

  test('normalizeDisk accepts retrograde', () => {
    expect(normalizeDisk({ prograde: false }).prograde).toBe(false)
  })

  test('store setDisk toggles prograde', () => {
    setDisk({ prograde: true })
    expect(getDisk().prograde).toBe(true)
    setDisk({ prograde: false })
    expect(getDisk().prograde).toBe(false)
    setDisk({ prograde: true })
  })
})
