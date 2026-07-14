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
  float,
  fract,
  int,
  max,
  min,
  screenSize,
  sin,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

export type SchwarzschildTracer = {
  material: THREE.MeshBasicNodeMaterial
  mesh: THREE.Mesh
  setMass: (mass: number) => void
  setCameraDistanceM: (distanceM: number) => void
  setInclination: (radians: number) => void
  setAzimuth: (radians: number) => void
  setFov: (fov: number) => void
}

/**
 * Schwarzschild GRRT (validated against CPU reference).
 *
 * Critical: step size must NOT shrink below ~0.2M or rays stall on the
 * photon sphere and never capture/escape — that produced the solid blob /
 * empty-frame failures.
 *
 * Disk in XZ (y = 0). Camera on sphere; face-on = +Y.
 */
export function createSchwarzschildTracer(): SchwarzschildTracer {
  const uMass = uniform(1)
  const uCamDistM = uniform(30)
  const uInclination = uniform(1.25)
  const uAzimuth = uniform(0)
  const uFov = uniform(0.65)
  const uRinM = uniform(6)
  const uRoutM = uniform(18)
  // Fixed iteration count — dynamic uniform ends are flaky on some drivers
  const STEPS = 900

  const colorNode = Fn(() => {
    const M = uMass
    const rs = M.mul(2)
    const rCapture = rs.mul(1.01)
    const camD = uCamDistM.mul(M)
    const rin = uRinM.mul(M)
    const rout = uRoutM.mul(M)

    const tex = uv()
    const aspect = screenSize.x.div(max(screenSize.y, float(1)))
    const ndc = vec2(tex.x.mul(2).sub(1).mul(aspect), tex.y.mul(2).sub(1))

    // Face-on = +Y pole; θ from +Y toward equator
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
    const right = rightRaw.length().lessThan(1e-4).select(vec3(1, 0, 0), rightRaw.normalize())
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

      // Escape once clearly outbound and far
      If(r.greaterThan(camD.mul(3)).and(dot(pos, vel).greaterThan(0)), () => {
        escaped.assign(1)
        done.assign(1)
        Break()
      })

      // Adaptive step — floor at 0.2 so photon-sphere skims still progress
      const adapt = min(float(1.5), max(float(0.2), r.div(M.mul(12))))
      const ds = float(0.1).mul(M).mul(adapt)

      prevY.assign(pos.y)
      const p0x = pos.x.toVar()
      const p0y = pos.y.toVar()
      const p0z = pos.z.toVar()

      // RK2 Heun
      const h1 = cross(pos, vel)
      const h1sq = dot(h1, h1)
      const r1 = max(r, float(1e-6))
      const r15 = r1.mul(r1).mul(r1).mul(r1).mul(r1)
      const a1 = pos.mul(float(-1.5).mul(rs).mul(h1sq).div(r15))

      const pm = pos.add(vel.mul(ds.mul(0.5)))
      const vm = vel.add(a1.mul(ds.mul(0.5)))
      const rm = max(pm.length(), float(1e-6))
      const rm5 = rm.mul(rm).mul(rm).mul(rm).mul(rm)
      const h2 = cross(pm, vm)
      const h2sq = dot(h2, h2)
      const a2 = pm.mul(float(-1.5).mul(rs).mul(h2sq).div(rm5))

      pos.addAssign(vel.add(vm).mul(ds.mul(0.5)))
      vel.addAssign(a1.add(a2).mul(ds.mul(0.5)))

      // Disk: y = 0 plane crossing
      If(prevY.mul(pos.y).lessThan(0).and(transm.greaterThan(0.02)).and(hits.lessThan(8)), () => {
        const t = prevY.div(prevY.sub(pos.y))
        const hx = p0x.add(pos.x.sub(p0x).mul(t))
        const hz = p0z.add(pos.z.sub(p0z).mul(t))
        const rho = hx.mul(hx).add(hz.mul(hz)).sqrt()

        If(rho.greaterThanEqual(rin).and(rho.lessThanEqual(rout)), () => {
          hits.addAssign(1)
          const x = rho.div(M)
          const g = max(float(1).sub(rs.div(max(rho, float(1e-5)))), float(1e-4)).sqrt()
          const temp = float(3.5).div(max(x.sub(5.0), float(0.28)))
          const fall = float(1.2).div(x.mul(0.09).add(0.45))
          const bounce = float(1).add(max(hits.sub(1), float(0)).mul(1.25))
          const emit = vec3(
            temp.mul(2.0).mul(g),
            temp.mul(0.6).mul(g).mul(g),
            temp.mul(0.16).mul(g).mul(g),
          )
            .mul(fall)
            .mul(bounce)

          col.addAssign(emit.mul(transm))
          transm.mulAssign(0.42)
        })
      })
    })

    // Unfinished photon-sphere skims ≈ capture
    If(done.lessThan(0.5).and(minR.lessThan(M.mul(3.2))), () => {
      captured.assign(1)
    })
    If(done.lessThan(0.5).and(minR.greaterThanEqual(M.mul(3.2))), () => {
      escaped.assign(1)
    })

    // Captured → pure black (keep any prior disk light that hit before plunge)
    // Escaped sky
    If(escaped.greaterThan(0.5), () => {
      const d = vel.normalize()
      const sky = vec3(0.012, 0.014, 0.025)
      const h = fract(sin(d.x.mul(12.9898).add(d.y.mul(78.233)).add(d.z.mul(37.719))).mul(43758.5453))
      const star = h.greaterThan(0.9968).select(float(0.9), float(0))
      col.addAssign(sky.add(vec3(star, star, star.mul(0.9))).mul(transm))
    })

    // If captured with no disk hits, force pure black
    If(captured.greaterThan(0.5).and(hits.lessThan(0.5)), () => {
      col.assign(vec3(0, 0, 0))
    })

    const mapped = col.div(col.add(1))
    return vec4(mapped, 1)
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
