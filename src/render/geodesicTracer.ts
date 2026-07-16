// @ts-nocheck — Three.js TSL node graphs make tsc (TS 7) non-terminating on this file.
import * as THREE from 'three/webgpu'
import {
  Break,
  Fn,
  If,
  Loop,
  abs,
  cos,
  cross,
  dot,
  exp,
  float,
  fract,
  int,
  max,
  min,
  pow,
  screenSize,
  sin,
  sqrt,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import { DEFAULT_MDOT } from '../physics/constants'
import { R_ISCO_SCHW_OVER_M } from '../physics/disk'
import { DEFAULT_DISK } from '../physics/diskParams'
import { RT } from '../physics/geodesic/rtConstants'
import { OBSERVER_DEFAULTS } from '../physics/observer'
import { DEBUG_DEFAULTS } from '../debug/state'
import { SKY_DEFAULTS } from '../state/sky'
import type { GeodesicTracer } from './geodesicTracerTypes'
import { applyDebugFalseColor } from './tsl/debugFalseColor'
import { sampleDeepSpaceSky } from './tsl/deepSpaceSky'
import { accumulateDiskHit } from './tsl/diskHitEmission'
import { processDiskVolumeSample } from './tsl/diskLayerHit'
import { knNullAccelTsl } from './tsl/knNullAccelTsl'

export type {
  CameraTraceParams,
  GeodesicTracer,
  SpacetimeTraceParams,
} from './geodesicTracerTypes'

/**
 * Einstein–Maxwell null geodesic ray marcher (WebGPU / TSL).
 * Families: Schwarzschild / Kerr / RN / Kerr–Newman from (M, a★, Q).
 * Disk: Novikov–Thorne T(r) with family ISCO; flux ∝ ṁ, T ∝ ṁ^{1/4}.
 * Spin ‖ +Y; disk in XZ (y = 0).
 *
 * Integrators (uIntegratorMode):
 *   0 = real-time Cartesian RK2 + kn force (default, GPU twin of cpuRef)
 *   1 = Boyer–Lindquist Mino-time (CPU Phase 1–3 math on GPU; Kerr/Schw)
 * Capture horizon uses (M,a,Q). BL potentials Kerr-form Δ (a,M); Q in g + horizon.
 * Escape sky: BL syncs vel from (r,θ,φ) so background is lensed.
 *
 * Emission constants: DISK_EMISSION in physics/disk.ts (CPU/GPU lockstep).
 */
export function createGeodesicTracer(): GeodesicTracer {
  const uMass = uniform(1)
  const uSpinStar = uniform(0)
  const uCharge = uniform(0)
  const uMdot = uniform(DEFAULT_MDOT)
  const uRIscoM = uniform(R_ISCO_SCHW_OVER_M)
  const uCamDistM = uniform(OBSERVER_DEFAULTS.distanceM)
  const uInclination = uniform(OBSERVER_DEFAULTS.inclination)
  const uAzimuth = uniform(OBSERVER_DEFAULTS.azimuth)
  const uFov = uniform(OBSERVER_DEFAULTS.fov)
  const uRoutM = uniform(RT.diskOuterM)
  /** 1 = prograde disk Ω; 0 = retrograde */
  const uPrograde = uniform(1)
  /** Disk structure realism (not hair) */
  const uStructure = uniform(DEFAULT_DISK.structure)
  const uArms = uniform(DEFAULT_DISK.arms)
  const uClumps = uniform(DEFAULT_DISK.clumps)
  const uDust = uniform(DEFAULT_DISK.dust)
  const uScaleH = uniform(DEFAULT_DISK.scaleHeight)
  const uShearRate = uniform(DEFAULT_DISK.shearRate)
  const uAnim = uniform(DEFAULT_DISK.animate ? 1 : 0)
  const uStarDensity = uniform(SKY_DEFAULTS.starDensity)
  const uStarBright = uniform(SKY_DEFAULTS.starBrightness)
  const uNebula = uniform(SKY_DEFAULTS.nebula)
  const uMilky = uniform(SKY_DEFAULTS.milky)
  const uDebugMode = uniform(DEBUG_DEFAULTS.mode)
  /** 0 = RT Cartesian, 1 = BL Mino */
  const uIntegratorMode = uniform(0)
  /** 1 = scale-free D = distanceM · M; 0 = fixed geometric D */
  const uScaleFree = uniform(1)
  /** 1 = ideal I∝g³; 0 = display I∝g² */
  const uIdealBeam = uniform(1)
  /** Animation clock (s) — Keplerian disk shear */
  const uTime = uniform(0)
  const STEPS = RT.maxSteps

  const colorNode = Fn(() => {
    const M = uMass
    const aStar = uSpinStar
    const a = aStar.mul(M)
    const Q = uCharge
    const mdot = max(uMdot, float(1e-6))
    const rs = M.mul(2)

    // r₊ = M + √(M² − a² − Q²)
    const disc = max(M.mul(M).sub(a.mul(a)).sub(Q.mul(Q)), float(0))
    const rPlus = M.add(sqrt(disc))
    const rCapture = rPlus.mul(RT.captureMargin)

    // Family ISCO from CPU (units of M → geometric)
    const rin = max(uRIscoM.mul(M), rPlus.mul(RT.iscoHorizonMargin))
    const rout = uRoutM.mul(M)
    // scale-free: D = d·M; fixed: D = d
    const camD = uScaleFree.greaterThan(0.5).select(uCamDistM.mul(M), uCamDistM)

    const tex = uv()
    const aspect = screenSize.x.div(max(screenSize.y, float(1)))
    const ndc = vec2(tex.x.mul(2).sub(1).mul(aspect), tex.y.mul(2).sub(1))

    const th = uInclination
    const ph = uAzimuth
    const camPos = vec3(
      sin(th).mul(cos(ph)).mul(camD),
      cos(th).mul(camD),
      sin(th).mul(sin(ph)).mul(camD),
    )

    const forward = camPos.negate().normalize()
    const worldUp = vec3(0, 1, 0)
    const rightRaw = cross(forward, worldUp)
    const right = rightRaw
      .length()
      .lessThan(1e-4)
      .select(vec3(1, 0, 0), rightRaw.normalize())
    const up = cross(right, forward).normalize()

    const dir0 = forward
      .add(right.mul(ndc.x.mul(uFov)))
      .add(up.mul(ndc.y.mul(uFov)))
      .normalize()

    const pos = camPos.toVar()
    const vel = dir0.toVar()
    const col = vec3(0, 0, 0).toVar()
    const transm = float(1).toVar()
    const prevY = camPos.y.toVar()
    const done = float(0).toVar()
    const escaped = float(0).toVar()
    const captured = float(0).toVar()
    const minR = camD.toVar()
    const hits = float(0).toVar()
    /** Disk volume optical depth (Beer's law) — caps edge-on stacking */
    const diskTau = float(0).toVar()
    const stepCount = float(0).toVar()
    const dbgG = float(0).toVar()
    const dbgT = float(0).toVar()
    const dbgFlux = float(0).toVar()
    // Impact parameter scale |r × n| at camera
    const impactB = cross(camPos, dir0).length().toVar()

    // --- BL camera init (asymptotic spherical frame, Phase 2/4) ---
    const useBl = uIntegratorMode.greaterThan(0.5)
    const rHat = camPos.normalize()
    const stCam = max(sin(th), float(1e-5))
    const ctCam = cos(th)
    const spCam = sin(ph)
    const cpCam = cos(ph)
    const thetaHat = vec3(ctCam.mul(cpCam), stCam.mul(-1), ctCam.mul(spCam))
    const phiHat = vec3(spCam.mul(-1), float(0), cpCam)
    const n_r = dot(dir0, rHat)
    const n_th = dot(dir0, thetaHat)
    const n_ph = dot(dir0, phiHat)
    const blE = float(1)
    const blLz = camD.mul(stCam).mul(n_ph).mul(blE).toVar()
    const pTheta = camD.mul(n_th).mul(blE)
    const blQ = pTheta
      .mul(pTheta)
      .add(
        ctCam
          .mul(ctCam)
          .mul(a.mul(a).mul(blE).mul(blE).mul(-1).add(blLz.mul(blLz).div(stCam.mul(stCam)))),
      )
      .toVar()
    const blR = camD.toVar()
    const blTh = th.toVar()
    const blPh = ph.toVar()
    const blSr = n_r.lessThan(0).select(float(-1), float(1)).toVar()
    const blSt = blQ
      .abs()
      .greaterThan(1e-8)
      .select(n_th.greaterThanEqual(0).select(float(1), float(-1)), float(0))
      .toVar()
    const prevTh = th.toVar()
    const prevBlR = camD.toVar()
    const prevBlPh = ph.toVar()
    const halfPi = float(1.57079632679)

    Loop({ start: int(0), end: int(STEPS), type: 'int', condition: '<' }, () => {
      If(done.greaterThan(0.5), () => {
        Break()
      })
      stepCount.addAssign(1)

      // ========== BL Mino path ==========
      If(useBl, () => {
        minR.assign(min(minR, blR))
        If(blR.lessThanEqual(rCapture), () => {
          captured.assign(1)
          done.assign(1)
        })
        If(
          done
            .lessThan(0.5)
            .and(blR.greaterThan(camD.mul(RT.escapeCamFactor)))
            .and(blSr.greaterThan(0)),
          () => {
            escaped.assign(1)
            done.assign(1)
          },
        )
        If(done.lessThan(0.5), () => {
          prevTh.assign(blTh)
          prevBlR.assign(blR)
          prevBlPh.assign(blPh)
          const Delta = max(
            blR.mul(blR).sub(M.mul(2).mul(blR)).add(a.mul(a)),
            float(1e-14),
          )
          const P = blE.mul(blR.mul(blR).add(a.mul(a))).sub(a.mul(blLz))
          const Kterm = blQ.add(blLz.sub(a.mul(blE)).mul(blLz.sub(a.mul(blE))))
          const Rv0 = P.mul(P).sub(Delta.mul(Kterm))
          const sTh = max(sin(blTh), float(1e-5))
          const cTh = cos(blTh)
          const Tv0 = blQ.sub(
            cTh
              .mul(cTh)
              .mul(a.mul(a).mul(blE).mul(blE).mul(-1).add(blLz.mul(blLz).div(sTh.mul(sTh)))),
          )
          const srFlip = Rv0.lessThanEqual(1e-12).select(float(-1), float(1))
          const stFlip = Tv0.lessThanEqual(1e-12)
            .and(blSt.abs().greaterThan(0.5))
            .select(float(-1), float(1))
          blSr.assign(blSr.mul(srFlip))
          blSt.assign(blSt.mul(stFlip))
          const Rv = max(Rv0, float(0))
          const Tv = max(Tv0, float(0))
          const sqrtR = sqrt(Rv)
          const sqrtT = sqrt(Tv)
          const targetDr = max(blR.mul(0.02), M.mul(1e-4))
          const dL0 = sqrtR.greaterThan(1e-14).select(targetDr.div(sqrtR), float(0.002))
          const dL1 = sqrtT.greaterThan(1e-14)
            .and(blSt.abs().greaterThan(0.5))
            .select(min(dL0, float(0.05).div(max(sqrtT, float(1e-8)))), dL0)
          const dL = min(max(dL1, float(1e-10)), float(0.5))
          const rM = max(blR.add(blSr.mul(sqrtR).mul(dL).mul(0.5)), M.mul(1e-6))
          const thM = min(
            max(blTh.add(blSt.mul(sqrtT).mul(dL).mul(0.5)), float(1e-5)),
            float(3.14159265).sub(1e-5),
          )
          const DeltaM = max(rM.mul(rM).sub(M.mul(2).mul(rM)).add(a.mul(a)), float(1e-14))
          const PM = blE.mul(rM.mul(rM).add(a.mul(a))).sub(a.mul(blLz))
          const KtermM = blQ.add(blLz.sub(a.mul(blE)).mul(blLz.sub(a.mul(blE))))
          const RvM0 = PM.mul(PM).sub(DeltaM.mul(KtermM))
          const sThM = max(sin(thM), float(1e-5))
          const cThM = cos(thM)
          const TvM0 = blQ.sub(
            cThM
              .mul(cThM)
              .mul(a.mul(a).mul(blE).mul(blE).mul(-1).add(blLz.mul(blLz).div(sThM.mul(sThM)))),
          )
          const srM = blSr.mul(RvM0.lessThanEqual(1e-12).select(float(-1), float(1)))
          const stM = blSt.mul(
            TvM0.lessThanEqual(1e-12)
              .and(blSt.abs().greaterThan(0.5))
              .select(float(-1), float(1)),
          )
          const drM = srM.mul(sqrt(max(RvM0, float(0))))
          const dthM = stM.mul(sqrt(max(TvM0, float(0))))
          const dph = blLz.div(sThM.mul(sThM)).sub(a.mul(blE)).add(a.mul(PM).div(DeltaM))
          blR.assign(max(blR.add(drM.mul(dL)), M.mul(1e-6)))
          blTh.assign(
            min(max(blTh.add(dthM.mul(dL)), float(1e-5)), float(3.14159265).sub(1e-5)),
          )
          blPh.assign(blPh.add(dph.mul(dL)))
          blSr.assign(srM)
          blSt.assign(stM)
          If(
            prevTh
              .sub(halfPi)
              .mul(blTh.sub(halfPi))
              .lessThan(0)
              .and(transm.greaterThan(0.02))
              .and(hits.lessThan(8)),
            () => {
              const denom = prevTh.sub(blTh)
              const t = abs(denom)
                .lessThan(1e-15)
                .select(float(0), prevTh.sub(halfPi).div(denom))
              const tt = min(max(t, float(0)), float(1))
              const hitR = prevBlR.add(blR.sub(prevBlR).mul(tt))
              If(hitR.greaterThanEqual(rin).and(hitR.lessThanEqual(rout)), () => {
                hits.addAssign(1)
                const rhoSafe = max(hitR, float(1e-5))
                const sqrtM = sqrt(max(M, float(1e-8)))
                const r32 = pow(rhoSafe, float(1.5))
                // Ω = ±√M / (r^{3/2} ± a√M)
                const OmegaPro = sqrtM.div(r32.add(a.mul(sqrtM)).add(1e-8))
                const denomR = r32.sub(a.mul(sqrtM))
                const OmegaRet = float(-1)
                  .mul(sqrtM)
                  .div(abs(denomR).lessThan(1e-12).select(float(1e-12), denomR))
                const Omega = uPrograde.greaterThan(0.5).select(OmegaPro, OmegaRet)
                const g_tt = float(-1).add(rs.div(rhoSafe)).sub(Q.mul(Q).div(rhoSafe.mul(rhoSafe)))
                const g_tphi = a.mul(M).mul(-2).div(rhoSafe)
                const g_phiphi = rhoSafe
                  .mul(rhoSafe)
                  .add(a.mul(a))
                  .add(M.mul(2).mul(a).mul(a).div(rhoSafe))
                  .sub(a.mul(a).mul(Q).mul(Q).div(rhoSafe.mul(rhoSafe)))
                const Xorb = g_tt
                  .mul(-1)
                  .sub(Omega.mul(2).mul(g_tphi))
                  .sub(Omega.mul(Omega).mul(g_phiphi))
                const u_t = float(1).div(sqrt(max(Xorb, float(1e-8))))
                const lambda = blLz.div(max(blE, float(1e-8)))
                const freq = float(1).div(
                  max(u_t.mul(float(1).sub(Omega.mul(lambda))), float(0.25)),
                )
                const hitPh = prevBlPh.add(blPh.sub(prevBlPh).mul(tt))
                accumulateDiskHit({
                  hitR,
                  freq,
                  cphi: cos(hitPh),
                  sphi: sin(hitPh),
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
                  // BL equator: moderate path (no easy |v_y|)
                  pathAbsY: float(0.35),
                  weight: float(1),
                })
              })
            },
          )
        })
      })

      // ========== RT Cartesian path (default) ==========
      If(useBl.not(), () => {
      const r = pos.length()
      minR.assign(min(minR, r))

      If(r.lessThanEqual(rCapture), () => {
        captured.assign(1)
        done.assign(1)
        Break()
      })

      If(r.greaterThan(camD.mul(RT.escapeCamFactor)).and(dot(pos, vel).greaterThan(0)), () => {
        escaped.assign(1)
        done.assign(1)
        Break()
      })

      const adapt = min(float(RT.adaptMax), max(float(RT.adaptFloor), r.div(M.mul(RT.adaptScale))))
      const ds = float(RT.baseStepM).mul(M).mul(adapt)

      prevY.assign(pos.y)
      const p0x = pos.x.toVar()
      const p0z = pos.z.toVar()

      const a1 = knNullAccelTsl(pos, vel, rs, a, Q, M)
      const pm = pos.add(vel.mul(ds.mul(0.5)))
      const vm = vel.add(a1.mul(ds.mul(0.5)))
      const a2 = knNullAccelTsl(pm, vm, rs, a, Q, M)

      pos.addAssign(vel.add(vm).mul(ds.mul(0.5)))
      vel.addAssign(a1.add(a2).mul(ds.mul(0.5)))

      // Frame-drag twist about +Y
      const rr = max(pos.length(), float(1e-6))
      const r3f = rr.mul(rr).mul(rr)
      const dphi = a.mul(M).mul(2).mul(ds).div(r3f.add(a.mul(a).mul(rr)).add(1e-12))
      const cph = cos(dphi)
      const sph = sin(dphi)
      const vx = vel.x.mul(cph).add(vel.z.mul(sph))
      const vz = vel.x.mul(sph.mul(-1)).add(vel.z.mul(cph))
      vel.assign(vec3(vx, vel.y, vz))

      // 3D volume: distinct plasma (inner thin hot) / gas (mid) / dust (outer thick cool).
      // Strong H(r) flare — not constant thickness. Soft power-law outer fade (no capsule tips).
      const hxV = pos.x
      const hzV = pos.z
      const rhoV = hxV.mul(hxV).add(hzV.mul(hzV)).sqrt()
      const span = max(rout.sub(rin), M.mul(4))
      // Radial coordinate 0 at ISCO → 1 at outer
      const xRad = min(float(1), max(float(0), rhoV.sub(rin).div(span)))
      // Zone weights (sum not required = 1; used as blends)
      const plasmaW = exp(xRad.mul(-5.0)) // hot inner plasma
      const dustW = pow(max(xRad.sub(float(0.32)), float(0)).div(0.68), float(1.35)) // outer dust
      // Strong flare: thin near ISCO, much thicker outer dust
      // H/R ≈ h0 · (0.18 + 1.6 x^1.05 + 0.7 dust)
      const hOverR = uScaleH.mul(
        float(0.18)
          .add(pow(xRad.add(0.04), float(1.05)).mul(1.55))
          .add(dustW.mul(0.75)),
      )
      const invRhoV = float(1).div(max(rhoV, float(1e-5)))
      const cphiV = hxV.mul(invRhoV)
      const sphiV = hzV.mul(invRhoV)
      const c3 = cphiV.mul(cphiV.mul(cphiV).sub(sphiV.mul(sphiV).mul(3)))
      const s3 = sphiV.mul(cphiV.mul(cphiV).mul(3).sub(sphiV.mul(sphiV)))
      const rimWobble = float(0.5).add(float(0.5).mul(c3.mul(0.7).add(s3.mul(0.3))))
      const routEff = rout.mul(float(0.9).add(rimWobble.mul(0.12)))
      // Power-law outer fade (long dusty tail) — avoids bullet/capsule tips
      const fadeW = max(span.mul(0.22), M.mul(1.8))
      const outerLin = min(float(1), max(float(0), routEff.sub(rhoV).div(fadeW)))
      const outerSoft = pow(outerLin, float(1.75))
      // Sharper plasma inner edge (hot truncation near ISCO)
      const fadeIn = max(rin.mul(0.22), M.mul(0.35))
      const innerLin = min(float(1), max(float(0), rhoV.sub(rin).div(fadeIn)))
      const innerSoft = pow(innerLin, float(0.85))
      const radialGate = outerSoft.mul(innerSoft)
      const Hloc = max(hOverR.mul(max(rhoV, M.mul(2))), M.mul(0.02))
      // sech² vertical; plasma thinner vertically (use smaller H already)
      const zNorm = abs(pos.y).div(Hloc.mul(float(1.05).add(dustW.mul(0.25))))
      const coshZ = exp(zNorm).add(exp(zNorm.mul(-1))).mul(0.5)
      const densZ = float(1).div(max(coshZ.mul(coshZ), float(1e-5)))
      // Plasma clumps (hot) vs dusty lanes (cool outer)
      const clumpN = fract(
        sin(cphiV.mul(7.1).add(sphiV.mul(5.3)).add(rhoV.div(M).mul(0.42))).mul(43758.5453),
      )
      const dustLane = float(0.5).add(
        float(0.5).mul(sin(rhoV.div(M).mul(2.8).add(cphiV.mul(3.0)).add(sphiV.mul(1.2)))),
      )
      const densPlasma = float(1).add(plasmaW.mul(clumpN.mul(1.1).sub(0.25)))
      const densDust = float(1).sub(dustW.mul(0.55).mul(float(0.35).add(dustLane.mul(0.65))))
      // Gas mid: spiral-ish density modulation
      const gasSpiral = float(0.5).add(
        float(0.5).mul(
          cphiV
            .mul(cphiV)
            .sub(sphiV.mul(sphiV))
            .mul(cos(rhoV.div(M).mul(-0.9)))
            .add(cphiV.mul(sphiV).mul(2).mul(sin(rhoV.div(M).mul(-0.9)))),
        ),
      )
      const densGas = float(0.82).add(gasSpiral.mul(0.35).mul(float(1).sub(plasmaW).sub(dustW.mul(0.5))))
      const dens = densZ
        .mul(radialGate)
        .mul(densPlasma)
        .mul(densDust)
        .mul(densGas)
      const sphR = pos.length()

      If(
        dens
          .greaterThan(0.02)
          .and(rhoV.greaterThan(rin.mul(0.8)))
          .and(rhoV.lessThan(rout.mul(1.15)))
          .and(sphR.greaterThan(rCapture.mul(1.15)))
          .and(diskTau.lessThan(1.7))
          .and(transm.greaterThan(0.05))
          .and(hits.lessThan(12)),
        () => {
          const dsH = min(ds.div(Hloc), float(0.8))
          // Plasma denser opacity; dust more translucent but extended
          const kappa = float(0.18)
            .add(plasmaW.mul(0.35))
            .add(densZ.mul(0.22))
            .add(dustW.mul(0.08))
          const dTau = dens.mul(dsH).mul(kappa)
          const beer = exp(diskTau.mul(-1))
          // Brightness: plasma hotter path weight; dust dimmer
          const zoneBright = float(0.45).add(plasmaW.mul(0.55)).sub(dustW.mul(0.12))
          const w = dens.mul(dsH).mul(beer).mul(zoneBright)
          If(w.greaterThan(0.01), () => {
            processDiskVolumeSample({
              hx: hxV,
              hz: hzV,
              weight: w,
              densVert: densZ,
              M,
              a,
              aStar,
              Q,
              rs,
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
              nRay: vel.normalize(),
            })
            hits.addAssign(0.12)
            diskTau.addAssign(dTau)
          })
        },
      )
      }) // end RT path (useBl.not)

    })

    If(done.lessThan(0.5).and(minR.lessThan(M.mul(RT.stalledCaptureM))), () => {
      captured.assign(1)
    })
    If(done.lessThan(0.5).and(minR.greaterThanEqual(M.mul(RT.stalledCaptureM))), () => {
      escaped.assign(1)
    })

    // BL → Cartesian exit direction for lensed sky (RT already updates vel)
    If(useBl, () => {
      const stE = max(sin(blTh), float(1e-5))
      const ctE = cos(blTh)
      const spE = sin(blPh)
      const cpE = cos(blPh)
      const erE = vec3(stE.mul(cpE), ctE, stE.mul(spE))
      const ethE = vec3(ctE.mul(cpE), stE.mul(-1), ctE.mul(spE))
      const ephE = vec3(spE.mul(-1), float(0), cpE)
      pos.assign(erE.mul(blR))
      const DeltaE = max(
        blR.mul(blR).sub(M.mul(2).mul(blR)).add(a.mul(a)),
        float(1e-14),
      )
      const PE = blE.mul(blR.mul(blR).add(a.mul(a))).sub(a.mul(blLz))
      const KtermE = blQ.add(blLz.sub(a.mul(blE)).mul(blLz.sub(a.mul(blE))))
      const RvE = max(PE.mul(PE).sub(DeltaE.mul(KtermE)), float(0))
      const TvE = max(
        blQ.sub(
          ctE
            .mul(ctE)
            .mul(a.mul(a).mul(blE).mul(blE).mul(-1).add(blLz.mul(blLz).div(stE.mul(stE)))),
        ),
        float(0),
      )
      const drE = blSr.mul(sqrt(RvE))
      const dthE = blSt.mul(sqrt(TvE))
      const dphE = blLz.div(stE.mul(stE)).sub(a.mul(blE)).add(a.mul(PE).div(DeltaE))
      const vCart = erE
        .mul(drE)
        .add(ethE.mul(blR.mul(dthE)))
        .add(ephE.mul(blR.mul(stE).mul(dphE)))
      const vLen = vCart.length()
      vel.assign(vLen.greaterThan(1e-12).select(vCart.normalize(), erE.mul(blSr)))
    })

    If(escaped.greaterThan(0.5), () => {
      const d = vel.normalize()
      const sky = sampleDeepSpaceSky(d, uStarDensity, uStarBright, uNebula, uMilky)
      col.addAssign(sky.mul(transm))
    })

    If(captured.greaterThan(0.5).and(hits.lessThan(0.5)), () => {
      col.assign(vec3(0, 0, 0))
    })

    applyDebugFalseColor({
      mode: uDebugMode,
      col,
      hits,
      captured,
      escaped,
      minR,
      M,
      stepCount,
      STEPS,
      dbgG,
      dbgT,
      dbgFlux,
      impactB,
    })

    return vec4(col, 1)
  })()

  const material = new THREE.MeshBasicNodeMaterial()
  material.colorNode = colorNode
  material.depthWrite = false
  material.depthTest = false
  material.side = THREE.DoubleSide

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  mesh.frustumCulled = false

  return {
    material,
    mesh,
    setSpacetime: (p) => {
      uMass.value = p.mass
      uSpinStar.value = p.spinStar
      uCharge.value = p.charge
      uMdot.value = p.mdot
      uRIscoM.value = p.rIscoOverM
      uRoutM.value = p.outerM
      uPrograde.value = p.prograde ? 1 : 0
      uStructure.value = p.structure
      uArms.value = p.arms
      uClumps.value = p.clumps
      uDust.value = p.dust
      uScaleH.value = p.scaleHeight
      uShearRate.value = p.shearRate
      uAnim.value = p.animate ? 1 : 0
    },
    setCamera: (c) => {
      uCamDistM.value = c.distanceM
      uInclination.value = c.inclination
      uAzimuth.value = c.azimuth
      uFov.value = c.fov
    },
    setSky: (s) => {
      uStarDensity.value = s.starDensity
      uStarBright.value = s.starBrightness
      uNebula.value = s.nebula
      uMilky.value = s.milky
    },
    setDebugMode: (mode) => {
      uDebugMode.value = mode
    },
    setIntegratorMode: (mode) => {
      uIntegratorMode.value = mode
    },
    setScaleFree: (on) => {
      uScaleFree.value = on ? 1 : 0
    },
    setIdealBeam: (on) => {
      uIdealBeam.value = on ? 1 : 0
    },
    setTime: (seconds) => {
      uTime.value = seconds
    },
  }
}
