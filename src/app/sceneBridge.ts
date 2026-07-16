/**
 * Application bridge: pure stores → render tracer / bloom / debug mode.
 * Targeted subscriptions + microtask coalesce so multi-store patches
 * (params+disk, presets) upload each channel at most once per turn.
 */
import { getDebug, subscribeDebug } from '../debug/state'
import { diskIsco, thinDiskScaleHeight, autoExposureFromPhysics } from '../physics/disk'
import { plasmaBetaToMriScale } from '../physics/diskParams'
import { resolveCameraDistance } from '../physics/observer'
import { realtimeModeTag, rIscoOverM } from '../physics/metricFamily'
import type { createBloomPipeline } from '../render/bloomPipeline'
import type { GeodesicTracer } from '../render/geodesicTracerTypes'
import { getCamera, subscribeCamera } from '../state/camera'
import { getDisk, subscribeDisk } from '../state/disk'
import { getGeodesicIntegrator, subscribeGeodesic } from '../state/geodesic'
import { getLook, setLook, subscribeLook } from '../state/look'
import { getParams, subscribe as subscribeParams } from '../state/params'
import { getScaleFree, subscribeScaleFree } from '../state/scaleFree'
import { getIdealBeam, subscribeIdealBeam } from '../state/idealBeam'
import { getQuality, subscribeQuality } from '../state/quality'
import { getGrmhd, subscribeGrmhd } from '../state/grmhd'
import { getScene } from '../state/scene'
import { getSky, subscribeSky } from '../state/sky'
import { syncGrmhdToTracer } from './grmhdLoader'

export type BloomPipeline = ReturnType<typeof createBloomPipeline>

export type SceneBridge = {
  applyPhysics: () => void
  applyCamera: () => void
  applyLook: () => void
  applySky: () => void
  applyDebug: () => void
  applyGeodesic: () => void
  applyScaleFree: () => void
  applyIdealBeam: () => void
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
  idealBeam: boolean
  quality: boolean
  grmhd: boolean
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
    idealBeam: false,
    quality: false,
    grmhd: false,
  }
  let scheduled = false

  function applyPhysics(): void {
    const p = getParams()
    const disk = getDisk()
    const rIsco = diskIsco(p, disk.prograde)
    const rinM = rIscoOverM(rIsco, p.mass)
    // H/R from thin-disk scaling + expert Γ (not a free look knob)
    const scaleHeight = thinDiskScaleHeight(disk.mdot, rinM, disk.gamma)
    const mriTurbScale = plasmaBetaToMriScale(disk.plasmaBeta)
    tracer.setSpacetime({
      mass: p.mass,
      spinStar: p.spinStar,
      charge: p.charge,
      mdot: disk.mdot,
      rIscoOverM: rinM,
      outerM: disk.outerM,
      prograde: disk.prograde,
      structure: disk.structure,
      arms: disk.arms,
      clumps: disk.clumps,
      dust: disk.dust,
      scaleHeight,
      shearRate: disk.shearRate,
      animate: disk.animate,
      tiltRad: disk.tiltRad,
      tiltNodeRad: disk.tiltNodeRad,
      jetPower: disk.jetPower,
      mriTurbScale,
    })
    // Exposure from η·ṁ (physics), not a film slider
    setLook({
      exposure: autoExposureFromPhysics(p.spinStar, disk.mdot, disk.prograde),
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

  function applyIdealBeam(): void {
    tracer.setIdealBeam(getIdealBeam())
  }

  function applyQuality(): void {
    const q = getQuality()
    tracer.setQuality({
      maxSteps: q.maxSteps,
      volumeStride: q.volumeStride,
      baseStepM: q.baseStepM,
    })
  }

  function applyGrmhd(): void {
    syncGrmhdToTracer(tracer)
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
    if (dirty.idealBeam) {
      dirty.idealBeam = false
      applyIdealBeam()
    }
    if (dirty.quality) {
      dirty.quality = false
      applyQuality()
    }
    if (dirty.grmhd) {
      dirty.grmhd = false
      applyGrmhd()
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
      subscribeIdealBeam(() => mark('idealBeam')),
      subscribeQuality(() => mark('quality')),
      subscribeGrmhd(() => mark('grmhd')),
      subscribeDebug(() => mark('debug')),
    ]
    return () => {
      for (const u of unsubs) u()
    }
  }

  function formatStats(fps: number, healthLine?: string): string {
    const { params: p, derived: d, disk, camera: c, look, geodesic, scaleFree, idealBeam } =
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
    const orbitTag = disk.prograde ? 'pro' : 'ret'
    const beamTag = idealBeam ? 'g³' : 'g²'
    const qTag = getQuality().level
    const grmhd = getGrmhd()
    const densTag = grmhd.enabled && grmhd.cube ? `dens=${grmhd.label}` : 'dens=analytic'
    const mode = realtimeModeTag(p, geodesic)
    const bloomTag = look.bloomEnabled
      ? `bloom=${look.bloomStrength.toFixed(2)}`
      : 'bloom=off'
    const dbg = getDebug().mode !== 0 ? ` · dbg=${getDebug().mode}` : ''
    const base = `${fps} fps · ${mode} · ${densTag} · ${d.family} · M=${m} a★=${a} Q=${q} ṁ=${md} · ${orbitTag} · ${beamTag} · q=${qTag} · r_out=${disk.outerM.toFixed(0)}M · ${bloomTag} · r₊=${rp} · ${distTag}${dbg}`
    return healthLine ? `${base}
${healthLine}` : base
  }

  return {
    applyPhysics,
    applyCamera,
    applyLook,
    applySky,
    applyDebug,
    applyGeodesic,
    applyScaleFree,
    applyIdealBeam,
    connect,
    formatStats,
    setBloomPipeline: (pipeline) => {
      bloom = pipeline
    },
  }
}
