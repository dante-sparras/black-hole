// @ts-nocheck — TSL; top-level only.
/**
 * Real-time KN null force: Binet RN + Kerr spin-orbit + Lense–Thirring.
 * Matches CPU knNullAccel stages used by RK2.
 */
import { cross, dot, float, max, vec3 } from 'three/tsl'

export function knNullAccelTsl(pos, vel, rs, a, Q, M) {
  const r1 = max(pos.length(), float(1e-6))
  const L1 = cross(pos, vel)
  const L12 = dot(L1, L1)
  const r13 = r1.mul(r1).mul(r1)
  const r15 = r13.mul(r1).mul(r1)
  const r16 = r15.mul(r1)
  const coup1 = a.mul(L1.y).div(r13.add(a.mul(a).mul(r1)).add(1e-12))
  const str1 = float(-1.5)
    .mul(rs)
    .mul(L12)
    .div(r15)
    .add(Q.mul(Q).mul(2).mul(L12).div(r16))
    .mul(float(1).sub(coup1.mul(1.35)))
  const Om1 = a.mul(M).mul(2).div(r13.add(a.mul(a).mul(r1)).add(1e-12))
  return pos.mul(str1).add(vec3(Om1.mul(2).mul(vel.z), float(0), Om1.mul(-2).mul(vel.x)))
}
