// @ts-nocheck — TSL top-level only
/**
 * MisterPrada/singularity BlackHole.js disk look (exact structure formulas).
 * Noise + thin Z-band + dual-sample edge + front-to-back alpha.
 * COLOR only: Planck blackbody from ṁ + radius (not fixed gold ColorRamp).
 * Called on our Kerr geodesic samples (not his fake 1/r² rays).
 */
import {
  abs,
  cos,
  exp,
  float,
  max,
  min,
  mix,
  pow,
  sin,
  sqrt,
  texture,
  vec2,
  vec3,
} from 'three/tsl'
import { PLANCK_C2_NM_K } from '../../physics/blackbody'
import {
  DISK_EMISSION,
  R_ISCO_SCHW_OVER_M,
  T_PEAK_MDOT_REF,
  T_PEAK_REF_K,
} from '../../physics/disk'

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
 * @param p.mdot Eddington ratio (drives BB temperature)
 * @param p.rIscoM optional r_in/M for spin/ISCO heating
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
  const mdot = p.mdot === undefined ? float(0.1) : p.mdot
  const rIscoM = p.rIscoM === undefined ? float(R_ISCO_SCHW_OVER_M) : p.rIscoM

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
  // Still drives brightness structure; NOT fixed gold palette.
  const rampInput = xyLen
    .add(noiseAmp.sub(0.78).mul(1.5))
    .add(noiseAmp.sub(noiseN).mul(19.75))
  const t = min(float(1.2), max(float(0), rampInput))

  // —— COLOR FIX only: Planck BB from ṁ + radius (same structure otherwise) ——
  // Cool ṁ → red/orange; default → multi-color warm; hot ṁ → blue-white.
  const E = DISK_EMISSION
  const rLen = pos.length()
  const rOverM = max(rLen.div(max(M, float(1e-8))), float(1.2))
  const iscoHot = pow(
    float(R_ISCO_SCHW_OVER_M).div(max(rIscoM, float(1.05))),
    float(E.iscoHotPower),
  )
  const tPeakK = float(T_PEAK_REF_K)
    .mul(pow(max(mdot.div(float(T_PEAK_MDOT_REF)), float(1e-6)), float(0.25)))
    .mul(iscoHot)
  // Outer cooler; ramp t (his fac) cools further like brown→black limbs
  const radCool = pow(float(6).div(max(rOverM, float(1.5))), float(0.55))
  const rampCool = float(1.1).sub(min(t, float(1)).mul(0.75))
  const tJitter = float(1).add(noiseAmp.sub(0.4).mul(0.3))
  const TK = max(
    float(E.tColorMinK),
    min(float(E.tColorMaxK), tPeakK.mul(radCool).mul(rampCool).mul(tJitter)),
  )

  // Inline Planck B_λ → max-norm RGB (no nested helpers — TSL-safe)
  const c2 = float(PLANCK_C2_NM_K)
  const Tsafe = max(TK, float(800))
  const x680 = c2.div(float(680).mul(Tsafe).add(1e-6))
  const x610 = c2.div(float(610).mul(Tsafe).add(1e-6))
  const x550 = c2.div(float(550).mul(Tsafe).add(1e-6))
  const x490 = c2.div(float(490).mul(Tsafe).add(1e-6))
  const x440 = c2.div(float(440).mul(Tsafe).add(1e-6))
  const b680 = float(1).div(
    float(680)
      .mul(680)
      .mul(680)
      .mul(680)
      .mul(680)
      .mul(max(exp(min(x680, float(40))).sub(1), float(1e-20))),
  )
  const b610 = float(1).div(
    float(610)
      .mul(610)
      .mul(610)
      .mul(610)
      .mul(610)
      .mul(max(exp(min(x610, float(40))).sub(1), float(1e-20))),
  )
  const b550 = float(1).div(
    float(550)
      .mul(550)
      .mul(550)
      .mul(550)
      .mul(550)
      .mul(max(exp(min(x550, float(40))).sub(1), float(1e-20))),
  )
  const b490 = float(1).div(
    float(490)
      .mul(490)
      .mul(490)
      .mul(490)
      .mul(490)
      .mul(max(exp(min(x490, float(40))).sub(1), float(1e-20))),
  )
  const b440 = float(1).div(
    float(440)
      .mul(440)
      .mul(440)
      .mul(440)
      .mul(440)
      .mul(max(exp(min(x440, float(40))).sub(1), float(1e-20))),
  )
  const br = b680.mul(0.55).add(b610.mul(0.45))
  const bg = b610.mul(0.2).add(b550.mul(0.55)).add(b490.mul(0.25))
  const bb = b490.mul(0.35).add(b440.mul(0.65))
  const bMax = max(br, max(bg, max(bb, float(1e-30))))
  const baseCol = vec3(br.div(bMax), bg.div(bMax), bb.div(bMax))

  // Same emissive gain as before (*2 + bias), but bias follows BB hue (not fixed gold)
  const emissiveCol = baseCol.mul(2.0).add(baseCol.mul(0.15))

  const insideCore = rLen.lessThan(rCapture.mul(1.05))
  const shadedCol = insideCore.select(vec3(0, 0, 0), emissiveCol)

  // Alpha shaping (his aNoise / aBand / aRadial) — UNCHANGED
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
