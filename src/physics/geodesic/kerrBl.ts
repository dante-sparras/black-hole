/**
 * Kerr null geodesics in Boyer–Lindquist coordinates (CPU).
 *
 * Conserved E, Lz, Carter Q; Mino-time integration of (r, θ, φ).
 * Geometric units G = c = 1. Pure physics — no Three.js.
 *
 * Disk: equatorial (θ = π/2) crossings + orbiting redshift g
 * using photon λ = Lz/E at the hit radius.
 *
 * Live GPU: optional BL mode via geodesic integrator toggle (Phase 4).
 * BL potentials use Kerr Δ = r²−2Mr+a² (charge enters horizon capture / g).
 */

import { knHorizon } from '../kn'
import { circularOmega, circularU_t } from './doppler'
import { RT } from './rtConstants'

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

export type BlDiskHit = {
  /** BL r at equatorial crossing */
  r: number
  /** Orbiting-emitter frequency factor g = 1/(u^t (1 − Ω λ)), λ = Lz/E */
  g: number
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
  /** Equatorial annulus crossings in [diskInner, diskOuter] */
  diskHits: number
  /** First few hits (for redshift diagnostics) */
  diskHitList: BlDiskHit[]
  /** g of first disk hit, or 0 if none */
  firstDiskG: number
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
  /** Disk annulus (absolute). Default: [6M, RT.diskOuterM·M] */
  diskInner?: number
  diskOuter?: number
  /** Max recorded hits in diskHitList (default 4) */
  maxRecordedHits?: number
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

/**
 * Orbiting-disk redshift using the photon’s conserved λ = Lz/E
 * (exact impact parameter for equatorial Kerr nulls).
 * g = 1 / (u^t (1 − Ω λ))
 */
export function blOrbitingRedshiftG(
  mass: number,
  r: number,
  spinLength: number,
  E: number,
  Lz: number,
  prograde = true,
  charge = 0,
): number {
  const rr = Math.max(r, 1e-8)
  const Omega = circularOmega(mass, rr, spinLength, prograde)
  const u_t = circularU_t(mass, rr, spinLength, charge, prograde)
  const lambda = Math.abs(E) > 1e-14 ? Lz / E : Lz
  const denom = Math.max(u_t * (1 - Omega * lambda), 1e-4)
  return 1 / denom
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

  const targetDr = Math.max(fracStep * r, 1e-4 * mass)
  let dL = sqrtR > 1e-14 ? targetDr / sqrtR : fracStep * 0.1
  if (sqrtT > 1e-14 && Math.abs(signTheta) > 0) {
    const targetDth = 0.05
    dL = Math.min(dL, targetDth / sqrtT)
  }
  dL = Math.min(Math.max(dL, 1e-10), 0.5)

  const dr = signR * sqrtR
  const dth = signTheta * sqrtT

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

  if (rN > 0 && radialPotentialR(rN, mass, a, E, Lz, Q) < 0) {
    signR = -signR
    rN = r
  } else {
    signR = srM
    signTheta = stM
  }

  if (thetaPotential(thN, a, E, Lz, Q) < 0 && Math.abs(signTheta) > 0) {
    signTheta = -signTheta
    thN = theta
  }

  if (!(rN > 0) || !Number.isFinite(rN)) {
    rN = r * 0.5
    signR = -signR
  }

  return { r: rN, theta: thN, phi: phN, signR, signTheta }
}

function equatorCrossed(th0: number, th1: number): boolean {
  const eq = Math.PI / 2
  return (th0 - eq) * (th1 - eq) < 0
}

function interpolateEquatorHit(
  r0: number,
  th0: number,
  ph0: number,
  r1: number,
  th1: number,
  ph1: number,
): { r: number; phi: number } {
  const eq = Math.PI / 2
  const denom = th0 - th1
  const t = Math.abs(denom) < 1e-15 ? 0 : (th0 - eq) / denom
  const tt = Math.min(1, Math.max(0, t))
  return {
    r: r0 + (r1 - r0) * tt,
    phi: ph0 + (ph1 - ph0) * tt,
  }
}

/**
 * Trace a Kerr null geodesic in BL (Mino time, adaptive fractional steps).
 * Counts thin-disk hits when θ crosses π/2 inside [diskInner, diskOuter].
 */
export function traceKerrBlNull(options: BlTraceOptions): BlTraceResult {
  const M = options.mass
  const a = options.spinLength
  const cons = options.conserved
  const maxSteps = options.maxSteps ?? 50_000
  const escapeR = options.escapeRadius ?? 250 * M
  const fracStep = options.fracStep ?? 0.02
  const diskInner = options.diskInner ?? 6 * M
  const diskOuter = options.diskOuter ?? RT.diskOuterM * M
  const maxRec = options.maxRecordedHits ?? 4
  const rPlus = knHorizon(M, a, 0)
  const captureR =
    (Number.isFinite(rPlus) ? rPlus : 2 * M) *
    (options.captureMargin ?? 1.02)

  let r = options.origin.r
  let theta = clampTheta(options.origin.theta)
  let phi = options.origin.phi
  let signR = options.signR ?? -1
  let signTheta = options.signTheta ?? 1

  const forceEquatorial =
    Math.abs(cons.Q) < 1e-14 && Math.abs(theta - Math.PI / 2) < 1e-5
  if (forceEquatorial) {
    signTheta = 0
    theta = Math.PI / 2
  }

  let minR = r
  const rStart = r
  let diskHits = 0
  const diskHitList: BlDiskHit[] = []
  let prevTheta = theta
  let prevR = r
  let prevPhi = phi

  const pack = (fate: BlTraceFate, steps: number): BlTraceResult => ({
    fate,
    minR,
    finalR: r,
    finalTheta: theta,
    steps,
    impactB:
      Math.abs(cons.E) > 1e-14 ? Math.abs(cons.Lz / cons.E) : Math.abs(cons.Lz),
    conserved: cons,
    diskHits,
    diskHitList,
    firstDiskG: diskHitList[0]?.g ?? 0,
  })

  for (let i = 0; i < maxSteps; i++) {
    if (r < minR) minR = r

    if (r <= captureR) {
      return pack('captured', i)
    }

    if (r >= escapeR && signR > 0) {
      return pack('escaped', i)
    }
    if (r > rStart * 1.02 && signR > 0 && i > 10) {
      return pack('escaped', i)
    }

    prevR = r
    prevTheta = theta
    prevPhi = phi

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
      return pack('max_steps', i)
    }

    if (!forceEquatorial && equatorCrossed(prevTheta, theta)) {
      const hit = interpolateEquatorHit(
        prevR,
        prevTheta,
        prevPhi,
        r,
        theta,
        phi,
      )
      if (hit.r >= diskInner && hit.r <= diskOuter) {
        diskHits++
        if (diskHitList.length < maxRec) {
          const g = blOrbitingRedshiftG(M, hit.r, a, cons.E, cons.Lz, true)
          diskHitList.push({ r: hit.r, g, phi: hit.phi })
        }
      }
    }
  }

  if (minR < 1.15 * captureR) {
    return pack('captured', maxSteps)
  }
  if (signR > 0 && r > 10 * M) {
    return pack('escaped', maxSteps)
  }
  return pack('max_steps', maxSteps)
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
