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

      // Disk y = 0 crossing
      If(
        prevY.mul(pos.y).lessThan(0).and(transm.greaterThan(0.02)).and(hits.lessThan(8)),
        () => {
          const t = prevY.div(prevY.sub(pos.y))
          const hx = p0x.add(pos.x.sub(p0x).mul(t))
          const hz = p0z.add(pos.z.sub(p0z).mul(t))
          const rho = hx.mul(hx).add(hz.mul(hz)).sqrt()

          If(rho.greaterThanEqual(rin).and(rho.lessThanEqual(rout)), () => {
            hits.addAssign(1)
            // Orbiting-emitter redshift: g = 1/(u^t (1 − Ω λ)), λ = ρ μ
            const rhoSafe = max(rho, float(1e-5))
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
            // ê_φ prograde about +Y: (−z,0,x); retrograde flips
            const tdirPro = vec3(hz.mul(-1), float(0), hx).normalize()
            const tdirRet = vec3(hz, float(0), hx.mul(-1)).normalize()
            const tdir = uPrograde.greaterThan(0.5).select(tdirPro, tdirRet)
            const nObs = vel.normalize().mul(-1)
            const mu = dot(tdir, nObs)
            const lambda = rhoSafe.mul(mu)
            const freq = float(1).div(
              max(u_t.mul(float(1).sub(Omega.mul(lambda))), float(0.25)),
            )
            const invRho = float(1).div(max(rhoSafe, float(1e-5)))
            const nRay = vel.normalize()
            accumulateDiskHit({
              hitR: rho,
              freq,
              cphi: hx.mul(invRho),
              sphi: hz.mul(invRho),
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
              pathAbsY: abs(nRay.y),
              weight: float(1),
            })
          })
        },
      )

      // Soft volumetric thin-disk slab (Gaussian |y|/H) — not a zero-thickness circle.
      // Real thin disks still have H/R ~ few %; volume path + light bending give depth.
      // Sample when inside the slab without requiring a midplane crossing (edge-on thickness).
  // Soft volume can fire every step — cap how often with stepCount stride to save cost
  // (every 2nd step when far from midplane density peak)
  If(
    transm
      .greaterThan(0.05)
      .and(hits.lessThan(10))
      .and(stepCount.mod(int(2)).equal(int(0))),
    () => {
          const hxV = pos.x
          const hzV = pos.z
          const rhoV = hxV.mul(hxV).add(hzV.mul(hzV)).sqrt()
          const H = max(uScaleH.mul(rhoV), M.mul(0.02))
          const absY = abs(pos.y)
          If(
            rhoV
              .greaterThanEqual(rin)
              .and(rhoV.lessThanEqual(rout.mul(1.05)))
              .and(absY.lessThan(H.mul(2.4))),
            () => {
              // dens = exp(-(y/H)²); path weight ∝ dens · min(ds/H, ·)
              const yOverH = absY.div(H)
              const dens = exp(yOverH.mul(yOverH).mul(-1))
              // Skip near-zero density; avoid double-counting pure midplane (plane hit handles y≈0)
              If(dens.greaterThan(0.08).and(absY.greaterThan(H.mul(0.12))), () => {
                const rhoSafe = max(rhoV, float(1e-5))
                const sqrtM = sqrt(max(M, float(1e-8)))
                const r32 = pow(rhoSafe, float(1.5))
                const OmegaPro = sqrtM.div(r32.add(a.mul(sqrtM)).add(1e-8))
                const denomR = r32.sub(a.mul(sqrtM))
                const OmegaRet = float(-1)
                  .mul(sqrtM)
                  .div(abs(denomR).lessThan(1e-12).select(float(1e-12), denomR))
                const Omega = uPrograde.greaterThan(0.5).select(OmegaPro, OmegaRet)
                const g_tt = float(-1)
                  .add(rs.div(rhoSafe))
                  .sub(Q.mul(Q).div(rhoSafe.mul(rhoSafe)))
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
                const tdirPro = vec3(hzV.mul(-1), float(0), hxV).normalize()
                const tdirRet = vec3(hzV, float(0), hxV.mul(-1)).normalize()
                const tdir = uPrograde.greaterThan(0.5).select(tdirPro, tdirRet)
                const nObs = vel.normalize().mul(-1)
                const mu = dot(tdir, nObs)
                const lambda = rhoSafe.mul(mu)
                const freq = float(1).div(
                  max(u_t.mul(float(1).sub(Omega.mul(lambda))), float(0.25)),
                )
                const invRho = float(1).div(max(rhoSafe, float(1e-5)))
                const nRay = vel.normalize()
                // Soft contribution — thinner optical depth than a hard plane hit
                const pathW = min(float(1.6), dens.mul(float(0.55)))
                accumulateDiskHit({
                  hitR: rhoV,
                  freq,
                  cphi: hxV.mul(invRho),
                  sphi: hzV.mul(invRho),
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
                  pathAbsY: abs(nRay.y),
                  weight: pathW,
                })
              })
            },
          )
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
