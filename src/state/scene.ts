/**
 * Unified scene snapshot facade over params + camera + look stores.
 * Does not replace the individual stores — composes them for app code.
 */
import {
  getCamera,
  setCamera,
  subscribeCamera,
  type CameraState,
} from './camera'
import { getLook, setLook, subscribeLook, type LookState } from './look'
import {
  getDerived,
  getParams,
  setParams,
  subscribe as subscribeParams,
} from './params'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import type { ParamsInput } from '../physics/validate'

export type SceneSnapshot = {
  params: BlackHoleParams
  derived: DerivedGeometry
  camera: CameraState
  look: LookState
}

export type ScenePatch = {
  params?: ParamsInput
  camera?: Partial<CameraState>
  look?: Partial<LookState>
}

type SceneListener = (scene: SceneSnapshot) => void

export function getScene(): SceneSnapshot {
  return {
    params: getParams(),
    derived: getDerived(),
    camera: getCamera(),
    look: getLook(),
  }
}

/** Apply any combination of physics / camera / look in one call. */
export function setScene(patch: ScenePatch): SceneSnapshot {
  if (patch.params) setParams(patch.params)
  if (patch.camera) setCamera(patch.camera)
  if (patch.look) setLook(patch.look)
  return getScene()
}

/**
 * Subscribe to all scene slices. Fires on any change.
 * Returns a single unsubscribe.
 */
export function subscribeScene(listener: SceneListener): () => void {
  const fire = () => listener(getScene())
  const u1 = subscribeParams(() => fire())
  const u2 = subscribeCamera(() => fire())
  const u3 = subscribeLook(() => fire())
  fire()
  return () => {
    u1()
    u2()
    u3()
  }
}
