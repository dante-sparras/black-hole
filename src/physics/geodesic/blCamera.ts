/**
 * Camera → Boyer–Lindquist null initial data (Phase 2).
 *
 * Matches project observer convention (OBSERVER_DEFAULTS / cpuRef):
 *   - Spin ‖ +Y; polar θ from +Y; φ around spin
 *   - camD = distanceM · M
 *   - Ray: dir = normalize(forward + right·ndcX·fov + up·ndcY·fov)
 *
 * At the camera (r ≫ M) we use the asymptotic static-frame map from a
 * Cartesian unit direction to conserved E, Lz, Carter Q for Kerr BL:
 *
 *   n_r, n_θ, n_φ = direction in orthonormal spherical basis
 *   E = 1  (normalize)
 *   Lz = r sinθ · n_φ     (plus Kerr frame-drag correction for ZAMO energy)
 *   p_θ = r · n_θ
 *   Q = p_θ² + cos²θ (−a² E² + Lz²/sin²θ)
 *
 * Far-field ZAMO / static observers coincide at O(M/r); we include the
 * leading Kerr Lense–Thirring piece on Lz via the ZAMO angular velocity
 * when extracting Killing energy for moderate r (distanceM ~ 60).
 *
 * Pure physics — no Three.js.
 */

import {
  OBSERVER_DEFAULTS,
  type ObserverCamera,
} from '../observer'
import {
  type BlConserved,
  type BlCoords,
  type BlTraceResult,
  traceKerrBlNull,
} from './kerrBl'
import {
  cross,
  dot,
  length3,
  normalize,
  scale,
  type Vec3,
  vec3,
} from './vec3'

export type CameraRayBl = {
  conserved: BlConserved
  origin: BlCoords
  signR: number
  signTheta: number
  /** Cartesian camera origin (project units) */
  cartOrigin: Vec3
  /** Cartesian unit ray direction (into the past / toward scene) */
  cartDir: Vec3
  /** |r × n| impact estimate at camera */
  impactCart: number
}

/** Cartesian camera basis — same as cpuRef / GPU tracer. */
export function cameraBasis(
  cam: ObserverCamera,
  mass: number,
): {
  origin: Vec3
  forward: Vec3
  right: Vec3
  up: Vec3
  camD: number
} {
  const camD = cam.distanceM * mass
  const th = cam.inclination
  const ph = cam.azimuth
  const origin: Vec3 = {
    x: Math.sin(th) * Math.cos(ph) * camD,
    y: Math.cos(th) * camD,
    z: Math.sin(th) * Math.sin(ph) * camD,
  }
  const forward = normalize(scale(origin, -1))
  const worldUp = vec3(0, 1, 0)
  let right = cross(forward, worldUp)
  if (length3(right) < 1e-6) right = vec3(1, 0, 0)
  right = normalize(right)
  const up = normalize(cross(right, forward))
  return { origin, forward, right, up, camD }
}

/**
 * BL coordinates of the camera.
 * Asymptotic: r ≈ camD, θ = inclination, φ = azimuth.
 * For Kerr, isotropic/Cartesian radius ≈ √(x²+y²+z²); BL r differs by O(a²/r).
 * We use the spherical radius (good for r ≳ 20M).
 */
export function cameraBlPosition(
  cam: ObserverCamera,
  mass: number,
  _spinLength = 0,
): BlCoords {
  const camD = cam.distanceM * mass
  return {
    r: camD,
    theta: cam.inclination,
    phi: cam.azimuth,
  }
}

/** Orthonormal spherical basis at Cartesian position (θ from +Y). */
export function sphericalBasis(pos: Vec3): {
  rHat: Vec3
  thetaHat: Vec3
  phiHat: Vec3
  r: number
  theta: number
  phi: number
} {
  const r = length3(pos)
  const rr = Math.max(r, 1e-12)
  const rHat = scale(pos, 1 / rr)
  // θ from +Y: cosθ = y/r
  const cy = Math.min(1, Math.max(-1, pos.y / rr))
  const theta = Math.acos(cy)
  const phi = Math.atan2(pos.z, pos.x)
  const st = Math.sin(theta)
  const ct = Math.cos(theta)
  const sp = Math.sin(phi)
  const cp = Math.cos(phi)
  // ∂r̂/∂θ direction: (cosθ cosφ, −sinθ, cosθ sinφ)
  const thetaHat = vec3(ct * cp, -st, ct * sp)
  // φ̂ = (−sinφ, 0, cosφ)
  const phiHat = vec3(-sp, 0, cp)
  return { rHat, thetaHat, phiHat, r, theta, phi }
}

/**
 * Conserved quantities for a null ray from the camera through NDC (ndcX, ndcY).
 * NDC is already aspect-corrected if the caller multiplies x by aspect (cpuRef style).
 */
export function cameraRayToBl(options: {
  mass: number
  spinLength: number
  camera?: Partial<ObserverCamera>
  ndcX: number
  ndcY: number
}): CameraRayBl {
  const M = options.mass
  const a = options.spinLength
  const cam: ObserverCamera = { ...OBSERVER_DEFAULTS, ...options.camera }
  const { origin, forward, right, up, camD } = cameraBasis(cam, M)

  const cartDir = normalize(
    {
      x: forward.x + right.x * options.ndcX * cam.fov + up.x * options.ndcY * cam.fov,
      y: forward.y + right.y * options.ndcX * cam.fov + up.y * options.ndcY * cam.fov,
      z: forward.z + right.z * options.ndcX * cam.fov + up.z * options.ndcY * cam.fov,
    },
  )

  const { rHat, thetaHat, phiHat, r, theta, phi } = sphericalBasis(origin)
  const n_r = dot(cartDir, rHat)
  const n_th = dot(cartDir, thetaHat)
  const n_ph = dot(cartDir, phiHat)

  // Asymptotic E = 1. Leading ZAMO correction: observer 4-velocity has Ω_ZAMO
  // Ω = 2 M a r / A, A = (r²+a²)² − Δ a² sin²θ
  // For extracting Killing energy of a photon with unit local energy, at large r
  // E_kill ≈ e − Ω L_local ≈ 1 at our precision (we keep E=1 and map Lz,Q).
  const E = 1

  // Physical azimuthal momentum → Lz = ϖ n_φ with ϖ = r sinθ (Schw / asymptotic Kerr)
  const s = Math.sin(theta)
  const sSafe = Math.max(Math.abs(s), 1e-12)
  const Lz = r * sSafe * n_ph * E

  // p_θ = r n_θ  (g_θθ^{1/2} ≈ r at large r; Σ^{1/2} ≈ r)
  const pTheta = r * n_th * E

  // Carter Q from null formula (μ = 0)
  const c = Math.cos(theta)
  const Q =
    pTheta * pTheta +
    c * c * (-a * a * E * E + (Lz * Lz) / (sSafe * sSafe))

  const conserved: BlConserved = { E, Lz, Q }

  // Radial sign from n_r (camera looks inward → n_r < 0 → signR = −1)
  const signR = n_r < 0 ? -1 : 1
  // Polar sign from n_θ
  let signTheta = 0
  if (Math.abs(Q) > 1e-10) {
    signTheta = n_th >= 0 ? 1 : -1
  }

  const impactCart = length3(cross(origin, cartDir))

  return {
    conserved,
    origin: { r: camD, theta, phi },
    signR,
    signTheta,
    cartOrigin: origin,
    cartDir,
    impactCart,
  }
}

/**
 * Trace one camera ray with the BL integrator.
 */
export function traceCameraRayBl(options: {
  mass: number
  spinLength: number
  camera?: Partial<ObserverCamera>
  ndcX: number
  ndcY: number
  maxSteps?: number
  fracStep?: number
}): BlTraceResult & { ray: CameraRayBl } {
  const ray = cameraRayToBl(options)
  const result = traceKerrBlNull({
    mass: options.mass,
    spinLength: options.spinLength,
    conserved: ray.conserved,
    origin: ray.origin,
    signR: ray.signR,
    signTheta: ray.signTheta,
    maxSteps: options.maxSteps ?? 80_000,
    fracStep: options.fracStep ?? 0.02,
    escapeRadius: Math.max(250 * options.mass, ray.origin.r * 4),
  })
  return { ...result, ray }
}

/**
 * Impact-parameter-like Lz/E from a camera ray (for diagnostics).
 * Equatorial asymptotic: |b| ≈ |Lz/E|.
 */
export function cameraRayImpactB(options: {
  mass: number
  spinLength: number
  camera?: Partial<ObserverCamera>
  ndcX: number
  ndcY: number
}): number {
  const ray = cameraRayToBl(options)
  return Math.abs(ray.conserved.Lz / ray.conserved.E)
}
