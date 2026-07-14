import { knHorizon } from '../kn'
import { RT, rtStepSize } from './rtConstants'
import {
  add,
  clone,
  cross,
  dot,
  length3,
  normalize,
  scale,
  type Vec3,
} from './vec3'
import { schwarzschildNullAccel } from './schwarzschildNull'

/**
 * Real-time Einstein–Maxwell null geodesics (Cartesian approx).
 *
 * Families (a = Kerr length, Q = charge):
 *   a=0, Q=0 → Schwarzschild
 *   a≠0, Q=0 → Kerr
 *   a=0, Q≠0 → Reissner–Nordström
 *   a≠0, Q≠0 → Kerr–Newman
 *
 * Radial force from Binet (RN):
 *   d²u/dφ² + u = 3 M u² − 2 Q² u³
 * → a = L² (−3M/r⁵ + 2 Q²/r⁶) x̂
 *   = −1.5 r_s L² x / r⁵ + 2 Q² L² x / r⁶   (r_s = 2M)
 *
 * Spin: Lense–Thirring + spin–orbit (same as kerrNull).
 */

export function knNullAccel(
  pos: Vec3,
  vel: Vec3,
  mass: number,
  spinLengthA: number,
  charge: number,
): Vec3 {
  const a = spinLengthA
  const Q = charge
  const r = length3(pos)
  if (r < 1e-10) return { x: 0, y: 0, z: 0 }

  // Pure Schwarzschild fast path
  if (Math.abs(a) < 1e-14 && Math.abs(Q) < 1e-14) {
    return schwarzschildNullAccel(pos, vel, 2 * mass)
  }

  const rs = 2 * mass
  const L = cross(pos, vel)
  const L2 = dot(L, L)
  const r2 = r * r
  const r3 = r2 * r
  const r5 = r2 * r3
  const r6 = r5 * r

  // RN/Schw radial strength: −1.5 rs L²/r⁵ + 2 Q² L²/r⁶
  let strength = (-1.5 * rs * L2) / r5
  if (Math.abs(Q) > 1e-14) {
    strength += (2 * Q * Q * L2) / r6
  }

  // Spin–orbit modulation (Kerr / KN)
  if (Math.abs(a) > 1e-14) {
    const Ly = L.y
    const coup = (a * Ly) / (r3 + a * a * r + 1e-12)
    strength *= 1 - 1.35 * coup
  }

  const radial: Vec3 = {
    x: strength * pos.x,
    y: strength * pos.y,
    z: strength * pos.z,
  }

  if (Math.abs(a) < 1e-14) return radial

  // Lense–Thirring Ω = 2 a M / (r³ + a² r)
  const Omega = (2 * a * mass) / (r3 + a * a * r + 1e-12)
  const lt: Vec3 = {
    x: 2 * Omega * vel.z,
    y: 0,
    z: -2 * Omega * vel.x,
  }
  return add(radial, lt)
}

/** @deprecated alias — use knNullAccel */
export function kerrNullAccel(
  pos: Vec3,
  vel: Vec3,
  mass: number,
  spinLengthA: number,
  charge = 0,
): Vec3 {
  return knNullAccel(pos, vel, mass, spinLengthA, charge)
}

export function frameDragRotateVel(
  vel: Vec3,
  pos: Vec3,
  mass: number,
  spinLengthA: number,
  ds: number,
): Vec3 {
  const a = spinLengthA
  if (Math.abs(a) < 1e-14) return vel
  const r = length3(pos)
  const r3 = r * r * r
  const dphi = (2 * a * mass * ds) / (r3 + a * a * r + 1e-12)
  const c = Math.cos(dphi)
  const s = Math.sin(dphi)
  return {
    x: vel.x * c + vel.z * s,
    y: vel.y,
    z: -vel.x * s + vel.z * c,
  }
}

export function rk4StepKn(
  pos: Vec3,
  vel: Vec3,
  mass: number,
  spinLengthA: number,
  charge: number,
  h: number,
): { pos: Vec3; vel: Vec3 } {
  const a1 = knNullAccel(pos, vel, mass, spinLengthA, charge)

  const p2 = add(pos, scale(vel, h * 0.5))
  const v2 = add(vel, scale(a1, h * 0.5))
  const a2 = knNullAccel(p2, v2, mass, spinLengthA, charge)

  const p3 = add(pos, scale(v2, h * 0.5))
  const v3 = add(vel, scale(a2, h * 0.5))
  const a3 = knNullAccel(p3, v3, mass, spinLengthA, charge)

  const p4 = add(pos, scale(v3, h))
  const v4 = add(vel, scale(a3, h))
  const a4 = knNullAccel(p4, v4, mass, spinLengthA, charge)

  const dPos = scale(add(add(vel, scale(add(v2, v3), 2)), v4), h / 6)
  const dVel = scale(add(add(a1, scale(add(a2, a3), 2)), a4), h / 6)

  let newPos = add(pos, dPos)
  let newVel = add(vel, dVel)
  newVel = frameDragRotateVel(newVel, newPos, mass, spinLengthA, h)
  return { pos: newPos, vel: newVel }
}

export function rk4StepKerr(
  pos: Vec3,
  vel: Vec3,
  mass: number,
  spinLengthA: number,
  h: number,
  charge = 0,
): { pos: Vec3; vel: Vec3 } {
  return rk4StepKn(pos, vel, mass, spinLengthA, charge, h)
}

export type KnTraceFate = 'captured' | 'escaped' | 'max_steps'
export type KerrTraceFate = KnTraceFate

export type KnTraceResult = {
  fate: KnTraceFate
  minR: number
  finalR: number
  steps: number
  diskHits: number
  impact: number
}
export type KerrTraceResult = KnTraceResult

export type KnTraceOptions = {
  mass: number
  spinLength: number
  charge?: number
  origin: Vec3
  direction: Vec3
  maxSteps?: number
  stepSize?: number
  escapeRadius?: number
  captureMargin?: number
  diskInner?: number
  diskOuter?: number
  diskAxis?: 'y' | 'z'
}
export type KerrTraceOptions = KnTraceOptions

export function impactParameter(pos: Vec3, vel: Vec3): number {
  const v = normalize(vel)
  return length3(cross(pos, v))
}

/**
 * Integrate a backward null geodesic in RN / Kerr / KN / Schw.
 * Disk: y=0 (XZ) by default — spin ‖ +Y.
 */
export function traceKnNull(options: KnTraceOptions): KnTraceResult {
  const M = options.mass
  const a = options.spinLength
  const Q = options.charge ?? 0
  const rPlus = knHorizon(M, a, Q)
  const captureR =
    (Number.isFinite(rPlus) ? rPlus : 2 * M) *
    (options.captureMargin ?? RT.captureMargin)
  const maxSteps = options.maxSteps ?? 5000
  const escapeR = options.escapeRadius ?? 250 * M
  const diskInner = options.diskInner ?? 6 * M
  const diskOuter = options.diskOuter ?? RT.diskOuterM * M
  const axis = options.diskAxis ?? 'y'

  let pos = clone(options.origin)
  let vel = normalize(options.direction)
  const impact = impactParameter(pos, vel)

  let minR = length3(pos)
  let diskHits = 0
  let prevAxis = axis === 'y' ? pos.y : pos.z
  let prevPos = clone(pos)

  for (let i = 0; i < maxSteps; i++) {
    const r = length3(pos)
    if (r < minR) minR = r

    if (r <= captureR) {
      return { fate: 'captured', minR, finalR: r, steps: i, diskHits, impact }
    }

    if (r >= escapeR && dot(pos, vel) > 0) {
      return { fate: 'escaped', minR, finalR: r, steps: i, diskHits, impact }
    }

    const h = options.stepSize
      ? options.stepSize * Math.min(RT.adaptMax, Math.max(RT.adaptFloor, r / (RT.adaptScale * M)))
      : rtStepSize(r, M)
    prevPos = clone(pos)
    prevAxis = axis === 'y' ? pos.y : pos.z

    const next = rk4StepKn(pos, vel, M, a, Q, h)
    pos = next.pos
    vel = next.vel

    const curAxis = axis === 'y' ? pos.y : pos.z
    if (prevAxis * curAxis < 0) {
      const denom = prevAxis - curAxis
      const t = Math.abs(denom) < 1e-15 ? 0 : prevAxis / denom
      const hx = prevPos.x + (pos.x - prevPos.x) * t
      const hy = prevPos.y + (pos.y - prevPos.y) * t
      const hz = prevPos.z + (pos.z - prevPos.z) * t
      const hitR =
        axis === 'y' ? Math.hypot(hx, hz) : Math.hypot(hx, hy)
      if (hitR >= diskInner && hitR <= diskOuter) diskHits++
    }
  }

  if (minR < RT.stalledCaptureM * M) {
    return {
      fate: 'captured',
      minR,
      finalR: length3(pos),
      steps: maxSteps,
      diskHits,
      impact,
    }
  }

  return {
    fate: 'max_steps',
    minR,
    finalR: length3(pos),
    steps: maxSteps,
    diskHits,
    impact,
  }
}

/** @deprecated alias */
export function traceKerrNull(options: KnTraceOptions): KnTraceResult {
  return traceKnNull(options)
}
