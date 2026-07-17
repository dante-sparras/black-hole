/**
 * Application bridge: pure stores → render tracer / bloom / debug mode.
 * Targeted subscriptions + microtask coalesce so multi-store patches
 * (params+disk, presets) upload each channel at most once per turn.
 */
import { getDebug, subscribeDebug } from '../debug/state'
import { autoExposureFromPhysics } from '../physics/disk'
import {
  magnetClassFromBeta,
  plasmaBetaToMriScale,
  perturbFromBeta,
  rhoTemperatureScale,
} from '../physics/diskParams'
import { effectiveDiskGeom } from '../physics/diskGeometry'
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
import { subscribeGrmhd } from '../state/grmhd'
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
    const geom = effectiveDiskGeom(p, disk)
    const rinM = geom.rinOverM
    // Free H/r — no longer derived from ṁ
    const scaleHeight = disk.scaleHeight
    const magnetClass = magnetClassFromBeta(disk.plasmaBeta)
    const mriTurbScale = plasmaBetaToMriScale(disk.plasmaBeta, magnetClass)
    const polyTScale = rhoTemperatureScale(disk.rho0, disk.gamma)
    const madBoost = magnetClass === 'mad' ? 1 : 0
    const perturbAmp = perturbFromBeta(disk.plasmaBeta)
    tracer.setSpacetime({
      mass: p.mass,
      spinStar: p.spinStar,
      charge: p.charge,
      mdot: disk.mdot,
      rIscoOverM: rinM,
      outerM: disk.outerM,
      structure: disk.structure,
      arms: disk.arms,
      clumps: disk.clumps,
      dust: disk.dust,
      scaleHeight,
      shearRate: disk.shearRate,
      animate: disk.animate,
      tiltRad: disk.tiltRad,
      jetBoost: disk.jetBoost,
      mriTurbScale,
      rho0: disk.rho0,
      polyTScale,
      rPeakOverM: geom.rPeakOverM,
      madBoost,
      perturbAmp,
    })
    setLook({
      exposure: autoExposureFromPhysics(
        p.spinStar,
        disk.mdot * Math.sqrt(disk.rho0),
        true,
      ),
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

  function formatStats(fps: number, _healthLine?: string): string {
      const { quality } = getScene()
      // Top bar: FPS + quality only — science lives in Readouts
      return `${fps} fps · ${quality.level}`
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
