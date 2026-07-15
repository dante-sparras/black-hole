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
  applySky: () => void
  connect: () => () => void
  getSpacetime: () => SpacetimeUniforms
  formatStats: (fps: number) => string
  setBloomPipeline: (pipeline: BloomPipeline | null) => void
}

export function createSceneBridge(tracer: GeodesicTracer): SceneBridge {
  const initial = getScene()
  let spacetime = toUniforms(initial.params, initial.derived, initial.disk)
  let bloom: BloomPipeline | null = null

  function applyPhysics(): void {
    const { params: p, derived: d, disk } = getScene()
    spacetime = toUniforms(p, d, disk)
    tracer.setSpacetime({
      mass: p.mass,
      spinStar: p.spinStar,
      charge: p.charge,
      mdot: disk.mdot,
      rIscoOverM: rIscoOverM(d.rIsco, p.mass),
      outerM: disk.outerM,
    })
  }

  function applyCamera(): void {
    tracer.setCamera(getScene().camera)
  }

  function applyLook(): void {
    if (bloom) bloom.applyLook(getScene().look)
  }

  function applySky(): void {
    tracer.setSky(getScene().sky)
  }

  function connect(): () => void {
    return subscribeScene(() => {
      applyPhysics()
      applyCamera()
      applyLook()
      applySky()
    })
  }

  function formatStats(fps: number): string {
    const { params: p, derived: d, disk, camera: c, look } = getScene()
    const m = p.mass.toFixed(2)
    const a = p.spinStar.toFixed(3)
    const q = p.charge.toFixed(3)
    const md = disk.mdot >= 0.01 ? disk.mdot.toFixed(2) : disk.mdot.toExponential(1)
    const rp = Number.isFinite(d.rPlus) ? d.rPlus.toFixed(3) : '—'
    const dist = c.distanceM.toFixed(1)
    const mode = realtimeModeTag(p)
    const bloomTag = look.bloomEnabled
      ? `bloom=${look.bloomStrength.toFixed(2)}`
      : 'bloom=off'
    return `${fps} fps · ${mode} · ${d.family} · M=${m} a★=${a} Q=${q} ṁ=${md} · r_out=${disk.outerM.toFixed(0)}M · ${bloomTag} · r₊=${rp} · D=${dist}M`
  }

  return {
    applyPhysics,
    applyCamera,
    applyLook,
    applySky,
    connect,
    getSpacetime: () => spacetime,
    formatStats,
    setBloomPipeline: (pipeline) => {
      bloom = pipeline
    },
  }
}
