/**
 * Relativistic Doppler + gravitational redshift for thin accretion-disk emission.
 * Geometric units G = c = 1. Pure physics (no Three.js).
 *
 * Backward raytracing convention: at a disk hit, `rayDir` is the null geodesic
 * tangent marching from the camera into the past. Photons that reach the camera
 * were emitted toward the observer along nObs = −normalize(rayDir).
 */

import { type Vec3 } from './vec3'

/** Newtonian Kepler speed √(M/ρ), clamped. */
export function keplerOrbitalSpeed(mass: number, rho: number): number {
  const r = Math.max(rho, 1e-8)
  return Math.min(Math.sqrt(mass / r), 0.95)
}

/**
 * Kerr equatorial circular angular velocity (prograde / retrograde).
 * Ω = ±√M / (r^{3/2} ± a √M)  with a = spin length.
 * Returns orbital linear speed ≈ |Ω| · ρ for the cylindrical radius.
 */
export function kerrOrbitalSpeed(
  mass: number,
  rho: number,
  spinLength: number,
  prograde = true,
): number {
  const r = Math.max(rho, 1e-8)
  const sqrtM = Math.sqrt(Math.max(mass, 1e-12))
  const r32 = Math.pow(r, 1.5)
  const a = spinLength
  const denom = prograde ? r32 + a * sqrtM : r32 - a * sqrtM
  if (Math.abs(denom) < 1e-12) return 0.95
  const Omega = (prograde ? 1 : -1) * sqrtM / denom
  return Math.min(Math.abs(Omega) * r, 0.95)
}

/**
 * Prograde azimuthal unit direction about +Y for a hit in the XZ plane:
 * ê_φ = (−z, 0, x) / ρ.
 */
export function progradeDirAboutY(hx: number, hz: number): Vec3 {
  const rho = Math.hypot(hx, hz)
  if (rho < 1e-12) return { x: 0, y: 0, z: 0 }
  return { x: -hz / rho, y: 0, z: hx / rho }
}

/**
 * Special-relativistic Doppler factor for a source with speed β = |v|/c
 * and μ = v̂ · n̂ (n̂ = direction of photon from emitter toward observer).
 *
 * D = 1 / (γ (1 − β μ))
 * D > 1 → blueshift (approaching); D < 1 → redshift (receding).
 */
export function specialRelDoppler(beta: number, mu: number): number {
  const b = Math.min(Math.max(beta, 0), 0.999)
  const m = Math.min(Math.max(mu, -1), 1)
  const gamma = 1 / Math.sqrt(1 - b * b)
  const denom = Math.max(1 - b * m, 1e-4)
  return 1 / (gamma * denom)
}

/**
 * Static gravitational redshift for RN: g = √(1 − 2M/r + Q²/r²).
 * Q=0 → Schwarzschild √(1 − 2M/r).
 */
export function gravitationalRedshift(
  mass: number,
  r: number,
  charge = 0,
): number {
  const rs = 2 * mass
  const rr = Math.max(r, rs * 1.001)
  const x = 1 - rs / rr + (charge * charge) / (rr * rr)
  return Math.sqrt(Math.max(x, 1e-8))
}

/**
 * Observer-frame frequency factor for an orbiting disk patch.
 * ≈ g · D  (separates gravity and special-relativistic Doppler).
 *
 * @param rayDir — geodesic tangent at hit (camera → past)
 * @param hx,hz — hit coordinates in the disk plane (y = 0)
 */
export function diskFrequencyFactor(options: {
  mass: number
  rho: number
  hx: number
  hz: number
  rayDir: Vec3
  spinLength?: number
  prograde?: boolean
}): { D: number; g: number; factor: number; mu: number; beta: number } {
  const {
    mass,
    rho,
    hx,
    hz,
    rayDir,
    spinLength = 0,
    prograde = true,
  } = options

  const g = gravitationalRedshift(mass, rho)
  const beta =
    Math.abs(spinLength) > 1e-12
      ? kerrOrbitalSpeed(mass, rho, spinLength, prograde)
      : keplerOrbitalSpeed(mass, rho)

  const tdir = progradeDirAboutY(hx, hz)
  // Photon direction from emitter toward observer
  const len = Math.hypot(rayDir.x, rayDir.y, rayDir.z)
  const nObs =
    len < 1e-12
      ? { x: 0, y: 0, z: 0 }
      : { x: -rayDir.x / len, y: -rayDir.y / len, z: -rayDir.z / len }
  const mu = tdir.x * nObs.x + tdir.y * nObs.y + tdir.z * nObs.z
  const D = specialRelDoppler(beta, mu)
  return { D, g, factor: g * D, mu, beta }
}

/** Bolometric intensity scaling for beamed emission (I ∝ D³). */
export function bolometricBeaming(D: number): number {
  const d = Math.max(D, 1e-4)
  return d * d * d
}

/**
 * Rough blackbody-ish RGB from a temperature scale T > 0.
 * Higher T → bluer/whiter; lower → redder.
 */
export function temperatureToRgb(T: number): { r: number; g: number; b: number } {
  // Map T so that T~1 is warm orange, T~3 is white-hot
  const t = Math.max(T, 0.05)
  const r = Math.min(1.5, 0.6 + t * 0.9)
  const g = Math.min(1.2, 0.2 + t * 0.55)
  const b = Math.min(1.0, 0.05 + t * t * 0.15)
  return { r, g, b }
}

/**
 * Observed disk patch color: rest temperature scaled by frequency factor,
 * intensity scaled by beaming and opacity weight.
 */
export function diskObservedEmit(options: {
  mass: number
  rho: number
  hx: number
  hz: number
  rayDir: Vec3
  spinLength?: number
  /** Rest-frame temperature scale (dimensionless) */
  tempRest: number
}): { r: number; g: number; b: number; factor: number; D: number } {
  const { factor, D } = diskFrequencyFactor(options)
  // Observed temperature ∝ frequency
  const Tobs = options.tempRest * factor
  const rgb = temperatureToRgb(Tobs)
  const beam = bolometricBeaming(D)
  // Extra: g already in factor for spectrum; still multiply mild g for energy
  return {
    r: rgb.r * beam,
    g: rgb.g * beam,
    b: rgb.b * beam,
    factor,
    D,
  }
}
