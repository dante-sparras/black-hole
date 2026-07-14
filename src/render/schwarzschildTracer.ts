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
 * Ray NDC comes from the fullscreen quad's local XY (PlaneGeometry 2×2 → [-1,1]),
 * not screenUV — avoids ortho/viewport mismatches that offset the shadow.
 */
export function createSchwarzschildTracer(): SchwarzschildTracer {
  const uMass = uniform(1)
  const uCamDistM = uniform(40)
  const uInclination = uniform(1.35) // ~77° from face-on
  const uAzimuth = uniform(0)
  const uFov = uniform(0.5)
  const uDiskInnerM = uniform(6)
  const uDiskOuterM = uniform(18)
  const uMaxSteps = uniform(int(400))
  const uStepBase = uniform(0.05)

  const colorNode = Fn(() => {
    const mass = uMass
    const rs = mass.mul(2)
    const captureR = rs.mul(1.01)
    const camDist = uCamDistM.mul(mass)
    const diskInner = uDiskInnerM.mul(mass)
    const diskOuter = uDiskOuterM.mul(mass)

    // Fullscreen quad local XY is NDC [-1,1]. Center pixel → BH.
    const aspect = screenSize.x.div(max(screenSize.y, float(1)))
    const uv = vec2(positionLocal.x.mul(aspect), positionLocal.y)

    // Spherical camera about origin: θ from +z, φ around z. Disk = xy plane.
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

    // Look at origin
    const forward = camPos.negate().normalize()
    // Build ONB with world up = +z (disk normal)
    const worldUp = vec3(0, 0, 1)
    const rightRaw = cross(forward, worldUp)
    const rightLen = rightRaw.length()
    const right = rightLen.lessThan(1e-4).select(vec3(1, 0, 0), rightRaw.div(max(rightLen, float(1e-6))))
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
    const diskHits = float(0).toVar()

    Loop({ start: int(0), end: uMaxSteps, type: 'int', condition: '<' }, () => {
      If(done.greaterThan(0.5), () => {
        Break()
      })

      const r = pos.length()

      // Event horizon capture → pure black contribution (no fill)
      If(r.lessThanEqual(captureR), () => {
        done.assign(1)
        Break()
      })

      // Escaped to infinity
      If(r.greaterThan(camDist.mul(5)).and(dot(pos, vel).greaterThan(0)), () => {
        escaped.assign(1)
        done.assign(1)
        Break()
      })

      // Smaller steps near the hole (photon sphere ~3M)
      const h = uStepBase
        .mul(mass)
        .mul(min(float(1.2), max(float(0.04), r.div(mass.mul(10)))))

      prevZ.assign(pos.z)
      const prevPos = vec3(pos.x, pos.y, pos.z).toVar()

      // RK2 Heun: a = −1.5 rs |L|² x / r⁵  (null geodesic spatial form)
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

      // Thin equatorial disk z=0 (optically thin, multi-orbit = photon-ring path)
      If(prevZ.mul(pos.z).lessThan(0).and(transm.greaterThan(0.015)), () => {
        const denom = prevZ.sub(pos.z)
        const tHit = prevZ.div(denom)
        const hx = prevPos.x.add(pos.x.sub(prevPos.x).mul(tHit))
        const hy = prevPos.y.add(pos.y.sub(prevPos.y).mul(tHit))
        const hitR = hx.mul(hx).add(hy.mul(hy)).sqrt()

        If(hitR.greaterThanEqual(diskInner).and(hitR.lessThanEqual(diskOuter)), () => {
          diskHits.addAssign(1)
          const g = max(float(1).sub(rs.div(max(hitR, float(1e-5)))), float(1e-4)).sqrt()
          const x = hitR.div(mass)
          // Peak near ISCO, fall with r; slight ring structure
          const radial = float(1).div(x.mul(0.18).add(0.55))
          const ring = float(0.65).add(
            float(0.35).mul(sin(x.mul(2.2)).mul(0.5).add(0.5)),
          )
          // Secondary images (photon ring) stay brighter longer
          const orbitBoost = float(1).add(max(diskHits.sub(1), float(0)).mul(0.85))
          const hot = float(1.6).div(max(x.sub(5.0), float(0.45)))
          const emit = vec3(
            hot.mul(1.9).mul(g),
            hot.mul(0.55).mul(g).mul(g),
            hot.mul(0.16).mul(g).mul(g),
          )
            .mul(radial)
            .mul(ring)
            .mul(orbitBoost)

          col.addAssign(emit.mul(transm))
          // Optically thin: later orbits still contribute
          transm.mulAssign(0.42)
        })
      })
    })

    // Escaped rays: very dark sky + faint procedural stars (not shadow fill)
    If(escaped.greaterThan(0.5), () => {
      const sky = vec3(0.004, 0.005, 0.01)
      // Cheap star field from ray direction
      const s = vel.normalize()
      const starHash = fract(sin(s.x.mul(127.1).add(s.y.mul(311.7)).add(s.z.mul(74.7))).mul(43758.55))
      const star = starHash.greaterThan(0.997).select(float(0.55), float(0))
      col.addAssign(sky.add(vec3(star, star, star.mul(0.9))).mul(transm))
    })

    // Soft tonemap — keep pure black for captured (col≈0, transm irrelevant)
    const mapped = col.div(col.add(1.1))
    return vec4(mapped, 1)
  })()

  const material = new THREE.MeshBasicNodeMaterial()
  material.colorNode = colorNode
  material.depthWrite = false
  material.depthTest = false
  material.side = THREE.DoubleSide

  // Fullscreen NDC quad. Paired with OrthographicCamera at z=1 looking at origin.
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
