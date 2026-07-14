import './style.css'

import * as THREE from 'three/webgpu'

import { createBloomPipeline } from './render/bloomPipeline'
import { createGeodesicTracer } from './render/geodesicTracer'
import { toUniforms } from './render/uniforms'
import { getCamera, subscribeCamera } from './state/camera'
import { getLook, subscribeLook } from './state/look'
import { getDerived, getParams, subscribe } from './state/params'
import { mountControls } from './ui/controls'
import { mountOrbitControls } from './ui/orbit'

// Geometric units G = c = 1. No-hair: M, a★, Q. View: Kerr/Schwarzschild GRRT.

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
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
camera.position.set(0, 0, 1)
camera.lookAt(0, 0, 0)

const tracer = createGeodesicTracer()
scene.add(tracer.mesh)

/** Post stack created after WebGPU init. */
let bloomPipeline: ReturnType<typeof createBloomPipeline> | null = null

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  bloomPipeline?.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)

if (controlsEl) {
  mountControls(controlsEl, derivedEl)
}

mountOrbitControls(renderer.domElement)

let spacetime = toUniforms(getParams(), getDerived())

function applyPhysics(): void {
  const p = getParams()
  const d = getDerived()
  spacetime = toUniforms(p, d)
  tracer.setSpacetime({
    mass: p.mass,
    spinStar: p.spinStar,
    charge: p.charge,
    mdot: p.mdot,
    rIscoOverM: d.rIsco / Math.max(p.mass, 1e-12),
  })
}

function applyCamera(): void {
  tracer.setCamera(getCamera())
}

function applyLook(): void {
  if (bloomPipeline) bloomPipeline.applyLook(getLook())
}

subscribe(() => {
  applyPhysics()
})
subscribeCamera(() => {
  applyCamera()
})
subscribeLook(() => {
  applyLook()
})
applyPhysics()
applyCamera()

let frames = 0
let fpsAccum = 0
let last = performance.now()

function formatStats(fps: number): string {
  const d = getDerived()
  const c = getCamera()
  const look = getLook()
  const m = spacetime.mass.toFixed(2)
  const a = spacetime.spinStar.toFixed(3)
  const q = spacetime.charge.toFixed(3)
  const md = spacetime.mdot >= 0.01 ? spacetime.mdot.toFixed(2) : spacetime.mdot.toExponential(1)
  const rp = Number.isFinite(spacetime.rPlus) ? spacetime.rPlus.toFixed(3) : '—'
  const dist = c.distanceM.toFixed(1)
  const hasA = Math.abs(spacetime.spinStar) >= 1e-6
  const hasQ = Math.abs(spacetime.charge) >= 1e-6
  const mode =
    !hasA && !hasQ
      ? 'schw-RT'
      : hasA && !hasQ
        ? 'kerr-RT'
        : !hasA && hasQ
          ? 'rn-RT'
          : 'kn-RT'
  const bloomTag = look.bloomEnabled ? `bloom=${look.bloomStrength.toFixed(2)}` : 'bloom=off'
  return `${fps} fps · ${mode} · ${d.family} · M=${m} a★=${a} Q=${q} ṁ=${md} · ${bloomTag} · r₊=${rp} · D=${dist}M`
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

  bloomPipeline = createBloomPipeline(renderer, scene, camera, getLook())
  applyLook()

  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 1 / 20)
    last = now

    if (bloomPipeline) {
      bloomPipeline.render()
    } else {
      renderer.render(scene, camera)
    }

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
