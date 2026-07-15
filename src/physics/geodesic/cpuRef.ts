/**
 * CPU reference ray-march — topology twin of the GPU geodesicTracer.
 * Uses knNullAccel + RT step floor (same physics family routing).
 */
import { diskIsco } from '../disk'
import { knHorizon } from '../kn'
import {
  OBSERVER_DEFAULTS,
  type ObserverCamera,
} from '../observer'
import type { BlackHoleParams } from '../types'
import { spinLength } from '../types'
import { normalizeParams } from '../validate'
import { rk4StepKn } from './kerrNull'
import { RT, rtStepSize } from './rtConstants'
import {
  add,
  cross,
  dot,
  length3,
  normalize,
  scale,
  type Vec3,
  vec3,
} from './vec3'

export type CpuRefFate = 'capture' | 'disk' | 'escape' | 'max'

export type CpuRefCounts = Record<CpuRefFate, number>

export type CpuRefPixel = {
  fate: CpuRefFate
  hits: number
  minR: number
  steps: number
}

export type CpuRefOptions = {
  params?: Partial<BlackHoleParams>
  camera?: Partial<ObserverCamera>
  /** Override r_ISCO (absolute); default from diskIsco(params) */
  rIsco?: number
  diskOuterM?: number
  width?: number
  height?: number
  maxSteps?: number
}

export type CpuRefResult = {
  counts: CpuRefCounts
  width: number
  height: number
  center: CpuRefPixel
  params: BlackHoleParams
  camera: ObserverCamera
  /** Row-major RGB 0–255 for optional PPM */
  rgb: Uint8Array
}

function camBasis(cam: ObserverCamera, mass: number): {
  origin: Vec3
  forward: Vec3
  right: Vec3
  up: Vec3
  camD: number
} {
  const camD = cam.distanceM * mass
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

export function traceCpuRefPixel(
  ndcX: number,
  ndcY: number,
  opts: {
    mass: number
    spinLength: number
    charge: number
    origin: Vec3
    forward: Vec3
    right: Vec3
    up: Vec3
    camD: number
    fov: number
    rin: number
    rout: number
    maxSteps: number
  },
): CpuRefPixel {
  const {
    mass: M,
    spinLength: a,
    charge: Q,
    origin,
    forward,
    right,
    up,
    camD,
    fov,
    rin,
    rout,
    maxSteps,
  } = opts

  const dir = normalize(
    add(add(forward, scale(right, ndcX * fov)), scale(up, ndcY * fov)),
  )

  const rPlus = knHorizon(M, a, Q)
  const captureR =
    (Number.isFinite(rPlus) ? rPlus : 2 * M) * RT.captureMargin

  let pos = { ...origin }
  let vel = { ...dir }
  let prevY = pos.y
  let hits = 0
  let minR = length3(pos)
  let stepsUsed = 0

  for (let i = 0; i < maxSteps; i++) {
    stepsUsed = i + 1
    const r = length3(pos)
    if (r < minR) minR = r

    if (r <= captureR) {
      return { fate: hits > 0 ? 'disk' : 'capture', hits, minR, steps: stepsUsed }
    }
    if (r > camD * RT.escapeCamFactor && dot(pos, vel) > 0) {
      return { fate: hits > 0 ? 'disk' : 'escape', hits, minR, steps: stepsUsed }
    }

    const ds = rtStepSize(r, M)
    prevY = pos.y
    const p0 = { ...pos }
    const next = rk4StepKn(pos, vel, M, a, Q, ds)
    pos = next.pos
    vel = next.vel

    if (prevY * pos.y < 0) {
      const denom = prevY - pos.y
      const t = Math.abs(denom) < 1e-15 ? 0 : prevY / denom
      const hx = p0.x + (pos.x - p0.x) * t
      const hz = p0.z + (pos.z - p0.z) * t
      const rho = Math.hypot(hx, hz)
      if (rho >= rin && rho <= rout) hits++
    }
  }

  if (minR < RT.stalledCaptureM * M) {
    return { fate: hits > 0 ? 'disk' : 'capture', hits, minR, steps: stepsUsed }
  }
  // Match GPU: unfinished rays that never skim the photon sphere → escape
  return { fate: hits > 0 ? 'disk' : 'escape', hits, minR, steps: stepsUsed }
}

function fateRgb(fate: CpuRefFate, minR: number, mass: number): [number, number, number] {
  if (fate === 'capture') return [0, 0, 0]
  if (fate === 'disk') return [220, 120, 40]
  if (fate === 'escape') {
    if (minR < 3.5 * mass) return [40, 180, 200]
    return [20, 24, 40]
  }
  return [80, 80, 80]
}

/**
 * Rasterize a small CPU reference image and topology counts.
 */
export function renderCpuRef(options: CpuRefOptions = {}): CpuRefResult {
  const params = normalizeParams(options.params ?? {})
  const camera: ObserverCamera = { ...OBSERVER_DEFAULTS, ...options.camera }
  const W = options.width ?? 96
  const H = options.height ?? 54
  const maxSteps = options.maxSteps ?? RT.maxSteps
  const diskOuterM = options.diskOuterM ?? RT.diskOuterM

  const M = params.mass
  const a = spinLength(params)
  const Q = params.charge
  const rIsco = options.rIsco ?? diskIsco(params)
  const rPlus = knHorizon(M, a, Q)
  const rin = Math.max(
    rIsco,
    (Number.isFinite(rPlus) ? rPlus : 2 * M) * RT.iscoHorizonMargin,
  )
  const rout = diskOuterM * M

  const { origin, forward, right, up, camD } = camBasis(camera, M)

  const counts: CpuRefCounts = { capture: 0, disk: 0, escape: 0, max: 0 }
  const rgb = new Uint8Array(W * H * 3)
  let center: CpuRefPixel | null = null
  const aspect = W / H

  const traceOpts = {
    mass: M,
    spinLength: a,
    charge: Q,
    origin,
    forward,
    right,
    up,
    camD,
    fov: camera.fov,
    rin,
    rout,
    maxSteps,
  }

  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const ndcX = ((i + 0.5) / W) * 2 - 1
      const ndcY = -(((j + 0.5) / H) * 2 - 1)
      const pix = traceCpuRefPixel(ndcX * aspect, ndcY, traceOpts)
      counts[pix.fate]++

      const isCenter =
        i === Math.floor(W / 2) && j === Math.floor(H / 2)
      if (isCenter) center = pix

      const [R, G, B] = fateRgb(pix.fate, pix.minR, M)
      const o = (j * W + i) * 3
      rgb[o] = R
      rgb[o + 1] = G
      rgb[o + 2] = B
    }
  }

  return {
    counts,
    width: W,
    height: H,
    center: center ?? traceCpuRefPixel(0, 0, traceOpts),
    params,
    camera,
    rgb,
  }
}

/** Encode RGB buffer as ASCII PPM (P3). */
export function rgbToPpm(width: number, height: number, rgb: Uint8Array): string {
  const parts: string[] = [`P3\n${width} ${height}\n255\n`]
  for (let i = 0; i < rgb.length; i += 3) {
    parts.push(`${rgb[i]} ${rgb[i + 1]} ${rgb[i + 2]}`)
  }
  return parts.join(' ') + '\n'
}
