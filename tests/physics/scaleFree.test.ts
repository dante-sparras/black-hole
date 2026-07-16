import { describe, expect, test } from 'bun:test'
import {
  getScaleFree,
  setScaleFree,
  subscribeScaleFree,
  SCALE_FREE_DEFAULT,
} from '../../src/state/scaleFree'
import { applyPreset } from '../../src/state/presets'
import { getScene, setScene } from '../../src/state/scene'

describe('scaleFree store (global, not per-preset)', () => {
  test('defaults to scale-free ON', () => {
    setScaleFree(SCALE_FREE_DEFAULT)
    expect(getScaleFree()).toBe(true)
    expect(SCALE_FREE_DEFAULT).toBe(true)
  })

  test('setScaleFree toggles', () => {
    setScaleFree(false)
    expect(getScaleFree()).toBe(false)
    setScaleFree(true)
    expect(getScaleFree()).toBe(true)
  })

  test('subscribe fires', () => {
    let n = 0
    const u = subscribeScaleFree(() => {
      n++
    })
    expect(n).toBeGreaterThanOrEqual(1)
    const before = n
    setScaleFree(!getScaleFree())
    expect(n).toBeGreaterThan(before)
    u()
    setScaleFree(true)
  })

  test('presets do not change scaleFree', () => {
    setScaleFree(false)
    applyPreset('hot')
    expect(getScaleFree()).toBe(false)
    setScaleFree(true)
  })

  test('scene snapshot includes scaleFree; setScene can patch it', () => {
    setScaleFree(true)
    expect(getScene().scaleFree).toBe(true)
    setScene({ scaleFree: false })
    expect(getScene().scaleFree).toBe(false)
    setScaleFree(true)
  })
})
