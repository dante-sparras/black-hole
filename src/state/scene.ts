/**
 * Unified scene snapshot: no-hair + disk + camera + look + sky + geodesic mode.
 * Sky and geodesic integrator are global (not overridden by presets).
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
import { getLook, setLook, subscribeLook, type LookState } from './look'
import {
  getDerived,
  getParams,
  setParams,
  subscribe as subscribeParams,
} from './params'
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
}

type SceneListener = (scene: SceneSnapshot) => void

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
  })
  return getScene()
}

export function subscribeScene(listener: SceneListener): () => void {
  const fire = () => listener(getScene())
  const u1 = subscribeParams(() => fire())
  const u2 = subscribeDisk(() => fire())
  const u3 = subscribeCamera(() => fire())
  const u4 = subscribeLook(() => fire())
  const u5 = subscribeSky(() => fire())
  const u6 = subscribeGeodesic(() => fire())
  const u7 = subscribeScaleFree(() => fire())
  const u8 = subscribeIdealBeam(() => fire())
  fire()
  return () => {
    u1()
    u2()
    u3()
    u4()
    u5()
    u6()
    u7()
    u8()
  }
}
