/**
 * Application bridge: pure stores → render tracer / bloom.
 * Keeps main.ts as a thin WebGPU boot entry.
 */
import { realtimeModeTag, rIscoOverM } from '../physics/metricFamily'
import type { createBloomPipeline } from '../render/bloomPipeline'
import type { GeodesicTracer } from '../render/geodesicTracer'
import { toUniforms, type SpacetimeUniforms } from '../render/uniforms'
import { getScene, subscribeScene } from '../state/scene'

export type BloomPipeline = ReturnType<typeof createBloomPipeline>

export type SceneBridge = {
  applyPhysics: () => void
  applyCamera: () => void
  applyLook: () => void
  /** Subscribe scene facade → tracer; returns unsubscribe. */
  connect: () => () => void
  getSpacetime: () => SpacetimeUniforms
  formatStats: (fps: number) => string
  setBloomPipeline: (pipeline: BloomPipeline | null) => void
}

export function createSceneBridge(tracer: GeodesicTracer): SceneBridge {
  const initial = getScene()
  let spacetime = toUniforms(initial.params, initial.derived)
  let bloom: BloomPipeline | null = null

  function applyPhysics(): void {
    const { params: p, derived: d } = getScene()
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
    tracer.setCamera(getScene().camera)
  }

  function applyLook(): void {
    if (bloom) bloom.applyLook(getScene().look)
  }

  function connect(): () => void {
    return subscribeScene(() => {
      applyPhysics()
      applyCamera()
      applyLook()
    })
  }

  function formatStats(fps: number): string {
    const { params: p, derived: d, camera: c, look } = getScene()
    const m = p.mass.toFixed(2)
    const a = p.spinStar.toFixed(3)
    const q = p.charge.toFixed(3)
    const md = p.mdot >= 0.01 ? p.mdot.toFixed(2) : p.mdot.toExponential(1)
    const rp = Number.isFinite(d.rPlus) ? d.rPlus.toFixed(3) : '—'
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
