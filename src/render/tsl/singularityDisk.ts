// @ts-nocheck — TSL top-level only
/**
 * Singularity-style disk (MisterPrada/singularity BlackHole.js look).
 * Noise + thin band + dual edge + gold ramp + front-to-back alpha.
 * Runs on our Kerr geodesic samples.
 */
import {
  abs,
  cos,
  float,
  max,
  min,
  mix,
  sin,
  sqrt,
  texture,
  vec2,
  vec3,
} from 'three/tsl'

export function singularityDiskComposite(p) {
  const { pos, M, rCapture, rout, uTime, noiseDeepMap, col, transm, hits } = p

  const scale = max(rout.mul(1.1), M.mul(12))
  const px = pos.x.div(scale)
  const py = pos.y.div(scale)
  const pz = pos.z.div(scale)
  const xyLen = sqrt(px.mul(px).add(pz.mul(pz)))

  // Exact singularity spiral UV
  const rotPhase = xyLen.mul(4.27).sub(uTime.mul(0.1))
  const cR = cos(rotPhase)
  const sR = sin(rotPhase)
  const rx = px.mul(cR).add(pz.mul(sR))
  const rz = px.mul(sR.mul(-1)).add(pz.mul(cR))
  const uv0 = vec2(rx.mul(2), rz.mul(2)).add(0.5)

  const n0 = texture(noiseDeepMap, uv0)
  const nR = n0.r
  const nG = n0.g
  const nB = n0.b

  // Thin band (their width~0.03; we use thicker for sparse geodesic samples)
  const bandWidth = float(0.12)
  const zAbs = abs(py)
  const zBand = max(float(1).sub(zAbs.div(bandWidth).mul(zAbs.div(bandWidth))), float(0))

  const noiseAmp = nR.mul(0.5).add(nG.mul(0.3)).add(nB.mul(0.2)).mul(zBand)

  const n1 = texture(noiseDeepMap, uv0.mul(1.002))
  const noiseN = n1.r.mul(0.5).add(n1.g.mul(0.3)).add(n1.b.mul(0.2)).mul(zBand)

  // rampInput (exact formula)
  const rampInput = xyLen
    .add(noiseAmp.sub(0.78).mul(1.5))
    .add(noiseAmp.sub(noiseN).mul(19.75))

  const t = min(float(1), max(float(0), rampInput))
  const gold = vec3(0.95, 0.71, 0.44)
  const brown = vec3(0.14, 0.05, 0.03)
  const black = vec3(0.0, 0.0, 0.0)
  const u01 = min(float(1), max(float(0), t.sub(0.05).div(0.375)))
  const u12 = min(float(1), max(float(0), t.sub(0.425).div(0.575)))
  const s01 = u01.mul(u01).mul(float(3).sub(u01.mul(2)))
  const s12 = u12.mul(u12).mul(float(3).sub(u12.mul(2)))
  const baseCol = mix(mix(gold, brown, s01), black, s12)
  const emissiveCol = baseCol.mul(2.0).add(vec3(0.14, 0.129, 0.09))

  const rLen = pos.length()
  const insideCore = rLen.lessThan(rCapture.mul(1.08))
  const shadedCol = insideCore.select(vec3(0, 0, 0), emissiveCol)

  // Alpha (boosted for sparse samples)
  const aNoise = noiseAmp.sub(0.7).mul(-0.6)
  const aPre = zAbs.add(aNoise)
  const aRadial = min(float(1), max(float(0), float(1.1).sub(xyLen)))
  const aBand = max(
    float(0),
    float(1).sub(aPre.div(bandWidth.add(0.05)).mul(aPre.div(bandWidth.add(0.05)))),
  )
    .mul(aRadial)
    .mul(zBand.add(0.2))
  const alphaLocal = insideCore.select(
    float(0),
    min(float(0.9), max(float(0), aBand.mul(3.0))),
  )

  // Front-to-back
  const weight = transm.mul(alphaLocal)
  col.addAssign(shadedCol.mul(weight))
  transm.mulAssign(max(float(0.02), float(1).sub(alphaLocal.mul(0.9))))
  hits.addAssign(alphaLocal.greaterThan(0.02).select(float(1), float(0)))
}
