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
  setMass: (mass: number) => void
  setSpinStar: (spinStar: number) => void
  setCharge: (charge: number) => void
  setMdot: (mdot: number) => void
  setRIscoM: (rIscoOverM: number) => void
  setCameraDistanceM: (distanceM: number) => void
  setInclination: (radians: number) => void
  setAzimuth: (radians: number) => void
  setFov: (fov: number) => void
}

/**
 * Einstein–Maxwell null geodesic ray marcher (WebGPU / TSL).
 * Families: Schwarzschild / Kerr / RN / Kerr–Newman from (M, a★, Q).
 * Disk: Novikov–Thorne T(r) with family ISCO; flux ∝ ṁ, T ∝ ṁ^{1/4}.
 * Spin ‖ +Y; disk in XZ (y = 0).
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

    Loop({ start: int(0), end: int(STEPS), type: 'int', condition: '<' }, () => {
      If(done.greaterThan(0.5), () => {
        Break()
      })

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
            // Higher spin → smaller r_ISCO → hotter peak (T ∝ r_in^{-3/4}), not cooler.
            // T(r) = T_peak (F/Fmax)^{1/4}; mild g on observed color (not full g wipe).
            const rIscoM = max(uRIscoM, float(1.05))
            const iscoHot = pow(float(R_ISCO_SCHW_OVER_M).div(rIscoM), float(E.iscoHotPower))
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

            col.addAssign(emit.mul(transm))
            transm.mulAssign(0.5)
          })
        },
      )
    })

    If(done.lessThan(0.5).and(minR.lessThan(M.mul(RT.stalledCaptureM))), () => {
      captured.assign(1)
    })
    If(done.lessThan(0.5).and(minR.greaterThanEqual(M.mul(RT.stalledCaptureM))), () => {
      escaped.assign(1)
    })

    If(escaped.greaterThan(0.5), () => {
      // ============================================================
      // Deep-space backdrop (flat TSL — no nested Fn helpers)
      // Direction = escape ray (GR-lensed background).
      // ============================================================
      const d = vel.normalize()
      const dx = d.x
      const dy = d.y
      const dz = d.z

      // Value-noise octave A (scale 2.4)
      const aS = float(2.4)
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

      // Octave B (scale 5.1)
      const bS = float(5.1)
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

      // Octave C (scale 11)
      const cS = float(11.0)
      const cix = floor(dx.mul(cS))
      const ciy = floor(dy.mul(cS))
      const ciz = floor(dz.mul(cS))
      const cfx = dx.mul(cS).sub(cix)
      const cfy = dy.mul(cS).sub(ciy)
      const cfz = dz.mul(cS).sub(ciz)
      const cux = cfx.mul(cfx).mul(float(3).sub(cfx.mul(2)))
      const cuy = cfy.mul(cfy).mul(float(3).sub(cfy.mul(2)))
      const cuz = cfz.mul(cfz).mul(float(3).sub(cfz.mul(2)))
      const csd = float(9.3)
      const cn000 = fract(sin(cix.mul(127.1).add(ciy.mul(311.7)).add(ciz.mul(74.7)).add(csd)).mul(43758.5453))
      const cn100 = fract(sin(cix.add(1).mul(127.1).add(ciy.mul(311.7)).add(ciz.mul(74.7)).add(csd)).mul(43758.5453))
      const cn010 = fract(sin(cix.mul(127.1).add(ciy.add(1).mul(311.7)).add(ciz.mul(74.7)).add(csd)).mul(43758.5453))
      const cn110 = fract(sin(cix.add(1).mul(127.1).add(ciy.add(1).mul(311.7)).add(ciz.mul(74.7)).add(csd)).mul(43758.5453))
      const cn001 = fract(sin(cix.mul(127.1).add(ciy.mul(311.7)).add(ciz.add(1).mul(74.7)).add(csd)).mul(43758.5453))
      const cn101 = fract(sin(cix.add(1).mul(127.1).add(ciy.mul(311.7)).add(ciz.add(1).mul(74.7)).add(csd)).mul(43758.5453))
      const cn011 = fract(sin(cix.mul(127.1).add(ciy.add(1).mul(311.7)).add(ciz.add(1).mul(74.7)).add(csd)).mul(43758.5453))
      const cn111 = fract(sin(cix.add(1).mul(127.1).add(ciy.add(1).mul(311.7)).add(ciz.add(1).mul(74.7)).add(csd)).mul(43758.5453))
      const cx00 = cn000.mul(float(1).sub(cux)).add(cn100.mul(cux))
      const cx10 = cn010.mul(float(1).sub(cux)).add(cn110.mul(cux))
      const cx01 = cn001.mul(float(1).sub(cux)).add(cn101.mul(cux))
      const cx11 = cn011.mul(float(1).sub(cux)).add(cn111.mul(cux))
      const cy0 = cx00.mul(float(1).sub(cuy)).add(cx10.mul(cuy))
      const cy1 = cx01.mul(float(1).sub(cuy)).add(cx11.mul(cuy))
      const n3 = cy0.mul(float(1).sub(cuz)).add(cy1.mul(cuz))

      const fbm = n1.mul(0.55).add(n2.mul(0.3)).add(n3.mul(0.15))

      // Extra noise fields for color variety (cheaper hashes on scaled dirs)
      const nA = fract(sin(dx.mul(19.1).add(dy.mul(47.3)).add(dz.mul(91.7)).add(2.2)).mul(43758.5453))
      const nB = fract(sin(dx.mul(41.2).add(dy.mul(13.9)).add(dz.mul(67.4)).add(6.6)).mul(43758.5453))
      const nC = fract(sin(dx.mul(73.5).add(dy.mul(29.8)).add(dz.mul(11.2)).add(3.1)).mul(43758.5453))
      // Blend coarse fbm with hashes for wisps
      const ridge = float(1).sub(abs(fbm.mul(2).sub(1)))
      const wisps = pow(max(ridge.mul(0.6).add(nB.mul(0.4)), float(0)), float(2.0))

      // Milky Way band
      const galN = vec3(0.22, 0.88, 0.42).normalize()
      const band = float(1).sub(abs(dot(d, galN)))
      const milky = pow(max(band, float(0)), float(8.0))
      const milkyDust = milky.mul(fbm.mul(0.65).add(0.35))
      const milkyCore = pow(max(band, float(0)), float(18.0)).mul(pow(max(fbm, float(0)), float(1.4)))

      const voidCol = vec3(0.003, 0.004, 0.01)
      const hemi = dy.mul(0.5).add(0.5)
      const hemiTint = vec3(0.012, 0.014, 0.035)
        .mul(float(1).sub(hemi).mul(0.45))
        .add(vec3(0.01, 0.007, 0.016).mul(hemi.mul(0.4)))

      const nebBlue = vec3(0.06, 0.09, 0.26).mul(
        pow(max(fbm.mul(0.75).add(nC.mul(0.25)), float(0)), float(1.5)).mul(0.7),
      )
      const nebMag = vec3(0.26, 0.05, 0.2).mul(pow(max(wisps, float(0)), float(1.7)).mul(0.85))
      const nebTeal = vec3(0.04, 0.16, 0.18).mul(
        pow(max(n2.mul(n3).mul(2.0), float(0)), float(2.2)).mul(0.55),
      )
      const nebWarm = vec3(0.2, 0.1, 0.04).mul(milkyDust.mul(0.55))
      const nebLane = vec3(0.14, 0.12, 0.18).mul(milky.mul(0.42))
      const nebCore = vec3(0.4, 0.24, 0.12).mul(milkyCore.mul(0.65))

      // Distant faint filaments (large scale)
      const fil = pow(max(n1.mul(0.5).add(nA.mul(0.5)), float(0)), float(3.0))
      const nebFil = vec3(0.08, 0.04, 0.14).mul(fil.mul(0.35))

      let sky = voidCol
        .add(hemiTint)
        .add(nebBlue)
        .add(nebMag)
        .add(nebTeal)
        .add(nebWarm)
        .add(nebLane)
        .add(nebCore)
        .add(nebFil)

      // Stars — three density layers
      const s1 = fract(
        sin(floor(dx.mul(200.0)).mul(127.1).add(floor(dy.mul(200.0)).mul(311.7)).add(floor(dz.mul(200.0)).mul(74.7)).add(11.1)).mul(
          43758.5453,
        ),
      )
      const star1 = pow(max(s1.sub(0.984), float(0)).div(0.016), float(6.5))
      const s2 = fract(
        sin(floor(dx.mul(80.0)).mul(127.1).add(floor(dy.mul(80.0)).mul(311.7)).add(floor(dz.mul(80.0)).mul(74.7)).add(22.2)).mul(
          43758.5453,
        ),
      )
      const star2 = pow(max(s2.sub(0.991), float(0)).div(0.009), float(5.0))
      const s3 = fract(
        sin(floor(dx.mul(32.0)).mul(127.1).add(floor(dy.mul(32.0)).mul(311.7)).add(floor(dz.mul(32.0)).mul(74.7)).add(33.3)).mul(
          43758.5453,
        ),
      )
      const star3 = pow(max(s3.sub(0.9972), float(0)).div(0.0028), float(3.2))

      const cHash = fract(
        sin(
          floor(dx.mul(80.0).add(3.1))
            .mul(127.1)
            .add(floor(dy.mul(80.0).add(1.7)).mul(311.7))
            .add(floor(dz.mul(80.0).add(5.9)).mul(74.7))
            .add(44.4),
        ).mul(43758.5453),
      )
      const starCool = vec3(0.7, 0.82, 1.0)
      const starWhite = vec3(1.0, 0.98, 0.94)
      const starWarm = vec3(1.0, 0.75, 0.5)
      const starTint = cHash
        .lessThan(0.32)
        .select(starCool, cHash.lessThan(0.68).select(starWhite, starWarm))

      const stars = starTint
        .mul(star1.mul(0.5).add(star2.mul(1.15)).add(star3.mul(3.0)))
        .add(starTint.mul(star3.mul(1.4)).mul(vec3(0.55, 0.65, 1.0)))

      // Dense band stars
      const sBand = fract(
        sin(floor(dx.mul(120.0)).mul(127.1).add(floor(dy.mul(120.0)).mul(311.7)).add(floor(dz.mul(120.0)).mul(74.7)).add(55.5)).mul(
          43758.5453,
        ),
      )
      const bandStars = pow(max(sBand.sub(0.987), float(0)).div(0.013), float(5.0)).mul(milky.mul(1.6))
      const starsAll = stars.add(starWhite.mul(bandStars.mul(0.85)))

      // A few ultra-bright "named" stars (very sparse)
      const s4 = fract(
        sin(floor(dx.mul(14.0)).mul(127.1).add(floor(dy.mul(14.0)).mul(311.7)).add(floor(dz.mul(14.0)).mul(74.7)).add(77.7)).mul(
          43758.5453,
        ),
      )
      const giant = pow(max(s4.sub(0.9988), float(0)).div(0.0012), float(2.5))
      const giants = starWarm.mul(giant.mul(4.0)).add(starCool.mul(giant.mul(2.0)))

      sky = sky.add(starsAll).add(giants)
      sky = min(sky, vec3(2.2, 2.2, 2.5))

      col.addAssign(sky.mul(transm))
    })

    If(captured.greaterThan(0.5).and(hits.lessThan(0.5)), () => {
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
  }
}
