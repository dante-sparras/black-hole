import { describe, expect, test } from 'bun:test'
import { fmt, fmtMdot, fmtTempK } from '../../src/ui/format'
import { diskPeakTemperatureK, densRestTemperatureK } from '../../src/physics/disk'
import { normalizeDisk } from '../../src/physics/diskParams'
import { normalizeParams } from '../../src/physics/validate'
import { effectiveDiskGeom } from '../../src/physics/diskGeometry'
import { novikovThornePeakRadius } from '../../src/physics/disk'
import { orbitingRedshiftFactor } from '../../src/physics/geodesic/doppler'
import { spinLength } from '../../src/physics/types'

describe('fmt helpers', () => {
  test('fmtTempK scales', () => {
    expect(fmtTempK(7000)).toBe('7000 K')
    expect(fmtTempK(12500)).toBe('12.5k K')
    expect(fmtTempK(0)).toBe('—')
  })
  test('fmtMdot', () => {
    expect(fmtMdot(0.1)).toBe(fmt(0.1, 2))
  })
})

describe('HUD peak temperature values', () => {
  test('default free bases produce finite T_peak ladder', () => {
    const params = normalizeParams({})
    const disk = normalizeDisk({})
    const geom = effectiveDiskGeom(params, disk)
    const tPeak = diskPeakTemperatureK(disk.mdot, geom.rinOverM, params.spinStar)
    const rPeak = novikovThornePeakRadius(geom.rIn)
    const tDens = densRestTemperatureK(rPeak, geom.rIn, disk.mdot, params.mass)
    const face = orbitingRedshiftFactor({
      mass: params.mass,
      r: rPeak,
      spinLength: spinLength(params),
      mu: 0,
      prograde: true,
    })
    expect(tPeak).toBeGreaterThan(2000)
    expect(tPeak).toBeLessThan(50_000)
    expect(tDens).toBeCloseTo(tPeak, 0) // same peak def for a=0 shape at rin=6
    expect(face.g).toBeGreaterThan(0.3)
    expect(face.g).toBeLessThan(1.1)
    expect(tDens * face.g).toBeLessThan(tDens) // face-on grav+orbit redshift
  })

  test('hot dens free bases → higher T_peak than cool', () => {
    const p = normalizeParams({ spinStar: 0.9 })
    const hot = normalizeDisk({ rho0: 4, scaleHeight: 0.14 })
    const cool = normalizeDisk({ rho0: 0.3, scaleHeight: 0.035 })
    const gH = effectiveDiskGeom(p, hot)
    const gC = effectiveDiskGeom(p, cool)
    const tH = diskPeakTemperatureK(hot.mdot, gH.rinOverM, p.spinStar)
    const tC = diskPeakTemperatureK(cool.mdot, gC.rinOverM, p.spinStar)
    expect(tH).toBeGreaterThan(tC * 1.5)
  })
})
