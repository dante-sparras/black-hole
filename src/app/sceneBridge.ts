/**
 * Application bridge: pure stores → render tracer / bloom / debug mode.
 * Targeted subscriptions so a sky tweak does not re-upload spacetime, etc.
 */
import { getDebug, subscribeDebug } from '../debug/state'
import { realtimeModeTag, rIscoOverM } from '../physics/metricFamily'
import type { createBloomPipeline } from '../render/bloomPipeline'
import type { GeodesicTracer } from '../render/geodesicTracerTypes'
import { getCamera, subscribeCamera } from '../state/camera'
import { getDisk, subscribeDisk } from '../state/disk'
import { getGeodesicIntegrator, subscribeGeodesic } from '../state/geodesic'
import { getLook, subscribeLook } from '../state/look'
import { getDerived, getParams, subscribe as subscribeParams } from '../state/params'
import { getScene } from '../state/scene'
import { getSky, subscribeSky } from '../state/sky'

export type BloomPipeline = ReturnType<typeof createBloomPipeline>

export type SceneBridge = {
  applyPhysics: () => void
  applyCamera: () => void
  applyLook: () => void
  applySky: () => void
  applyDebug: () => void
  applyGeodesic: () => void
  /** Wire store listeners; returns unsubscribe. Applies once immediately via store subs. */
  connect: () => () => void
  formatStats: (fps: number, healthLine?: string) => string
  setBloomPipeline: (pipeline: BloomPipeline | null) => void
}

export function createSceneBridge(tracer: GeodesicTracer): SceneBridge {
  let bloom: BloomPipeline | null = null

  function applyPhysics(): void {
    const p = getParams()
    const d = getDerived()
    const disk = getDisk()
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
    tracer.setCamera(getCamera())
  }

  function applyLook(): void {
    if (bloom) bloom.applyLook(getLook())
  }

  function applySky(): void {
    tracer.setSky(getSky())
  }

  function applyDebug(): void {
    tracer.setDebugMode(getDebug().mode)
  }

  function applyGeodesic(): void {
    const mode = getGeodesicIntegrator()
    tracer.setIntegratorMode(mode === 'bl' ? 1 : 0)
  }

  function connect(): () => void {
    // Each store subscribe fires once on attach — full initial upload.
    const unsubs = [
      subscribeParams(() => applyPhysics()),
      subscribeDisk(() => applyPhysics()),
      subscribeCamera(() => applyCamera()),
      subscribeLook(() => applyLook()),
      subscribeSky(() => applySky()),
      subscribeGeodesic(() => applyGeodesic()),
      subscribeDebug(() => applyDebug()),
    ]
    return () => {
      for (const u of unsubs) u()
    }
  }

  function formatStats(fps: number, healthLine?: string): string {
    const { params: p, derived: d, disk, camera: c, look, geodesic } = getScene()
    const m = p.mass.toFixed(2)
    const a = p.spinStar.toFixed(3)
    const q = p.charge.toFixed(3)
    const md = disk.mdot >= 0.01 ? disk.mdot.toFixed(2) : disk.mdot.toExponential(1)
    const rp = Number.isFinite(d.rPlus) ? d.rPlus.toFixed(3) : '—'
    const dist = c.distanceM.toFixed(1)
    const mode = realtimeModeTag(p, geodesic)
    const bloomTag = look.bloomEnabled
      ? `bloom=${look.bloomStrength.toFixed(2)}`
      : 'bloom=off'
    const dbg = getDebug().mode !== 0 ? ` · dbg=${getDebug().mode}` : ''
    const base = `${fps} fps · ${mode} · ${d.family} · M=${m} a★=${a} Q=${q} ṁ=${md} · r_out=${disk.outerM.toFixed(0)}M · ${bloomTag} · r₊=${rp} · D=${dist}M${dbg}`
    return healthLine ? `${base}\n${healthLine}` : base
  }

  return {
    applyPhysics,
    applyCamera,
    applyLook,
    applySky,
    applyDebug,
    applyGeodesic,
    connect,
    formatStats,
    setBloomPipeline: (pipeline) => {
      bloom = pipeline
    },
  }
}
