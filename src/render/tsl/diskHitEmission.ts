// @ts-nocheck — TSL node graphs; keep helpers top-level (never nest inside Fn).
/**
 * Shared disk-hit emission: NT flux, blackbody chroma, seamless texture, intensity.
 * Called from both RT (y=0 plane) and BL (θ=π/2) hit sites with the same recipe.
 */
import {
  cos,
  exp,
  float,
  floor,
  fract,
  If,
  log,
  max,
  min,
  pow,
  sin,
  sqrt,
  vec3,
} from 'three/tsl'
import {
  LAMBDA_B_NM,
  LAMBDA_G_NM,
  LAMBDA_R_NM,
  PLANCK_C2_NM_K,
} from '../../physics/blackbody'
import {
  DISK_EMISSION,
  R_ISCO_SCHW_OVER_M,
  T_PEAK_MDOT_REF,
  T_PEAK_REF_K,
} from '../../physics/disk'

/**
 * Accumulate one disk hit into col/transm and update debug channels.
 * @param p.hitR geometric radius of hit (ρ or r)
 * @param p.freq orbiting redshift g
 * @param p.cphi / p.sphi cos/sin φ for seamless texture
 */
export function accumulateDiskHit(p) {
  const E = DISK_EMISSION
  const {
    hitR,
    freq,
    cphi,
    sphi,
    M,
    aStar,
    mdot,
    rin,
    uRIscoM,
    hits,
    col,
    transm,
    dbgG,
    dbgT,
    dbgFlux,
    uDebugMode,
    uIdealBeam,
  } = p

  // Display: g²; ideal bolometric: g³ (color path stays soft)
  const beamExp = uIdealBeam
    .greaterThan(0.5)
    .select(float(E.beamExponentIdeal), float(E.beamExponent))
  const beamFl = uIdealBeam
    .greaterThan(0.5)
    .select(float(E.beamFloorIdeal), float(E.beamFloor))
  const beam = pow(max(freq, beamFl), beamExp)

  const gap = max(float(1).sub(sqrt(rin.div(max(hitR, rin.mul(1.0001))))), float(0))
  const Ftilde = gap.div(hitR.mul(hitR).mul(hitR).add(1e-12))
  const rPeak = rin.mul(E.ntPeakOverRin)
  const gapPeak = max(float(1).sub(sqrt(rin.div(max(rPeak, rin.mul(1.0001))))), float(0))
  const FtildeMax = gapPeak.div(rPeak.mul(rPeak).mul(rPeak).add(1e-12))
  const fluxRel = Ftilde.div(max(FtildeMax, float(1e-12)))
  const fluxVis = pow(max(fluxRel, float(1e-6)), float(E.fluxVisPower))

  const rIscoM = max(uRIscoM, float(1.05))
  const iscoHot = pow(float(R_ISCO_SCHW_OVER_M).div(rIscoM), float(E.iscoHotPower))
  const spinFac = float(1).add(max(aStar, float(0)).mul(E.spinEtaNudge))
  const tPeakK = float(T_PEAK_REF_K)
    .mul(pow(max(mdot.div(T_PEAK_MDOT_REF), float(1e-6)), float(0.25)))
    .mul(iscoHot)
    .mul(spinFac)
  const tRestK = tPeakK.mul(pow(max(fluxRel, float(1e-6)), float(0.25)))
  const gColor = pow(max(freq, float(E.gColorFloor)), float(E.gColorExponent))
  const TK = max(float(E.tColorMinK), min(float(E.tColorMaxK), tRestK.mul(gColor)))

  const planckC2 = float(PLANCK_C2_NM_K)
  const lamR = float(LAMBDA_R_NM)
  const lamG = float(LAMBDA_G_NM)
  const lamB = float(LAMBDA_B_NM)
  const xR = min(planckC2.div(lamR.mul(TK)), float(80))
  const xG = min(planckC2.div(lamG.mul(TK)), float(80))
  const xB = min(planckC2.div(lamB.mul(TK)), float(80))
  const br = float(1).div(pow(lamR, float(5)).mul(max(exp(xR).sub(1), float(1e-20))))
  const bg = float(1).div(pow(lamG, float(5)).mul(max(exp(xG).sub(1), float(1e-20))))
  const bb = float(1).div(pow(lamB, float(5)).mul(max(exp(xB).sub(1), float(1e-20))))
  const bMax = max(br, max(bg, bb))
  const chroma = vec3(br, bg, bb).div(max(bMax, float(1e-20)))

  const lnR = log(max(hitR.div(M), float(1e-4)))
  const c2a = cphi.mul(cphi).sub(sphi.mul(sphi))
  const s2a = cphi.mul(sphi).mul(2)
  const alpha = float(-1.1).mul(lnR).add(0.3)
  const armWave = float(0.5).add(float(0.5).mul(c2a.mul(cos(alpha)).add(s2a.mul(sin(alpha)))))
  const armFac = float(0.8).add(pow(max(armWave, float(1e-4)), float(1.1)).mul(0.32))
  const nUVx = cphi.mul(1.3).add(lnR.mul(0.12))
  const nUVy = sphi.mul(1.3).add(lnR.mul(0.1))
  const ix = floor(nUVx)
  const iy = floor(nUVy)
  const fx = nUVx.sub(ix)
  const fy = nUVy.sub(iy)
  const ux = fx.mul(fx).mul(float(3).sub(fx.mul(2)))
  const uy = fy.mul(fy).mul(float(3).sub(fy.mul(2)))
  const n00 = fract(sin(ix.mul(127.1).add(iy.mul(311.7))).mul(43758.5453))
  const n10 = fract(sin(ix.add(1).mul(127.1).add(iy.mul(311.7))).mul(43758.5453))
  const n01 = fract(sin(ix.mul(127.1).add(iy.add(1).mul(311.7))).mul(43758.5453))
  const n11 = fract(sin(ix.add(1).mul(127.1).add(iy.add(1).mul(311.7))).mul(43758.5453))
  const turb = n00
    .mul(float(1).sub(ux))
    .add(n10.mul(ux))
    .mul(float(1).sub(uy))
    .add(n01.mul(float(1).sub(ux)).add(n11.mul(ux)).mul(uy))
  const texFac = max(float(0.75), min(float(1.25), armFac.mul(float(0.9).add(turb.mul(0.2)))))

  const bounce = float(1).add(max(hits.sub(1), float(0)).mul(0.55))
  const mdotBright = float(E.mdotBrightBase).add(
    pow(max(mdot.div(T_PEAK_MDOT_REF), float(E.mdotBrightFloor)), float(E.mdotBrightPower)).mul(
      E.mdotBrightScale,
    ),
  )
  const iFlux = max(fluxVis, float(E.fluxVisFloor)).mul(mdotBright).mul(E.intensityGain)
  const emit = chroma.mul(iFlux).mul(beam).mul(texFac).mul(bounce)

  dbgG.assign(freq)
  dbgT.assign(TK.div(float(12000)))
  dbgFlux.assign(fluxVis)

  If(uDebugMode.notEqual(float(8)), () => {
    col.addAssign(emit.mul(transm))
    transm.mulAssign(0.5)
  })
}
