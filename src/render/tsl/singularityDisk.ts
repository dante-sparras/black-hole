// @ts-nocheck — TSL top-level only
/**
 * MisterPrada/singularity BlackHole.js disk look — structure (noise, Z-band,
 * dual-edge, alpha) for real-time 60fps+ dens sampling.
 *
 * COLOR / brightness (realism): Planck blackbody from NT-style T(r,ṁ) and
 * flux-shaped intensity — not fixed gold ColorRamp film paint.
 * Geodesics remain Kerr/RN; this is photosphere emission on those rays.
 */
import {
  abs,
  cos,
  exp,
  float,
  max,
  min,
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
 * @param p.weight optional dens/path weight (default 1)
 * @param p.beam optional Doppler/g beam (default 1; pass g when available)
 * @param p.mdot Eddington ratio (free-base–derived)
 * @param p.rIscoM free r_in/M (emission edge / heating ref)
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

  // —— Structure (singularity look; unchanged) ——
  const scale = max(rout, M.mul(10))
  const px = pos.x.div(scale)
  const py = pos.y.div(scale)
  const pz = pos.z.div(scale)
  const xyLen = sqrt(px.mul(px).add(pz.mul(pz)))

  const rotPhase = xyLen.mul(4.27).sub(uTime.mul(0.1))
  const cR = cos(rotPhase)
  const sR = sin(rotPhase)
  const rx = px.mul(cR).add(pz.mul(sR))
  const rz = px.mul(sR.mul(-1)).add(pz.mul(cR))
  const uv0 = vec2(rx.mul(2), rz.mul(2)).add(0.5)

  const n0 = texture(noiseDeepMap, uv0)
  const bandWidth = float(0.055)
  const zAbs = abs(py)
  const zN = zAbs.div(bandWidth)
  const zBand = max(float(1).sub(zN.mul(zN)), float(0))

  const noiseAmp = n0.r.mul(0.5).add(n0.g.mul(0.3)).add(n0.b.mul(0.2)).mul(zBand)

  const n1 = texture(noiseDeepMap, uv0.mul(1.002))
  const noiseN = n1.r.mul(0.5).add(n1.g.mul(0.3)).add(n1.b.mul(0.2)).mul(zBand)

  // Dual-edge residual still shapes local T jitter (plasma), not gold palette
  const edgeRes = noiseAmp.sub(noiseN)

  // —— Realism: NT-like F̃(r), T ∝ ṁ^{1/4} F̃^{1/4}, BB chroma ——
  const E = DISK_EMISSION
  const rLen = pos.length()
  const rSafe = max(rLen, M.mul(1.05))
  const rin = max(rIscoM, float(1.05)).mul(max(M, float(1e-8)))
  // Zero-torque Schw shape (good enough for dens samples; full PT is on plane path)
  const gap = max(float(0), float(1).sub(sqrt(rin.div(max(rSafe, rin.mul(1.0001))))))
  const Ftilde = gap.div(rSafe.mul(rSafe).mul(rSafe).add(1e-12))
  const rPeak = rin.mul(float(E.ntPeakOverRin))
  const gapP = max(float(0), float(1).sub(sqrt(rin.div(max(rPeak, rin.mul(1.0001))))))
  const Fmax = gapP.div(rPeak.mul(rPeak).mul(rPeak).add(1e-12))
  const fluxRel = min(float(1.5), Ftilde.div(max(Fmax, float(1e-12))))
  const fluxVis = pow(max(fluxRel, float(E.fluxVisFloor)), float(E.fluxVisPower))

  const iscoHot = pow(
    float(R_ISCO_SCHW_OVER_M).div(max(rIscoM, float(1.05))),
    float(E.iscoHotPower),
  )
  const tPeakK = float(T_PEAK_REF_K)
    .mul(pow(max(mdot.div(float(T_PEAK_MDOT_REF)), float(1e-6)), float(0.25)))
    .mul(iscoHot)
  // T(r) = T_peak · (F/Fmax)^{1/4}; mild noise jitter (not film ramp)
  const tJitter = float(1)
    .add(noiseAmp.sub(0.4).mul(0.12))
    .add(edgeRes.mul(0.08))
  const TK = max(
    float(E.tColorMinK),
    min(
      float(E.tColorMaxK),
      tPeakK.mul(pow(max(fluxRel, float(1e-6)), float(0.25))).mul(tJitter),
    ),
  )

  // Planck B_λ → max-norm RGB (inline; TSL-safe)
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
  const bbCol = vec3(br.div(bMax), bg.div(bMax), bb.div(bMax))

  // Intensity: NT flux shape × compressive ṁ (not gold ramp luma)
  const mdotBright = float(E.mdotBrightBase).add(
    pow(max(mdot.div(float(T_PEAK_MDOT_REF)), float(E.mdotBrightFloor)), float(E.mdotBrightPower)).mul(
      E.mdotBrightScale,
    ),
  )
  const iScale = max(fluxVis, float(E.fluxVisFloor))
    .mul(mdotBright)
    .mul(float(E.intensityGain))
    .mul(float(E.filmEmission))
  // Soft-knee so hot dens doesn't blow HDR before tonemap
  const softI = iScale.div(float(1).add(iScale.mul(float(E.sampleKnee))))
  const emissiveCol = bbCol.mul(softI.mul(2.0))

  const insideCore = rLen.lessThan(rCapture.mul(1.05))
  const shadedCol = insideCore.select(vec3(0, 0, 0), emissiveCol)

  // —— Alpha (singularity look; unchanged) ——
  const aNoise = noiseAmp.sub(0.75).mul(-0.6)
  const aPre = zAbs.add(aNoise)
  const aRadial = min(float(1), max(float(0), float(1.05).sub(xyLen)))
  const aBand = max(float(0), float(1).sub(aPre.div(max(bandWidth, float(1e-4)))))
    .mul(aRadial)
    .mul(zBand)
  const alphaLocal = insideCore.select(
    float(0),
    min(float(0.85), max(float(0), aBand.mul(4.5).mul(min(weight, float(1.5))))),
  )

  const wA = transm.mul(alphaLocal).mul(min(beam, float(2.5)))
  col.addAssign(shadedCol.mul(wA))
  transm.mulAssign(max(float(0.04), float(1).sub(alphaLocal.mul(0.92))))
  hits.addAssign(alphaLocal.greaterThan(0.015).select(float(0.15), float(0)))
}
