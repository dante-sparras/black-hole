import './style.css'

import * as THREE from 'three/webgpu'

import { createSchwarzschildTracer } from './render/schwarzschildTracer'
import { toUniforms } from './render/uniforms'
import { getCamera, subscribeCamera } from './state/camera'
import { getDerived, getParams, subscribe } from './state/params'
import { mountControls } from './ui/controls'
import { mountOrbitControls } from './ui/orbit'

// Geometric units G = c = 1. Core: M, a★, Q. View: Schwarzschild GRRT + orbit camera.

const errorEl = document.querySelector<HTMLElement>('#error')
const statsEl = document.querySelector<HTMLElement>('#stats')
const controlsEl = document.querySelector<HTMLElement>('#controls')
const derivedEl = document.querySelector<HTMLElement>('#derived')

function showError(message: string) {
  if (!errorEl) return
  errorEl.textContent = message
  errorEl.classList.add('visible')
}

const renderer = new THREE.WebGPURenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setClearColor(0x000000, 1)
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
// Fullscreen NDC: camera in front of the plane (z=0). near < 1 < far.
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
camera.position.set(0, 0, 1)
camera.lookAt(0, 0, 0)

const tracer = createSchwarzschildTracer()
scene.add(tracer.mesh)

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)

if (controlsEl) {
  mountControls(controlsEl, derivedEl)
}

// Orbit: drag = azimuth/inclination, wheel/pinch = distance
mountOrbitControls(renderer.domElement)

let spacetime = toUniforms(getParams(), getDerived())

function applyPhysics(): void {
  const p = getParams()
  spacetime = toUniforms(p, getDerived())
  tracer.setMass(p.mass)
}

function applyCamera(): void {
  const c = getCamera()
  tracer.setCameraDistanceM(c.distanceM)
  tracer.setInclination(c.inclination)
  tracer.setAzimuth(c.azimuth)
  tracer.setFov(c.fov)
}

subscribe(() => {
  applyPhysics()
})
subscribeCamera(() => {
  applyCamera()
})
applyPhysics()
applyCamera()

let frames = 0
let fpsAccum = 0
let last = performance.now()

function formatStats(fps: number): string {
  const d = getDerived()
  const c = getCamera()
  const m = spacetime.mass.toFixed(2)
  const a = spacetime.spinStar.toFixed(3)
  const q = spacetime.charge.toFixed(3)
  const rp = Number.isFinite(spacetime.rPlus) ? spacetime.rPlus.toFixed(3) : '—'
  const dist = c.distanceM.toFixed(1)
  const mode = spacetime.spinStar === 0 && spacetime.charge === 0 ? 'schw-RT' : 'schw-RT*'
  return `${fps} fps · ${mode} · ${d.family} · M=${m} a★=${a} Q=${q} · r₊=${rp} · D=${dist}M`
}

async function boot() {
  try {
    await renderer.init()
  } catch (err) {
    showError(
      `WebGPU failed to initialize.\n\n${err instanceof Error ? err.message : String(err)}\n\nUse Chrome/Edge with WebGPU enabled.`,
    )
    return
  }

  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 1 / 20)
    last = now

    renderer.render(scene, camera)

    frames++
    fpsAccum += dt
    if (fpsAccum >= 0.5) {
      const fps = Math.round(frames / fpsAccum)
      frames = 0
      fpsAccum = 0
      if (statsEl) statsEl.textContent = formatStats(fps)
    }
  })
}

boot()
