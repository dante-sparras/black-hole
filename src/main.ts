import './style.css'

import * as THREE from 'three/webgpu'

import { toUniforms } from './render/uniforms'
import { getDerived, getParams, subscribe } from './state/params'
import { mountControls } from './ui/controls'

// Geometric units G = c = 1. Core controls: mass M, spin a★, charge Q (no-hair).

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
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 0, 10)

function onResize() {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}
window.addEventListener('resize', onResize)

if (controlsEl) {
  mountControls(controlsEl, derivedEl)
}

// Keep a live uniform snapshot ready for the future geodesic pipeline.
let spacetime = toUniforms(getParams(), getDerived())
subscribe((p, d) => {
  spacetime = toUniforms(p, d)
})

let frames = 0
let fpsAccum = 0
let last = performance.now()

function formatStats(fps: number): string {
  const d = getDerived()
  const m = spacetime.mass.toFixed(2)
  const a = spacetime.spinStar.toFixed(3)
  const q = spacetime.charge.toFixed(3)
  const rp = Number.isFinite(spacetime.rPlus) ? spacetime.rPlus.toFixed(3) : '—'
  return `${fps} fps · ${d.family} · M=${m} a★=${a} Q=${q} · r₊=${rp}`
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
