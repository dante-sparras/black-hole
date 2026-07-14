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
import { kerrHorizon } from '../kerr'

/**
 * Real-time Kerr null geodesics in Cartesian form (spin ‖ +Y).
 *
 * When a = 0, reduces exactly to the Schwarzschild pseudo-Newtonian force
 * used in schwarzschildNullAccel.
 *
 * Nonzero spin adds Lense–Thirring frame-dragging:
 *   Ω(r) = 2 a M / (r³ + a² r) along ŷ
 *   a_LT = 2 Ω × v
 * plus a co/counter-rotation coupling that shifts the effective capture
 * (prograde rays less tightly bound, retrograde more).
 *
 * This is the standard class of real-time Kerr approximations (not full
 * Boyer–Lindquist Christoffels) — accurate enough for silhouette + drag
 * asymmetry; a=0 matches our tested Schwarzschild integrator.
 */

export function kerrNullAccel(
  pos: Vec3,
  vel: Vec3,
  mass: number,
  spinLengthA: number,
): Vec3 {
  const a = spinLengthA
  if (Math.abs(a) < 1e-14) {
    return schwarzschildNullAccel(pos, vel, 2 * mass)
  }

  const r = length3(pos)
  if (r < 1e-10) return { x: 0, y: 0, z: 0 }

  const rs = 2 * mass
  const L = cross(pos, vel)
  const L2 = dot(L, L)
  const r2 = r * r
  const r3 = r2 * r
  const r5 = r2 * r3

  // Base Schwarzschild-like radial force
  let strength = (-1.5 * rs * L2) / r5

  // Spin–orbit coupling: Ly > 0 with a > 0 is prograde (weaker effective pull
  // near the hole → smaller shadow on that side).
  const Ly = L.y
  const coup = (a * Ly) / (r3 + a * a * r + 1e-12)
  // Mild modulation so a=0.998 is dramatic but stable
  strength *= 1 - 1.35 * coup

  const schw: Vec3 = {
    x: strength * pos.x,
    y: strength * pos.y,
    z: strength * pos.z,
  }

  // Lense–Thirring: Ω = 2 a M / (r³ + a² r) along +Y
  const Omega = (2 * a * mass) / (r3 + a * a * r + 1e-12)
  // 2 Ω × v with Ω = (0, Ω, 0) → (2 Ω vz, 0, −2 Ω vx)
  const lt: Vec3 = {
    x: 2 * Omega * vel.z,
    y: 0,
    z: -2 * Omega * vel.x,
  }

  return add(schw, lt)
}

/** Rotate velocity about +Y by dφ (frame-drag twist of the ray). */
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

export function rk4StepKerr(
  pos: Vec3,
  vel: Vec3,
  mass: number,
  spinLengthA: number,
  h: number,
): { pos: Vec3; vel: Vec3 } {
  const a1 = kerrNullAccel(pos, vel, mass, spinLengthA)

  const p2 = add(pos, scale(vel, h * 0.5))
  const v2 = add(vel, scale(a1, h * 0.5))
  const a2 = kerrNullAccel(p2, v2, mass, spinLengthA)

  const p3 = add(pos, scale(v2, h * 0.5))
  const v3 = add(vel, scale(a2, h * 0.5))
  const a3 = kerrNullAccel(p3, v3, mass, spinLengthA)

  const p4 = add(pos, scale(v3, h))
  const v4 = add(vel, scale(a3, h))
  const a4 = kerrNullAccel(p4, v4, mass, spinLengthA)

  const dPos = scale(add(add(vel, scale(add(v2, v3), 2)), v4), h / 6)
  const dVel = scale(add(add(a1, scale(add(a2, a3), 2)), a4), h / 6)

  let newPos = add(pos, dPos)
  let newVel = add(vel, dVel)
  // Continuous frame-drag twist (helps shadow asymmetry)
  newVel = frameDragRotateVel(newVel, newPos, mass, spinLengthA, h)

  return { pos: newPos, vel: newVel }
}

export type KerrTraceFate = 'captured' | 'escaped' | 'max_steps'

export type KerrTraceResult = {
  fate: KerrTraceFate
  minR: number
  finalR: number
  steps: number
  diskHits: number
  impact: number
}

export type KerrTraceOptions = {
  mass: number
  /** Kerr length a = a★ M */
  spinLength: number
  origin: Vec3
  direction: Vec3
  maxSteps?: number
  stepSize?: number
  escapeRadius?: number
  captureMargin?: number
  diskInner?: number
  diskOuter?: number
  /** Disk normal: 'y' (XZ plane, default) or 'z' (XY plane) */
  diskAxis?: 'y' | 'z'
}

export function impactParameter(pos: Vec3, vel: Vec3): number {
  const v = normalize(vel)
  return length3(cross(pos, v))
}

/**
 * Integrate a backward null geodesic in (approximate) Kerr spacetime.
 * Disk: y=0 (XZ) by default — spin ‖ +Y.
 */
export function traceKerrNull(options: KerrTraceOptions): KerrTraceResult {
  const M = options.mass
  const a = options.spinLength
  const rPlus = kerrHorizon(M, a)
  const captureR =
    (Number.isFinite(rPlus) ? rPlus : 2 * M) * (options.captureMargin ?? 1.02)
  const maxSteps = options.maxSteps ?? 5000
  const h0 = options.stepSize ?? 0.1 * M
  const escapeR = options.escapeRadius ?? 250 * M
  const diskInner = options.diskInner ?? 6 * M
  const diskOuter = options.diskOuter ?? 30 * M
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

    // Floor adapt so photon-sphere skims still progress
    const h = h0 * Math.min(1.5, Math.max(0.2, r / (12 * M)))
    prevPos = clone(pos)
    prevAxis = axis === 'y' ? pos.y : pos.z

    const next = rk4StepKerr(pos, vel, M, a, h)
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

  // Unfinished near-photon-sphere skims ≈ capture
  if (minR < 3.2 * M) {
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
