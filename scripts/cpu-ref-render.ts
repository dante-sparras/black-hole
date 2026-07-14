/**
 * CPU reference renderer — same physics as the GPU tracer.
 * Writes a tiny PPM so we can verify shadow + disk topology.
 */
import { writeFileSync } from 'fs'
import {
  add,
  cross,
  dot,
  length3,
  normalize,
  scale,
  type Vec3,
  vec3,
} from '../src/physics/geodesic/vec3'
import { rk4Step } from '../src/physics/geodesic/schwarzschildNull'

const M = 1
const rs = 2 * M
const camD = 30 * M
const incl = 1.25
const fov = 0.65
const rin = 6 * M
const rout = 18 * M
const W = 96
const H = 54

const camPos: Vec3 = {
  x: Math.sin(incl) * camD,
  y: Math.cos(incl) * camD,
  z: 0,
}
const forward = normalize(scale(camPos, -1))
const worldUp = vec3(0, 1, 0)
let right = cross(forward, worldUp)
if (length3(right) < 1e-6) right = vec3(1, 0, 0)
right = normalize(right)
const up = normalize(cross(right, forward))

type Fate = 'capture' | 'disk' | 'escape' | 'max'

function trace(ndcX: number, ndcY: number): { fate: Fate; hits: number; minR: number } {
  const dir = normalize(
    add(
      add(forward, scale(right, ndcX * fov)),
      scale(up, ndcY * fov),
    ),
  )
  let pos = { ...camPos }
  let vel = { ...dir }
  let prevY = pos.y
  let hits = 0
  let minR = length3(pos)
  const maxSteps = 800

  for (let i = 0; i < maxSteps; i++) {
    const r = length3(pos)
    if (r < minR) minR = r
    if (r <= rs * 1.002) return { fate: hits > 0 ? 'disk' : 'capture', hits, minR }
    if (r > camD * 8 && dot(pos, vel) > 0) {
      return { fate: hits > 0 ? 'disk' : 'escape', hits, minR }
    }

    const adapt = Math.min(1.25, Math.max(0.03, r / M / 8))
    const yFactor = Math.min(1, Math.max(0.06, Math.abs(pos.y) / (M * 0.8)))
    const ds = 0.04 * M * adapt * yFactor

    prevY = pos.y
    const p0 = { ...pos }
    // Use same RK4 as physics module (higher quality than GPU RK2)
    const next = rk4Step(pos, vel, rs, ds)
    pos = next.pos
    vel = next.vel

    if (prevY * pos.y < 0) {
      const t = prevY / (prevY - pos.y)
      const hx = p0.x + (pos.x - p0.x) * t
      const hz = p0.z + (pos.z - p0.z) * t
      const rho = Math.hypot(hx, hz)
      if (rho >= rin && rho <= rout) hits++
    }
  }
  return { fate: hits > 0 ? 'disk' : 'max', hits, minR }
}

const counts = { capture: 0, disk: 0, escape: 0, max: 0 }
const ppm: number[] = []

for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const ndcX = ((i + 0.5) / W) * 2 - 1
    const ndcY = -(((j + 0.5) / H) * 2 - 1) // top row = +Y
    const aspect = W / H
    const r = trace(ndcX * aspect, ndcY)
    counts[r.fate]++

    // RGB
    let R = 0,
      G = 0,
      B = 0
    if (r.fate === 'capture') {
      R = G = B = 0
    } else if (r.fate === 'disk') {
      R = 220
      G = 120
      B = 40
    } else if (r.fate === 'escape') {
      R = 20
      G = 24
      B = 40
    } else {
      R = G = B = 80
    }
    // Mark very close approaches (photon-sphere skims) as cyan tint on escape
    if (r.fate === 'escape' && r.minR < 3.5 * M) {
      R = 40
      G = 180
      B = 200
    }
    ppm.push(R, G, B)
  }
}

const header = `P3\n${W} ${H}\n255\n`
writeFileSync(
  'C:/Users/dante/Projects/black-hole/tmp-ref.ppm',
  header + ppm.join(' ') + '\n',
)
console.log(JSON.stringify(counts, null, 2))
console.log('center pixel:', trace(0, 0))
console.log('wrote tmp-ref.ppm')
