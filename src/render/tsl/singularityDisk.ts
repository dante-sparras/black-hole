// @ts-nocheck — TSL top-level only
/**
 * MisterPrada/singularity BlackHole.js disk look (exact formulas).
 * Noise + thin Z-band + dual-sample edge + ColorRamp3 + front-to-back alpha.
 * Called on our Kerr geodesic samples (not his fake 1/r² rays).
 */
import {
  abs,
  cos,
  float,
  max,
  min,
  mix,
  sin,
  sqrt,
  texture,
  vec2,
  vec3,
} from 'three/tsl'

/**
 * @param p.pos sample position
 * @param p.M mass
 * @param p.rCapture capture radius
 * @param p.rout outer disk radius
 * @param p.uTime time
 * @param p.noiseDeepMap noise texture
 * @param p.col color accum (var)
 * @param p.transm transmittance (var)
 * @param p.hits hit counter (var)
 * @param p.weight optional extra weight (dens/path, default 1)
 * @param p.beam optional Doppler/g beam multiplier (default 1)
 */
export function singularityDiskComposite(p) {
  const {
    pos,
    M,
    rCapture,
    rout,
    uTime,
    noiseDeepMap,
    col,
    transm,
    hits,
  } = p
  const weight = p.weight === undefined ? float(1) : p.weight
  const beam = p.beam === undefined ? float(1) : p.beam

  // Unit-disk coords like his object space (scale by outer radius)
  const scale = max(rout, M.mul(10))
  const px = pos.x.div(scale)
  const py = pos.y.div(scale)
  const pz = pos.z.div(scale)
  const xyLen = sqrt(px.mul(px).add(pz.mul(pz)))

  // Exact spiral UV: rotPhase = xyLen * 4.27 − time * 0.1
  const rotPhase = xyLen.mul(4.27).sub(uTime.mul(0.1))
  const cR = cos(rotPhase)
  const sR = sin(rotPhase)
  const rx = px.mul(cR).add(pz.mul(sR))
  const rz = px.mul(sR.mul(-1)).add(pz.mul(cR))
  const uv0 = vec2(rx.mul(2), rz.mul(2)).add(0.5)

  const n0 = texture(noiseDeepMap, uv0)
  // Thin Z-band — his width ~0.03 unit; map to our scale (slightly thicker for sparse steps)
  const bandWidth = float(0.055)
  const zAbs = abs(py)
  // zBand = max(w - (z-ends)²/w, 0)/w style (his quadratic band)
  const zN = zAbs.div(bandWidth)
  const zBand = max(float(1).sub(zN.mul(zN)), float(0))

  const noiseAmp = n0.r.mul(0.5).add(n0.g.mul(0.3)).add(n0.b.mul(0.2)).mul(zBand)

  // Dual sample edge (his 1.002 UV) — structure from noise gradient
  const n1 = texture(noiseDeepMap, uv0.mul(1.002))
  const noiseN = n1.r.mul(0.5).add(n1.g.mul(0.3)).add(n1.b.mul(0.2)).mul(zBand)

  // rampInput exact: xyLen + (noiseAmp−0.78)*1.5 + (noiseAmp−noiseN)*19.75
  const rampInput = xyLen
    .add(noiseAmp.sub(0.78).mul(1.5))
    .add(noiseAmp.sub(noiseN).mul(19.75))
  const t = min(float(1.2), max(float(0), rampInput))

  // ColorRamp3 stops (exact)
  const gold = vec3(0.95, 0.71, 0.44)
  const brown = vec3(0.14, 0.05, 0.03)
  const black = vec3(0.0, 0.0, 0.0)
  const u01 = min(float(1), max(float(0), t.sub(0.05).div(0.375)))
  const u12 = min(float(1), max(float(0), t.sub(0.425).div(0.575)))
  const s01 = u01.mul(u01).mul(float(3).sub(u01.mul(2)))
  const s12 = u12.mul(u12).mul(float(3).sub(u12.mul(2)))
  const baseCol = mix(mix(gold, brown, s01), black, s12)
  // emissive = ramp * 2 + bias
  const emissiveCol = baseCol.mul(2.0).add(vec3(0.14, 0.129, 0.09))

  const rLen = pos.length()
  const insideCore = rLen.lessThan(rCapture.mul(1.05))
  const shadedCol = insideCore.select(vec3(0, 0, 0), emissiveCol)

  // Alpha shaping (his aNoise / aBand / aRadial)
  const aNoise = noiseAmp.sub(0.75).mul(-0.6)
  const aPre = zAbs.add(aNoise)
  const aRadial = min(float(1), max(float(0), float(1.05).sub(xyLen)))
  // smoothRange-ish: high when aPre near 0 and within band
  const aBand = max(float(0), float(1).sub(aPre.div(max(bandWidth, float(1e-4)))))
    .mul(aRadial)
    .mul(zBand)
  // Sparse geodesic samples → boost alpha so photosphere still reads
  const alphaLocal = insideCore.select(
    float(0),
    min(float(0.85), max(float(0), aBand.mul(4.5).mul(min(weight, float(1.5))))),
  )

  // Front-to-back (his mix weight)
  const wA = transm.mul(alphaLocal).mul(min(beam, float(2.5)))
  col.addAssign(shadedCol.mul(wA))
  transm.mulAssign(max(float(0.04), float(1).sub(alphaLocal.mul(0.92))))
  hits.addAssign(alphaLocal.greaterThan(0.015).select(float(0.15), float(0)))
}
