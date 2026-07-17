// @ts-nocheck — TSL; top-level only.
/**
 * Procedural deep-space backdrop tuned to match public/space.jpg reference:
 * deep navy void, dense cool-white stars, warm amber galactic core,
 * dark dust lanes, faint magenta nebula patches.
 *
 * Customizable via sky uniforms: starDensity, starBrightness, nebula, milky.
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
  mix,
  pow,
  sin,
  sqrt,
  vec3,
} from 'three/tsl'

/** Hash noise 0–1 from cell coords + seed. */
function h3(ix, iy, iz, seed) {
  return fract(
    sin(ix.mul(127.1).add(iy.mul(311.7)).add(iz.mul(74.7)).add(seed)).mul(43758.5453),
  )
}

/** Trilinear value noise on direction * scale. */
function valueNoise3(d, scale, seed) {
  const p = d.mul(scale)
  const ix = floor(p.x)
  const iy = floor(p.y)
  const iz = floor(p.z)
  const fx = p.x.sub(ix)
  const fy = p.y.sub(iy)
  const fz = p.z.sub(iz)
  const ux = fx.mul(fx).mul(float(3).sub(fx.mul(2)))
  const uy = fy.mul(fy).mul(float(3).sub(fy.mul(2)))
  const uz = fz.mul(fz).mul(float(3).sub(fz.mul(2)))
  const n000 = h3(ix, iy, iz, seed)
  const n100 = h3(ix.add(1), iy, iz, seed)
  const n010 = h3(ix, iy.add(1), iz, seed)
  const n110 = h3(ix.add(1), iy.add(1), iz, seed)
  const n001 = h3(ix, iy, iz.add(1), seed)
  const n101 = h3(ix.add(1), iy, iz.add(1), seed)
  const n011 = h3(ix, iy.add(1), iz.add(1), seed)
  const n111 = h3(ix.add(1), iy.add(1), iz.add(1), seed)
  const x00 = n000.mul(float(1).sub(ux)).add(n100.mul(ux))
  const x10 = n010.mul(float(1).sub(ux)).add(n110.mul(ux))
  const x01 = n001.mul(float(1).sub(ux)).add(n101.mul(ux))
  const x11 = n011.mul(float(1).sub(ux)).add(n111.mul(ux))
  const y0 = x00.mul(float(1).sub(uy)).add(x10.mul(uy))
  const y1 = x01.mul(float(1).sub(uy)).add(x11.mul(uy))
  return y0.mul(float(1).sub(uz)).add(y1.mul(uz))
}

/**
 * @param d unit escape direction
 * @param uStarDensity star spawn density
 * @param uStarBright star brightness
 * @param uNebula dust / nebula amount
 * @param uMilky milky-way lane strength
 */
export function sampleDeepSpaceSky(d, uStarDensity, uStarBright, uNebula, uMilky) {
  // —— Palette from space.jpg reference ——
  // Void: deep navy-black #050810
  const voidCol = vec3(0.012, 0.016, 0.035)
  // Dust: cool brown-grey
  const dustCool = vec3(0.09, 0.08, 0.1)
  // Core / lane warm: amber-gold #c9a078
  const coreWarm = vec3(0.78, 0.58, 0.38)
  // Core highlight: pale gold
  const coreHot = vec3(0.95, 0.82, 0.62)
  // Magenta nebula patch (faint, photo has purple blobs)
  const nebMag = vec3(0.45, 0.22, 0.55)
  // Dark dust lane
  const dustDark = vec3(0.02, 0.018, 0.025)

  // Multi-octave fbm along direction
  const n1 = valueNoise3(d, float(2.4), float(1.7))
  const n2 = valueNoise3(d, float(5.8), float(4.2))
  const n3 = valueNoise3(d, float(12.0), float(9.1))
  const fbm = n1.mul(0.55).add(n2.mul(0.3)).add(n3.mul(0.15))
  const fbm2 = valueNoise3(d, float(3.5), float(2.9))
    .mul(0.6)
    .add(valueNoise3(d, float(9.0), float(6.3)).mul(0.4))

  // Galactic plane: band around galN (tilted like the photo diagonal)
  // Photo band runs roughly upper-right to lower-left → plane normal ~ tilted
  const galN = vec3(0.22, 0.78, 0.58).normalize()
  const band = float(1).sub(abs(dot(d, galN)))
  // Soft wide glow + tighter bright core
  const laneWide = pow(max(band, float(0)), float(4.5))
  const laneCore = pow(max(band, float(0)), float(12.0))
  const milkyAmt = max(uMilky, float(0))

  // Dust lanes: darker structured strips inside the band (from fbm)
  const laneMask = laneWide.mul(milkyAmt)
  const dustLane = pow(max(fbm2.sub(0.52), float(0)).mul(2.2), float(1.6))
  const dustCut = dustLane.mul(laneMask)

  // Warm core concentrated where band is strong and fbm bright
  const coreGlow = laneCore
    .mul(pow(max(fbm.sub(0.35), float(0)).mul(1.6), float(1.4)))
    .mul(milkyAmt)
  const warmBody = laneWide
    .mul(float(0.35).add(fbm.mul(0.65)))
    .mul(milkyAmt)
    .mul(float(0.55).add(uNebula.mul(0.25)))

  // Cool void dust (subtle, all-sky)
  const voidDust = pow(max(fbm.sub(0.48), float(0)).mul(1.5), float(1.8))
    .mul(uNebula)
    .mul(0.12)

  // Magenta nebula: sparse patches along band
  const nebPatch = pow(max(fbm2.sub(0.62), float(0)).mul(2.5), float(2.2))
    .mul(laneWide)
    .mul(uNebula)
    .mul(0.35)

  let sky = voidCol
  sky = sky.add(dustCool.mul(voidDust))
  sky = sky.add(mix(dustCool, coreWarm, float(0.65)).mul(warmBody.mul(0.22)))
  sky = sky.add(coreWarm.mul(coreGlow.mul(0.45)))
  sky = sky.add(coreHot.mul(coreGlow.mul(coreGlow).mul(0.35)))
  sky = sky.add(nebMag.mul(nebPatch.mul(0.28)))
  // Darken dust lanes over the band (photo: dark rifts)
  sky = mix(sky, dustDark, min(dustCut.mul(0.85), float(0.75)))

  // —— Stars (dense cool field like the photo) ——
  const dens = max(uStarDensity, float(0))
  const sBright = max(uStarBright, float(0))

  // Layer 1: dense small blue-white
  const s1 = float(110.0)
  const p1 = d.mul(s1)
  const i1x = floor(p1.x)
  const i1y = floor(p1.y)
  const i1z = floor(p1.z)
  const f1x = p1.x.sub(i1x)
  const f1y = p1.y.sub(i1y)
  const f1z = p1.z.sub(i1z)
  const h1a = h3(i1x, i1y, i1z, float(11.1))
  const h1b = h3(i1x, i1y, i1z, float(12.2))
  const h1c = h3(i1x, i1y, i1z, float(13.3))
  const thr1 = float(1).sub(float(0.028).mul(dens))
  const spawn1 = h1a.greaterThan(thr1).select(float(1), float(0))
  const dist1 = sqrt(
    f1x
      .sub(h1b.mul(0.65).add(0.175))
      .mul(f1x.sub(h1b.mul(0.65).add(0.175)))
      .add(f1y.sub(h1c.mul(0.65).add(0.175)).mul(f1y.sub(h1c.mul(0.65).add(0.175))))
      .add(f1z.sub(h1a.mul(0.65).add(0.175)).mul(f1z.sub(h1a.mul(0.65).add(0.175)))),
  )
  const rad1 = float(0.022).add(h1b.mul(0.014))
  const disc1 = exp(dist1.mul(dist1).div(rad1.mul(rad1).add(1e-8)).mul(-1))
  const bright1 = spawn1.mul(disc1).mul(float(0.4).add(h1c.mul(0.5))).mul(sBright)

  // Layer 2: medium white/gold
  const s2 = float(48.0)
  const p2 = d.mul(s2)
  const i2x = floor(p2.x)
  const i2y = floor(p2.y)
  const i2z = floor(p2.z)
  const f2x = p2.x.sub(i2x)
  const f2y = p2.y.sub(i2y)
  const f2z = p2.z.sub(i2z)
  const h2a = h3(i2x, i2y, i2z, float(21.1))
  const h2b = h3(i2x, i2y, i2z, float(22.2))
  const h2c = h3(i2x, i2y, i2z, float(23.3))
  const thr2 = float(1).sub(float(0.012).mul(dens))
  const spawn2 = h2a.greaterThan(thr2).select(float(1), float(0))
  const dist2 = sqrt(
    f2x
      .sub(h2b.mul(0.6).add(0.2))
      .mul(f2x.sub(h2b.mul(0.6).add(0.2)))
      .add(f2y.sub(h2c.mul(0.6).add(0.2)).mul(f2y.sub(h2c.mul(0.6).add(0.2))))
      .add(f2z.sub(h2a.mul(0.6).add(0.2)).mul(f2z.sub(h2a.mul(0.6).add(0.2)))),
  )
  const rad2 = float(0.032).add(h2b.mul(0.02))
  const disc2 = exp(dist2.mul(dist2).div(rad2.mul(rad2).add(1e-8)).mul(-1))
  const bright2 = spawn2.mul(disc2).mul(float(0.75).add(h2c.mul(0.85))).mul(sBright)

  // Layer 3: sparse bright with soft halo
  const s3 = float(20.0)
  const p3 = d.mul(s3)
  const i3x = floor(p3.x)
  const i3y = floor(p3.y)
  const i3z = floor(p3.z)
  const f3x = p3.x.sub(i3x)
  const f3y = p3.y.sub(i3y)
  const f3z = p3.z.sub(i3z)
  const h3a = h3(i3x, i3y, i3z, float(31.1))
  const h3b = h3(i3x, i3y, i3z, float(32.2))
  const h3c = h3(i3x, i3y, i3z, float(33.3))
  const thr3 = float(1).sub(float(0.005).mul(dens))
  const spawn3 = h3a.greaterThan(thr3).select(float(1), float(0))
  const dist3 = sqrt(
    f3x
      .sub(h3b.mul(0.55).add(0.225))
      .mul(f3x.sub(h3b.mul(0.55).add(0.225)))
      .add(f3y.sub(h3c.mul(0.55).add(0.225)).mul(f3y.sub(h3c.mul(0.55).add(0.225))))
      .add(f3z.sub(h3a.mul(0.55).add(0.225)).mul(f3z.sub(h3a.mul(0.55).add(0.225)))),
  )
  const rad3 = float(0.04).add(h3b.mul(0.028))
  const disc3 = exp(dist3.mul(dist3).div(rad3.mul(rad3).add(1e-8)).mul(-1))
  const halo3 = exp(dist3.mul(dist3).div(rad3.mul(rad3).mul(5.0).add(1e-8)).mul(-1)).mul(0.28)
  const bright3 = spawn3.mul(disc3.add(halo3)).mul(float(1.5).add(h3c.mul(1.5))).mul(sBright)

  // Star tints: mostly cool white/blue, some gold (photo mix)
  const tintH = h3(i2x, i2y, i2z, float(44.4))
  const starCol = tintH
    .lessThan(0.2)
    .select(
      vec3(0.75, 0.85, 1.0), // cool blue
      tintH
        .lessThan(0.75)
        .select(vec3(0.98, 0.98, 1.0), vec3(1.0, 0.9, 0.75)), // white / warm
    )

  // Extra density along milky band (photo: packed stars in plane)
  const bandStarBoost = float(1).add(laneWide.mul(milkyAmt).mul(0.55))
  const stars = starCol.mul(bright1.add(bright2).add(bright3)).mul(bandStarBoost)

  sky = sky.add(stars)
  // Soft global contrast (photo is deep black + bright core)
  sky = pow(max(sky, vec3(0)), vec3(0.95))
  sky = min(sky, vec3(2.5, 2.35, 2.4))
  return sky
}
