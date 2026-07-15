import { describe, expect, test } from 'bun:test'
import { getCamera, setCamera } from '../../src/state/camera'
import { getDisk, setDisk } from '../../src/state/disk'
import { getLook, setLook } from '../../src/state/look'
import { getParams, setParams } from '../../src/state/params'
import { getScene, setScene, subscribeScene } from '../../src/state/scene'

describe('scene facade', () => {
  test('getScene returns all slices including disk', () => {
    setParams({ mass: 1, spinStar: 0.2, charge: 0 })
    setDisk({ mdot: 0.15, outerM: 25 })
    const s = getScene()
    expect(s.params.spinStar).toBeCloseTo(0.2, 5)
    expect(s.disk.mdot).toBeCloseTo(0.15, 5)
    expect(s.disk.outerM).toBe(25)
    expect(s.camera.distanceM).toBe(getCamera().distanceM)
    expect(s.look.exposure).toBe(getLook().exposure)
    expect(s.derived.family).toBe('kerr')
  })

  test('setScene patches multiple stores', () => {
    setScene({
      params: { spinStar: 0, charge: 0.4 },
      disk: { mdot: 0.05, outerM: 40 },
      camera: { distanceM: 55 },
      look: { bloomStrength: 0.25 },
    })
    expect(getParams().charge).toBeCloseTo(0.4, 5)
    expect(getDisk().mdot).toBeCloseTo(0.05, 5)
    expect(getDisk().outerM).toBe(40)
    expect(getCamera().distanceM).toBe(55)
    expect(getLook().bloomStrength).toBeCloseTo(0.25, 5)
    expect(getScene().derived.family).toBe('reissner-nordstrom')
  })

  test('subscribeScene fires on disk change', () => {
    let n = 0
    const unsub = subscribeScene(() => {
      n++
    })
    expect(n).toBeGreaterThanOrEqual(1)
    const before = n
    setDisk({ mdot: 0.33 })
    expect(n).toBeGreaterThan(before)
    const mid = n
    setCamera({ fov: 0.85 })
    expect(n).toBeGreaterThan(mid)
    unsub()
  })
})
