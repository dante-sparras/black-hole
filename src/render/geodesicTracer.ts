// @ts-nocheck — Three.js TSL node graphs make tsc (TS 7) non-terminating on this file.
import * as THREE from 'three/webgpu'
import {
  Break,
  Fn,
  If,
  Loop,
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
      const d = vel.normalize()
      const sky = vec3(0.012, 0.014, 0.025)
      const h = fract(
        sin(d.x.mul(12.9898).add(d.y.mul(78.233)).add(d.z.mul(37.719))).mul(43758.5453),
      )
      const star = h.greaterThan(0.9968).select(float(0.9), float(0))
      col.addAssign(sky.add(vec3(star, star, star.mul(0.9))).mul(transm))
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
