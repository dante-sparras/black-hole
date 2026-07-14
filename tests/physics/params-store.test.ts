import { describe, expect, test } from 'bun:test'
import { getDerived, getParams, setParams, subscribe } from '../../src/state/params'

describe('params store', () => {
  test('setParams updates derived geometry', () => {
    setParams({ mass: 1, spinStar: 0, charge: 0 })
    expect(getParams().mass).toBe(1)
    expect(getDerived().family).toBe('schwarzschild')

    setParams({ spinStar: 0.7 })
    expect(getParams().spinStar).toBeCloseTo(0.7, 10)
    expect(getDerived().family).toBe('kerr')
    expect(getDerived().rPlus).toBeLessThan(2)
  })

  test('subscribe fires on setParams', () => {
    setParams({ mass: 1, spinStar: 0, charge: 0 })
    let calls = 0
    const unsub = subscribe(() => {
      calls++
    })
    // immediate call on subscribe
    expect(calls).toBe(1)
    setParams({ mass: 2 })
    expect(calls).toBe(2)
    unsub()
    setParams({ mass: 3 })
    expect(calls).toBe(2)
  })
})
