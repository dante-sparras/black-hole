import { describe, expect, test } from 'bun:test'
import { getCamera, setCamera } from '../../src/state/camera'
import { getDisk, setDisk } from '../../src/state/disk'
import { getLook, setLook } from '../../src/state/look'
import { getParams, setParams } from '../../src/state/params'
import { getScene, setScene, subscribeScene } from '../../src/state/scene'

describe('scene facade', () => {
  test('getScene returns all slices including disk + geodesic + scaleFree + quality + grmhd', () => {
    setParams({ mass: 1, spinStar: 0.2, charge: 0 })
    setDisk({ mdot: 0.15, outerM: 25 })
    const s = getScene()
    expect(s.params.spinStar).toBeCloseTo(0.2, 5)
    expect(s.disk.mdot).toBeCloseTo(0.15, 5)
    expect(s.disk.outerM).toBe(25)
    expect(s.camera.distanceM).toBe(getCamera().distanceM)
    expect(s.look.exposure).toBe(getLook().exposure)
    expect(s.derived.family).toBe('kerr')
    expect(s.geodesic === 'rt' || s.geodesic === 'bl').toBe(true)
    expect(typeof s.scaleFree).toBe('boolean')
    expect(typeof s.idealBeam).toBe('boolean')
    expect(['low', 'med', 'high']).toContain(s.quality.level)
    expect(typeof s.grmhd.enabled).toBe('boolean')
    expect(typeof s.grmhd.hasCube).toBe('boolean')
  })

  test('setScene patches multiple stores', () => {
    setScene({
      params: { spinStar: 0, charge: 0.4 },
      disk: { mdot: 0.05, outerM: 40 },
      camera: { distanceM: 55 },
      look: { bloomStrength: 0.25 },
      quality: 'low',
      grmhd: { enabled: false, mix: 0 },
    })
    expect(getParams().charge).toBeCloseTo(0.4, 5)
    expect(getDisk().mdot).toBeCloseTo(0.05, 5)
    expect(getDisk().outerM).toBe(40)
    expect(getCamera().distanceM).toBe(55)
    expect(getLook().bloomStrength).toBeCloseTo(0.25, 5)
    expect(getScene().derived.family).toBe('reissner-nordstrom')
    expect(getScene().quality.level).toBe('low')
    expect(getScene().grmhd.enabled).toBe(false)
    expect(getScene().grmhd.mix).toBe(0)
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
