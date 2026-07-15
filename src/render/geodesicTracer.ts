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
  floor,
  fract,
  int,
  log,
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
import {
  LAMBDA_B_NM,
  LAMBDA_G_NM,
  LAMBDA_R_NM,
  PLANCK_C2_NM_K,
} from '../physics/blackbody'
import { DEFAULT_MDOT } from '../physics/constants'
import {
  DISK_EMISSION,
  R_ISCO_SCHW_OVER_M,
  T_PEAK_MDOT_REF,
  T_PEAK_REF_K,
} from '../physics/disk'
import { RT } from '../physics/geodesic/rtConstants'
import { OBSERVER_DEFAULTS } from '../physics/observer'
import { DEBUG_DEFAULTS } from '../debug/state'
import { SKY_DEFAULTS, type SkyState } from '../state/sky'

export type SpacetimeTraceParams = {
  mass: number
  spinStar: number
  charge: number
  mdot: number
  /** r_ISCO / M from CPU diskIsco */
  rIscoOverM: number
  /** Disk outer radius in units of M */
  outerM: number
}

export type CameraTraceParams = {
  distanceM: number
  inclination: number
  azimuth: number
  fov: number
}

export type GeodesicTracer = {
  material: THREE.MeshBasicNodeMaterial
  mesh: THREE.Mesh
  setSpacetime: (p: SpacetimeTraceParams) => void
  setCamera: (c: CameraTraceParams) => void
  setSky: (s: SkyState) => void
  setDebugMode: (mode: number) => void
  setMass: (mass: number) => void
  setSpinStar: (spinStar: number) => void
  setCharge: (charge: number) => void
  setMdot: (mdot: number) => void
  setRIscoM: (rIscoOverM: number) => void
  setCameraDistanceM: (distanceM: number) => void
  setInclination: (radians: number) => void
  setAzimuth: (radians: number) => void
  setFov: (fov: number) => void
  /** 0 = real-time Cartesian (default), 1 = Boyer–Lindquist Mino */
  setIntegratorMode: (mode: 0 | 1) => void
}

/**
 * Einstein–Maxwell null geodesic ray marcher (WebGPU / TSL).
 * Families: Schwarzschild / Kerr / RN / Kerr–Newman from (M, a★, Q).
 * Disk: Novikov–Thorne T(r) with family ISCO; flux ∝ ṁ, T ∝ ṁ^{1/4}.
 * Spin ‖ +Y; disk in XZ (y = 0).
 *
 * Integrators (uIntegratorMode):
 *   0 = real-time Cartesian RK2 + kn force (default, GPU twin of cpuRef)
 *   1 = Boyer–Lindquist Mino-time (CPU Phase 1–3 math on GPU; Kerr/Schw)
 * Capture horizon uses (M,a,Q). BL potentials are Kerr-form (a,M); Q in g_tt for RN tint.
 *
 * Emission constants: DISK_EMISSION in physics/disk.ts (CPU/GPU lockstep).
 */
export function createGeodesicTracer(): GeodesicTracer {
  const E = DISK_EMISSION
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
  const uStarDensity = uniform(SKY_DEFAULTS.starDensity)
  const uStarBright = uniform(SKY_DEFAULTS.starBrightness)
  const uNebula = uniform(SKY_DEFAULTS.nebula)
  const uMilky = uniform(SKY_DEFAULTS.milky)
  const uDebugMode = uniform(DEBUG_DEFAULTS.mode)
  /** 0 = RT Cartesian, 1 = BL Mino */
  const uIntegratorMode = uniform(0)
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
    const camD = uCamDistM.mul(M)

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
                const Omega = sqrtM.div(r32.add(a.mul(sqrtM)).add(1e-8))
                const g_tt = float(-1).add(rs.div(rhoSafe)).sub(Q.mul(Q).div(rhoSafe.mul(rhoSafe)))
                const g_tphi = a.mul(M).mul(-2).div(rhoSafe)
                const g_phiphi = rhoSafe
                  .mul(rhoSafe)
                  .add(a.mul(a))
                  .add(M.mul(2).mul(a).mul(a).div(rhoSafe))
                const Xorb = g_tt
                  .mul(-1)
                  .sub(Omega.mul(2).mul(g_tphi))
                  .sub(Omega.mul(Omega).mul(g_phiphi))
                const u_t = float(1).div(sqrt(max(Xorb, float(1e-8))))
                const lambda = blLz.div(max(blE, float(1e-8)))
                const freq = float(1).div(
                  max(u_t.mul(float(1).sub(Omega.mul(lambda))), float(0.25)),
                )
                const beam = pow(max(freq, float(E.beamFloor)), float(E.beamExponent))
                const gap = max(
                  float(1).sub(sqrt(rin.div(max(hitR, rin.mul(1.0001))))),
                  float(0),
                )
                const Ftilde = gap.div(hitR.mul(hitR).mul(hitR).add(1e-12))
                const rPeak = rin.mul(E.ntPeakOverRin)
                const gapPeak = max(
                  float(1).sub(sqrt(rin.div(max(rPeak, rin.mul(1.0001))))),
                  float(0),
                )
                const FtildeMax = gapPeak.div(rPeak.mul(rPeak).mul(rPeak).add(1e-12))
                const fluxRel = Ftilde.div(max(FtildeMax, float(1e-12)))
                const fluxVis = pow(max(fluxRel, float(1e-6)), float(E.fluxVisPower))
                const rIscoM = max(uRIscoM, float(1.05))
                const iscoHot = pow(
                  float(R_ISCO_SCHW_OVER_M).div(rIscoM),
                  float(E.iscoHotPower),
                )
                const spinFac = float(1).add(max(aStar, float(0)).mul(E.spinEtaNudge))
                const tPeakK = float(T_PEAK_REF_K)
                  .mul(pow(max(mdot.div(T_PEAK_MDOT_REF), float(1e-6)), float(0.25)))
                  .mul(iscoHot)
                  .mul(spinFac)
                const tRestK = tPeakK.mul(pow(max(fluxRel, float(1e-6)), float(0.25)))
                const gColor = pow(max(freq, float(E.gColorFloor)), float(E.gColorExponent))
                const TK = max(
                  float(E.tColorMinK),
                  min(float(E.tColorMaxK), tRestK.mul(gColor)),
                )
                const planckC2 = float(PLANCK_C2_NM_K)
                const lamR = float(LAMBDA_R_NM)
                const lamG = float(LAMBDA_G_NM)
                const lamB = float(LAMBDA_B_NM)
                const xR = min(planckC2.div(lamR.mul(TK)), float(80))
                const xG = min(planckC2.div(lamG.mul(TK)), float(80))
                const xB = min(planckC2.div(lamB.mul(TK)), float(80))
                const br = float(1).div(
                  pow(lamR, float(5)).mul(max(exp(xR).sub(1), float(1e-20))),
                )
                const bg = float(1).div(
                  pow(lamG, float(5)).mul(max(exp(xG).sub(1), float(1e-20))),
                )
                const bb = float(1).div(
                  pow(lamB, float(5)).mul(max(exp(xB).sub(1), float(1e-20))),
                )
                const bMax = max(br, max(bg, bb))
                const chroma = vec3(br, bg, bb).div(max(bMax, float(1e-20)))
                const bounce = float(1).add(max(hits.sub(1), float(0)).mul(0.55))
                const mdotBright = float(E.mdotBrightBase).add(
                  pow(
                    max(mdot.div(T_PEAK_MDOT_REF), float(E.mdotBrightFloor)),
                    float(E.mdotBrightPower),
                  ).mul(E.mdotBrightScale),
                )
                const iFlux = max(fluxVis, float(E.fluxVisFloor))
                  .mul(mdotBright)
                  .mul(E.intensityGain)
                const emit = chroma.mul(iFlux).mul(beam).mul(bounce)
                dbgG.assign(freq)
                dbgT.assign(TK.div(float(12000)))
                dbgFlux.assign(fluxVis)
                If(uDebugMode.notEqual(float(8)), () => {
                  col.addAssign(emit.mul(transm))
                  transm.mulAssign(0.5)
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

      // --- a1 = knAccel(pos, vel): Schw/RN radial + Kerr LT ---
      const r1 = max(r, float(1e-6))
      const L1 = cross(pos, vel)
      const L12 = dot(L1, L1)
      const r13 = r1.mul(r1).mul(r1)
      const r15 = r13.mul(r1).mul(r1)
      const r16 = r15.mul(r1)
      const coup1 = a.mul(L1.y).div(r13.add(a.mul(a).mul(r1)).add(1e-12))
      // Binet RN: strength = −1.5 rs L²/r⁵ + 2 Q² L²/r⁶
      const str1 = float(-1.5)
        .mul(rs)
        .mul(L12)
        .div(r15)
        .add(Q.mul(Q).mul(2).mul(L12).div(r16))
        .mul(float(1).sub(coup1.mul(1.35)))
      const Om1 = a.mul(M).mul(2).div(r13.add(a.mul(a).mul(r1)).add(1e-12))
      const a1 = pos.mul(str1).add(vec3(Om1.mul(2).mul(vel.z), float(0), Om1.mul(-2).mul(vel.x)))

      const pm = pos.add(vel.mul(ds.mul(0.5)))
      const vm = vel.add(a1.mul(ds.mul(0.5)))

      // --- a2 = knAccel(pm, vm) ---
      const r2 = max(pm.length(), float(1e-6))
      const L2 = cross(pm, vm)
      const L22 = dot(L2, L2)
      const r23 = r2.mul(r2).mul(r2)
      const r25 = r23.mul(r2).mul(r2)
      const r26 = r25.mul(r2)
      const coup2 = a.mul(L2.y).div(r23.add(a.mul(a).mul(r2)).add(1e-12))
      const str2 = float(-1.5)
        .mul(rs)
        .mul(L22)
        .div(r25)
        .add(Q.mul(Q).mul(2).mul(L22).div(r26))
        .mul(float(1).sub(coup2.mul(1.35)))
      const Om2 = a.mul(M).mul(2).div(r23.add(a.mul(a).mul(r2)).add(1e-12))
      const a2 = pm.mul(str2).add(vec3(Om2.mul(2).mul(vm.z), float(0), Om2.mul(-2).mul(vm.x)))

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
            const x = rho.div(M)

            // Orbiting-emitter redshift: g = 1/(u^t (1 − Ω λ)), λ = ρ μ
            // Kerr equatorial: u^t from −g_tt − 2Ω g_tφ − Ω² g_φφ
            const rhoSafe = max(rho, float(1e-5))
            const sqrtM = sqrt(max(M, float(1e-8)))
            const r32 = pow(rhoSafe, float(1.5))
            const Omega = sqrtM.div(r32.add(a.mul(sqrtM)).add(1e-8))

            // Metric (equatorial, BL-like + RN g_tt)
            const g_tt = float(-1).add(rs.div(rhoSafe)).sub(Q.mul(Q).div(rhoSafe.mul(rhoSafe)))
            const g_tphi = a.mul(M).mul(-2).div(rhoSafe)
            const g_phiphi = rhoSafe
              .mul(rhoSafe)
              .add(a.mul(a))
              .add(M.mul(2).mul(a).mul(a).div(rhoSafe))
            const Xorb = g_tt
              .mul(-1)
              .sub(Omega.mul(2).mul(g_tphi))
              .sub(Omega.mul(Omega).mul(g_phiphi))
            const u_t = float(1).div(sqrt(max(Xorb, float(1e-8))))

            const tdir = vec3(hz.mul(-1), float(0), hx).normalize()
            const nObs = vel.normalize().mul(-1)
            const mu = dot(tdir, nObs)
            const lambda = rhoSafe.mul(mu)
            const freq = float(1).div(
              max(u_t.mul(float(1).sub(Omega.mul(lambda))), float(0.25)),
            )
            // Mild Doppler boost (g^n). Extreme g³ + low ṁ zeroed the disk face.
            const beam = pow(max(freq, float(E.beamFloor)), float(E.beamExponent))

            // --- NT flux profile ---
            const gap = max(float(1).sub(sqrt(rin.div(max(rho, rin.mul(1.0001))))), float(0))
            const Ftilde = gap.div(rho.mul(rho).mul(rho).add(1e-12))
            const rPeak = rin.mul(E.ntPeakOverRin)
            const gapPeak = max(
              float(1).sub(sqrt(rin.div(max(rPeak, rin.mul(1.0001))))),
              float(0),
            )
            const FtildeMax = gapPeak.div(rPeak.mul(rPeak).mul(rPeak).add(1e-12))
            const fluxRel = Ftilde.div(max(FtildeMax, float(1e-12)))
            // Softer radial falloff for optical display
            const fluxVis = pow(max(fluxRel, float(1e-6)), float(E.fluxVisPower))

            // --- Color temperature (Kelvin) — COLOR ONLY ---
            // Higher spin → smaller r_ISCO → hotter peak (T ∝ r_in^{-3/4}); no extra spinEta.
            // T(r) = T_peak (F/Fmax)^{1/4}; mild g on observed color (not full g wipe).
            const rIscoM = max(uRIscoM, float(1.05))
            const iscoHot = pow(float(R_ISCO_SCHW_OVER_M).div(rIscoM), float(E.iscoHotPower))
            // spinEtaNudge kept for lockstep with DISK_EMISSION (default 0)
            const spinFac = float(1).add(max(aStar, float(0)).mul(E.spinEtaNudge))
            const tPeakK = float(T_PEAK_REF_K)
              .mul(pow(max(mdot.div(T_PEAK_MDOT_REF), float(1e-6)), float(0.25)))
              .mul(iscoHot)
              .mul(spinFac)
            const tRestK = tPeakK.mul(pow(max(fluxRel, float(1e-6)), float(0.25)))
            // Soft redshift on color: full g over-redshifts high-spin inner disk
            const gColor = pow(max(freq, float(E.gColorFloor)), float(E.gColorExponent))
            const TK = max(float(E.tColorMinK), min(float(E.tColorMaxK), tRestK.mul(gColor)))

            // Max-normalized blackbody chromaticity (always unit peak channel)
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

            // Mild seamless texture (structure, not voids)
            const invRho = float(1).div(max(rhoSafe, float(1e-5)))
            const cphi = hx.mul(invRho)
            const sphi = hz.mul(invRho)
            const lnR = log(max(rhoSafe.div(M), float(1e-4)))
            const c2a = cphi.mul(cphi).sub(sphi.mul(sphi))
            const s2a = cphi.mul(sphi).mul(2)
            const alpha = float(-1.1).mul(lnR).add(0.3)
            const armWave = float(0.5).add(
              float(0.5).mul(c2a.mul(cos(alpha)).add(s2a.mul(sin(alpha)))),
            )
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
            const n11 = fract(
              sin(ix.add(1).mul(127.1).add(iy.add(1).mul(311.7))).mul(43758.5453),
            )
            const turb = n00
              .mul(float(1).sub(ux))
              .add(n10.mul(ux))
              .mul(float(1).sub(uy))
              .add(n01.mul(float(1).sub(ux)).add(n11.mul(ux)).mul(uy))
            const texFac = max(float(0.75), min(float(1.25), armFac.mul(float(0.9).add(turb.mul(0.2)))))

            // --- Brightness from accretion power (NOT absolute optical B_λ) ---
            // I ∝ F_vis · f(ṁ) · g^n · texture
            // f(ṁ) soft so min slider still shows a glowing disk (thick thermal surface)
            const bounce = float(1).add(max(hits.sub(1), float(0)).mul(0.55))
            const mdotBright = float(E.mdotBrightBase).add(
              pow(max(mdot.div(T_PEAK_MDOT_REF), float(E.mdotBrightFloor)), float(E.mdotBrightPower)).mul(
                E.mdotBrightScale,
              ),
            )
            const iFlux = max(fluxVis, float(E.fluxVisFloor)).mul(mdotBright).mul(E.intensityGain)
            const emit = chroma.mul(iFlux).mul(beam).mul(texFac).mul(bounce)

            // Debug channels (last disk hit wins)
            dbgG.assign(freq)
            dbgT.assign(TK.div(float(12000)))
            dbgFlux.assign(fluxVis)

            // Sky-only mode: skip disk emission
            If(uDebugMode.notEqual(float(8)), () => {
              col.addAssign(emit.mul(transm))
              transm.mulAssign(0.5)
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

    If(escaped.greaterThan(0.5), () => {
      // ============================================================
      // Deep space: mostly black, soft circular stars, subtle nebulae.
      // Escape-ray direction = GR-lensed background.
      // ============================================================
      const d = vel.normalize()
      const dx = d.x
      const dy = d.y
      const dz = d.z

      // --- Soft 2-octave fBm (nebula mask only) ---
      const aS = float(2.2)
      const aix = floor(dx.mul(aS))
      const aiy = floor(dy.mul(aS))
      const aiz = floor(dz.mul(aS))
      const afx = dx.mul(aS).sub(aix)
      const afy = dy.mul(aS).sub(aiy)
      const afz = dz.mul(aS).sub(aiz)
      const aux = afx.mul(afx).mul(float(3).sub(afx.mul(2)))
      const auy = afy.mul(afy).mul(float(3).sub(afy.mul(2)))
      const auz = afz.mul(afz).mul(float(3).sub(afz.mul(2)))
      const asd = float(1.7)
      const an000 = fract(sin(aix.mul(127.1).add(aiy.mul(311.7)).add(aiz.mul(74.7)).add(asd)).mul(43758.5453))
      const an100 = fract(sin(aix.add(1).mul(127.1).add(aiy.mul(311.7)).add(aiz.mul(74.7)).add(asd)).mul(43758.5453))
      const an010 = fract(sin(aix.mul(127.1).add(aiy.add(1).mul(311.7)).add(aiz.mul(74.7)).add(asd)).mul(43758.5453))
      const an110 = fract(sin(aix.add(1).mul(127.1).add(aiy.add(1).mul(311.7)).add(aiz.mul(74.7)).add(asd)).mul(43758.5453))
      const an001 = fract(sin(aix.mul(127.1).add(aiy.mul(311.7)).add(aiz.add(1).mul(74.7)).add(asd)).mul(43758.5453))
      const an101 = fract(sin(aix.add(1).mul(127.1).add(aiy.mul(311.7)).add(aiz.add(1).mul(74.7)).add(asd)).mul(43758.5453))
      const an011 = fract(sin(aix.mul(127.1).add(aiy.add(1).mul(311.7)).add(aiz.add(1).mul(74.7)).add(asd)).mul(43758.5453))
      const an111 = fract(sin(aix.add(1).mul(127.1).add(aiy.add(1).mul(311.7)).add(aiz.add(1).mul(74.7)).add(asd)).mul(43758.5453))
      const ax00 = an000.mul(float(1).sub(aux)).add(an100.mul(aux))
      const ax10 = an010.mul(float(1).sub(aux)).add(an110.mul(aux))
      const ax01 = an001.mul(float(1).sub(aux)).add(an101.mul(aux))
      const ax11 = an011.mul(float(1).sub(aux)).add(an111.mul(aux))
      const ay0 = ax00.mul(float(1).sub(auy)).add(ax10.mul(auy))
      const ay1 = ax01.mul(float(1).sub(auy)).add(ax11.mul(auy))
      const n1 = ay0.mul(float(1).sub(auz)).add(ay1.mul(auz))

      const bS = float(5.5)
      const bix = floor(dx.mul(bS))
      const biy = floor(dy.mul(bS))
      const biz = floor(dz.mul(bS))
      const bfx = dx.mul(bS).sub(bix)
      const bfy = dy.mul(bS).sub(biy)
      const bfz = dz.mul(bS).sub(biz)
      const bux = bfx.mul(bfx).mul(float(3).sub(bfx.mul(2)))
      const buy = bfy.mul(bfy).mul(float(3).sub(bfy.mul(2)))
      const buz = bfz.mul(bfz).mul(float(3).sub(bfz.mul(2)))
      const bsd = float(4.2)
      const bn000 = fract(sin(bix.mul(127.1).add(biy.mul(311.7)).add(biz.mul(74.7)).add(bsd)).mul(43758.5453))
      const bn100 = fract(sin(bix.add(1).mul(127.1).add(biy.mul(311.7)).add(biz.mul(74.7)).add(bsd)).mul(43758.5453))
      const bn010 = fract(sin(bix.mul(127.1).add(biy.add(1).mul(311.7)).add(biz.mul(74.7)).add(bsd)).mul(43758.5453))
      const bn110 = fract(sin(bix.add(1).mul(127.1).add(biy.add(1).mul(311.7)).add(biz.mul(74.7)).add(bsd)).mul(43758.5453))
      const bn001 = fract(sin(bix.mul(127.1).add(biy.mul(311.7)).add(biz.add(1).mul(74.7)).add(bsd)).mul(43758.5453))
      const bn101 = fract(sin(bix.add(1).mul(127.1).add(biy.mul(311.7)).add(biz.add(1).mul(74.7)).add(bsd)).mul(43758.5453))
      const bn011 = fract(sin(bix.mul(127.1).add(biy.add(1).mul(311.7)).add(biz.add(1).mul(74.7)).add(bsd)).mul(43758.5453))
      const bn111 = fract(sin(bix.add(1).mul(127.1).add(biy.add(1).mul(311.7)).add(biz.add(1).mul(74.7)).add(bsd)).mul(43758.5453))
      const bx00 = bn000.mul(float(1).sub(bux)).add(bn100.mul(bux))
      const bx10 = bn010.mul(float(1).sub(bux)).add(bn110.mul(bux))
      const bx01 = bn001.mul(float(1).sub(bux)).add(bn101.mul(bux))
      const bx11 = bn011.mul(float(1).sub(bux)).add(bn111.mul(bux))
      const by0 = bx00.mul(float(1).sub(buy)).add(bx10.mul(buy))
      const by1 = bx01.mul(float(1).sub(buy)).add(bx11.mul(buy))
      const n2 = by0.mul(float(1).sub(buz)).add(by1.mul(buz))

      const fbm = n1.mul(0.65).add(n2.mul(0.35))

      // Soft milky haze (desaturated, low gain) — amount via uMilky
      const galN = vec3(0.18, 0.9, 0.35).normalize()
      const band = float(1).sub(abs(dot(d, galN)))
      const milky = pow(max(band, float(0)), float(10.0)).mul(uMilky)

      // --- Mostly black void + faint cool dust (uNebula) ---
      const voidCol = vec3(0.0015, 0.0018, 0.0035)
      const dustMask = pow(max(fbm.sub(0.42), float(0)).mul(1.8), float(1.8))
      const dust = vec3(0.04, 0.05, 0.08).mul(dustMask.mul(0.22).mul(uNebula))
      const lane = vec3(0.05, 0.055, 0.07).mul(milky.mul(fbm.mul(0.5).add(0.25)).mul(0.18))
      let sky = voidCol.add(dust).add(lane)

      // ============================================================
      // Circular stars — density/brightness from uniforms
      // spawn fraction ~ 0.014 * density (layer1), etc.
      // ============================================================
      const dens = max(uStarDensity, float(0))
      const sBright = max(uStarBright, float(0))

      // Layer 1 — dense faint field
      const s1 = float(95.0)
      const p1x = dx.mul(s1)
      const p1y = dy.mul(s1)
      const p1z = dz.mul(s1)
      const i1x = floor(p1x)
      const i1y = floor(p1y)
      const i1z = floor(p1z)
      const f1x = p1x.sub(i1x)
      const f1y = p1y.sub(i1y)
      const f1z = p1z.sub(i1z)
      const h1a = fract(sin(i1x.mul(127.1).add(i1y.mul(311.7)).add(i1z.mul(74.7)).add(11.1)).mul(43758.5453))
      const h1b = fract(sin(i1x.mul(269.5).add(i1y.mul(183.3)).add(i1z.mul(419.2)).add(12.2)).mul(43758.5453))
      const h1c = fract(sin(i1x.mul(419.2).add(i1y.mul(371.9)).add(i1z.mul(127.1)).add(13.3)).mul(43758.5453))
      const h1d = fract(sin(i1x.mul(71.7).add(i1y.mul(113.5)).add(i1z.mul(271.9)).add(14.4)).mul(43758.5453))
      // Base ~1.8% cells at density=1; scales with dens
      const thr1 = float(1).sub(float(0.018).mul(dens))
      const spawn1 = h1a.greaterThan(thr1).select(float(1), float(0))
      const cx1 = h1b.mul(0.7).add(0.15)
      const cy1 = h1c.mul(0.7).add(0.15)
      const cz1 = h1d.mul(0.7).add(0.15)
      const dist1 = sqrt(
        f1x.sub(cx1).mul(f1x.sub(cx1)).add(f1y.sub(cy1).mul(f1y.sub(cy1))).add(f1z.sub(cz1).mul(f1z.sub(cz1))),
      )
      const rad1 = float(0.028).add(h1b.mul(0.018))
      const disc1 = exp(dist1.mul(dist1).div(rad1.mul(rad1).add(1e-8)).mul(-1))
      const bright1 = spawn1.mul(disc1).mul(float(0.35).add(h1c.mul(0.45))).mul(sBright)

      // Layer 2 — medium stars
      const s2 = float(42.0)
      const p2x = dx.mul(s2)
      const p2y = dy.mul(s2)
      const p2z = dz.mul(s2)
      const i2x = floor(p2x)
      const i2y = floor(p2y)
      const i2z = floor(p2z)
      const f2x = p2x.sub(i2x)
      const f2y = p2y.sub(i2y)
      const f2z = p2z.sub(i2z)
      const h2a = fract(sin(i2x.mul(127.1).add(i2y.mul(311.7)).add(i2z.mul(74.7)).add(21.1)).mul(43758.5453))
      const h2b = fract(sin(i2x.mul(269.5).add(i2y.mul(183.3)).add(i2z.mul(419.2)).add(22.2)).mul(43758.5453))
      const h2c = fract(sin(i2x.mul(419.2).add(i2y.mul(371.9)).add(i2z.mul(127.1)).add(23.3)).mul(43758.5453))
      const h2d = fract(sin(i2x.mul(71.7).add(i2y.mul(113.5)).add(i2z.mul(271.9)).add(24.4)).mul(43758.5453))
      const thr2 = float(1).sub(float(0.01).mul(dens))
      const spawn2 = h2a.greaterThan(thr2).select(float(1), float(0))
      const cx2 = h2b.mul(0.65).add(0.175)
      const cy2 = h2c.mul(0.65).add(0.175)
      const cz2 = h2d.mul(0.65).add(0.175)
      const dist2 = sqrt(
        f2x.sub(cx2).mul(f2x.sub(cx2)).add(f2y.sub(cy2).mul(f2y.sub(cy2))).add(f2z.sub(cz2).mul(f2z.sub(cz2))),
      )
      const rad2 = float(0.035).add(h2b.mul(0.025))
      const disc2 = exp(dist2.mul(dist2).div(rad2.mul(rad2).add(1e-8)).mul(-1))
      const bright2 = spawn2.mul(disc2).mul(float(0.7).add(h2c.mul(0.9))).mul(sBright)

      // Layer 3 — rare bright circular stars
      const s3 = float(18.0)
      const p3x = dx.mul(s3)
      const p3y = dy.mul(s3)
      const p3z = dz.mul(s3)
      const i3x = floor(p3x)
      const i3y = floor(p3y)
      const i3z = floor(p3z)
      const f3x = p3x.sub(i3x)
      const f3y = p3y.sub(i3y)
      const f3z = p3z.sub(i3z)
      const h3a = fract(sin(i3x.mul(127.1).add(i3y.mul(311.7)).add(i3z.mul(74.7)).add(31.1)).mul(43758.5453))
      const h3b = fract(sin(i3x.mul(269.5).add(i3y.mul(183.3)).add(i3z.mul(419.2)).add(32.2)).mul(43758.5453))
      const h3c = fract(sin(i3x.mul(419.2).add(i3y.mul(371.9)).add(i3z.mul(127.1)).add(33.3)).mul(43758.5453))
      const h3d = fract(sin(i3x.mul(71.7).add(i3y.mul(113.5)).add(i3z.mul(271.9)).add(34.4)).mul(43758.5453))
      const thr3 = float(1).sub(float(0.0045).mul(dens))
      const spawn3 = h3a.greaterThan(thr3).select(float(1), float(0))
      const cx3 = h3b.mul(0.55).add(0.225)
      const cy3 = h3c.mul(0.55).add(0.225)
      const cz3 = h3d.mul(0.55).add(0.225)
      const dist3 = sqrt(
        f3x.sub(cx3).mul(f3x.sub(cx3)).add(f3y.sub(cy3).mul(f3y.sub(cy3))).add(f3z.sub(cz3).mul(f3z.sub(cz3))),
      )
      const rad3 = float(0.045).add(h3b.mul(0.03))
      const disc3 = exp(dist3.mul(dist3).div(rad3.mul(rad3).add(1e-8)).mul(-1))
      const halo3 = exp(dist3.mul(dist3).div(rad3.mul(rad3).mul(4.5).add(1e-8)).mul(-1)).mul(0.25)
      const bright3 = spawn3.mul(disc3.add(halo3)).mul(float(1.4).add(h3c.mul(1.6))).mul(sBright)

      // Nearly white stars with very mild temperature tint
      const tintH = fract(sin(i2x.mul(91.7).add(i2y.mul(51.3)).add(i2z.mul(17.9)).add(44.4)).mul(43758.5453))
      const starCol = tintH
        .lessThan(0.25)
        .select(vec3(0.85, 0.9, 1.0), tintH.lessThan(0.75).select(vec3(1.0, 0.98, 0.96), vec3(1.0, 0.92, 0.82)))

      const stars = starCol.mul(bright1.add(bright2).add(bright3))

      sky = sky.add(stars)
      sky = min(sky, vec3(1.6, 1.6, 1.7))

      col.addAssign(sky.mul(transm))
    })

    If(captured.greaterThan(0.5).and(hits.lessThan(0.5)), () => {
      col.assign(vec3(0, 0, 0))
    })

    // ============================================================
    // Debug false-color modes (uDebugMode): 0 = normal
    // ============================================================
    const mode = uDebugMode
    If(mode.equal(float(1)), () => {
      // Fate: capture black, disk orange, escape cyan/blue
      If(hits.greaterThan(0.5), () => {
        col.assign(vec3(0.95, 0.45, 0.12))
      })
      If(hits.lessThan(0.5).and(captured.greaterThan(0.5)), () => {
        col.assign(vec3(0.02, 0.02, 0.02))
      })
      If(hits.lessThan(0.5).and(escaped.greaterThan(0.5)), () => {
        const near = minR.lessThan(M.mul(4.0)).select(float(1), float(0))
        col.assign(
          near
            .greaterThan(0.5)
            .select(vec3(0.15, 0.75, 0.85), vec3(0.08, 0.1, 0.18)),
        )
      })
    })
    If(mode.equal(float(2)), () => {
      // Steps heatmap (blue → green → red)
      const t = min(stepCount.div(float(STEPS)), float(1))
      col.assign(
        vec3(t, float(1).sub(abs(t.mul(2).sub(1))), float(1).sub(t)).mul(1.2),
      )
    })
    If(mode.equal(float(3)), () => {
      // min r / (8M) heat
      const t = min(minR.div(M.mul(8)), float(1))
      col.assign(vec3(float(1).sub(t), t.mul(0.6), t))
    })
    If(mode.equal(float(4)), () => {
      // g-factor on disk; dark elsewhere
      If(hits.greaterThan(0.5), () => {
        const g = min(dbgG.mul(0.7), float(1.5))
        col.assign(vec3(g, g.mul(0.85), g.mul(0.55)))
      })
      If(hits.lessThan(0.5), () => {
        col.assign(
          captured
            .greaterThan(0.5)
            .select(vec3(0, 0, 0), vec3(0.03, 0.03, 0.05)),
        )
      })
    })
    If(mode.equal(float(5)), () => {
      If(hits.greaterThan(0.5), () => {
        const t = min(dbgT, float(1.2))
        col.assign(vec3(t, t.mul(0.7), t.mul(0.35)))
      })
      If(hits.lessThan(0.5), () => {
        col.assign(
          captured
            .greaterThan(0.5)
            .select(vec3(0, 0, 0), vec3(0.02, 0.02, 0.04)),
        )
      })
    })
    If(mode.equal(float(6)), () => {
      If(hits.greaterThan(0.5), () => {
        const f = min(pow(max(dbgFlux, float(1e-4)), float(0.45)), float(1.2))
        col.assign(vec3(f, f.mul(0.5), f.mul(0.15)))
      })
      If(hits.lessThan(0.5), () => {
        col.assign(
          captured
            .greaterThan(0.5)
            .select(vec3(0, 0, 0), vec3(0.02, 0.02, 0.04)),
        )
      })
    })
    If(mode.equal(float(7)), () => {
      // Impact b / (6√3 M) — critical shadow ~1 at Schw
      const bc = M.mul(float(5.1961524227))
      const t = min(impactB.div(max(bc, float(1e-6))), float(2)).mul(0.5)
      col.assign(vec3(t, float(1).sub(abs(t.mul(2).sub(1))), float(1).sub(t)))
    })
    // mode 8 sky-only: already skipped disk emit; capture stays black
    If(mode.equal(float(8)).and(captured.greaterThan(0.5)).and(hits.lessThan(0.5)), () => {
      col.assign(vec3(0, 0, 0))
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
    setMass: (m) => {
      uMass.value = m
    },
    setSpinStar: (s) => {
      uSpinStar.value = s
    },
    setCharge: (q) => {
      uCharge.value = q
    },
    setMdot: (m) => {
      uMdot.value = m
    },
    setRIscoM: (r) => {
      uRIscoM.value = r
    },
    setCameraDistanceM: (d) => {
      uCamDistM.value = d
    },
    setInclination: (r) => {
      uInclination.value = r
    },
    setAzimuth: (r) => {
      uAzimuth.value = r
    },
    setFov: (f) => {
      uFov.value = f
    },
    setIntegratorMode: (mode) => {
      uIntegratorMode.value = mode
    },
  }
}
