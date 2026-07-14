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
  int,
  max,
  min,
  screenSize,
  screenUV,
  sin,
  uniform,
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
 * Full-screen Schwarzschild null-geodesic ray marcher (WebGPU / TSL).
 * Pure-black capture; thin equatorial disk with multi-orbit accumulation.
 */
export function createSchwarzschildTracer(): SchwarzschildTracer {
  const uMass = uniform(1)
  const uCamDistM = uniform(28)
  const uInclination = uniform(1.15)
  const uAzimuth = uniform(0)
  const uFov = uniform(0.62)
  // Disk in units of M (scaled by mass in shader)
  const uDiskInnerM = uniform(6)
  const uDiskOuterM = uniform(16)
  const uMaxSteps = uniform(int(360))
  const uStepBase = uniform(0.06)

  const colorNode = Fn(() => {
    const mass = uMass
    const rs = mass.mul(2)
    const captureR = rs.mul(1.02)
    const camDist = uCamDistM.mul(mass)
    const diskInner = uDiskInnerM.mul(mass)
    const diskOuter = uDiskOuterM.mul(mass)

    // screenUV: (0,0) bottom-left in three.js viewport space for WebGPU
    const ndc = screenUV.mul(2).sub(1)
    const aspect = screenSize.x.div(screenSize.y)
    const uv = vec2(ndc.x.mul(aspect), ndc.y)

    // Spherical camera: θ = inclination from +z, φ = azimuth
    const th = uInclination
    const ph = uAzimuth
    const sth = sin(th)
    const cth = cos(th)
    const sph = sin(ph)
    const cph = cos(ph)
    const camPos = vec3(
      sth.mul(cph).mul(camDist),
      sth.mul(sph).mul(camDist),
      cth.mul(camDist),
    )
    const forward = camPos.negate().normalize()
    const worldUp = vec3(0, 0, 1)
    const rightRaw = cross(forward, worldUp)
    const right = rightRaw
      .length()
      .lessThan(1e-4)
      .select(vec3(1, 0, 0), rightRaw)
      .normalize()
    const up = cross(right, forward).normalize()

    const rd = forward
      .add(right.mul(uv.x.mul(uFov)))
      .add(up.mul(uv.y.mul(uFov)))
      .normalize()

    const pos = camPos.toVar()
    const vel = rd.toVar()
    const col = vec3(0, 0, 0).toVar()
    const transm = float(1).toVar()
    const prevZ = float(0).toVar()
    const done = float(0).toVar()
    const escaped = float(0).toVar()

    Loop({ start: int(0), end: uMaxSteps, type: 'int', condition: '<' }, () => {
      If(done.greaterThan(0.5), () => {
        Break()
      })

      const r = pos.length()

      If(r.lessThanEqual(captureR), () => {
        done.assign(1)
        Break()
      })

      // Escape once far and outgoing
      If(r.greaterThan(camDist.mul(4)).and(dot(pos, vel).greaterThan(0)), () => {
        escaped.assign(1)
        done.assign(1)
        Break()
      })

      const h = uStepBase
        .mul(mass)
        .mul(min(float(1.4), max(float(0.05), r.div(mass.mul(12)))))

      prevZ.assign(pos.z)
      const prevPos = vec3(pos).toVar()

      // RK2 (Heun): a = −1.5 rs |L|² x / r⁵
      const L1 = cross(pos, vel)
      const L2sq1 = dot(L1, L1)
      const rSafe = max(r, float(1e-5))
      const r5 = rSafe.mul(rSafe).mul(rSafe).mul(rSafe).mul(rSafe)
      const a1 = pos.mul(float(-1.5).mul(rs).mul(L2sq1).div(r5))

      const posMid = pos.add(vel.mul(h.mul(0.5)))
      const velMid = vel.add(a1.mul(h.mul(0.5)))
      const rMid = max(posMid.length(), float(1e-5))
      const r5m = rMid.mul(rMid).mul(rMid).mul(rMid).mul(rMid)
      const L2 = cross(posMid, velMid)
      const L2sq2 = dot(L2, L2)
      const a2 = posMid.mul(float(-1.5).mul(rs).mul(L2sq2).div(r5m))

      pos.addAssign(vel.add(velMid).mul(h.mul(0.5)))
      vel.addAssign(a1.add(a2).mul(h.mul(0.5)))

      // Equatorial disk z = 0
      If(prevZ.mul(pos.z).lessThan(0).and(transm.greaterThan(0.02)), () => {
        const denom = prevZ.sub(pos.z)
        const tHit = prevZ.div(denom)
        const hx = prevPos.x.add(pos.x.sub(prevPos.x).mul(tHit))
        const hy = prevPos.y.add(pos.y.sub(prevPos.y).mul(tHit))
        const hitR = hx.mul(hx).add(hy.mul(hy)).sqrt()

        If(hitR.greaterThanEqual(diskInner).and(hitR.lessThanEqual(diskOuter)), () => {
          const g = max(float(1).sub(rs.div(max(hitR, float(1e-5)))), float(0)).sqrt()
          const x = hitR.div(mass)
          // Brighter ring near ISCO, falloff outward
          const fall = float(1).div(x.mul(0.22).add(0.4))
          const hot = float(1).div(max(x.sub(5.2), float(0.4)))
          const emit = vec3(
            hot.mul(2.2).mul(g),
            hot.mul(0.7).mul(g).mul(g),
            hot.mul(0.22).mul(g).mul(g),
          ).mul(fall)

          col.addAssign(emit.mul(transm))
          transm.mulAssign(0.48)
        })
      })
    })

    // Dim starless sky for escaped rays (not a fake fill of the shadow)
    const bg = vec3(0.008, 0.01, 0.018)
    If(escaped.greaterThan(0.5), () => {
      col.addAssign(bg.mul(transm))
    })

    // Reinhard-ish tonemap
    const mapped = col.div(col.add(0.85))
    return vec4(mapped, 1)
  })()

  const material = new THREE.MeshBasicNodeMaterial()
  material.colorNode = colorNode
  material.depthWrite = false
  material.depthTest = false

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  mesh.frustumCulled = false

  return {
    material,
    mesh,
    setMass: (mass: number) => {
      uMass.value = mass
    },
    setCameraDistanceM: (distanceM: number) => {
      uCamDistM.value = distanceM
    },
    setInclination: (radians: number) => {
      uInclination.value = radians
    },
    setAzimuth: (radians: number) => {
      uAzimuth.value = radians
    },
    setFov: (fov: number) => {
      uFov.value = fov
    },
  }
}
