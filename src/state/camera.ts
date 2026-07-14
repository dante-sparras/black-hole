/** Observer camera (not black-hole hair). Distances in units of M. */

export type CameraState = {
  /** Distance from BH center, in units of M */
  distanceM: number
  /** Polar angle from +z (spin axis), radians. 0 = face-on, π/2 = edge-on */
  inclination: number
  /** Azimuth around z, radians */
  azimuth: number
  /** Half-screen FOV scale (shader ray offset strength) */
  fov: number
}

export const CAMERA_DEFAULTS: CameraState = {
  distanceM: 28,
  inclination: 1.2, // ~69° from face-on
  azimuth: 0,
  fov: 0.7,
}

export const CAMERA_LIMITS = {
  distanceM: { min: 8, max: 120 },
  inclination: { min: 0.05, max: Math.PI - 0.05 },
  fov: { min: 0.2, max: 1.4 },
} as const

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
  // azimuth free-wrap
  next.azimuth = wrapAngle(next.azimuth)
  next.fov = clamp(next.fov, CAMERA_LIMITS.fov.min, CAMERA_LIMITS.fov.max)

  camera = next
  for (const listener of listeners) listener(camera)
  return camera
}

export function subscribeCamera(listener: Listener): () => void {
  listeners.add(listener)
  listener(camera)
  return () => {
    listeners.delete(listener)
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
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
