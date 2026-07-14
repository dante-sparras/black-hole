import { describe, expect, test } from 'bun:test'
import { getCamera, setCamera } from '../../src/state/camera'
import { getLook, setLook } from '../../src/state/look'
import { getParams, setParams } from '../../src/state/params'
import { getScene, setScene, subscribeScene } from '../../src/state/scene'

describe('scene facade', () => {
  test('getScene returns all slices', () => {
    setParams({ mass: 1, spinStar: 0.2, charge: 0, mdot: 0.1 })
    const s = getScene()
    expect(s.params.spinStar).toBeCloseTo(0.2, 5)
    expect(s.camera.distanceM).toBe(getCamera().distanceM)
    expect(s.look.exposure).toBe(getLook().exposure)
    expect(s.derived.family).toBe('kerr')
  })

  test('setScene patches multiple stores', () => {
    setScene({
      params: { spinStar: 0, charge: 0.4 },
      camera: { distanceM: 55 },
      look: { bloomStrength: 0.25 },
    })
    expect(getParams().charge).toBeCloseTo(0.4, 5)
    expect(getCamera().distanceM).toBe(55)
    expect(getLook().bloomStrength).toBeCloseTo(0.25, 5)
    expect(getScene().derived.family).toBe('reissner-nordstrom')
  })

  test('subscribeScene fires on any slice', () => {
    let n = 0
    const unsub = subscribeScene(() => {
      n++
    })
    // initial fire
    expect(n).toBeGreaterThanOrEqual(1)
    const before = n
    setParams({ mdot: 0.2 })
    expect(n).toBeGreaterThan(before)
    const mid = n
    setCamera({ fov: 0.85 })
    expect(n).toBeGreaterThan(mid)
    unsub()
  })
})
