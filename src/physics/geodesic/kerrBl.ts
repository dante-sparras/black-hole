/**
 * Kerr null geodesics in Boyer–Lindquist coordinates (CPU).
 *
 * Conserved E, Lz, Carter Q; Mino-time integration of (r, θ, φ).
 * Geometric units G = c = 1. Pure physics — no Three.js.
 *
 * Live GPU still uses the real-time Cartesian approx (knNullAccel) until a
 * later phase wires BL to the tracer.
 *
 * Conventions:
 *   - Kerr length a = a★ M
 *   - BL polar θ = 0 along +Y (same spin axis as the project)
 *   - Null μ = 0; default E = 1
 *   - Equatorial disk: θ = π/2
 *
 * Potentials:
 *   P = E(r² + a²) − a Lz
 *   Δ = r² − 2 M r + a²
 *   R(r) = P² − Δ [Q + (Lz − a E)²]
 *   Θ(θ) = Q − cos²θ (−a² E² + Lz²/sin²θ)   (μ = 0)
 *
 * Note: at large r, √R ~ E r², so Mino steps must target fractional Δr
 * (not a fixed dλ ≈ 0.05M — that jumps over the entire domain).
 */

import { knHorizon } from '../kn'

export type BlConserved = {
  readonly E: number
  readonly Lz: number
  readonly Q: number
}

export type BlCoords = {
  r: number
  theta: number
  phi: number
}

export type BlTraceFate = 'captured' | 'escaped' | 'max_steps'

export type BlTraceResult = {
  fate: BlTraceFate
  minR: number
  finalR: number
  finalTheta: number
  steps: number
  impactB: number
  conserved: BlConserved
}

export type BlTraceOptions = {
  mass: number
  spinLength: number
  conserved: BlConserved
  origin: BlCoords
  /** −1 ingoing (default), +1 outgoing */
  signR?: number
  signTheta?: number
  maxSteps?: number
  /** Target |Δr| / r per step (default 0.02) */
  fracStep?: number
  escapeRadius?: number
  captureMargin?: number
}

/** Δ = r² − 2Mr + a² */
export function kerrDelta(r: number, mass: number, a: number): number {
  return r * r - 2 * mass * r + a * a
}

/** Σ = r² + a² cos²θ */
export function kerrSigma(r: number, theta: number, a: number): number {
  const c = Math.cos(theta)
  return r * r + a * a * c * c
}

/** P = E(r² + a²) − a Lz */
export function kerrP(r: number, a: number, E: number, Lz: number): number {
  return E * (r * r + a * a) - a * Lz
}

/** R(r) = P² − Δ [Q + (Lz − a E)²] */
export function radialPotentialR(
  r: number,
  mass: number,
  a: number,
  E: number,
  Lz: number,
  Q: number,
): number {
  const Delta = kerrDelta(r, mass, a)
  const P = kerrP(r, a, E, Lz)
  const term = Q + (Lz - a * E) * (Lz - a * E)
  return P * P - Delta * term
}

/** Θ(θ) for null (μ = 0) */
export function thetaPotential(
  theta: number,
  a: number,
  E: number,
  Lz: number,
  Q: number,
): number {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const s2 = Math.max(s * s, 1e-18)
  return Q - c * c * (-a * a * E * E + (Lz * Lz) / s2)
}

export function impactToConserved(b: number, q = 0, E = 1): BlConserved {
  return { E, Lz: b * E, Q: q * E * E }
}

export function schwCriticalImpact(mass: number): number {
  return 3 * Math.sqrt(3) * mass
}

/** dφ/dλ = −(a E − Lz/sin²θ) + a P / Δ */
export function dphiDlambda(
  r: number,
  theta: number,
  mass: number,
  a: number,
  E: number,
  Lz: number,
): number {
  const Delta = Math.max(kerrDelta(r, mass, a), 1e-14)
  const P = kerrP(r, a, E, Lz)
  const s = Math.sin(theta)
  const s2 = Math.max(s * s, 1e-18)
  return -(a * E - Lz / s2) + (a * P) / Delta
}

function clampTheta(theta: number): number {
  const eps = 1e-5
  if (theta < eps) return eps
  if (theta > Math.PI - eps) return Math.PI - eps
  return theta
}

type BlDyn = BlCoords & { signR: number; signTheta: number }

/**
 * Adaptive Mino step: choose dλ so |Δr| ≈ fracStep · r (and |Δθ| bounded).
 */
export function blMinoStep(
  state: BlDyn,
  mass: number,
  a: number,
  cons: BlConserved,
  fracStep: number,
): BlDyn {
  const { E, Lz, Q } = cons
  let { r, theta, phi, signR, signTheta } = state
  theta = clampTheta(theta)

  let R0 = radialPotentialR(r, mass, a, E, Lz, Q)
  let T0 = thetaPotential(theta, a, E, Lz, Q)

  // Turning points: flip before taking a zero step
  if (R0 <= 1e-12) {
    signR = -signR
    R0 = Math.max(R0, 0)
  }
  if (T0 <= 1e-12 && Math.abs(signTheta) > 0) {
    signTheta = -signTheta
    T0 = Math.max(T0, 0)
  }

  const sqrtR = Math.sqrt(Math.max(R0, 0))
  const sqrtT = Math.sqrt(Math.max(T0, 0))

  // Target radial displacement
  const targetDr = Math.max(fracStep * r, 1e-4 * mass)
  let dL = sqrtR > 1e-14 ? targetDr / sqrtR : fracStep * 0.1
  // Also limit polar motion
  if (sqrtT > 1e-14 && Math.abs(signTheta) > 0) {
    const targetDth = 0.05
    dL = Math.min(dL, targetDth / sqrtT)
  }
  dL = Math.min(Math.max(dL, 1e-10), 0.5)

  const dr = signR * sqrtR
  const dth = signTheta * sqrtT

  // Midpoint
  const rM = Math.max(r + 0.5 * dL * dr, 1e-6 * mass)
  const thM = clampTheta(theta + 0.5 * dL * dth)
  let RM = radialPotentialR(rM, mass, a, E, Lz, Q)
  let TM = thetaPotential(thM, a, E, Lz, Q)
  let srM = signR
  let stM = signTheta
  if (RM <= 1e-12) {
    srM = -srM
    RM = 0
  }
  if (TM <= 1e-12 && Math.abs(stM) > 0) {
    stM = -stM
    TM = 0
  }

  const drM = srM * Math.sqrt(Math.max(RM, 0))
  const dthM = stM * Math.sqrt(Math.max(TM, 0))
  const dphM = dphiDlambda(rM, thM, mass, a, E, Lz)

  let rN = r + dL * drM
  let thN = clampTheta(theta + dL * dthM)
  const phN = phi + dL * dphM

  // If step crossed into forbidden R<0, reflect at current r
  if (rN > 0 && radialPotentialR(rN, mass, a, E, Lz, Q) < 0) {
    signR = -signR
    // Place just outside the turning region: stay near r, reverse
    rN = r
  } else {
    // Accept midpoint signs if we successfully advanced
    signR = srM
    signTheta = stM
  }

  if (thetaPotential(thN, a, E, Lz, Q) < 0 && Math.abs(signTheta) > 0) {
    signTheta = -signTheta
    thN = theta
  }

  // Never go non-positive
  if (!(rN > 0) || !Number.isFinite(rN)) {
    rN = r * 0.5
    signR = -signR
  }

  return { r: rN, theta: thN, phi: phN, signR, signTheta }
}

/**
 * Trace a Kerr null geodesic in BL (Mino time, adaptive fractional steps).
 */
export function traceKerrBlNull(options: BlTraceOptions): BlTraceResult {
  const M = options.mass
  const a = options.spinLength
  const cons = options.conserved
  const maxSteps = options.maxSteps ?? 50_000
  const escapeR = options.escapeRadius ?? 250 * M
  const fracStep = options.fracStep ?? 0.02
  const rPlus = knHorizon(M, a, 0)
  const captureR =
    (Number.isFinite(rPlus) ? rPlus : 2 * M) *
    (options.captureMargin ?? 1.02)

  let r = options.origin.r
  let theta = clampTheta(options.origin.theta)
  let phi = options.origin.phi
  let signR = options.signR ?? -1
  let signTheta = options.signTheta ?? 1

  // Stay equatorial when Q≈0 and θ≈π/2
  if (Math.abs(cons.Q) < 1e-14 && Math.abs(theta - Math.PI / 2) < 1e-5) {
    signTheta = 0
    theta = Math.PI / 2
  }

  let minR = r
  const rStart = r

  for (let i = 0; i < maxSteps; i++) {
    if (r < minR) minR = r

    if (r <= captureR) {
      return finish('captured', minR, r, theta, i, cons)
    }

    // Escaped: outside start shell and moving out (or past escapeR)
    if (r >= escapeR && signR > 0) {
      return finish('escaped', minR, r, theta, i, cons)
    }
    // Also count bounce-back past launch radius as escape
    if (r > rStart * 1.02 && signR > 0 && i > 10) {
      return finish('escaped', minR, r, theta, i, cons)
    }

    const next = blMinoStep(
      { r, theta, phi, signR, signTheta },
      M,
      a,
      cons,
      fracStep,
    )
    r = next.r
    theta = next.theta
    phi = next.phi
    signR = next.signR
    signTheta = next.signTheta

    if (!Number.isFinite(r) || !Number.isFinite(theta)) {
      return finish('max_steps', minR, r, theta, i, cons)
    }
  }

  // Near-horizon unfinished → capture; otherwise treat as escape if outbound far
  if (minR < 1.15 * captureR) {
    return finish('captured', minR, r, theta, maxSteps, cons)
  }
  if (signR > 0 && r > 10 * M) {
    return finish('escaped', minR, r, theta, maxSteps, cons)
  }
  return finish('max_steps', minR, r, theta, maxSteps, cons)
}

function finish(
  fate: BlTraceFate,
  minR: number,
  r: number,
  theta: number,
  steps: number,
  cons: BlConserved,
): BlTraceResult {
  return {
    fate,
    minR,
    finalR: r,
    finalTheta: theta,
    steps,
    impactB:
      Math.abs(cons.E) > 1e-14 ? Math.abs(cons.Lz / cons.E) : Math.abs(cons.Lz),
    conserved: cons,
  }
}

/** Equatorial ray from large r with impact b = Lz/E. */
export function traceEquatorialImpact(options: {
  mass: number
  spinLength: number
  b: number
  rStart?: number
  maxSteps?: number
  escapeRadius?: number
  fracStep?: number
}): BlTraceResult {
  const M = options.mass
  const rStart = options.rStart ?? 80 * M
  return traceKerrBlNull({
    mass: M,
    spinLength: options.spinLength,
    conserved: impactToConserved(options.b, 0, 1),
    origin: { r: rStart, theta: Math.PI / 2, phi: 0 },
    signR: -1,
    signTheta: 0,
    maxSteps: options.maxSteps ?? 80_000,
    escapeRadius: options.escapeRadius ?? 200 * M,
    fracStep: options.fracStep ?? 0.02,
  })
}
