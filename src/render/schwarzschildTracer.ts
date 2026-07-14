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
  positionLocal,
  screenSize,
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
 *
 * - Rays from fullscreen-quad local XY as NDC (center → BH)
 * - Finite-thickness equatorial disk (miss-resistant)
 * - Adaptive steps near the photon sphere
 * - Pure-black horizon capture
 */
export function createSchwarzschildTracer(): SchwarzschildTracer {
  const uMass = uniform(1)
  const uCamDistM = uniform(28)
  const uInclination = uniform(1.2) // ~69°
  const uAzimuth = uniform(0)
  const uFov = uniform(0.7)
  const uDiskInnerM = uniform(6)
  const uDiskOuterM = uniform(20)
  const uDiskHalfHM = uniform(0.22) // half-thickness in units of M
  const uMaxSteps = uniform(int(520))
  const uStepBase = uniform(0.045)

  const colorNode = Fn(() => {
    const mass = uMass
    const rs = mass.mul(2)
    const captureR = rs.mul(1.005)
    const camDist = uCamDistM.mul(mass)
    const diskInner = uDiskInnerM.mul(mass)
    const diskOuter = uDiskOuterM.mul(mass)
    const diskHalfH = uDiskHalfHM.mul(mass)

    const aspect = screenSize.x.div(max(screenSize.y, float(1)))
    // PlaneGeometry(2,2) local XY = NDC. Flip Y so +inclination reads "disk up" naturally.
    const uv = vec2(positionLocal.x.mul(aspect), positionLocal.y.negate())

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
    const rightLen = rightRaw.length()
    const right = rightLen
      .lessThan(1e-4)
      .select(vec3(1, 0, 0), rightRaw.div(max(rightLen, float(1e-6))))
    const up = cross(right, forward).normalize()

    const rd = forward
      .add(right.mul(uv.x.mul(uFov)))
      .add(up.mul(uv.y.mul(uFov)))
      .normalize()

    const pos = camPos.toVar()
    const vel = rd.toVar()
    const col = vec3(0, 0, 0).toVar()
    const transm = float(1).toVar()
    const done = float(0).toVar()
    const escaped = float(0).toVar()
    // Track optical depth through disk to avoid infinite glow while allowing multi-orbit
    const diskTau = float(0).toVar()

    Loop({ start: int(0), end: uMaxSteps, type: 'int', condition: '<' }, () => {
      If(done.greaterThan(0.5), () => {
        Break()
      })

      const r = pos.length()

      If(r.lessThanEqual(captureR), () => {
        done.assign(1)
        Break()
      })

      If(r.greaterThan(camDist.mul(6)).and(dot(pos, vel).greaterThan(0)), () => {
        escaped.assign(1)
        done.assign(1)
        Break()
      })

      // Adaptive step: fine near hole and near the equatorial plane
      const nearHole = min(float(1.2), max(float(0.035), r.div(mass.mul(9))))
      const nearPlane = min(float(1), max(float(0.08), abs(pos.z).div(mass.mul(1.2))))
      const h = uStepBase.mul(mass).mul(nearHole).mul(nearPlane)

      // --- Finite-thickness disk sample (before step) ---
      const rho = pos.x.mul(pos.x).add(pos.y.mul(pos.y)).sqrt()
      const inDisk = abs(pos.z)
        .lessThanEqual(diskHalfH)
        .and(rho.greaterThanEqual(diskInner))
        .and(rho.lessThanEqual(diskOuter))
        .and(transm.greaterThan(0.02))
        .and(diskTau.lessThan(4))

      If(inDisk, () => {
        const g = max(float(1).sub(rs.div(max(rho, float(1e-5)))), float(1e-4)).sqrt()
        const x = rho.div(mass)
        // Temperature-ish: hot near ISCO
        const hot = float(2.4).div(max(x.sub(5.0), float(0.35)))
        const fall = float(1).div(x.mul(0.12).add(0.45))
        // Vertical gaussian so midplane is brightest
        const vert = max(
          float(1).sub(abs(pos.z).div(max(diskHalfH, float(1e-5))).mul(abs(pos.z).div(max(diskHalfH, float(1e-5))))),
          float(0),
        )
        // Path length through this step (approx)
        const ds = h.mul(0.85)
        const kappa = float(1.8).div(mass) // opacity scale
        const dTau = kappa.mul(ds).mul(vert.add(0.15))
        const emit = vec3(
          hot.mul(2.1).mul(g),
          hot.mul(0.65).mul(g).mul(g),
          hot.mul(0.18).mul(g).mul(g),
        )
          .mul(fall)
          .mul(vert.add(0.2))

        // Emission * transmittance * (1 - e^{-dτ}) ≈ emit * transm * dτ for small dτ
        const weight = transm.mul(min(dTau, float(0.85)))
        col.addAssign(emit.mul(weight))
        transm.mulAssign(max(float(1).sub(dTau.mul(0.55)), float(0.15)))
        diskTau.addAssign(dTau)
      })

      // RK2 Heun null geodesic step: a = −1.5 rs |L|² x / r⁵
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
    })

    // Escaped: dim sky + sparse stars
    If(escaped.greaterThan(0.5), () => {
      const sky = vec3(0.006, 0.007, 0.014)
      const s = vel.normalize()
      const starHash = fract(
        sin(s.x.mul(127.1).add(s.y.mul(311.7)).add(s.z.mul(74.7))).mul(43758.55),
      )
      const star = starHash.greaterThan(0.9965).select(float(0.7), float(0))
      col.addAssign(sky.add(vec3(star, star, star.mul(0.85))).mul(transm))
    })

    // Captured rays keep col≈0 → pure black after tonemap
    const mapped = col.div(col.add(0.9))
    return vec4(mapped, 1)
  })()

  const material = new THREE.MeshBasicNodeMaterial()
  material.colorNode = colorNode
  material.depthWrite = false
  material.depthTest = false
  material.side = THREE.DoubleSide

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  mesh.frustumCulled = false
  mesh.position.set(0, 0, 0)

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
