// @ts-nocheck — TSL node graphs; keep helpers top-level (never nest inside Fn).
/**
 * Continuous thin-disk volume sample (Gaussian vertical structure).
 *
 * Density ∝ exp(−(y/H)²), H = (H/R)·ρ. Emission uses Beer's law weight
 * from the caller (dens · Δs · e^{−τ}) so edge-on paths saturate instead
 * of stacking into a bright slash through the shadow.
 */
import { abs, dot, float, max, min, pow, sqrt, vec3 } from 'three/tsl'
import { accumulateDiskHit } from './diskHitEmission'

/**
 * Emit at cylindrical (hx,hz) with precomputed weight (includes dens·path·e^{−τ}).
 */
export function processDiskVolumeSample(p) {
  const {
    hx,
    hz,
    weight,
    densVert,
    M,
    a,
    aStar,
    Q,
    rs,
    mdot,
    rin,
    rout,
    uRIscoM,
    hits,
    col,
    transm,
    dbgG,
    dbgT,
    dbgFlux,
    uDebugMode,
    uIdealBeam,
    uTime,
    uPrograde,
    uStructure,
    uArms,
    uClumps,
    uDust,
    uScaleH,
    uShearRate,
    uAnim,
    nRay,
  } = p

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
  const freq = float(1).div(max(u_t.mul(float(1).sub(Omega.mul(lambda))), float(0.08)))
  const invRho = float(1).div(max(rhoSafe, float(1e-5)))
  const nY = abs(nRay.y)
  const dVert = densVert === undefined ? float(1) : densVert

  accumulateDiskHit({
    hitR: rho,
    freq,
    cphi: hx.mul(invRho),
    sphi: hz.mul(invRho),
    M,
    aStar,
    mdot,
    rin,
    rout,
    uRIscoM,
    hits,
    col,
    transm,
    dbgG,
    dbgT,
    dbgFlux,
    uDebugMode,
    uIdealBeam,
    uTime,
    uPrograde,
    uStructure,
    uArms,
    uClumps,
    uDust,
    uScaleH,
    uShearRate,
    uAnim,
    pathAbsY: nY,
    weight,
    densVert: dVert,
  })
}
