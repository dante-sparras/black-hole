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
  texture,
  texture3D,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import { DEFAULT_MDOT } from '../physics/constants'
import { DISK_EMISSION, R_ISCO_SCHW_OVER_M } from '../physics/disk'
import { DEFAULT_DISK } from '../physics/diskParams'
import { DISK_TEXTURE } from '../physics/diskTexture'
import { createEmptyCube } from '../physics/grmhdCube'
import { RT, rtMaxStepsForCamera } from '../physics/geodesic/rtConstants'
import { OBSERVER_DEFAULTS } from '../physics/observer'
import { DEBUG_DEFAULTS } from '../debug/state'
import { SKY_DEFAULTS } from '../state/sky'
import type { GeodesicTracer } from './geodesicTracerTypes'
import { createGrmhdTexture, type GrmhdGpuTexture } from './grmhdTexture'
import { applyDebugFalseColor } from './tsl/debugFalseColor'
import { sampleDeepSpaceSky } from './tsl/deepSpaceSky'
import { accumulateDiskHit } from './tsl/diskHitEmission'
import { processDiskVolumeSample } from './tsl/diskLayerHit'
import { singularityDiskComposite } from './tsl/singularityDisk'
import { orbitingDiskG } from './tsl/orbitingG'
import { knNullAccelTsl } from './tsl/knNullAccelTsl'
import { publicUrl } from '../app/publicUrl'

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
  /** Disk midplane tilt (rad) + line of nodes about +Y */
  const uTilt = uniform(0)
  const uTiltNode = uniform(0)
  /** Jet power 0…1 (off by default) */
  const uJetPower = uniform(0)
  /** MRI dens variance scale from plasma β */
  const uMriTurb = uniform(1)
  const uRho0 = uniform(1)
  const uPolyT = uniform(1)
  const uRPeakM = uniform(12)
  const uMadBoost = uniform(0)
  const uPerturb = uniform(0.35)
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
  /** GRMHD dens cube: mix 0 = analytic, 1 = pure cube (R8 3D texture) */
  const uGrmhdMix = uniform(0)
  const uCubeOx = uniform(-40)
  const uCubeOy = uniform(-12)
  const uCubeOz = uniform(-40)
  const uCubeEx = uniform(80)
  const uCubeEy = uniform(24)
  const uCubeEz = uniform(80)
  const uCubeScale = uniform(1)
  const stubCube = createEmptyCube(2, 2, 2, 1, 1)
  stubCube.data.fill(0)
  let gpuGrmhd: GrmhdGpuTexture | null = createGrmhdTexture(stubCube)
  const stubTex = gpuGrmhd.texture
  // Official TSL API: texture3D(tex).sample(uvw) — see TextureHelperGPU
  const cubeTexNode = texture3D(stubTex)

  // Singularity-style deep noise dens layer (2D, spiral UV)
  // publicUrl() — must work under Vite base (e.g. /black-hole/ on GitHub Pages)
  // Texture AA: trilinear mips (UV density varies across dens spiral) — no dens formula change
  const noiseDeepMap = new THREE.TextureLoader().load(publicUrl('noise_deep.png'))
  noiseDeepMap.wrapS = THREE.RepeatWrapping
  noiseDeepMap.wrapT = THREE.RepeatWrapping
  noiseDeepMap.minFilter = THREE.LinearMipmapLinearFilter
  noiseDeepMap.magFilter = THREE.LinearFilter
  noiseDeepMap.colorSpace = THREE.NoColorSpace
  noiseDeepMap.generateMipmaps = true
  noiseDeepMap.anisotropy = 4

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
    // Singularity-inspired: per-pixel ray origin jitter kills volume banding (onion rings)
    // Static in time so the image is stable; hash from screen coords only.
    // Mild amplitude (was 0.9×baseStep) — less sample grit; SMAA cleans residual edges.
    const pix = ndc.mul(screenSize.xy)
    const nJ = fract(
      sin(dot(pix, vec2(12.9898, 78.233))).mul(43758.5453),
    )
    pos.addAssign(vel.mul(nJ.sub(0.5).mul(M.mul(float(RT.baseStepM).mul(0.45)))))

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
          // Opaque disk already: further steps cannot change col (sky·transm≈0).
          // Same pixels as marching to escape/capture — big win on thick edge-on rays.
          If(transm.lessThan(0.02).and(hits.greaterThanEqual(float(1))), () => {
            done.assign(1)
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

      // Disk-frame coords (tilt about line of nodes; tilt=0 → identity)
      const cN = cos(uTiltNode)
      const sN = sin(uTiltNode)
      const x1 = pos.x.mul(cN).add(pos.z.mul(sN))
      const z1 = pos.z.mul(cN).sub(pos.x.mul(sN))
      const y1 = pos.y
      const cT = cos(uTilt)
      const sT = sin(uTilt)
      const diskX = x1
      const diskY = y1.mul(cT).sub(z1.mul(sT))
      const diskZ = y1.mul(sT).add(z1.mul(cT))
      const diskPos = vec3(diskX, diskY, diskZ)
      // Cheap reject before heavy dens (most steps outside the slab)
      const hxV = diskX
      const hzV = diskZ
      const rhoV = hxV.mul(hxV).add(hzV.mul(hzV)).sqrt()
      const absY = abs(diskY)
      const roughH = max(uScaleH.mul(max(rhoV, M.mul(2))).mul(5), M.mul(0.4))
      // Sample denser near midplane (stride 1–2) so thin far-side isn't skipped
      const midStride = absY.lessThan(roughH.mul(1.1)).select(int(1), int(uVolumeStride))
      // High-ṁ factor in RT scope (corona + dens both need it — never nest-only)
      const mdotHi = min(
        float(1),
        max(float(0), mdot.sub(float(0.35)).div(float(1.15))),
      )
      If(
        rhoV
          .greaterThan(rin.mul(0.9))
          .and(rhoV.lessThan(rout.mul(1.3)))
          .and(absY.lessThan(roughH))
          .and(transm.greaterThan(0.02))
          .and(hits.lessThan(float(40)))
          .and(stepCount.mod(midStride).equal(int(0))),
        () => {
              // densEnv gate (sech² + rim + photosphere) → singularity noise dens.
              // Heavy spiral/MRI analytic dens was unused after singularity path (densAnalytic dead).
              const span = max(rout.sub(rin), M.mul(4))
              const xRad = min(float(1), max(float(0), rhoV.sub(rin).div(span)))
              const dustW = pow(max(xRad.sub(float(0.24)), float(0)).div(0.76), float(1.35))
              const hOverR = uScaleH.mul(
                float(0.14)
                  .add(pow(xRad.add(0.05), float(1.15)).mul(1.75))
                  .add(dustW.mul(0.95)),
              )
              const invRhoV = float(1).div(max(rhoV, float(1e-5)))
              const cphiV = hxV.mul(invRhoV)
              const sphiV = hzV.mul(invRhoV)
              // Material-frame shear — midplane warp + cube advection when GRMHD mix > 0
              const rhoM = max(rhoV.div(M), float(1e-4))
              const OmegaDim = pow(rhoM, float(-1.5))
              const sense = uPrograde.greaterThan(0.5).select(float(1), float(-1))
              const shear = sense
                .mul(uShearRate)
                .mul(uAnim)
                .mul(float(6))
                .mul(OmegaDim)
                .mul(uTime)
              const drag = aStar.mul(float(2.1)).div(max(rhoM, float(1.05)))
              const ltWind = aStar.mul(float(2.8)).div(max(rhoM.mul(rhoM).mul(rhoM), float(1.2)))
              const shearTot = shear.add(drag.mul(float(1).add(uTime.mul(0.12)))).add(ltWind)
              const csh = cos(shearTot)
              const ssh = sin(shearTot)
              const cx = cphiV.mul(csh).sub(sphiV.mul(ssh))
              const sx = cphiV.mul(ssh).add(sphiV.mul(csh))
              const c2 = cx.mul(cx).sub(sx.mul(sx))
              const s2 = cx.mul(sx).mul(2)
              // Irregular outer rim: m=3 soft
              const c3 = cphiV.mul(cphiV.mul(cphiV).sub(sphiV.mul(sphiV).mul(3)))
              const s3 = sphiV.mul(cphiV.mul(cphiV).mul(3).sub(sphiV.mul(sphiV)))
              const rimN = fract(sin(cphiV.mul(4.1).add(sphiV.mul(3.3)).add(3.1)).mul(43758.5453))
              const rimWobble = float(0.5).add(
                float(0.5).mul(c3.mul(0.45).add(s3.mul(0.2)).add(rimN.mul(0.35)).sub(0.1)),
              )
              const routEff = rout.mul(float(0.86).add(rimWobble.mul(0.16)))
              const fadeW = max(span.mul(0.28), M.mul(2.0))
              const outerLin = min(float(1), max(float(0), routEff.sub(rhoV).div(fadeW)))
              const outerSoft = pow(outerLin, float(1.4))
              const fadeIn = max(rin.mul(0.18), M.mul(0.3))
              const innerLin = min(float(1), max(float(0), rhoV.sub(rin).div(fadeIn)))
              const innerSoft = pow(innerLin, float(0.9))
              const radialGate = outerSoft.mul(innerSoft)
              const Hloc = max(hOverR.mul(max(rhoV, M.mul(2))), M.mul(0.02))
              // Mild m=2 midplane warp
              const warpAmp = Hloc.mul(float(0.08)).mul(uStructure.add(0.35))
              const midY = s2.mul(warpAmp).add(c2.mul(warpAmp.mul(0.3)))
              const zWob = sx.mul(0.1).add(cx.mul(0.05)).mul(Hloc)
              const zNorm = abs(diskY.sub(midY).sub(zWob)).div(Hloc.mul(float(1.05).add(dustW.mul(0.3))))
              const coshZ = exp(zNorm).add(exp(zNorm.mul(-1))).mul(0.5)
              const densZ = float(1).div(max(coshZ.mul(coshZ), float(1e-5)))
              // Cube dens — skip 3D texture fetches when mix≈0 (boot analytic default).
              // Uniform-coherent branch: identical dens when uGrmhdMix=0.
              const densCube = float(0).toVar()
              If(uGrmhdMix.greaterThan(0.001), () => {
                const xAdv = cx.mul(rhoV)
                const zAdv = sx.mul(rhoV)
                const yAdv = diskY.div(max(M, float(1e-8)))
                const ux = xAdv.sub(uCubeOx).div(max(uCubeEx, float(1e-6)))
                const uy = yAdv.sub(uCubeOy).div(max(uCubeEy, float(1e-6)))
                const uz = zAdv.sub(uCubeOz).div(max(uCubeEz, float(1e-6)))
                const uvw = vec3(ux, uy, uz)
                const mx = max(float(1).sub(abs(ux.mul(2).sub(1))), float(0))
                const my = max(float(1).sub(abs(uy.mul(2).sub(1))), float(0))
                const mz = max(float(1).sub(abs(uz.mul(2).sub(1))), float(0))
                const boxMask = mx.mul(my).mul(mz)
                const cubeRaw = cubeTexNode.sample(uvw).r.mul(uCubeScale).mul(float(1.6))
                const uvwN = uvw.add(vec3(0.008, 0.004, 0.006))
                const cubeN = cubeTexNode.sample(uvwN).r.mul(uCubeScale).mul(float(1.6))
                const densEdge = abs(cubeRaw.sub(cubeN)).mul(float(3.2))
                densCube.assign(
                  max(cubeRaw, float(0))
                    .mul(boxMask)
                    .mul(float(0.78).add(min(densEdge, float(1.0)).mul(0.4))),
                )
              })
              // High-ṁ photosphere (mdotHi from RT scope): kill polar hourglass
              // Photosphere: densZ^(2+…) → razor midplane at high ṁ
              const densZPow = float(2).add(mdotHi.mul(2.2))
              const densZPhot = pow(max(densZ, float(1e-6)), densZPow)
              // Extra off-midplane kill (polar hourglass)
              const zKill = exp(zNorm.mul(zNorm).mul(float(-0.35).sub(mdotHi.mul(1.8))))
              const densEnv = densZ
                .mul(radialGate)
                .mul(densZPhot)
                .mul(zKill)
                .mul(float(1).sub(mdotHi.mul(0.25))) // overall dens soft-cap at high ṁ
              // Torus dens peak from ℓ̃ (rPeak) — Gaussian envelope in log-r
              const rPeak = max(uRPeakM.mul(M), rin.mul(1.05))
              const lnPeak = log(max(rhoV.div(rPeak), float(1e-4)))
              const peakEnv = exp(lnPeak.mul(lnPeak).mul(-1.1))
              const dens = densEnv
                .mul(float(1.2).add(uGrmhdMix.mul(densCube.mul(0.4))))
                .mul(uRho0)
                .mul(float(0.55).add(peakEnv.mul(0.7)))
                .mul(float(0.7).add(uPerturb.mul(0.6)))
              const sphR = pos.length()

              // Singularity look path (noise dens + dual edge + α) — BB chroma only (not gold)
              If(
                dens
                  .greaterThan(0.008)
                  .and(sphR.greaterThan(rCapture.mul(float(RT.captureMargin).add(0.01))))
                  .and(transm.greaterThan(0.03)),
                () => {
                  // Tighter path Δs at high ṁ — less volume stack per step
                  const dsHCap = float(0.5).mul(float(1).sub(mdotHi.mul(0.45)))
                  const dsH = min(ds.div(max(Hloc, M.mul(0.05))), max(dsHCap, float(0.18)))
                  // Harder Beer at high ṁ (photosphere saturates, no white funnel)
                  const beerK = float(0.55).add(mdotHi.mul(0.85))
                  const beer = exp(diskTau.mul(beerK.mul(-1)))
                  // Compressive ṁ weight (not linear dens stack)
                  const mdotW = float(1).div(float(1).add(mdotHi.mul(1.4)))
                  const w = dens
                    .mul(dsH)
                    .mul(beer)
                    .mul(float(1.25))
                    .mul(sqrt(max(uPolyT, float(0.2))))
                    .mul(mdotW)
                  If(w.greaterThan(0.004), () => {
                    // Orbiting g for Doppler beam + Wien T_obs (realism; dens path)
                    const nRayD = vel.normalize()
                    const freqD = orbitingDiskG({
                      hx: hxV,
                      hz: hzV,
                      M,
                      a,
                      Q,
                      rs,
                      nRay: nRayD,
                      uPrograde,
                    })
                    const beamExpD = uIdealBeam
                      .greaterThan(0.5)
                      .select(float(DISK_EMISSION.beamExponentIdeal), float(DISK_EMISSION.beamExponent))
                    const beamFlD = uIdealBeam
                      .greaterThan(0.5)
                      .select(float(DISK_EMISSION.beamFloorIdeal), float(DISK_EMISSION.beamFloor))
                    const beamD = pow(max(freqD, beamFlD), beamExpD)
                    singularityDiskComposite({
                      pos: diskPos,
                      M,
                      rCapture,
                      rout,
                      uTime,
                      noiseDeepMap,
                      col,
                      transm,
                      hits,
                      weight: w,
                      beam: beamD,
                      freq: freqD,
                      mdot,
                      rinOverM: uRIscoM,
                    })
                    diskTau.addAssign(w.mul(float(0.35).add(mdotHi.mul(0.45))))
                  })
                },
              )
                },
              )
      // Hot dilute corona — KEEP WEAK; was ∝ mdot and drew polar hourglass
      If(
        rhoV
          .greaterThan(rin.mul(0.95))
          .and(rhoV.lessThan(rin.mul(5)))
          .and(absY.greaterThan(roughH.mul(1.2)))
          .and(absY.lessThan(roughH.mul(3.5)))
          .and(transm.greaterThan(0.25))
          .and(mdotHi.lessThan(0.55)) // disable corona contribution at high ṁ (Hot)
          .and(stepCount.mod(int(4)).equal(int(0))),
        () => {
          const cFall = exp(absY.div(max(roughH.mul(2.5), M.mul(0.2))).mul(-1))
          const wC = cFall.mul(0.018).mul(float(0.2).add(mdot.mul(0.04)))
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
      // Optional bipolar jets along ±spin (lab Y); power ∝ jetPower · a★² · ṁ
      If(
        uJetPower
          .greaterThan(0.01)
          .and(transm.greaterThan(0.08))
          .and(stepCount.mod(int(3)).equal(int(0))),
        () => {
          const rLab = max(pos.length(), float(1e-5))
          const rhoJet = pos.x.mul(pos.x).add(pos.z.mul(pos.z)).sqrt()
          const muJet = abs(pos.y).div(rLab)
          const core = M.mul(0.45)
          const radial = exp(rhoJet.div(max(core, float(1e-5))).mul(rhoJet.div(max(core, float(1e-5)))).mul(-1))
          const polar = max(float(0), muJet.sub(0.45).div(0.55))
          const away = min(float(1), abs(pos.y).div(max(M.mul(1.5), float(1e-5))))
          const a2 = min(float(1), aStar.mul(aStar))
          const jEff = uJetPower
            .mul(a2)
            .mul(pow(max(mdot, float(0.01)).div(0.1), float(0.4)))
            .mul(float(1).add(uMadBoost.mul(0.85)))
            .mul(sqrt(max(uRho0, float(0.2))))
          const jw = radial.mul(polar).mul(polar).mul(away).mul(jEff).mul(0.12).mul(ds.div(max(M, float(0.1))))
          If(
            jw.greaterThan(0.002).and(rLab.greaterThan(rCapture.mul(1.08))),
            () => {
              const jc = vec3(0.62, 0.78, 0.98).mul(jw).mul(transm)
              col.addAssign(jc)
              transm.mulAssign(max(float(0.15), float(1).sub(jw.mul(0.35))))
              hits.addAssign(0.05)
            },
          )
        },
      )
      }) // end RT path (useBl.not)

    })

    If(done.lessThan(0.5).and(minR.lessThan(M.mul(RT.stalledCaptureM))), () => {
      captured.assign(1)
    })
    // Incomplete far-camera rays: do NOT paint sky if still plunging or
    // impact is inside critical scale — that made the hole vanish on zoom-out.
    If(
      done
        .lessThan(0.5)
        .and(minR.greaterThanEqual(M.mul(RT.stalledCaptureM))),
      () => {
        const inbound = dot(pos, vel).lessThan(0)
        const shadowImpact = impactB.lessThan(M.mul(float(RT.stalledShadowImpactM)))
        If(inbound.or(shadowImpact), () => {
          captured.assign(1)
        })
        If(inbound.not().and(shadowImpact.not()), () => {
          escaped.assign(1)
        })
      },
    )

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

    // Human-eye + cinematic mid-contrast tonemap (lift mids, compress peaks)
    const luma = dot(col, vec3(0.2126, 0.7152, 0.0722))
    const tmMid = float(DISK_EMISSION.tonemapMid)
    const tmHigh = float(DISK_EMISSION.tonemapHigh)
    const toned = luma
      .mul(float(1).add(luma.mul(tmMid)))
      .div(float(1).add(luma.mul(tmHigh)))
    const eyeScale = toned.div(max(luma, float(1e-5)))
    const hasLight = luma.greaterThan(1e-6)
    const colT = col.mul(eyeScale)
    // Saturation restore so film/blackbody color survives compress
    const sat = float(DISK_EMISSION.tonemapSat)
    const colSat = colT.mul(sat).sub(vec3(toned).mul(sat.sub(1)))
    col.assign(hasLight.select(max(colSat, vec3(0)), col))

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

  let lastQualityMaxSteps = RT.defaultMaxSteps
  let lastBaseStepM = RT.baseStepM

  function refreshIntegrationBudget(): void {
    const M = Math.max(uMass.value as number, 1e-8)
    const dSlider = uCamDistM.value as number
    const scaleFreeOn = (uScaleFree.value as number) > 0.5
    const camD = scaleFreeOn ? dSlider * M : dSlider
    uMaxSteps.value = rtMaxStepsForCamera(camD, M, lastQualityMaxSteps)
    uBaseStepM.value = lastBaseStepM
  }

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
      uPrograde.value = 1 // co-rot locked
      uStructure.value = p.structure
      uArms.value = p.arms
      uClumps.value = p.clumps
      uDust.value = p.dust
      uScaleH.value = p.scaleHeight
      uShearRate.value = p.shearRate
      uAnim.value = p.animate ? 1 : 0
      uTilt.value = p.tiltRad
      uTiltNode.value = 0
      uJetPower.value = p.jetBoost
      uMriTurb.value = p.mriTurbScale
      uRho0.value = p.rho0
      uPolyT.value = p.polyTScale
      uRPeakM.value = p.rPeakOverM
      uMadBoost.value = p.madBoost
      uPerturb.value = p.perturbAmp
      refreshIntegrationBudget()
    },
    setCamera: (c) => {
      uCamDistM.value = c.distanceM
      uInclination.value = c.inclination
      uAzimuth.value = c.azimuth
      uFov.value = c.fov
      refreshIntegrationBudget()
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
      refreshIntegrationBudget()
    },
    setIdealBeam: (on) => {
      uIdealBeam.value = on ? 1 : 0
    },
    setTime: (seconds) => {
      uTime.value = seconds
    },
    setQuality: (q) => {
      lastQualityMaxSteps = q.maxSteps
      lastBaseStepM = q.baseStepM
      uVolumeStride.value = q.volumeStride
      refreshIntegrationBudget()
    },
    setGrmhdCube: (gpu, mix) => {
      if (gpu) {
        const prev = gpuGrmhd
        gpuGrmhd = gpu
        cubeTexNode.value = gpu.texture
        uCubeOx.value = gpu.origin.x
        uCubeOy.value = gpu.origin.y
        uCubeOz.value = gpu.origin.z
        uCubeEx.value = gpu.extent.x
        uCubeEy.value = gpu.extent.y
        uCubeEz.value = gpu.extent.z
        uCubeScale.value = gpu.densScale
        uGrmhdMix.value = Math.min(1, Math.max(0, mix))
        if (prev && prev.texture !== gpu.texture && prev.texture !== stubTex) {
          try {
            prev.texture.dispose()
          } catch {
            /* ignore */
          }
        }
      } else {
        uGrmhdMix.value = 0
        cubeTexNode.value = stubTex
      }
    },
  }
}
