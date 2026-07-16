// @ts-nocheck — TSL; top-level only.
/**
 * False-color debug modes for the geodesic tracer (uDebugMode 1–8).
 */
import { abs, float, If, max, min, pow, vec3 } from 'three/tsl'

export function applyDebugFalseColor(p) {
  const {
    mode,
    col,
    hits,
    captured,
    escaped,
    minR,
    M,
    stepCount,
    STEPS,
    dbgG,
    dbgT,
    dbgFlux,
    impactB,
  } = p

  If(mode.equal(float(1)), () => {
    If(hits.greaterThan(0.5), () => {
      col.assign(vec3(0.95, 0.45, 0.12))
    })
    If(hits.lessThan(0.5).and(captured.greaterThan(0.5)), () => {
      col.assign(vec3(0.02, 0.02, 0.02))
    })
    If(hits.lessThan(0.5).and(escaped.greaterThan(0.5)), () => {
      const near = minR.lessThan(M.mul(4.0)).select(float(1), float(0))
      col.assign(
        near.greaterThan(0.5).select(vec3(0.15, 0.75, 0.85), vec3(0.08, 0.1, 0.18)),
      )
    })
  })
  If(mode.equal(float(2)), () => {
    const t = min(stepCount.div(float(STEPS)), float(1))
    col.assign(vec3(t, float(1).sub(abs(t.mul(2).sub(1))), float(1).sub(t)).mul(1.2))
  })
  If(mode.equal(float(3)), () => {
    const t = min(minR.div(M.mul(8)), float(1))
    col.assign(vec3(float(1).sub(t), t.mul(0.6), t))
  })
  If(mode.equal(float(4)), () => {
    If(hits.greaterThan(0.5), () => {
      const g = min(dbgG.mul(0.7), float(1.5))
      col.assign(vec3(g, g.mul(0.85), g.mul(0.55)))
    })
    If(hits.lessThan(0.5), () => {
      col.assign(captured.greaterThan(0.5).select(vec3(0, 0, 0), vec3(0.03, 0.03, 0.05)))
    })
  })
  If(mode.equal(float(5)), () => {
    If(hits.greaterThan(0.5), () => {
      const t = min(dbgT, float(1.2))
      col.assign(vec3(t, t.mul(0.7), t.mul(0.35)))
    })
    If(hits.lessThan(0.5), () => {
      col.assign(captured.greaterThan(0.5).select(vec3(0, 0, 0), vec3(0.02, 0.02, 0.04)))
    })
  })
  If(mode.equal(float(6)), () => {
    If(hits.greaterThan(0.5), () => {
      const f = min(pow(max(dbgFlux, float(1e-4)), float(0.45)), float(1.2))
      col.assign(vec3(f, f.mul(0.5), f.mul(0.15)))
    })
    If(hits.lessThan(0.5), () => {
      col.assign(captured.greaterThan(0.5).select(vec3(0, 0, 0), vec3(0.02, 0.02, 0.04)))
    })
  })
  If(mode.equal(float(7)), () => {
    const bc = M.mul(float(5.1961524227))
    const t = min(impactB.div(max(bc, float(1e-6))), float(2)).mul(0.5)
    col.assign(vec3(t, float(1).sub(abs(t.mul(2).sub(1))), float(1).sub(t)))
  })
  If(mode.equal(float(8)).and(captured.greaterThan(0.5)).and(hits.lessThan(0.5)), () => {
    col.assign(vec3(0, 0, 0))
  })
}
