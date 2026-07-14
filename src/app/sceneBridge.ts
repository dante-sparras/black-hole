/**
 * Application bridge: pure stores → render tracer / bloom.
 * Keeps main.ts as a thin WebGPU boot entry.
 */
import type { createBloomPipeline } from '../render/bloomPipeline'
import type { GeodesicTracer } from '../render/geodesicTracer'
import { toUniforms, type SpacetimeUniforms } from '../render/uniforms'
import { getCamera, subscribeCamera } from '../state/camera'
import { getLook, subscribeLook } from '../state/look'
import { getDerived, getParams, subscribe } from '../state/params'
import { realtimeModeTag, rIscoOverM } from '../physics/metricFamily'

export type BloomPipeline = ReturnType<typeof createBloomPipeline>

export type SceneBridge = {
  applyPhysics: () => void
  applyCamera: () => void
  applyLook: () => void
  /** Subscribe stores → tracer; returns unsubscribe all. */
  connect: () => () => void
  getSpacetime: () => SpacetimeUniforms
  formatStats: (fps: number) => string
  setBloomPipeline: (pipeline: BloomPipeline | null) => void
}

export function createSceneBridge(tracer: GeodesicTracer): SceneBridge {
  let spacetime = toUniforms(getParams(), getDerived())
  let bloom: BloomPipeline | null = null

  function applyPhysics(): void {
    const p = getParams()
    const d = getDerived()
    spacetime = toUniforms(p, d)
    tracer.setSpacetime({
      mass: p.mass,
      spinStar: p.spinStar,
      charge: p.charge,
      mdot: p.mdot,
      rIscoOverM: rIscoOverM(d.rIsco, p.mass),
    })
  }

  function applyCamera(): void {
    tracer.setCamera(getCamera())
  }

  function applyLook(): void {
    if (bloom) bloom.applyLook(getLook())
  }

  function connect(): () => void {
    const unsubP = subscribe(() => {
      applyPhysics()
    })
    const unsubC = subscribeCamera(() => {
      applyCamera()
    })
    const unsubL = subscribeLook(() => {
      applyLook()
    })
    applyPhysics()
    applyCamera()
    return () => {
      unsubP()
      unsubC()
      unsubL()
    }
  }

  function formatStats(fps: number): string {
    const d = getDerived()
    const c = getCamera()
    const look = getLook()
    const p = spacetime
    const m = p.mass.toFixed(2)
    const a = p.spinStar.toFixed(3)
    const q = p.charge.toFixed(3)
    const md = p.mdot >= 0.01 ? p.mdot.toFixed(2) : p.mdot.toExponential(1)
    const rp = Number.isFinite(p.rPlus) ? p.rPlus.toFixed(3) : '—'
    const dist = c.distanceM.toFixed(1)
    const mode = realtimeModeTag(p)
    const bloomTag = look.bloomEnabled
      ? `bloom=${look.bloomStrength.toFixed(2)}`
      : 'bloom=off'
    return `${fps} fps · ${mode} · ${d.family} · M=${m} a★=${a} Q=${q} ṁ=${md} · ${bloomTag} · r₊=${rp} · D=${dist}M`
  }

  return {
    applyPhysics,
    applyCamera,
    applyLook,
    connect,
    getSpacetime: () => spacetime,
    formatStats,
    setBloomPipeline: (pipeline) => {
      bloom = pipeline
    },
  }
}
