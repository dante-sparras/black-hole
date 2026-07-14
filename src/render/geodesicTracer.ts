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
  setCameraDistanceM: (distanceM: number) => void
  setInclination: (radians: number) => void
  setAzimuth: (radians: number) => void
  setFov: (fov: number) => void
}

/**
 * Kerr / Schwarzschild null geodesic ray marcher (WebGPU / TSL).
 * Spin ‖ +Y; disk in XZ (y = 0). a★ = 0 → Schwarzschild.
 */
export function createGeodesicTracer(): GeodesicTracer {
  const uMass = uniform(1)
  const uSpinStar = uniform(0)
  const uCamDistM = uniform(30)
  const uInclination = uniform(1.25)
  const uAzimuth = uniform(0)
  const uFov = uniform(0.65)
  const uRoutM = uniform(18)
  const STEPS = 900

  const colorNode = Fn(() => {
    const M = uMass
    const aStar = uSpinStar
    const a = aStar.mul(M)
    const rs = M.mul(2)

    const disc = max(M.mul(M).sub(a.mul(a)), float(0))
    const rPlus = M.add(sqrt(disc))
    const rCapture = rPlus.mul(1.02)

    // Prograde ISCO (Bardeen)
    const a2 = aStar.mul(aStar)
    const oneMa2 = max(float(1).sub(a2), float(1e-6))
    const cbrt1m = pow(oneMa2, float(1 / 3))
    const cbrt1p = pow(max(float(1).add(aStar), float(1e-6)), float(1 / 3))
    const cbrt1n = pow(max(float(1).sub(aStar), float(1e-6)), float(1 / 3))
    const Z1 = float(1).add(cbrt1m.mul(cbrt1p.add(cbrt1n)))
    const Z2 = sqrt(a2.mul(3).add(Z1.mul(Z1)))
    const sgn = aStar.lessThan(0).select(float(-1), float(1))
    const iscoRoot = sqrt(
      max(float(3).sub(Z1).mul(float(3).add(Z1).add(Z2.mul(2))), float(0)),
    )
    const rin = max(
      M.mul(float(3).add(Z2).sub(sgn.mul(iscoRoot))),
      rPlus.mul(1.15),
    )
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

      // --- a1 = kerrAccel(pos, vel) ---
      const r1 = max(r, float(1e-6))
      const L1 = cross(pos, vel)
      const L12 = dot(L1, L1)
      const r13 = r1.mul(r1).mul(r1)
      const r15 = r13.mul(r1).mul(r1)
      const coup1 = a.mul(L1.y).div(r13.add(a.mul(a).mul(r1)).add(1e-12))
      const str1 = float(-1.5)
        .mul(rs)
        .mul(L12)
        .div(r15)
        .mul(float(1).sub(coup1.mul(1.35)))
      const Om1 = a.mul(M).mul(2).div(r13.add(a.mul(a).mul(r1)).add(1e-12))
      const a1 = pos.mul(str1).add(vec3(Om1.mul(2).mul(vel.z), float(0), Om1.mul(-2).mul(vel.x)))

      const pm = pos.add(vel.mul(ds.mul(0.5)))
      const vm = vel.add(a1.mul(ds.mul(0.5)))

      // --- a2 = kerrAccel(pm, vm) ---
      const r2 = max(pm.length(), float(1e-6))
      const L2 = cross(pm, vm)
      const L22 = dot(L2, L2)
      const r23 = r2.mul(r2).mul(r2)
      const r25 = r23.mul(r2).mul(r2)
      const coup2 = a.mul(L2.y).div(r23.add(a.mul(a).mul(r2)).add(1e-12))
      const str2 = float(-1.5)
        .mul(rs)
        .mul(L22)
        .div(r25)
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
            const g = max(float(1).sub(rs.div(max(rho, float(1e-5)))), float(1e-4)).sqrt()

            // Prograde orbital dir about +Y: (−z, 0, x)
            const tdir = vec3(hz.mul(-1), float(0), hx).normalize()
            const vK = sqrt(M.div(max(rho, float(1e-5))))
            const view = vel.normalize()
            const mu = dot(tdir, view)
            const beta = min(vK, float(0.55))
            const doppler = float(1).div(max(float(1).sub(beta.mul(mu)), float(0.25)))
            const beam = doppler.mul(doppler).mul(doppler)

            const temp = float(3.5).div(max(x.sub(rin.div(M)).add(1), float(0.28)))
            const fall = float(1.2).div(x.mul(0.09).add(0.45))
            const bounce = float(1).add(max(hits.sub(1), float(0)).mul(1.25))
            const emit = vec3(
              temp.mul(2.0).mul(g),
              temp.mul(0.55).mul(g).mul(g),
              temp.mul(0.14).mul(g).mul(g),
            )
              .mul(fall)
              .mul(bounce)
              .mul(beam)

            col.addAssign(emit.mul(transm))
            transm.mulAssign(0.42)
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
