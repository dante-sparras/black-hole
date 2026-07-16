/**
 * CPU ray probe + verbose step log (P3).
 * Topology twin of GPU path for a single NDC pixel.
 */
import { diskIsco } from '../physics/disk'
import { knHorizon } from '../physics/kn'
import { OBSERVER_DEFAULTS, resolveCameraDistance, type ObserverCamera } from '../physics/observer'
import type { BlackHoleParams } from '../physics/types'
import { spinLength } from '../physics/types'
import { normalizeParams } from '../physics/validate'
import { rk2StepKn } from '../physics/geodesic/kerrNull'
import { RT, rtStepSize } from '../physics/geodesic/rtConstants'
import {
  add,
  cross,
  dot,
  length3,
  normalize,
  scale,
  type Vec3,
  vec3,
} from '../physics/geodesic/vec3'
import type { CpuRefFate } from '../physics/geodesic/cpuRef'

export type ProbeStep = {
  i: number
  r: number
  x: number
  y: number
  z: number
  event?: 'capture' | 'escape' | 'disk' | 'stall'
}

export type ProbeResult = {
  fate: CpuRefFate
  hits: number
  minR: number
  steps: number
  maxSteps: number
  /** |L| at camera ≈ impact parameter scale */
  impactB: number
  ndcX: number
  ndcY: number
  captureR: number
  rPlus: number
  rin: number
  rout: number
  stepsLog: ProbeStep[]
  summary: string
}

function camBasis(
  cam: ObserverCamera,
  mass: number,
  scaleFree: boolean,
): {
  origin: Vec3
  forward: Vec3
  right: Vec3
  up: Vec3
  camD: number
} {
  const camD = resolveCameraDistance(mass, cam.distanceM, scaleFree)
  const th = cam.inclination
  const ph = cam.azimuth
  const origin: Vec3 = {
    x: Math.sin(th) * Math.cos(ph) * camD,
    y: Math.cos(th) * camD,
    z: Math.sin(th) * Math.sin(ph) * camD,
  }
  const forward = normalize(scale(origin, -1))
  const worldUp = vec3(0, 1, 0)
  let right = cross(forward, worldUp)
  if (length3(right) < 1e-6) right = vec3(1, 0, 0)
  right = normalize(right)
  const up = normalize(cross(right, forward))
  return { origin, forward, right, up, camD }
}

export type ProbeOptions = {
  params?: Partial<BlackHoleParams>
  camera?: Partial<ObserverCamera>
  ndcX?: number
  ndcY?: number
  diskOuterM?: number
  maxSteps?: number
  /** Log every Nth step + events (default 8) */
  logStride?: number
  scaleFree?: boolean
  /** Disk orbital sense (default prograde). */
  prograde?: boolean
}

/**
 * Integrate one ray with a step log for HUD / debugging.
 */
export function probeRay(options: ProbeOptions = {}): ProbeResult {
  const params = normalizeParams(options.params ?? {})
  const camera: ObserverCamera = { ...OBSERVER_DEFAULTS, ...options.camera }
  const ndcX = options.ndcX ?? 0
  const ndcY = options.ndcY ?? 0
  const maxSteps = options.maxSteps ?? RT.maxSteps
  const logStride = options.logStride ?? 8
  const diskOuterM = options.diskOuterM ?? RT.diskOuterM

  const M = params.mass
  const a = spinLength(params)
  const Q = params.charge
  const rIsco = diskIsco(params, options.prograde ?? true)
  const rPlus = knHorizon(M, a, Q)
  const rin = Math.max(
    rIsco,
    (Number.isFinite(rPlus) ? rPlus : 2 * M) * RT.iscoHorizonMargin,
  )
  const rout = diskOuterM * M
  const { origin, forward, right, up, camD } = camBasis(
    camera,
    M,
    options.scaleFree ?? true,
  )

  const dir = normalize(
    add(add(forward, scale(right, ndcX * camera.fov)), scale(up, ndcY * camera.fov)),
  )
  const impactB = length3(cross(origin, dir))

  const captureR =
    (Number.isFinite(rPlus) ? rPlus : 2 * M) * RT.captureMargin

  let pos = { ...origin }
  let vel = { ...dir }
  let prevY = pos.y
  let hits = 0
  let minR = length3(pos)
  const stepsLog: ProbeStep[] = []
  let fate: CpuRefFate = 'escape'
  let stepsUsed = 0

  const pushLog = (i: number, event?: ProbeStep['event']) => {
    stepsLog.push({
      i,
      r: length3(pos),
      x: pos.x,
      y: pos.y,
      z: pos.z,
      event,
    })
  }
  pushLog(0)

  for (let i = 0; i < maxSteps; i++) {
    stepsUsed = i + 1
    const r = length3(pos)
    if (r < minR) minR = r

    if (r <= captureR) {
      fate = hits > 0 ? 'disk' : 'capture'
      pushLog(i, hits > 0 ? 'disk' : 'capture')
      break
    }
    if (r > camD * RT.escapeCamFactor && dot(pos, vel) > 0) {
      fate = hits > 0 ? 'disk' : 'escape'
      pushLog(i, hits > 0 ? 'disk' : 'escape')
      break
    }

    const ds = rtStepSize(r, M)
    prevY = pos.y
    const p0 = { ...pos }
    const next = rk2StepKn(pos, vel, M, a, Q, ds)
    pos = next.pos
    vel = next.vel

    if (prevY * pos.y < 0) {
      const denom = prevY - pos.y
      const t = Math.abs(denom) < 1e-15 ? 0 : prevY / denom
      const hx = p0.x + (pos.x - p0.x) * t
      const hz = p0.z + (pos.z - p0.z) * t
      const rho = Math.hypot(hx, hz)
      if (rho >= rin && rho <= rout) {
        hits++
        pushLog(i, 'disk')
      }
    } else if (i % logStride === 0) {
      pushLog(i)
    }

    if (i === maxSteps - 1) {
      if (minR < RT.stalledCaptureM * M) {
        fate = hits > 0 ? 'disk' : 'capture'
        pushLog(i, 'stall')
      } else {
        fate = hits > 0 ? 'disk' : 'escape'
        pushLog(i)
      }
    }
  }

  const summary =
    `fate=${fate} hits=${hits} minR=${(minR / M).toFixed(3)}M ` +
    `steps=${stepsUsed}/${maxSteps} b≈${(impactB / M).toFixed(3)}M ` +
    `r₊=${Number.isFinite(rPlus) ? (rPlus / M).toFixed(3) : '—'}M`

  return {
    fate,
    hits,
    minR,
    steps: stepsUsed,
    maxSteps,
    impactB,
    ndcX,
    ndcY,
    captureR,
    rPlus: Number.isFinite(rPlus) ? rPlus : Number.NaN,
    rin,
    rout,
    stepsLog,
    summary,
  }
}
