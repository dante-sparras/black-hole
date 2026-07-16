/** Observer camera (not black-hole hair). Distances in units of M. */
import {
  OBSERVER_DEFAULTS,
  OBSERVER_LIMITS,
  type ObserverCamera,
} from '../physics/observer'
import { clamp } from '../physics/math'
import { emitStore } from './batch'

export type CameraState = ObserverCamera

export const CAMERA_DEFAULTS: CameraState = { ...OBSERVER_DEFAULTS }
export const CAMERA_LIMITS = OBSERVER_LIMITS

type Listener = (cam: CameraState) => void

let camera: CameraState = { ...CAMERA_DEFAULTS }
const listeners = new Set<Listener>()

export function getCamera(): CameraState {
  return camera
}

export function setCamera(partial: Partial<CameraState>): CameraState {
  const next: CameraState = { ...camera, ...partial }

  next.distanceM = clamp(
    next.distanceM,
    CAMERA_LIMITS.distanceM.min,
    CAMERA_LIMITS.distanceM.max,
  )
  next.inclination = clamp(
    next.inclination,
    CAMERA_LIMITS.inclination.min,
    CAMERA_LIMITS.inclination.max,
  )
  next.azimuth = wrapAngle(next.azimuth)
  next.fov = clamp(next.fov, CAMERA_LIMITS.fov.min, CAMERA_LIMITS.fov.max)

  camera = next
  emitStore('camera', () => {
    for (const listener of listeners) listener(camera)
  })
  return camera
}

export function subscribeCamera(listener: Listener): () => void {
  listeners.add(listener)
  listener(camera)
  return () => {
    listeners.delete(listener)
  }
}

function wrapAngle(a: number): number {
  const tau = Math.PI * 2
  let x = a % tau
  if (x < 0) x += tau
  return x
}

export function radToDeg(r: number): number {
  return (r * 180) / Math.PI
}

export function degToRad(d: number): number {
  return (d * Math.PI) / 180
}
