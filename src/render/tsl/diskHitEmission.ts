// @ts-nocheck — TSL node graphs; keep helpers top-level (never nest inside Fn).
/**
 * Shared disk-hit emission: NT flux, blackbody chroma, structured texture, intensity.
 * Called from both RT (y=0 plane) and BL (θ=π/2) hit sites with the same recipe.
 *
 * Realism targets: rotating flattened gas/plasma/dust —
 *   - Keplerian-sheared log spirals (integer m, seamless)
 *   - Multi-scale turbulence (plasma clumps)
 *   - Outer dust lanes + soft radial edges
 *   - Path-length factor for finite scale-height look when edge-on
 */
import {
  abs,
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
import { DISK_TEXTURE } from '../../physics/diskTexture'

/**
 * Accumulate one disk hit into col/transm and update debug channels.
 */
export function accumulateDiskHit(p) {
  const E = DISK_EMISSION
  const TX = DISK_TEXTURE
  const {
    hitR,
    freq,
    cphi,
    sphi,
    M,
    aStar,
    mdot,
    rin,
    rout,
    uRIscoM,
    hits,
    col,
    transm,
    dbgG,
    dbgT,
    dbgFlux,
    uDebugMode,
    uIdealBeam,
    uTime,
    uPrograde,
    uStructure,
    uArms,
    uClumps,
    uDust,
    uScaleH,
    uShearRate,
    uAnim,
    pathAbsY,
    /** Optional intensity weight (1 = full midplane hit; <1 soft volume sample) */
    weight,
    /** Vertical density 0–1 for atmosphere cooling (1 = midplane) */
    densVert,
  } = p

  const w = weight === undefined ? float(1) : weight
  const dVert = densVert === undefined ? float(1) : densVert

  // Effective contrasts: master structure × per-channel knobs
  const armContrast = uStructure.mul(uArms)
  const turbContrast = uStructure.mul(uClumps)
  const dustContrast = uStructure.mul(uDust)
  const shearRateLive = uAnim.greaterThan(0.5).select(uShearRate, float(0))

  // Intensity beam: display g² vs ideal g³
  const beamExp = uIdealBeam
    .greaterThan(0.5)
    .select(float(E.beamExponentIdeal), float(E.beamExponent))
  const beamFl = uIdealBeam
    .greaterThan(0.5)
    .select(float(E.beamFloorIdeal), float(E.beamFloor))
  const beam = pow(max(freq, beamFl), beamExp)

  // NT flux shape
  const gap = max(float(1).sub(sqrt(rin.div(max(hitR, rin.mul(1.0001))))), float(0))
  const Ftilde = gap.div(hitR.mul(hitR).mul(hitR).add(1e-12))
  const rPeak = rin.mul(E.ntPeakOverRin)
  const gapPeak = max(float(1).sub(sqrt(rin.div(max(rPeak, rin.mul(1.0001))))), float(0))
  const FtildeMax = gapPeak.div(rPeak.mul(rPeak).mul(rPeak).add(1e-12))
  const fluxRel = Ftilde.div(max(FtildeMax, float(1e-12)))
  const fluxVis = pow(max(fluxRel, float(1e-6)), float(E.fluxVisPower))

  // Soft radial edges — sharper ISCO plasma edge; long dusty outer power-law fade
  const softIn = min(
    float(1),
    max(float(0), hitR.sub(rin).div(max(rin.mul(0.25), M.mul(0.35)))),
  )
  const c3 = cphi.mul(cphi.mul(cphi).sub(sphi.mul(sphi).mul(3)))
  const s3 = sphi.mul(cphi.mul(cphi).mul(3).sub(sphi.mul(sphi)))
  const rimWobble = float(0.5).add(float(0.5).mul(c3.mul(0.7).add(s3.mul(0.3))))
  const routEff = rout.mul(float(0.9).add(rimWobble.mul(0.12)))
  // Power-law outer (not bullet smoothstep)
  const outerLin = min(
    float(1),
    max(float(0), routEff.sub(hitR).div(max(rout.sub(rin).mul(0.22), M.mul(1.6)))),
  )
  const softOut = pow(outerLin, float(1.7))
  const edgeIn = pow(softIn, float(0.9))
  const edgeFac = float(0.4).add(float(0.6).mul(edgeIn.mul(softOut)))

  // Zones relative to ISCO–outer (clear plasma / gas / dust)
  const spanR = max(rout.sub(rin), M.mul(4))
  const xRad = min(float(1), max(float(0), hitR.sub(rin).div(spanR)))
  const plasmaZone = exp(xRad.mul(-5.0))
  const dustZone = pow(max(xRad.sub(float(0.32)), float(0)).div(0.68), float(1.35))
  const gasZone = max(float(0), float(1).sub(plasmaZone).sub(dustZone.mul(0.7)))

  const rIscoM = max(uRIscoM, float(1.05))
  const iscoHot = pow(float(R_ISCO_SCHW_OVER_M).div(rIscoM), float(E.iscoHotPower))
  const spinFac = float(1).add(max(aStar, float(0)).mul(E.spinEtaNudge))
  const tPeakK = float(T_PEAK_REF_K)
    .mul(pow(max(mdot.div(T_PEAK_MDOT_REF), float(1e-6)), float(0.25)))
    .mul(iscoHot)
    .mul(spinFac)
  const tRestK = tPeakK.mul(pow(max(fluxRel, float(1e-6)), float(0.25)))
  const gColor = pow(max(freq, float(E.gColorFloor)), float(E.gColorExponent))
  // Plasma hotter, dust much cooler (still blackbody path)
  const tZone = float(1)
    .add(plasmaZone.mul(0.35))
    .sub(dustZone.mul(0.28).mul(dustContrast.add(0.4)))
    .sub(gasZone.mul(0.04))
  const tAtm = float(0.68).add(dVert.mul(0.32))
  let TK = max(
    float(E.tColorMinK),
    min(float(E.tColorMaxK), tRestK.mul(gColor).mul(tZone).mul(tAtm)),
  )

  // --- Structured surface: advected spirals + flow filaments + plasma + dust ---
  // Visible Keplerian: shearGain × rate × Ω̃ × t
  // Ω̃ = (M/r)^{3/2} — independent of M at fixed r/M (scale-free safe)
  const lnR = log(max(hitR.div(M), float(1e-4)))
  const rhoM = max(hitR.div(M), float(1e-4))
  const OmegaDim = pow(rhoM, float(-1.5))
  const sense = uPrograde.greaterThan(0.5).select(float(1), float(-1))
  const shear = sense
    .mul(shearRateLive)
    .mul(float(TX.shearGain))
    .mul(OmegaDim)
    .mul(uTime)

  // Rotate (cφ,sφ) into material frame — pattern advects with gas
  const csh = cos(shear)
  const ssh = sin(shear)
  const cx = cphi.mul(csh).sub(sphi.mul(ssh))
  const sx = cphi.mul(ssh).add(sphi.mul(csh))

  // m=2 log spiral in advected frame
  const c2a = cx.mul(cx).sub(sx.mul(sx))
  const s2a = cx.mul(sx).mul(2)
  const armsN = float(TX.arms)
  const alpha = armsN.mul(float(-TX.pitch)).mul(lnR).add(float(TX.phase0))
  const armWave = float(0.5).add(
    float(0.5).mul(c2a.mul(cos(alpha)).add(s2a.mul(sin(alpha)))),
  )
  const armsBright = pow(max(armWave, float(1e-4)), float(1.55))
  const armFac = float(1)
    .sub(armContrast)
    .add(armContrast.mul(float(0.16).add(armsBright.mul(1.1))))

  // m=2 + m=4 filaments (skip m=8 for perf — similar look at lower cost)
  const c4a = c2a.mul(c2a).sub(s2a.mul(s2a))
  const s4a = c2a.mul(s2a).mul(2)
  const zPhase = float(1).sub(dVert).mul(1.8)
  const a2s = float(-0.44).mul(lnR).add(float(TX.phase0).mul(0.7)).add(zPhase.mul(0.4))
  const a4s = float(-0.72).mul(lnR).add(float(TX.phase0).mul(1.1)).add(zPhase.mul(0.85))
  const stream2 = float(0.5).add(
    float(0.5).mul(c2a.mul(cos(a2s)).add(s2a.mul(sin(a2s)))),
  )
  const stream4 = float(0.5).add(
    float(0.5).mul(c4a.mul(cos(a4s)).add(s4a.mul(sin(a4s)))),
  )
  const streams = stream2
    .mul(float(1).sub(float(TX.streamHarmonic)))
    .add(pow(max(stream4, float(1e-4)), float(1.6)).mul(float(TX.streamHarmonic)))
  // Stronger filaments in denser midplane gas
  const streamStr = float(TX.streamContrast)
    .mul(uStructure)
    .mul(float(0.85).add(dVert.mul(0.5)))
  const streamFac = float(1)
    .sub(streamStr)
    .add(streamStr.mul(float(0.15).add(streams.mul(1.15))))

  // Turbulence in advected frame — z-slice so atmosphere ≠ extruded midplane
  const turbDomainZ = lnR.add(shear.mul(0.04)).add(zPhase.mul(0.25))
  const nUVx = cx.mul(1.65).add(turbDomainZ.mul(0.12)).add(dVert.mul(0.4))
  const nUVy = sx.mul(1.65).add(turbDomainZ.mul(0.11)).add(float(1).sub(dVert).mul(0.65))
  const ix1 = floor(nUVx)
  const iy1 = floor(nUVy)
  const fx1 = nUVx.sub(ix1)
  const fy1 = nUVy.sub(iy1)
  const ux1 = fx1.mul(fx1).mul(float(3).sub(fx1.mul(2)))
  const uy1 = fy1.mul(fy1).mul(float(3).sub(fy1.mul(2)))
  const n00 = fract(sin(ix1.mul(127.1).add(iy1.mul(311.7))).mul(43758.5453))
  const n10 = fract(sin(ix1.add(1).mul(127.1).add(iy1.mul(311.7))).mul(43758.5453))
  const n01 = fract(sin(ix1.mul(127.1).add(iy1.add(1).mul(311.7))).mul(43758.5453))
  const n11 = fract(sin(ix1.add(1).mul(127.1).add(iy1.add(1).mul(311.7))).mul(43758.5453))
  const turb1 = n00
    .mul(float(1).sub(ux1))
    .add(n10.mul(ux1))
    .mul(float(1).sub(uy1))
    .add(n01.mul(float(1).sub(ux1)).add(n11.mul(ux1)).mul(uy1))

  const nUVx2 = nUVx.mul(2.2)
  const nUVy2 = nUVy.mul(2.2)
  const ix2 = floor(nUVx2)
  const iy2 = floor(nUVy2)
  const fx2 = nUVx2.sub(ix2)
  const fy2 = nUVy2.sub(iy2)
  const ux2 = fx2.mul(fx2).mul(float(3).sub(fx2.mul(2)))
  const uy2 = fy2.mul(fy2).mul(float(3).sub(fy2.mul(2)))
  const m00 = fract(sin(ix2.mul(127.1).add(iy2.mul(311.7)).add(19.1)).mul(43758.5453))
  const m10 = fract(sin(ix2.add(1).mul(127.1).add(iy2.mul(311.7)).add(19.1)).mul(43758.5453))
  const m01 = fract(sin(ix2.mul(127.1).add(iy2.add(1).mul(311.7)).add(19.1)).mul(43758.5453))
  const m11 = fract(
    sin(ix2.add(1).mul(127.1).add(iy2.add(1).mul(311.7)).add(19.1)).mul(43758.5453),
  )
  const turb2 = m00
    .mul(float(1).sub(ux2))
    .add(m10.mul(ux2))
    .mul(float(1).sub(uy2))
    .add(m01.mul(float(1).sub(ux2)).add(m11.mul(ux2)).mul(uy2))

  // 2 octaves only (3rd was ~+40% texture ALU for little look)
  const turb = turb1.mul(0.62).add(turb2.mul(0.38))
  const plasmaClump = pow(max(turb2, float(1e-4)), float(1.75)).mul(plasmaZone)

  const turbFac = float(1)
    .sub(turbContrast)
    .add(
      turbContrast.mul(
        float(0.18).add(turb.mul(0.85)).add(plasmaClump.mul(0.75).mul(plasmaZone.add(0.35))),
      ),
    )
  const ripple = float(0.5).add(float(0.5).mul(sin(lnR.mul(4.8).add(shear.mul(0.25)))))

  // Outer dust lanes stronger in dust zone
  const dustWave = float(0.5).add(
    float(0.5).mul(sin(lnR.mul(5.4).add(0.55).add(shear.mul(0.12)))),
  )
  const dust = float(1).sub(
    dustContrast
      .mul(dustZone)
      .mul(float(0.4).add(dustWave.mul(0.6)))
      .mul(float(0.55).add(uStructure.mul(0.45))),
  )
  // Plasma: boost clump contrast; dust: mute arms a bit
  const armZone = float(1).sub(dustZone.mul(0.35)).add(plasmaZone.mul(0.15))
  let texFac = armFac
    .mul(armZone)
    .mul(streamFac)
    .mul(turbFac)
    .mul(dust)
    .mul(float(0.84).add(ripple.mul(0.32)))
    .mul(edgeFac)
  texFac = max(float(TX.texMin), min(float(TX.texMax), texFac))

  // Plasma hotspots / cooler dust: T jitter (still blackbody)
  const tJitter = float(1)
    .add(float(TX.tempJitterAmp).mul(turbContrast.add(0.35)).mul(turb.mul(2).sub(1)))
    .add(plasmaZone.mul(0.1).mul(turbContrast.add(0.4)))
    .sub(dustZone.mul(0.07).mul(dustContrast.add(0.3)))
  TK = max(float(E.tColorMinK), min(float(E.tColorMaxK), TK.mul(tJitter)))

  // Max-norm Planck chroma
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

  // Lensed multi-hit: modest secondary (too high → milk white rings)
  const bounce = float(1).add(max(min(hits, float(4)).sub(1), float(0)).mul(0.2))
  const mdotBright = float(E.mdotBrightBase).add(
    pow(max(mdot.div(T_PEAK_MDOT_REF), float(E.mdotBrightFloor)), float(E.mdotBrightPower)).mul(
      E.mdotBrightScale,
    ),
  )
  // pathFac mild
  const nY = max(pathAbsY, float(0.18))
  const pathFac = min(float(1.12), uScaleH.div(nY).mul(0.25).add(0.9))
  const iFlux = max(fluxVis, float(E.fluxVisFloor))
    .mul(mdotBright)
    .mul(E.intensityGain)
    .mul(pathFac)
  // Soft intensity so volume paths keep chroma (not pure white)
  const raw = iFlux.mul(beam).mul(texFac).mul(bounce).mul(w)
  const softI = raw.div(float(1).add(raw.mul(0.35)))
  const emit = chroma.mul(softI)

  dbgG.assign(freq)
  dbgT.assign(TK.div(float(12000)))
  dbgFlux.assign(fluxVis.mul(texFac).mul(w))

  If(uDebugMode.notEqual(float(8)).and(w.greaterThan(0.01)), () => {
    col.addAssign(emit.mul(transm))
    transm.mulAssign(max(float(0.88), float(1).sub(w.mul(0.12))))
  })
}
