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
  log,
  max,
  min,
  pow,
  screenSize,
  sin,
  sqrt,
  texture3D,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import { DEFAULT_MDOT } from '../physics/constants'
import { R_ISCO_SCHW_OVER_M } from '../physics/disk'
import { DEFAULT_DISK } from '../physics/diskParams'
import { createEmptyCube } from '../physics/grmhdCube'
import { RT } from '../physics/geodesic/rtConstants'
import { OBSERVER_DEFAULTS } from '../physics/observer'
import { DEBUG_DEFAULTS } from '../debug/state'
import { SKY_DEFAULTS } from '../state/sky'
import type { GeodesicTracer } from './geodesicTracerTypes'
import { createGrmhdTexture, type GrmhdGpuTexture } from './grmhdTexture'
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
  /** Quality: effective step budget (≤ STEPS hard ceiling) */
  const uMaxSteps = uniform(RT.defaultMaxSteps)
  const uVolumeStride = uniform(RT.volumeStride)
  const uBaseStepM = uniform(RT.baseStepM)
  /** GRMHD dens cube: mix 0 = analytic, 1 = full cube */
  const uGrmhdMix = uniform(0)
  const uCubeOrigin = uniform(new THREE.Vector3(-40, -12, -40))
  const uCubeExtent = uniform(new THREE.Vector3(80, 24, 80))
  const uCubeScale = uniform(1)
  // Valid 2³ stub so texture3D always bound
  const stubCube = createEmptyCube(2, 2, 2, 1, 1)
  stubCube.data.fill(0)
  let gpuGrmhd: GrmhdGpuTexture | null = createGrmhdTexture(stubCube)
  const stubTex = gpuGrmhd.texture
  const uCubeMap = uniform(gpuGrmhd.texture)

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
      If(done.greaterThan(0.5).or(stepCount.greaterThanEqual(int(uMaxSteps))), () => {
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
              .and(hits.lessThan(float(RT.maxDiskHits))),
            () => {
              const denom = prevTh.sub(blTh)
              const t = abs(denom)
                .lessThan(1e-15)
                .select(float(0), prevTh.sub(halfPi).div(denom))
              const tt = min(max(t, float(0)), float(1))
              const hitR = prevBlR.add(blR.sub(prevBlR).mul(tt))
              // ISCO-locked: no emission inside rin
              If(hitR.greaterThanEqual(rin.mul(1.001)).and(hitR.lessThanEqual(rout)), () => {
                hits.addAssign(1)
                const rhoSafe = max(hitR, float(1e-5))
                const sqrtM = sqrt(max(M, float(1e-8)))
                const r32 = pow(rhoSafe, float(1.5))
                // Exact Kerr Ω = ±√M / (r^{3/2} ± a√M)
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
                // Honest g floor (was 0.25 — clipped dim side)
                const freq = float(1).div(
                  max(u_t.mul(float(1).sub(Omega.mul(lambda))), float(0.08)),
                )
                const hitPh = prevBlPh.add(blPh.sub(prevBlPh).mul(tt))
                // Soft vertical weight near equator (thin slab for BL)
                const dTh = abs(blTh.sub(halfPi))
                const Hth = max(uScaleH.mul(0.9), float(0.02))
                const densVertBl = exp(dTh.div(Hth).mul(dTh.div(Hth)).mul(-1))
                const wBl = densVertBl.mul(float(0.85).add(hits.greaterThan(1.5).select(float(0.15), float(0))))
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
                  pathAbsY: max(float(0.08), densVertBl.mul(0.5)),
                  weight: wBl,
                  densVert: densVertBl,
                })
              })
            },
          )
          // BL volume samples near equator (not only midplane crossings)
          If(
            transm
              .greaterThan(0.04)
              .and(hits.lessThan(float(RT.maxDiskHits)))
              .and(blR.greaterThan(rin.mul(0.95)))
              .and(blR.lessThan(rout.mul(1.1)))
              .and(stepCount.mod(int(uVolumeStride)).equal(int(0))),
            () => {
              const dThV = abs(blTh.sub(halfPi))
              const HthV = max(uScaleH.mul(1.1), float(0.025))
              const densV = exp(dThV.div(HthV).mul(dThV.div(HthV)).mul(-1))
              If(densV.greaterThan(0.05), () => {
                const rhoSafe = max(blR, float(1e-5))
                const sqrtM = sqrt(max(M, float(1e-8)))
                const r32 = pow(rhoSafe, float(1.5))
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
                  max(u_t.mul(float(1).sub(Omega.mul(lambda))), float(0.08)),
                )
                const w = densV.mul(float(0.35)).mul(float(RT.volumeStride).mul(0.5))
                accumulateDiskHit({
                  hitR: blR,
                  freq,
                  cphi: cos(blPh),
                  sphi: sin(blPh),
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
                  pathAbsY: densV.mul(0.4).add(0.05),
                  weight: w,
                  densVert: densV,
                })
                hits.addAssign(0.08)
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

      // Photon-sphere + critical-curve refinement
      const rOverM = r.div(max(M, float(1e-8)))
      const nearPh = exp(
        abs(rOverM.sub(float(RT.phCenterM))).div(float(RT.phWidthM)).mul(-1),
      )
      // b_c ~ 5.2 M Schw; refine when impact near critical
      const bOverM = impactB.div(max(M, float(1e-8)))
      const nearCrit = exp(abs(bOverM.sub(float(5.2))).mul(-0.55))
      const refine = max(nearPh, nearCrit)
      const adaptFloorL = float(RT.adaptFloor).mul(float(1).sub(refine.mul(float(RT.phRefine))))
      const adapt = min(
        float(RT.adaptMax),
        max(adaptFloorL, r.div(M.mul(RT.adaptScale))),
      )
      const ds = uBaseStepM.mul(M).mul(adapt)

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

      // Cheap reject before heavy dens (most steps outside the slab)
      const hxV = pos.x
      const hzV = pos.z
      const rhoV = hxV.mul(hxV).add(hzV.mul(hzV)).sqrt()
      const absY = abs(pos.y)
      const roughH = max(uScaleH.mul(max(rhoV, M.mul(2))).mul(2.6), M.mul(0.12))
      // Sample denser near midplane (stride 1–2) so thin far-side isn't skipped
      const midStride = absY.lessThan(roughH.mul(0.55)).select(int(1), int(uVolumeStride))
      If(
        rhoV
          .greaterThan(rin.mul(1.001))
          .and(rhoV.lessThan(rout.mul(1.18)))
          .and(absY.lessThan(roughH))
          .and(transm.greaterThan(0.04))
          .and(diskTau.lessThan(float(RT.tauSampleMax)))
          .and(hits.lessThan(float(RT.maxDiskHits)))
          .and(stepCount.mod(midStride).equal(int(0))),
        () => {
      // 3D volume dens: Keplerian-advected spirals + plasma/gas/dust zones
      // dens follows orbital flow (material frame), not a frozen paint job
      const span = max(rout.sub(rin), M.mul(4))
      const xRad = min(float(1), max(float(0), rhoV.sub(rin).div(span)))
      // Zone weights from radial structure (physical annuli)
      const plasmaW = exp(xRad.mul(-4.5)) // hot inner
      const dustW = pow(max(xRad.sub(float(0.24)), float(0)).div(0.76), float(1.35))
      const gasW = max(float(0), float(1).sub(plasmaW.mul(0.85)).sub(dustW.mul(0.55)))
      const hOverR = uScaleH.mul(
        float(0.14)
          .add(pow(xRad.add(0.05), float(1.15)).mul(1.75))
          .add(dustW.mul(0.95)),
      )
      const invRhoV = float(1).div(max(rhoV, float(1e-5)))
      const cphiV = hxV.mul(invRhoV)
      const sphiV = hzV.mul(invRhoV)
      // Keplerian material-frame shear — pattern co-moves with gas
      // Ω̃ = (M/ρ)^{3/2} (scale-free; visible wind when Animate on)
      const rhoM = max(rhoV.div(M), float(1e-4))
      const OmegaDim = pow(rhoM, float(-1.5))
      const sense = uPrograde.greaterThan(0.5).select(float(1), float(-1))
      const shear = sense
        .mul(uShearRate)
        .mul(uAnim)
        .mul(float(32))
        .mul(OmegaDim)
        .mul(uTime)
      // Kerr frame-drag + Lense–Thirring dens wind
      const drag = aStar.mul(float(2.1)).div(max(rhoM, float(1.05)))
      const ltWind = aStar.mul(float(2.8)).div(max(rhoM.mul(rhoM).mul(rhoM), float(1.2)))
      const shearTot = shear.add(drag.mul(float(1).add(uTime.mul(0.12)))).add(ltWind)
      const csh = cos(shearTot)
      const ssh = sin(shearTot)
      const cx = cphiV.mul(csh).sub(sphiV.mul(ssh))
      const sx = cphiV.mul(ssh).add(sphiV.mul(csh))
      const c2 = cx.mul(cx).sub(sx.mul(sx))
      const s2 = cx.mul(sx).mul(2)
      const lnR = log(rhoM)
      // m=2 log spiral density wave (gas arms) + frame-drag twist — high contrast
      const pitch = float(0.72)
      const armPh = float(-2).mul(pitch).mul(lnR).add(float(0.35)).add(drag)
      const armWave = float(0.5).add(
        float(0.5).mul(c2.mul(cos(armPh)).add(s2.mul(sin(armPh)))),
      )
      const spiralDens = float(0.38).add(pow(max(armWave, float(1e-4)), float(1.7)).mul(1.2))
      // Flow-aligned filaments m=4 + m=8 (material frame)
      const c4 = c2.mul(c2).sub(s2.mul(s2))
      const s4 = c2.mul(s2).mul(2)
      const c8 = c4.mul(c4).sub(s4.mul(s4))
      const s8 = c4.mul(s4).mul(2)
      const filPh = float(-0.9).mul(lnR).add(float(1.1)).add(drag.mul(0.6))
      const fil = float(0.5).add(float(0.5).mul(c4.mul(cos(filPh)).add(s4.mul(sin(filPh)))))
      const fil8Ph = float(-1.15).mul(lnR).add(float(1.4)).add(drag.mul(0.9))
      const fil8 = float(0.5).add(float(0.5).mul(c8.mul(cos(fil8Ph)).add(s8.mul(sin(fil8Ph)))))
      const filDens = float(0.58)
        .add(pow(max(fil, float(1e-4)), float(1.75)).mul(0.5))
        .add(pow(max(fil8, float(1e-4)), float(2.2)).mul(0.35))
      // GRMHD-like multi-scale dens: 2 octaves → log-normal MRI
      const nA = fract(
        sin(cx.mul(5.7).add(sx.mul(4.1)).add(lnR.mul(1.9))).mul(43758.5453),
      )
      const nB = fract(
        sin(cx.mul(11.3).add(sx.mul(9.7)).add(lnR.mul(3.1)).add(19.1)).mul(43758.5453),
      )
      const nMix = nA.mul(0.58).add(nB.mul(0.42))
      const sigmaM = float(0.68).mul(float(0.45).add(uClumps.mul(0.55)).add(uStructure.mul(0.25)))
      const xiM = nMix.mul(2).sub(1)
      const mriDens = exp(xiM.mul(sigmaM).sub(sigmaM.mul(sigmaM).mul(0.5)))
      // Vertical MRI channel (z-corrugation modulated)
      const chan = float(0.82).add(
        float(0.18).mul(sin(sx.mul(3.5).add(lnR.mul(1.2)).add(drag))),
      )
      // Irregular outer rim: m=3 + high-freq noise (not a perfect circle)
      const c3 = cphiV.mul(cphiV.mul(cphiV).sub(sphiV.mul(sphiV).mul(3)))
      const s3 = sphiV.mul(cphiV.mul(cphiV).mul(3).sub(sphiV.mul(sphiV)))
      const rimN = fract(sin(cphiV.mul(12.7).add(sphiV.mul(9.3)).add(3.1)).mul(43758.5453))
      const rimWobble = float(0.5).add(
        float(0.5).mul(c3.mul(0.5).add(s3.mul(0.22)).add(rimN.mul(0.55)).sub(0.15)),
      )
      const routEff = rout.mul(float(0.84).add(rimWobble.mul(0.2)))
      const fadeW = max(span.mul(0.26), M.mul(2.0))
      const outerLin = min(float(1), max(float(0), routEff.sub(rhoV).div(fadeW)))
      const outerSoft = pow(outerLin, float(1.55))
      const fadeIn = max(rin.mul(0.18), M.mul(0.3))
      const innerLin = min(float(1), max(float(0), rhoV.sub(rin).div(fadeIn)))
      const innerSoft = pow(innerLin, float(0.9))
      const radialGate = outerSoft.mul(innerSoft)
      const Hloc = max(hOverR.mul(max(rhoV, M.mul(2))), M.mul(0.02))
      // Mild m=2 midplane warp (LT/MRI) + vertical corrugation — uses signed y
      const warpAmp = Hloc.mul(float(0.1)).mul(uStructure.add(0.35))
      const midY = s2.mul(warpAmp).add(c2.mul(warpAmp.mul(0.35)))
      const zWob = sx.mul(0.14).add(cx.mul(0.07)).mul(Hloc)
      const zNorm = abs(pos.y.sub(midY).sub(zWob)).div(Hloc.mul(float(1.05).add(dustW.mul(0.35))))
      const coshZ = exp(zNorm).add(exp(zNorm.mul(-1))).mul(0.5)
      const densZ = float(1).div(max(coshZ.mul(coshZ), float(1e-5)))
      // Plasma: hot clumpy inner (advected)
      const clumpN = fract(
        sin(cx.mul(9.3).add(sx.mul(6.1)).add(lnR.mul(2.4))).mul(43758.5453),
      )
      const densPlasma = float(1).add(
        plasmaW.mul(uClumps.add(0.45)).mul(clumpN.mul(1.55).sub(0.4)),
      )
      // Dust lanes: cool outer, darker in density (advected)
      const dustLane = float(0.5).add(
        float(0.5).mul(sin(lnR.mul(3.4).add(cx.mul(2.8)).add(sx.mul(1.4)))),
      )
      const densDust = float(1).sub(
        dustW.mul(uDust.add(0.5)).mul(float(0.28).add(dustLane.mul(0.75))).mul(0.78),
      )
      // Gas: spiral + filament modulation (structure master) — high contrast
      const struct = uStructure
      const densGas = float(1)
        .sub(struct.mul(0.65))
        .add(
          struct.mul(
            spiralDens.mul(gasW.add(0.4)).mul(0.62).add(filDens.mul(0.52)),
          ),
        )
      // Combine: sech² × radial × zones × GRMHD-like MRI dens (analytic)
      const densAnalytic = densZ
        .mul(radialGate)
        .mul(densPlasma)
        .mul(densDust)
        .mul(densGas)
        .mul(float(0.65).add(mriDens.mul(0.5)))
        .mul(chan)
      // Real GRMHD cube dens (world coords / M → UVW)
      const pM = pos.div(max(M, float(1e-8)))
      const uvw = pM.sub(uCubeOrigin).div(max(uCubeExtent, vec3(1e-6)))
      const cubeRaw = texture3D(uCubeMap, uvw).x.mul(uCubeScale)
      const inCube = uvw.x
        .greaterThanEqual(0)
        .and(uvw.y.greaterThanEqual(0))
        .and(uvw.z.greaterThanEqual(0))
        .and(uvw.x.lessThanEqual(1))
        .and(uvw.y.lessThanEqual(1))
        .and(uvw.z.lessThanEqual(1))
      const densCube = inCube.select(max(cubeRaw, float(0)), float(0))
      // mix: 0 analytic · 1 pure cube (cube already has vertical structure)
      const dens = densAnalytic
        .mul(float(1).sub(uGrmhdMix))
        .add(densCube.mul(uGrmhdMix))
      const sphR = pos.length()

      // Only skip deep inside capture — keep photon-ring / far-side bridge
      If(
        dens
          .greaterThan(0.02)
          .and(sphR.greaterThan(rCapture.mul(float(RT.captureMargin).add(0.01)))),
        () => {
          const dsH = min(ds.div(Hloc), float(0.75))
          // Opacity: electron scattering (inner/hot) vs Kramers-like (outer/cool)
          // κ_es ~ const (Thomson); κ_K rises outward / in dusty cooler gas
          const fEs = min(
            float(1),
            plasmaW.mul(0.75).add(gasW.mul(0.4)).add(float(0.12)),
          )
          const kappaEs = float(0.26).mul(float(0.65).add(densZ.mul(0.55)))
          const kappaKr = float(0.08)
            .add(dustW.mul(0.42))
            .add(pow(xRad.add(0.08), float(1.1)).mul(0.28))
          const kappa = kappaEs
            .mul(fEs)
            .add(kappaKr.mul(float(1).sub(fEs.mul(0.8))))
            .mul(float(0.8).add(struct.mul(0.25)))
          const strideF = absY.lessThan(Hloc.mul(1.1)).select(float(1.15), float(uVolumeStride))
          // Multi-image: when outside dense slab after a hit, decay τ so secondary survives
          const outSlab = absY.greaterThan(Hloc.mul(1.8))
          If(outSlab.and(hits.greaterThan(0.5)), () => {
            diskTau.mulAssign(0.92)
          })
          const dTau = dens.mul(dsH).mul(kappa).mul(strideF)
          const beer = exp(diskTau.mul(float(-RT.beerSoft)))
          const sec = hits.greaterThan(1.2).select(float(1.08), float(1))
          const w = dens.mul(dsH).mul(beer).mul(strideF.mul(0.88)).mul(sec)
          If(w.greaterThan(0.016), () => {
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
            hits.addAssign(0.08)
            diskTau.addAssign(dTau)
          })
        },
      )
        },
      )
      // Hot dilute corona above inner disk (optical proxy for soft X-ray region)
      If(
        rhoV
          .greaterThan(rin.mul(0.95))
          .and(rhoV.lessThan(rin.mul(5)))
          .and(absY.greaterThan(roughH.mul(0.9)))
          .and(absY.lessThan(roughH.mul(5)))
          .and(transm.greaterThan(0.15))
          .and(stepCount.mod(int(4)).equal(int(0))),
        () => {
          const cFall = exp(absY.div(max(roughH.mul(2.5), M.mul(0.2))).mul(-1))
          const wC = cFall.mul(0.04).mul(mdot.add(0.05))
          If(wC.greaterThan(0.008), () => {
            processDiskVolumeSample({
              hx: hxV,
              hz: hzV,
              weight: wC,
              densVert: cFall.mul(0.3),
              M,
              a,
              aStar,
              Q,
              rs,
              mdot: mdot.mul(0.3).add(0.05),
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
              uStructure: float(0.2),
              uArms: float(0),
              uClumps: float(0.3),
              uDust: float(0),
              uScaleH,
              uShearRate,
              uAnim,
              nRay: vel.normalize(),
            })
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
    setQuality: (q) => {
      uMaxSteps.value = q.maxSteps
      uVolumeStride.value = q.volumeStride
      uBaseStepM.value = q.baseStepM
    },
    setGrmhdCube: (gpu, mix) => {
      if (gpu) {
        const prev = gpuGrmhd
        gpuGrmhd = gpu
        uCubeMap.value = gpu.texture
        uCubeOrigin.value.set(gpu.origin.x, gpu.origin.y, gpu.origin.z)
        uCubeExtent.value.set(gpu.extent.x, gpu.extent.y, gpu.extent.z)
        uCubeScale.value = gpu.densScale
        uGrmhdMix.value = Math.min(1, Math.max(0, mix))
        // Dispose previous real cube (not the initial stub if same ref)
        if (prev && prev.texture !== gpu.texture && prev.texture !== stubTex) {
          try {
            prev.texture.dispose()
          } catch {
            /* ignore */
          }
        }
      } else {
        uGrmhdMix.value = 0
      }
    },
  }
}
