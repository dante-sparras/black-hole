/**
 * Unified scene snapshot: no-hair + disk + camera + look + sky + globals.
 * Sky, geodesic, scale-free, ideal beam, quality, grmhd dens mode are global
 * (presets should not override them unless intentional).
 */
import type { DiskInput, DiskParams } from '../physics/diskParams'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import type { ParamsInput } from '../physics/validate'
import { withBatch } from './batch'
import {
  getCamera,
  setCamera,
  subscribeCamera,
  type CameraState,
} from './camera'
import { getDisk, setDisk, subscribeDisk } from './disk'
import {
  getGeodesicIntegrator,
  setGeodesicIntegrator,
  subscribeGeodesic,
  type GeodesicIntegrator,
} from './geodesic'
import {
  getGrmhd,
  setGrmhd,
  subscribeGrmhd,
  type GrmhdState,
} from './grmhd'
import { getLook, setLook, subscribeLook, type LookState } from './look'
import {
  getDerived,
  getParams,
  setParams,
  subscribe as subscribeParams,
} from './params'
import {
  getQuality,
  setQuality,
  subscribeQuality,
  type QualityConfig,
  type QualityLevel,
} from './quality'
import {
  getScaleFree,
  setScaleFree,
  subscribeScaleFree,
} from './scaleFree'
import {
  getIdealBeam,
  setIdealBeam,
  subscribeIdealBeam,
} from './idealBeam'
import { getSky, setSky, subscribeSky, type SkyState } from './sky'

/** Lightweight dens-mode view for snapshots (no cube payload). */
export type GrmhdSceneView = {
  enabled: boolean
  mix: number
  label: string
  error: string | null
  /** Whether a cube is currently loaded */
  hasCube: boolean
}

export type SceneSnapshot = {
  params: BlackHoleParams
  derived: DerivedGeometry
  disk: DiskParams
  camera: CameraState
  look: LookState
  sky: SkyState
  /** Global geodesic integrator (rt | bl) — not hair, not per-preset */
  geodesic: GeodesicIntegrator
  /** Global scale-free camera (D∝M) — not hair, not per-preset */
  scaleFree: boolean
  /** Global ideal I∝g³ beam — not hair, not per-preset */
  idealBeam: boolean
  /** Numerics quality (not physics law) */
  quality: QualityConfig
  /** Dens source mode (not physics law; cube binary not included) */
  grmhd: GrmhdSceneView
}

export type ScenePatch = {
  params?: ParamsInput
  disk?: DiskInput
  camera?: Partial<CameraState>
  look?: Partial<LookState>
  /** Optional — presets should leave sky alone */
  sky?: Partial<SkyState>
  geodesic?: GeodesicIntegrator
  /** Optional — presets should leave scaleFree alone */
  scaleFree?: boolean
  /** Optional — presets should leave idealBeam alone */
  idealBeam?: boolean
  /** Optional quality level */
  quality?: QualityLevel
  /** Optional dens mode (not cube bytes) */
  grmhd?: Partial<Pick<GrmhdState, 'enabled' | 'mix' | 'label' | 'error'>>
}

type SceneListener = (scene: SceneSnapshot) => void

function grmhdView(): GrmhdSceneView {
  const g = getGrmhd()
  return {
    enabled: g.enabled,
    mix: g.mix,
    label: g.label,
    error: g.error,
    hasCube: g.cube !== null,
  }
}

export function getScene(): SceneSnapshot {
  return {
    params: getParams(),
    derived: getDerived(),
    disk: getDisk(),
    camera: getCamera(),
    look: getLook(),
    sky: getSky(),
    geodesic: getGeodesicIntegrator(),
    scaleFree: getScaleFree(),
    idealBeam: getIdealBeam(),
    quality: getQuality(),
    grmhd: grmhdView(),
  }
}

export function setScene(patch: ScenePatch): SceneSnapshot {
  withBatch(() => {
    if (patch.params) setParams(patch.params)
    if (patch.disk) setDisk(patch.disk)
    if (patch.camera) setCamera(patch.camera)
    if (patch.look) setLook(patch.look)
    if (patch.sky) setSky(patch.sky)
    if (patch.geodesic) setGeodesicIntegrator(patch.geodesic)
    if (typeof patch.scaleFree === 'boolean') setScaleFree(patch.scaleFree)
    if (typeof patch.idealBeam === 'boolean') setIdealBeam(patch.idealBeam)
    if (patch.quality) setQuality(patch.quality)
    if (patch.grmhd) setGrmhd(patch.grmhd)
  })
  return getScene()
}

export function subscribeScene(listener: SceneListener): () => void {
  const fire = () => listener(getScene())
  const unsubs = [
    subscribeParams(() => fire()),
    subscribeDisk(() => fire()),
    subscribeCamera(() => fire()),
    subscribeLook(() => fire()),
    subscribeSky(() => fire()),
    subscribeGeodesic(() => fire()),
    subscribeScaleFree(() => fire()),
    subscribeIdealBeam(() => fire()),
    subscribeQuality(() => fire()),
    subscribeGrmhd(() => fire()),
  ]
  fire()
  return () => {
    for (const u of unsubs) u()
  }
}
