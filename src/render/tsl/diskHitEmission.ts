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
  acos,
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

  // NT / Page–Thorne flux shape (Kerr when |a★|>0) — no nested helpers (TSL)
  const aEff = uPrograde.greaterThan(0.5).select(aStar, aStar.mul(-1))
  const x = sqrt(max(hitR.div(max(M, float(1e-8))), float(1.05)))
  const x0 = sqrt(max(rin.div(max(M, float(1e-8))), float(1.05)))
  const gapSchw = max(float(1).sub(sqrt(rin.div(max(hitR, rin.mul(1.0001))))), float(0))
  const Fschw = gapSchw.div(hitR.mul(hitR).mul(hitR).add(1e-12))
  const th = acos(max(float(-1), min(float(1), aEff)))
  const x1 = float(2).mul(cos(th.sub(float(Math.PI)).div(3)))
  const x2 = float(2).mul(cos(th.add(float(Math.PI)).div(3)))
  const x3 = float(-2).mul(cos(th.div(3)))
  const Bpt = float(1).add(aEff.div(x.mul(x).mul(x).add(1e-12)))
  const Cpt = float(1)
    .sub(float(3).div(x.mul(x).add(1e-12)))
    .add(aEff.mul(2).div(x.mul(x).mul(x).add(1e-12)))
  // Page–Thorne log terms (inlined)
  const r1 = x.sub(x1).div(x0.sub(x1).add(1e-14))
  const r2 = x.sub(x2).div(x0.sub(x2).add(1e-14))
  const r3 = x.sub(x3).div(x0.sub(x3).add(1e-14))
  const t1 = float(3)
    .mul(x1.sub(aEff))
    .mul(x1.sub(aEff))
    .div(x1.mul(x1.sub(x2)).mul(x1.sub(x3)).add(1e-14))
    .mul(log(max(r1, float(1e-12))))
    .mul(r1.greaterThan(0).select(float(1), float(0)))
  const t2 = float(3)
    .mul(x2.sub(aEff))
    .mul(x2.sub(aEff))
    .div(x2.mul(x2.sub(x1)).mul(x2.sub(x3)).add(1e-14))
    .mul(log(max(r2, float(1e-12))))
    .mul(r2.greaterThan(0).select(float(1), float(0)))
  const t3 = float(3)
    .mul(x3.sub(aEff))
    .mul(x3.sub(aEff))
    .div(x3.mul(x3.sub(x1)).mul(x3.sub(x2)).add(1e-14))
    .mul(log(max(r3, float(1e-12))))
    .mul(r3.greaterThan(0).select(float(1), float(0)))
  const Qpt = x
    .sub(x0)
    .sub(aEff.mul(1.5).mul(log(max(x.div(max(x0, float(1e-6))), float(1e-12)))))
    .sub(t1)
    .sub(t2)
    .sub(t3)
  const Fkerr = max(Qpt, float(0)).div(
    max(Bpt, float(1e-6))
      .mul(sqrt(max(Cpt, float(1e-8))))
      .mul(hitR.mul(hitR).mul(hitR).add(1e-12)),
  )
  const Ftilde = abs(aEff).lessThan(1e-4).select(Fschw, Fkerr)
  const rPeak = rin.mul(E.ntPeakOverRin)
  const xP = sqrt(max(rPeak.div(max(M, float(1e-8))), float(1.05)))
  const gapP = max(float(1).sub(sqrt(rin.div(max(rPeak, rin.mul(1.0001))))), float(0))
  const FschwP = gapP.div(rPeak.mul(rPeak).mul(rPeak).add(1e-12))
  const Bp = float(1).add(aEff.div(xP.mul(xP).mul(xP).add(1e-12)))
  const Cp = float(1)
    .sub(float(3).div(xP.mul(xP).add(1e-12)))
    .add(aEff.mul(2).div(xP.mul(xP).mul(xP).add(1e-12)))
  const rp1 = xP.sub(x1).div(x0.sub(x1).add(1e-14))
  const rp2 = xP.sub(x2).div(x0.sub(x2).add(1e-14))
  const rp3 = xP.sub(x3).div(x0.sub(x3).add(1e-14))
  const tp1 = float(3)
    .mul(x1.sub(aEff))
    .mul(x1.sub(aEff))
    .div(x1.mul(x1.sub(x2)).mul(x1.sub(x3)).add(1e-14))
    .mul(log(max(rp1, float(1e-12))))
    .mul(rp1.greaterThan(0).select(float(1), float(0)))
  const tp2 = float(3)
    .mul(x2.sub(aEff))
    .mul(x2.sub(aEff))
    .div(x2.mul(x2.sub(x1)).mul(x2.sub(x3)).add(1e-14))
    .mul(log(max(rp2, float(1e-12))))
    .mul(rp2.greaterThan(0).select(float(1), float(0)))
  const tp3 = float(3)
    .mul(x3.sub(aEff))
    .mul(x3.sub(aEff))
    .div(x3.mul(x3.sub(x1)).mul(x3.sub(x2)).add(1e-14))
    .mul(log(max(rp3, float(1e-12))))
    .mul(rp3.greaterThan(0).select(float(1), float(0)))
  const Qp = xP
    .sub(x0)
    .sub(aEff.mul(1.5).mul(log(max(xP.div(max(x0, float(1e-6))), float(1e-12)))))
    .sub(tp1)
    .sub(tp2)
    .sub(tp3)
  const FkerrP = max(Qp, float(0)).div(
    max(Bp, float(1e-6))
      .mul(sqrt(max(Cp, float(1e-8))))
      .mul(rPeak.mul(rPeak).mul(rPeak).add(1e-12)),
  )
  const FtildeMax = abs(aEff).lessThan(1e-4).select(FschwP, FkerrP)
  const fluxRel = Ftilde.div(max(FtildeMax, float(1e-12)))
  const fluxVis = pow(max(fluxRel, float(1e-6)), float(E.fluxVisPower))

  // Soft radial edges — sharp physical ISCO zero-torque taper
  const softIn = min(
    float(1),
    max(float(0), hitR.sub(rin).div(max(rin.mul(0.12), M.mul(0.2)))),
  )
  const outerLin = min(
    float(1),
    max(float(0), rout.sub(hitR).div(max(rout.sub(rin).mul(0.2), M.mul(1.5)))),
  )
  const softOut = pow(outerLin, float(1.65))
  // Harder ISCO edge (emissivity locked to rin)
  const edgeFac = pow(softIn, float(1.35)).mul(softOut)

  // Zones relative to ISCO–outer
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
  // Physical T: NT + g-redshift; mild outer dust cooling only (no fake plasma heat)
  const tZone = float(1).sub(dustZone.mul(0.12).mul(dustContrast.add(0.25)))
  const tAtm = float(0.75).add(dVert.mul(0.25))
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
  // Kerr frame-drag spiral wind: δφ ∝ a★ (M/r) — stronger near the hole
  const drag = aStar.mul(float(TX.frameDragGain)).div(max(rhoM, float(1.05)))
  const shearTot = shear.add(drag.mul(float(1).add(uTime.mul(0.12))))

  // Rotate (cφ,sφ) into material frame — Kepler + frame-drag
  const csh = cos(shearTot)
  const ssh = sin(shearTot)
  const cx = cphi.mul(csh).sub(sphi.mul(ssh))
  const sx = cphi.mul(ssh).add(sphi.mul(csh))

  // m=2 log spiral in advected frame (twisted by spin)
  const c2a = cx.mul(cx).sub(sx.mul(sx))
  const s2a = cx.mul(sx).mul(2)
  const armsN = float(TX.arms)
  const alpha = armsN
    .mul(float(-TX.pitch))
    .mul(lnR)
    .add(float(TX.phase0))
    .add(drag)
  const armWave = float(0.5).add(
    float(0.5).mul(c2a.mul(cos(alpha)).add(s2a.mul(sin(alpha)))),
  )
  const armsBright = pow(max(armWave, float(1e-4)), float(1.55))
  const armFac = float(1)
    .sub(armContrast)
    .add(armContrast.mul(float(0.16).add(armsBright.mul(1.1))))

  // m=2 + m=4 filaments
  const c4a = c2a.mul(c2a).sub(s2a.mul(s2a))
  const s4a = c2a.mul(s2a).mul(2)
  const zPhase = float(1).sub(dVert).mul(1.8)
  const a2s = float(-0.44)
    .mul(lnR)
    .add(float(TX.phase0).mul(0.7))
    .add(zPhase.mul(0.4))
    .add(drag.mul(0.5))
  const a4s = float(-0.72)
    .mul(lnR)
    .add(float(TX.phase0).mul(1.1))
    .add(zPhase.mul(0.85))
    .add(drag.mul(0.8))
  const stream2 = float(0.5).add(
    float(0.5).mul(c2a.mul(cos(a2s)).add(s2a.mul(sin(a2s)))),
  )
  const stream4 = float(0.5).add(
    float(0.5).mul(c4a.mul(cos(a4s)).add(s4a.mul(sin(a4s)))),
  )
  const streams = stream2
    .mul(float(1).sub(float(TX.streamHarmonic)))
    .add(pow(max(stream4, float(1e-4)), float(1.6)).mul(float(TX.streamHarmonic)))
  const streamStr = float(TX.streamContrast)
    .mul(uStructure)
    .mul(float(0.85).add(dVert.mul(0.5)))
  const streamFac = float(1)
    .sub(streamStr)
    .add(streamStr.mul(float(0.15).add(streams.mul(1.15))))

  // Turbulence in advected frame — z-slice so atmosphere ≠ extruded midplane
  const turbDomainZ = lnR.add(shearTot.mul(0.04)).add(zPhase.mul(0.25))
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

  const turb = turb1.mul(0.62).add(turb2.mul(0.38))
  // Log-normal MRI dens proxy: f = exp(σ ξ − σ²/2), ξ=2n−1
  const sigma = float(TX.mriSigma).mul(float(0.55).add(turbContrast.mul(0.7)))
  const xi = turb.mul(2).sub(1)
  const mriLn = exp(xi.mul(sigma).sub(sigma.mul(sigma).mul(0.5)))
  const plasmaClump = pow(max(turb2, float(1e-4)), float(1.75)).mul(plasmaZone)

  const turbFac = float(1)
    .sub(turbContrast)
    .add(
      turbContrast.mul(
        float(0.14)
          .add(turb.mul(0.55))
          .add(plasmaClump.mul(0.55).mul(plasmaZone.add(0.35)))
          .add(mriLn.mul(0.35)),
      ),
    )
  const ripple = float(0.5).add(float(0.5).mul(sin(lnR.mul(4.8).add(shearTot.mul(0.25)))))

  // Outer dust lanes stronger in dust zone
  const dustWave = float(0.5).add(
    float(0.5).mul(sin(lnR.mul(5.4).add(0.55).add(shearTot.mul(0.12)))),
  )
  const dust = float(1).sub(
    dustContrast
      .mul(dustZone)
      .mul(float(0.4).add(dustWave.mul(0.6)))
      .mul(float(0.55).add(uStructure.mul(0.45))),
  )
  const armZone = float(1).sub(dustZone.mul(0.35)).add(plasmaZone.mul(0.15))
  let texFac = armFac
    .mul(armZone)
    .mul(streamFac)
    .mul(turbFac)
    .mul(dust)
    .mul(float(0.84).add(ripple.mul(0.32)))
    .mul(edgeFac)
    .mul(float(0.82).add(mriLn.mul(0.18)))
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

  // Photon-ring: multi-wrap from true path accumulation only (boost=0 by default)
  const wrap = max(hits.sub(float(1)), float(0))
  const photonProx = exp(abs(rhoM.sub(float(3))).mul(-1.15))
  const silk = min(
    float(2.0),
    float(1)
      .add(min(wrap, float(3)).mul(0.12))
      .add(photonProx.mul(min(wrap, float(2))).mul(float(TX.photonRingBoost))),
  )
  const mdotBright = float(E.mdotBrightBase).add(
    pow(max(mdot.div(T_PEAK_MDOT_REF), float(E.mdotBrightFloor)), float(E.mdotBrightPower)).mul(
      E.mdotBrightScale,
    ),
  )
  // Path length + linear limb darkening (optically thick atmosphere μ = |n·ẑ|)
  const mu = min(float(1), max(pathAbsY, float(0.04)))
  const limb = float(0.5).add(float(0.5).mul(pow(mu, float(0.7))))
  const pathFac = min(float(1.1), uScaleH.div(max(mu, float(0.12))).mul(0.18).add(0.9))
  const iFlux = max(fluxVis, float(E.fluxVisFloor))
    .mul(mdotBright)
    .mul(E.intensityGain)
    .mul(pathFac)
    .mul(limb)
  // Mild ACES pre-soft only (not milk-glass)
  const raw = iFlux.mul(beam).mul(texFac).mul(silk).mul(w)
  const softI = raw.div(float(1).add(raw.mul(0.18)))
  const emit = chroma.mul(softI)

  dbgG.assign(freq)
  dbgT.assign(TK.div(float(12000)))
  dbgFlux.assign(fluxVis.mul(texFac).mul(w))

  If(uDebugMode.notEqual(float(8)).and(w.greaterThan(0.01)), () => {
    col.addAssign(emit.mul(transm))
  // Mild multi-hit extinction only — leave room for true lensed far side
  transm.mulAssign(max(float(0.94), float(1).sub(w.mul(0.06))))
  })
}
