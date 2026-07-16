import { describe, expect, test } from 'bun:test'
import { withBatch, isBatching, emitStore } from '../../src/state/batch'
import { setParams, getParams, subscribe } from '../../src/state/params'
import { setDisk, getDisk, subscribeDisk } from '../../src/state/disk'
import { setScene } from '../../src/state/scene'
import { applyPreset } from '../../src/state/presets'

describe('store batching', () => {
  test('withBatch defers emitStore until end', () => {
    const fires: string[] = []
    withBatch(() => {
      expect(isBatching()).toBe(true)
      emitStore('a', () => fires.push('a'))
      emitStore('b', () => fires.push('b'))
      emitStore('a', () => fires.push('a2')) // latest wins for key a
      expect(fires).toEqual([])
    })
    expect(fires).toEqual(['a2', 'b'])
  })

  test('setScene multi-patch notifies each store once', () => {
    let paramsN = 0
    let diskN = 0
    const u1 = subscribe(() => {
      paramsN++
    })
    const u2 = subscribeDisk(() => {
      diskN++
    })
    // subscribe fires immediately
    const p0 = paramsN
    const d0 = diskN
    setScene({
      params: { mass: 1.1, spinStar: 0.1, charge: 0 },
      disk: { mdot: 0.2, outerM: 20 },
    })
    expect(paramsN).toBe(p0 + 1)
    expect(diskN).toBe(d0 + 1)
    expect(getParams().mass).toBeCloseTo(1.1, 5)
    expect(getDisk().mdot).toBeCloseTo(0.2, 5)
    u1()
    u2()
  })

  test('applyPreset batches store notifications', () => {
    let n = 0
    const u = subscribe(() => {
      n++
    })
    const before = n
    applyPreset('default')
    // one params notify from batched preset (not 4 separate storms on params)
    expect(n).toBe(before + 1)
    u()
  })
})
