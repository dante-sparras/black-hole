/**
 * Relativistic Doppler + gravitational redshift for thin accretion-disk emission.
 * Geometric units G = c = 1. Pure physics (no Three.js).
 *
 * Backward raytracing convention: at a disk hit, `rayDir` is the null geodesic
 * tangent marching from the camera into the past. Photons that reach the camera
 * were emitted toward the observer along nObs = −normalize(rayDir).
 *
 * Orbiting emitters use circular-orbit 4-velocity (u^t, Ω) from the equatorial
 * Kerr/RN metric so face-on redshift is √(1−3M/r) (Schw), not the static √(1−2M/r).
 *
 * Disk *color* on GPU uses blackbodyRgb (true Kelvin). Prefer that over any
 * film palette for production emission.
 */

import { type Vec3 } from './vec3'

/** Newtonian Kepler speed √(M/ρ), clamped. */
export function keplerOrbitalSpeed(mass: number, rho: number): number {
  const r = Math.max(rho, 1e-8)
  return Math.min(Math.sqrt(mass / r), 0.95)
}

/**
 * Kerr equatorial circular angular velocity (prograde / retrograde).
 * Ω = ±√M / (r^{3/2} ± a √M)
 * Note: for charged (RN/KN) disks we still use Kerr Ω — full charged
 * circular orbits are more involved; kinematics labeled Kerr-form.
 */
export function circularOmega(
  mass: number,
  r: number,
  spinLength: number,
  prograde = true,
): number {
  const rr = Math.max(r, 1e-8)
  const sqrtM = Math.sqrt(Math.max(mass, 1e-12))
  const r32 = Math.pow(rr, 1.5)
  const a = spinLength
  const denom = prograde ? r32 + a * sqrtM : r32 - a * sqrtM
  if (Math.abs(denom) < 1e-12) return 0
  return ((prograde ? 1 : -1) * sqrtM) / denom
}

/**
 * Kerr/RN equatorial metric components (θ = π/2, Σ = r²).
 * KN: g_φφ includes −a²Q²/r² term from Δ = r²−2Mr+a²+Q².
 * RN: a = 0, g_tt = −(1 − 2M/r + Q²/r²).
 */
export function equatorialMetric(
  mass: number,
  r: number,
  spinLength: number,
  charge = 0,
): { g_tt: number; g_tphi: number; g_phiphi: number } {
  const rr = Math.max(r, 1e-8)
  const M = mass
  const a = spinLength
  const Q = charge
  const g_tt = -(1 - (2 * M) / rr + (Q * Q) / (rr * rr))
  const g_tphi = a === 0 ? 0 : (-2 * M * a) / rr
  // [(r²+a²)² − a²Δ]/r² at equator with Δ = r²−2Mr+a²+Q²
  const g_phiphi =
    rr * rr + a * a + (2 * M * a * a) / rr - (a * a * Q * Q) / (rr * rr)
  return { g_tt, g_tphi, g_phiphi }
}

/**
 * Circular-orbit u^t = 1 / √(−g_tt − 2Ω g_tφ − Ω² g_φφ).
 * Schw a=Q=0 → u^t = 1/√(1 − 3M/r).
 */
export function circularU_t(
  mass: number,
  r: number,
  spinLength: number,
  charge = 0,
  prograde = true,
): number {
  const Omega = circularOmega(mass, r, spinLength, prograde)
  const { g_tt, g_tphi, g_phiphi } = equatorialMetric(mass, r, spinLength, charge)
  const X = -g_tt - 2 * Omega * g_tphi - Omega * Omega * g_phiphi
  if (X <= 1e-12) return 1e6
  return 1 / Math.sqrt(X)
}

/**
 * Full orbiting-emitter redshift to infinity:
 *   g = 1 / ( u^t (1 − Ω λ) )
 * with impact-like λ ≈ ρ · μ, μ = ê_φ · n̂_obs (photon toward observer).
 *
 * Face-on (μ=0): g = 1/u^t = √(1−3M/r) in Schwarzschild.
 */
export function orbitingRedshiftFactor(options: {
  mass: number
  r: number
  spinLength?: number
  charge?: number
  /** ê_φ · n̂_obs */
  mu: number
  prograde?: boolean
}): { g: number; u_t: number; Omega: number; lambda: number } {
  const {
    mass,
    r,
    spinLength = 0,
    charge = 0,
    mu,
    prograde = true,
  } = options
  const rr = Math.max(r, 1e-8)
  const Omega = circularOmega(mass, rr, spinLength, prograde)
  const u_t = circularU_t(mass, rr, spinLength, charge, prograde)
  // Conserved λ = L/E ≈ cylindrical radius × direction cosine (equatorial approx)
  const lambda = rr * Math.min(1, Math.max(-1, mu))
  const denom = Math.max(u_t * (1 - Omega * lambda), 1e-4)
  return { g: 1 / denom, u_t, Omega, lambda }
}

/** Kerr equatorial circular linear speed ≈ |Ω| · ρ (clamped). */
export function kerrOrbitalSpeed(
  mass: number,
  rho: number,
  spinLength: number,
  prograde = true,
): number {
  const Omega = circularOmega(mass, rho, spinLength, prograde)
  return Math.min(Math.abs(Omega) * Math.max(rho, 1e-8), 0.95)
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
 * Special-relativistic Doppler factor (flat-space limit).
 * Prefer orbitingRedshiftFactor for disk emission in GR.
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
 * Prefer circular-orbit factor for disk gas.
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
 * Observer-frame frequency factor for an orbiting disk patch (circular geodesic).
 */
export function diskFrequencyFactor(options: {
  mass: number
  rho: number
  hx: number
  hz: number
  rayDir: Vec3
  spinLength?: number
  charge?: number
  prograde?: boolean
}): { D: number; g: number; factor: number; mu: number; beta: number } {
  const {
    mass,
    rho,
    hx,
    hz,
    rayDir,
    spinLength = 0,
    charge = 0,
    prograde = true,
  } = options

  const tdir = progradeDirAboutY(hx, hz)
  const len = Math.hypot(rayDir.x, rayDir.y, rayDir.z)
  const nObs =
    len < 1e-12
      ? { x: 0, y: 0, z: 0 }
      : { x: -rayDir.x / len, y: -rayDir.y / len, z: -rayDir.z / len }
  const mu = tdir.x * nObs.x + tdir.y * nObs.y + tdir.z * nObs.z

  const orb = orbitingRedshiftFactor({
    mass,
    r: rho,
    spinLength,
    charge,
    mu,
    prograde,
  })

  // Decompose for diagnostics: face-on piece vs Doppler boost
  const gFace = 1 / orb.u_t
  const D = orb.g / Math.max(gFace, 1e-8)
  const beta = kerrOrbitalSpeed(mass, rho, spinLength, prograde)

  return { D, g: gFace, factor: orb.g, mu, beta }
}

/**
 * Bolometric intensity scaling.
 * Ideal GRRT: I ∝ g³. Display path uses DISK_EMISSION.beamExponent (softer).
 * Prefer beamIntensity(g, ideal) from disk.ts for the dual-mode path.
 */
export function bolometricBeaming(D: number, ideal = true): number {
  const d = Math.max(D, 1e-4)
  if (ideal) return d * d * d
  // soft display default matches DISK_EMISSION.beamExponent = 2
  return d * d
}
