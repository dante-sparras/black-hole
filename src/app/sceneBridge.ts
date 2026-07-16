/**
 * Application bridge: pure stores → render tracer / bloom / debug mode.
 * Targeted subscriptions + microtask coalesce so multi-store patches
 * (params+disk, presets) upload each channel at most once per turn.
 */
import { getDebug, subscribeDebug } from '../debug/state'
import { resolveCameraDistance } from '../physics/observer'
import { realtimeModeTag, rIscoOverM } from '../physics/metricFamily'
import type { createBloomPipeline } from '../render/bloomPipeline'
import type { GeodesicTracer } from '../render/geodesicTracerTypes'
import { getCamera, subscribeCamera } from '../state/camera'
import { getDisk, subscribeDisk } from '../state/disk'
import { getGeodesicIntegrator, subscribeGeodesic } from '../state/geodesic'
import { getLook, subscribeLook } from '../state/look'
import { getDerived, getParams, subscribe as subscribeParams } from '../state/params'
import { getScaleFree, subscribeScaleFree } from '../state/scaleFree'
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
  applyScaleFree: () => void
  /** Wire store listeners; returns unsubscribe. Applies once immediately via store subs. */
  connect: () => () => void
  formatStats: (fps: number, healthLine?: string) => string
  setBloomPipeline: (pipeline: BloomPipeline | null) => void
}

type Dirty = {
  physics: boolean
  camera: boolean
  look: boolean
  sky: boolean
  debug: boolean
  geodesic: boolean
  scaleFree: boolean
}

export function createSceneBridge(tracer: GeodesicTracer): SceneBridge {
  let bloom: BloomPipeline | null = null
  const dirty: Dirty = {
    physics: false,
    camera: false,
    look: false,
    sky: false,
    debug: false,
    geodesic: false,
    scaleFree: false,
  }
  let scheduled = false

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

  function applyScaleFree(): void {
    tracer.setScaleFree(getScaleFree())
  }

  function flush(): void {
    scheduled = false
    if (dirty.physics) {
      dirty.physics = false
      applyPhysics()
    }
    if (dirty.camera) {
      dirty.camera = false
      applyCamera()
    }
    if (dirty.look) {
      dirty.look = false
      applyLook()
    }
    if (dirty.sky) {
      dirty.sky = false
      applySky()
    }
    if (dirty.debug) {
      dirty.debug = false
      applyDebug()
    }
    if (dirty.geodesic) {
      dirty.geodesic = false
      applyGeodesic()
    }
    if (dirty.scaleFree) {
      dirty.scaleFree = false
      applyScaleFree()
    }
  }

  function mark(key: keyof Dirty): void {
    dirty[key] = true
    if (scheduled) return
    scheduled = true
    queueMicrotask(flush)
  }

  function connect(): () => void {
    const unsubs = [
      subscribeParams(() => mark('physics')),
      subscribeDisk(() => mark('physics')),
      subscribeCamera(() => mark('camera')),
      subscribeLook(() => mark('look')),
      subscribeSky(() => mark('sky')),
      subscribeGeodesic(() => mark('geodesic')),
      subscribeScaleFree(() => mark('scaleFree')),
      subscribeDebug(() => mark('debug')),
    ]
    return () => {
      for (const u of unsubs) u()
    }
  }

  function formatStats(fps: number, healthLine?: string): string {
    const { params: p, derived: d, disk, camera: c, look, geodesic, scaleFree } =
      getScene()
    const m = p.mass.toFixed(2)
    const a = p.spinStar.toFixed(3)
    const q = p.charge.toFixed(3)
    const md = disk.mdot >= 0.01 ? disk.mdot.toFixed(2) : disk.mdot.toExponential(1)
    const rp = Number.isFinite(d.rPlus) ? d.rPlus.toFixed(3) : '—'
    const D = resolveCameraDistance(p.mass, c.distanceM, scaleFree)
    const distTag = scaleFree
      ? `d=${c.distanceM.toFixed(1)}M (D/M)`
      : `D=${D.toFixed(1)} (fixed)`
    const mode = realtimeModeTag(p, geodesic)
    const bloomTag = look.bloomEnabled
      ? `bloom=${look.bloomStrength.toFixed(2)}`
      : 'bloom=off'
    const dbg = getDebug().mode !== 0 ? ` · dbg=${getDebug().mode}` : ''
    const base = `${fps} fps · ${mode} · ${d.family} · M=${m} a★=${a} Q=${q} ṁ=${md} · r_out=${disk.outerM.toFixed(0)}M · ${bloomTag} · r₊=${rp} · ${distTag}${dbg}`
    return healthLine ? `${base}\n${healthLine}` : base
  }

  return {
    applyPhysics,
    applyCamera,
    applyLook,
    applySky,
    applyDebug,
    applyGeodesic,
    applyScaleFree,
    connect,
    formatStats,
    setBloomPipeline: (pipeline) => {
      bloom = pipeline
    },
  }
}
