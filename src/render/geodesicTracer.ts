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

export type GeodesicTracer = {
  material: THREE.MeshBasicNodeMaterial
  mesh: THREE.Mesh
  setMass: (mass: number) => void
  setSpinStar: (spinStar: number) => void
  setCharge: (charge: number) => void
  setRIscoM: (rIscoOverM: number) => void
  setCameraDistanceM: (distanceM: number) => void
  setInclination: (radians: number) => void
  setAzimuth: (radians: number) => void
  setFov: (fov: number) => void
}

/**
 * Einstein–Maxwell null geodesic ray marcher (WebGPU / TSL).
 * Families: Schwarzschild / Kerr / RN / Kerr–Newman from (M, a★, Q).
 * Disk: Novikov–Thorne T(r) with family ISCO from CPU uniform.
 * Spin ‖ +Y; disk in XZ (y = 0).
 */
export function createGeodesicTracer(): GeodesicTracer {
  const uMass = uniform(1)
  const uSpinStar = uniform(0)
  const uCharge = uniform(0)
  const uRIscoM = uniform(6) // r_isco / M from CPU diskIsco
  const uCamDistM = uniform(30)
  const uInclination = uniform(1.25)
  const uAzimuth = uniform(0)
  const uFov = uniform(0.65)
  const uRoutM = uniform(22)
  const STEPS = 900

  const colorNode = Fn(() => {
    const M = uMass
    const aStar = uSpinStar
    const a = aStar.mul(M)
    const Q = uCharge
    const rs = M.mul(2)

    // r₊ = M + √(M² − a² − Q²)
    const disc = max(M.mul(M).sub(a.mul(a)).sub(Q.mul(Q)), float(0))
    const rPlus = M.add(sqrt(disc))
    const rCapture = rPlus.mul(1.02)

    // Family ISCO from CPU (units of M → geometric)
    const rin = max(uRIscoM.mul(M), rPlus.mul(1.05))
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

      If(r.greaterThan(camD.mul(3)).and(dot(pos, vel).greaterThan(0)), () => {
        escaped.assign(1)
        done.assign(1)
        Break()
      })

      const adapt = min(float(1.5), max(float(0.2), r.div(M.mul(12))))
      const ds = float(0.1).mul(M).mul(adapt)

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
            const freq = float(1).div(max(u_t.mul(float(1).sub(Omega.mul(lambda))), float(0.08)))
            // Bolometric I ∝ g³
            const beam = freq.mul(freq).mul(freq)

            // Novikov–Thorne: F̃ ∝ ρ⁻³ (1 − √(r_in/ρ)), T ∝ F̃^{1/4}
            const gap = max(float(1).sub(sqrt(rin.div(max(rho, rin.mul(1.0001))))), float(0))
            const flux = gap.div(rho.mul(rho).mul(rho).add(1e-12))
            const Fm = flux.mul(M).mul(M).mul(M).mul(8000)
            const Tnt = pow(max(Fm, float(1e-12)), float(0.25))
            const eff = float(1).add(max(aStar, float(0)).mul(0.35))
            const tempRest = Tnt.mul(eff).mul(2.2)
            const Tobs = tempRest.mul(freq)

            const bounce = float(1).add(max(hits.sub(1), float(0)).mul(1.1))
            const emit = vec3(
              min(float(2.2), float(0.45).add(Tobs.mul(1.15))),
              min(float(1.6), float(0.15).add(Tobs.mul(0.7))),
              min(float(1.2), float(0.03).add(Tobs.mul(Tobs).mul(0.25))),
            )
              .mul(bounce)
              .mul(beam)

            col.addAssign(emit.mul(transm))
            transm.mulAssign(0.4)
          })
        },
      )
    })

    If(done.lessThan(0.5).and(minR.lessThan(M.mul(3.2))), () => {
      captured.assign(1)
    })
    If(done.lessThan(0.5).and(minR.greaterThanEqual(M.mul(3.2))), () => {
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

    return vec4(col.div(col.add(1)), 1)
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
    setMass: (m) => {
      uMass.value = m
    },
    setSpinStar: (s) => {
      uSpinStar.value = s
    },
    setCharge: (q) => {
      uCharge.value = q
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

/** @deprecated alias */
export const createSchwarzschildTracer = createGeodesicTracer
