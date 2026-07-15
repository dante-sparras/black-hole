/**
 * Spatial acceleration for Schwarzschild null geodesics (G = c = 1).
 *
 * From the Binet equation d²u/dφ² + u = 3M u² with rs = 2M:
 *   a = −(3/2) rs |L|² x / r⁵ ,  L = x × v
 *
 * Tracing, step policy, and disk plane live in knNull (RT lockstep).
 * Do not reintroduce a separate Schw tracer.
 */
import { cross, dot, length3, scale, type Vec3 } from './vec3'

export function schwarzschildNullAccel(pos: Vec3, vel: Vec3, rs: number): Vec3 {
  const r = length3(pos)
  if (r < 1e-10) return { x: 0, y: 0, z: 0 }
  const L = cross(pos, vel)
  const L2 = dot(L, L)
  const r2 = r * r
  const r5 = r2 * r2 * r
  return scale(pos, (-1.5 * rs * L2) / r5)
}
