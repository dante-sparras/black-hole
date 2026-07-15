/**
 * Unified scene snapshot: no-hair + disk + camera + look.
 */
import type { DiskParams } from '../physics/diskParams'
import type { DiskInput } from '../physics/diskParams'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import type { ParamsInput } from '../physics/validate'
import {
  getCamera,
  setCamera,
  subscribeCamera,
  type CameraState,
} from './camera'
import { getDisk, setDisk, subscribeDisk } from './disk'
import { getLook, setLook, subscribeLook, type LookState } from './look'
import {
  getDerived,
  getParams,
  setParams,
  subscribe as subscribeParams,
} from './params'

export type SceneSnapshot = {
  params: BlackHoleParams
  derived: DerivedGeometry
  disk: DiskParams
  camera: CameraState
  look: LookState
}

export type ScenePatch = {
  params?: ParamsInput
  disk?: DiskInput
  camera?: Partial<CameraState>
  look?: Partial<LookState>
}

type SceneListener = (scene: SceneSnapshot) => void

export function getScene(): SceneSnapshot {
  return {
    params: getParams(),
    derived: getDerived(),
    disk: getDisk(),
    camera: getCamera(),
    look: getLook(),
  }
}

export function setScene(patch: ScenePatch): SceneSnapshot {
  if (patch.params) setParams(patch.params)
  if (patch.disk) setDisk(patch.disk)
  if (patch.camera) setCamera(patch.camera)
  if (patch.look) setLook(patch.look)
  return getScene()
}

export function subscribeScene(listener: SceneListener): () => void {
  const fire = () => listener(getScene())
  const u1 = subscribeParams(() => fire())
  const u2 = subscribeDisk(() => fire())
  const u3 = subscribeCamera(() => fire())
  const u4 = subscribeLook(() => fire())
  fire()
  return () => {
    u1()
    u2()
    u3()
    u4()
  }
}
