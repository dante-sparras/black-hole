// @ts-nocheck — TSL top-level only (never nest inside Fn).
/**
 * Orbiting-disk frequency factor g = ν_obs/ν_em for circular equatorial flow.
 * Same recipe as processDiskVolumeSample / accumulateDiskHit (Kerr Ω + u_t).
 */
import { abs, dot, float, max, min, pow, sqrt, vec3 } from 'three/tsl'

/**
 * @returns g = 1 / (u_t (1 − Ω λ)), floored ~0.08
 */
export function orbitingDiskG(p) {
  const { hx, hz, M, a, Q, rs, nRay, uPrograde } = p
  const rho = hx.mul(hx).add(hz.mul(hz)).sqrt()
  const rhoSafe = max(rho, float(1e-5))
  const sqrtM = sqrt(max(M, float(1e-8)))
  const r32 = pow(rhoSafe, float(1.5))
  const OmegaPro = sqrtM.div(r32.add(a.mul(sqrtM)).add(1e-8))
  const denomR = r32.sub(a.mul(sqrtM))
  const OmegaRet = float(-1)
    .mul(sqrtM)
    .div(abs(denomR).lessThan(1e-12).select(float(1e-12), denomR))
  const Omega = uPrograde.greaterThan(0.5).select(OmegaPro, OmegaRet)
  const g_tt = float(-1).add(rs.div(rhoSafe)).sub(Q.mul(Q).div(rhoSafe.mul(rhoSafe)))
  const g_tphi = a.mul(M).mul(-2).div(rhoSafe)
  const g_phiphi = rhoSafe
    .mul(rhoSafe)
    .add(a.mul(a))
    .add(M.mul(2).mul(a).mul(a).div(rhoSafe))
    .sub(a.mul(a).mul(Q).mul(Q).div(rhoSafe.mul(rhoSafe)))
  const Xorb = g_tt
    .mul(-1)
    .sub(Omega.mul(2).mul(g_tphi))
    .sub(Omega.mul(Omega).mul(g_phiphi))
  const u_t = float(1).div(sqrt(max(Xorb, float(1e-8))))
  const tdirPro = vec3(hz.mul(-1), float(0), hx).normalize()
  const tdirRet = vec3(hz, float(0), hx.mul(-1)).normalize()
  const tdir = uPrograde.greaterThan(0.5).select(tdirPro, tdirRet)
  const nObs = nRay.mul(-1)
  const mu = dot(tdir, nObs)
  const lambda = rhoSafe.mul(mu)
  return float(1).div(max(u_t.mul(float(1).sub(Omega.mul(lambda))), float(0.08)))
}
