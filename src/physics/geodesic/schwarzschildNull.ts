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

/**
 * Spatial acceleration for Schwarzschild null geodesics (G = c = 1).
 *
 * From the Binet equation d²u/dφ² + u = 3M u² with rs = 2M:
 *   a = −(3/2) rs |L|² x / r⁵ ,  L = x × v
 *
 * This is the standard real-time GRRT form that reproduces capture vs escape
 * around the critical impact parameter b_c = 3√3 M.
 */
export function schwarzschildNullAccel(pos: Vec3, vel: Vec3, rs: number): Vec3 {
  const r = length3(pos)
  if (r < 1e-10) return { x: 0, y: 0, z: 0 }
  const L = cross(pos, vel)
  const L2 = dot(L, L)
  const r2 = r * r
  const r5 = r2 * r2 * r
  return scale(pos, (-1.5 * rs * L2) / r5)
}

/** One RK4 step: pos′ = vel, vel′ = accel(pos, vel). */
export function rk4Step(
  pos: Vec3,
  vel: Vec3,
  rs: number,
  h: number,
): { pos: Vec3; vel: Vec3 } {
  const a1 = schwarzschildNullAccel(pos, vel, rs)

  const p2 = add(pos, scale(vel, h * 0.5))
  const v2 = add(vel, scale(a1, h * 0.5))
  const a2 = schwarzschildNullAccel(p2, v2, rs)

  const p3 = add(pos, scale(v2, h * 0.5))
  const v3 = add(vel, scale(a2, h * 0.5))
  const a3 = schwarzschildNullAccel(p3, v3, rs)

  const p4 = add(pos, scale(v3, h))
  const v4 = add(vel, scale(a3, h))
  const a4 = schwarzschildNullAccel(p4, v4, rs)

  const dPos = scale(
    add(add(vel, scale(add(v2, v3), 2)), v4),
    h / 6,
  )
  // k1=v, k2=v2, k3=v3, k4=v4 for position; for velocity k_i = a_i
  const dVel = scale(add(add(a1, scale(add(a2, a3), 2)), a4), h / 6)

  return {
    pos: add(pos, dPos),
    vel: add(vel, dVel),
  }
}

export type TraceFate = 'captured' | 'escaped' | 'max_steps'

export type TraceResult = {
  fate: TraceFate
  minR: number
  finalR: number
  steps: number
  diskHits: number
  /** Approximate impact parameter |r × v̂| at start */
  impact: number
}

export type TraceOptions = {
  mass: number
  origin: Vec3
  direction: Vec3
  maxSteps?: number
  /** Base step in geometric units; scaled adaptively with r */
  stepSize?: number
  escapeRadius?: number
  /** Capture slightly outside r₊ for numerical safety */
  captureMargin?: number
  diskInner?: number
  diskOuter?: number
}

export function impactParameter(pos: Vec3, vel: Vec3): number {
  const v = normalize(vel)
  return length3(cross(pos, v))
}

/**
 * Integrate a backward null geodesic in Schwarzschild spacetime.
 * Captured rays: pure black (caller paints void).
 * Disk plane z = 0 crossings in [diskInner, diskOuter] count as hits.
 */
export function traceSchwarzschildNull(options: TraceOptions): TraceResult {
  const M = options.mass
  const rs = 2 * M
  const rPlus = rs
  const captureR = rPlus * (options.captureMargin ?? 1.02)
  const maxSteps = options.maxSteps ?? 4000
  const h0 = options.stepSize ?? 0.08 * M
  const escapeR = options.escapeRadius ?? 250 * M
  const diskInner = options.diskInner ?? 6 * M
  const diskOuter = options.diskOuter ?? 30 * M

  let pos = clone(options.origin)
  let vel = normalize(options.direction)
  const impact = impactParameter(pos, vel)

  let minR = length3(pos)
  let diskHits = 0
  let prevZ = pos.z
  let prevPos = clone(pos)

  for (let i = 0; i < maxSteps; i++) {
    const r = length3(pos)
    if (r < minR) minR = r

    if (r <= captureR) {
      return { fate: 'captured', minR, finalR: r, steps: i, diskHits, impact }
    }

    // Far and outgoing → escaped to infinity
    if (r >= escapeR && dot(pos, vel) > 0) {
      return { fate: 'escaped', minR, finalR: r, steps: i, diskHits, impact }
    }

    const h = h0 * Math.min(1.5, Math.max(0.04, r / (12 * M)))
    prevPos = clone(pos)
    prevZ = pos.z

    const next = rk4Step(pos, vel, rs, h)
    pos = next.pos
    vel = next.vel

    // Equatorial disk crossing (z = 0)
    if (prevZ * pos.z < 0) {
      const denom = prevZ - pos.z
      const t = Math.abs(denom) < 1e-15 ? 0 : prevZ / denom
      const hx = prevPos.x + (pos.x - prevPos.x) * t
      const hy = prevPos.y + (pos.y - prevPos.y) * t
      const hitR = Math.hypot(hx, hy)
      if (hitR >= diskInner && hitR <= diskOuter) {
        diskHits++
      }
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
