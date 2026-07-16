// @ts-nocheck — TSL; top-level only.
/**
 * Deep-space backdrop from escape direction: void + dust + milky lane + circular stars.
 */
import {
  abs,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  max,
  min,
  pow,
  sin,
  sqrt,
  vec3,
} from 'three/tsl'

/** Returns sky RGB (unclamped HDR-ish) for unit direction d and sky uniforms. */
export function sampleDeepSpaceSky(d, uStarDensity, uStarBright, uNebula, uMilky) {
  const dx = d.x
  const dy = d.y
  const dz = d.z

  const aS = float(2.2)
  const aix = floor(dx.mul(aS))
  const aiy = floor(dy.mul(aS))
  const aiz = floor(dz.mul(aS))
  const afx = dx.mul(aS).sub(aix)
  const afy = dy.mul(aS).sub(aiy)
  const afz = dz.mul(aS).sub(aiz)
  const aux = afx.mul(afx).mul(float(3).sub(afx.mul(2)))
  const auy = afy.mul(afy).mul(float(3).sub(afy.mul(2)))
  const auz = afz.mul(afz).mul(float(3).sub(afz.mul(2)))
  const asd = float(1.7)
  const an000 = fract(sin(aix.mul(127.1).add(aiy.mul(311.7)).add(aiz.mul(74.7)).add(asd)).mul(43758.5453))
  const an100 = fract(sin(aix.add(1).mul(127.1).add(aiy.mul(311.7)).add(aiz.mul(74.7)).add(asd)).mul(43758.5453))
  const an010 = fract(sin(aix.mul(127.1).add(aiy.add(1).mul(311.7)).add(aiz.mul(74.7)).add(asd)).mul(43758.5453))
  const an110 = fract(sin(aix.add(1).mul(127.1).add(aiy.add(1).mul(311.7)).add(aiz.mul(74.7)).add(asd)).mul(43758.5453))
  const an001 = fract(sin(aix.mul(127.1).add(aiy.mul(311.7)).add(aiz.add(1).mul(74.7)).add(asd)).mul(43758.5453))
  const an101 = fract(sin(aix.add(1).mul(127.1).add(aiy.mul(311.7)).add(aiz.add(1).mul(74.7)).add(asd)).mul(43758.5453))
  const an011 = fract(sin(aix.mul(127.1).add(aiy.add(1).mul(311.7)).add(aiz.add(1).mul(74.7)).add(asd)).mul(43758.5453))
  const an111 = fract(sin(aix.add(1).mul(127.1).add(aiy.add(1).mul(311.7)).add(aiz.add(1).mul(74.7)).add(asd)).mul(43758.5453))
  const ax00 = an000.mul(float(1).sub(aux)).add(an100.mul(aux))
  const ax10 = an010.mul(float(1).sub(aux)).add(an110.mul(aux))
  const ax01 = an001.mul(float(1).sub(aux)).add(an101.mul(aux))
  const ax11 = an011.mul(float(1).sub(aux)).add(an111.mul(aux))
  const ay0 = ax00.mul(float(1).sub(auy)).add(ax10.mul(auy))
  const ay1 = ax01.mul(float(1).sub(auy)).add(ax11.mul(auy))
  const n1 = ay0.mul(float(1).sub(auz)).add(ay1.mul(auz))

  const bS = float(5.5)
  const bix = floor(dx.mul(bS))
  const biy = floor(dy.mul(bS))
  const biz = floor(dz.mul(bS))
  const bfx = dx.mul(bS).sub(bix)
  const bfy = dy.mul(bS).sub(biy)
  const bfz = dz.mul(bS).sub(biz)
  const bux = bfx.mul(bfx).mul(float(3).sub(bfx.mul(2)))
  const buy = bfy.mul(bfy).mul(float(3).sub(bfy.mul(2)))
  const buz = bfz.mul(bfz).mul(float(3).sub(bfz.mul(2)))
  const bsd = float(4.2)
  const bn000 = fract(sin(bix.mul(127.1).add(biy.mul(311.7)).add(biz.mul(74.7)).add(bsd)).mul(43758.5453))
  const bn100 = fract(sin(bix.add(1).mul(127.1).add(biy.mul(311.7)).add(biz.mul(74.7)).add(bsd)).mul(43758.5453))
  const bn010 = fract(sin(bix.mul(127.1).add(biy.add(1).mul(311.7)).add(biz.mul(74.7)).add(bsd)).mul(43758.5453))
  const bn110 = fract(sin(bix.add(1).mul(127.1).add(biy.add(1).mul(311.7)).add(biz.mul(74.7)).add(bsd)).mul(43758.5453))
  const bn001 = fract(sin(bix.mul(127.1).add(biy.mul(311.7)).add(biz.add(1).mul(74.7)).add(bsd)).mul(43758.5453))
  const bn101 = fract(sin(bix.add(1).mul(127.1).add(biy.mul(311.7)).add(biz.add(1).mul(74.7)).add(bsd)).mul(43758.5453))
  const bn011 = fract(sin(bix.mul(127.1).add(biy.add(1).mul(311.7)).add(biz.add(1).mul(74.7)).add(bsd)).mul(43758.5453))
  const bn111 = fract(sin(bix.add(1).mul(127.1).add(biy.add(1).mul(311.7)).add(biz.add(1).mul(74.7)).add(bsd)).mul(43758.5453))
  const bx00 = bn000.mul(float(1).sub(bux)).add(bn100.mul(bux))
  const bx10 = bn010.mul(float(1).sub(bux)).add(bn110.mul(bux))
  const bx01 = bn001.mul(float(1).sub(bux)).add(bn101.mul(bux))
  const bx11 = bn011.mul(float(1).sub(bux)).add(bn111.mul(bux))
  const by0 = bx00.mul(float(1).sub(buy)).add(bx10.mul(buy))
  const by1 = bx01.mul(float(1).sub(buy)).add(bx11.mul(buy))
  const n2 = by0.mul(float(1).sub(buz)).add(by1.mul(buz))

  const fbm = n1.mul(0.65).add(n2.mul(0.35))

  const galN = vec3(0.18, 0.9, 0.35).normalize()
  const band = float(1).sub(abs(dot(d, galN)))
  const milky = pow(max(band, float(0)), float(10.0)).mul(uMilky)

  const voidCol = vec3(0.0015, 0.0018, 0.0035)
  const dustMask = pow(max(fbm.sub(0.42), float(0)).mul(1.8), float(1.8))
  const dust = vec3(0.04, 0.05, 0.08).mul(dustMask.mul(0.22).mul(uNebula))
  const lane = vec3(0.05, 0.055, 0.07).mul(milky.mul(fbm.mul(0.5).add(0.25)).mul(0.18))
  let sky = voidCol.add(dust).add(lane)

  const dens = max(uStarDensity, float(0))
  const sBright = max(uStarBright, float(0))

  const s1 = float(95.0)
  const p1x = dx.mul(s1)
  const p1y = dy.mul(s1)
  const p1z = dz.mul(s1)
  const i1x = floor(p1x)
  const i1y = floor(p1y)
  const i1z = floor(p1z)
  const f1x = p1x.sub(i1x)
  const f1y = p1y.sub(i1y)
  const f1z = p1z.sub(i1z)
  const h1a = fract(sin(i1x.mul(127.1).add(i1y.mul(311.7)).add(i1z.mul(74.7)).add(11.1)).mul(43758.5453))
  const h1b = fract(sin(i1x.mul(269.5).add(i1y.mul(183.3)).add(i1z.mul(419.2)).add(12.2)).mul(43758.5453))
  const h1c = fract(sin(i1x.mul(419.2).add(i1y.mul(371.9)).add(i1z.mul(127.1)).add(13.3)).mul(43758.5453))
  const h1d = fract(sin(i1x.mul(71.7).add(i1y.mul(113.5)).add(i1z.mul(271.9)).add(14.4)).mul(43758.5453))
  const thr1 = float(1).sub(float(0.018).mul(dens))
  const spawn1 = h1a.greaterThan(thr1).select(float(1), float(0))
  const cx1 = h1b.mul(0.7).add(0.15)
  const cy1 = h1c.mul(0.7).add(0.15)
  const cz1 = h1d.mul(0.7).add(0.15)
  const dist1 = sqrt(
    f1x.sub(cx1).mul(f1x.sub(cx1)).add(f1y.sub(cy1).mul(f1y.sub(cy1))).add(f1z.sub(cz1).mul(f1z.sub(cz1))),
  )
  const rad1 = float(0.028).add(h1b.mul(0.018))
  const disc1 = exp(dist1.mul(dist1).div(rad1.mul(rad1).add(1e-8)).mul(-1))
  const bright1 = spawn1.mul(disc1).mul(float(0.35).add(h1c.mul(0.45))).mul(sBright)

  const s2 = float(42.0)
  const p2x = dx.mul(s2)
  const p2y = dy.mul(s2)
  const p2z = dz.mul(s2)
  const i2x = floor(p2x)
  const i2y = floor(p2y)
  const i2z = floor(p2z)
  const f2x = p2x.sub(i2x)
  const f2y = p2y.sub(i2y)
  const f2z = p2z.sub(i2z)
  const h2a = fract(sin(i2x.mul(127.1).add(i2y.mul(311.7)).add(i2z.mul(74.7)).add(21.1)).mul(43758.5453))
  const h2b = fract(sin(i2x.mul(269.5).add(i2y.mul(183.3)).add(i2z.mul(419.2)).add(22.2)).mul(43758.5453))
  const h2c = fract(sin(i2x.mul(419.2).add(i2y.mul(371.9)).add(i2z.mul(127.1)).add(23.3)).mul(43758.5453))
  const h2d = fract(sin(i2x.mul(71.7).add(i2y.mul(113.5)).add(i2z.mul(271.9)).add(24.4)).mul(43758.5453))
  const thr2 = float(1).sub(float(0.01).mul(dens))
  const spawn2 = h2a.greaterThan(thr2).select(float(1), float(0))
  const cx2 = h2b.mul(0.65).add(0.175)
  const cy2 = h2c.mul(0.65).add(0.175)
  const cz2 = h2d.mul(0.65).add(0.175)
  const dist2 = sqrt(
    f2x.sub(cx2).mul(f2x.sub(cx2)).add(f2y.sub(cy2).mul(f2y.sub(cy2))).add(f2z.sub(cz2).mul(f2z.sub(cz2))),
  )
  const rad2 = float(0.035).add(h2b.mul(0.025))
  const disc2 = exp(dist2.mul(dist2).div(rad2.mul(rad2).add(1e-8)).mul(-1))
  const bright2 = spawn2.mul(disc2).mul(float(0.7).add(h2c.mul(0.9))).mul(sBright)

  const s3 = float(18.0)
  const p3x = dx.mul(s3)
  const p3y = dy.mul(s3)
  const p3z = dz.mul(s3)
  const i3x = floor(p3x)
  const i3y = floor(p3y)
  const i3z = floor(p3z)
  const f3x = p3x.sub(i3x)
  const f3y = p3y.sub(i3y)
  const f3z = p3z.sub(i3z)
  const h3a = fract(sin(i3x.mul(127.1).add(i3y.mul(311.7)).add(i3z.mul(74.7)).add(31.1)).mul(43758.5453))
  const h3b = fract(sin(i3x.mul(269.5).add(i3y.mul(183.3)).add(i3z.mul(419.2)).add(32.2)).mul(43758.5453))
  const h3c = fract(sin(i3x.mul(419.2).add(i3y.mul(371.9)).add(i3z.mul(127.1)).add(33.3)).mul(43758.5453))
  const h3d = fract(sin(i3x.mul(71.7).add(i3y.mul(113.5)).add(i3z.mul(271.9)).add(34.4)).mul(43758.5453))
  const thr3 = float(1).sub(float(0.0045).mul(dens))
  const spawn3 = h3a.greaterThan(thr3).select(float(1), float(0))
  const cx3 = h3b.mul(0.55).add(0.225)
  const cy3 = h3c.mul(0.55).add(0.225)
  const cz3 = h3d.mul(0.55).add(0.225)
  const dist3 = sqrt(
    f3x.sub(cx3).mul(f3x.sub(cx3)).add(f3y.sub(cy3).mul(f3y.sub(cy3))).add(f3z.sub(cz3).mul(f3z.sub(cz3))),
  )
  const rad3 = float(0.045).add(h3b.mul(0.03))
  const disc3 = exp(dist3.mul(dist3).div(rad3.mul(rad3).add(1e-8)).mul(-1))
  const halo3 = exp(dist3.mul(dist3).div(rad3.mul(rad3).mul(4.5).add(1e-8)).mul(-1)).mul(0.25)
  const bright3 = spawn3.mul(disc3.add(halo3)).mul(float(1.4).add(h3c.mul(1.6))).mul(sBright)

  const tintH = fract(sin(i2x.mul(91.7).add(i2y.mul(51.3)).add(i2z.mul(17.9)).add(44.4)).mul(43758.5453))
  const starCol = tintH
    .lessThan(0.25)
    .select(vec3(0.85, 0.9, 1.0), tintH.lessThan(0.75).select(vec3(1.0, 0.98, 0.96), vec3(1.0, 0.92, 0.82)))

  const stars = starCol.mul(bright1.add(bright2).add(bright3))
  sky = sky.add(stars)
  sky = min(sky, vec3(2.4, 2.35, 2.5))
  return sky
}
