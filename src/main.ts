import './style.css'

import * as THREE from 'three/webgpu'

import { createSceneBridge } from './app/sceneBridge'
import { getDebug } from './debug/state'
import { createBloomPipeline } from './render/bloomPipeline'
import { createGeodesicTracer } from './render/geodesicTracer'
import { getLook } from './state/look'
import { mountControls } from './ui/controls'
import { mountDebugHud } from './ui/debugHud'
import { mountOrbitControls } from './ui/orbit'

// Geometric units G = c = 1. No-hair: M, a★, Q + disk ṁ (not hair).

const errorEl = document.querySelector<HTMLElement>('#error')
const statsEl = document.querySelector<HTMLElement>('#stats')
const controlsEl = document.querySelector<HTMLElement>('#controls')
const derivedEl = document.querySelector<HTMLElement>('#derived')
const debugEl = document.querySelector<HTMLElement>('#debug-panel')

function showError(message: string): void {
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

const bridge = createSceneBridge(tracer)
bridge.connect()
bridge.applyDebug()

let bloomPipeline: ReturnType<typeof createBloomPipeline> | null = null
let debugHud: ReturnType<typeof mountDebugHud> | null = null

function onResize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight)
  bloomPipeline?.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)

if (controlsEl) {
  mountControls(controlsEl, derivedEl)
}
if (debugEl) {
  debugHud = mountDebugHud(debugEl)
}

const orbit = mountOrbitControls(renderer.domElement)

// Shift+click (or probe enabled + click without drag) for ray probe
renderer.domElement.addEventListener('click', (ev) => {
  if (!debugHud || !getDebug().probeEnabled) return
  if (orbit.didDrag()) return
  if (ev.button !== 0) return
  debugHud.probeAtClient(ev.clientX, ev.clientY, renderer.domElement)
})

let frames = 0
let fpsAccum = 0
let last = performance.now()

async function boot(): Promise<void> {
  try {
    await renderer.init()
  } catch (err) {
    showError(
      `WebGPU failed to initialize.\n\n${err instanceof Error ? err.message : String(err)}\n\nUse Chrome/Edge with WebGPU enabled.`,
    )
    return
  }

  bloomPipeline = createBloomPipeline(renderer, scene, camera, getLook())
  bridge.setBloomPipeline(bloomPipeline)
  bridge.applyLook()

  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 1 / 20)
    last = now

    if (bloomPipeline) {
      bloomPipeline.render()
    } else {
      renderer.render(scene, camera)
    }

    debugHud?.tickHealth()

    frames++
    fpsAccum += dt
    if (fpsAccum >= 0.5) {
      const fps = Math.round(frames / fpsAccum)
      frames = 0
      fpsAccum = 0
      if (statsEl) {
        const health = debugHud?.getLastHealth()
        statsEl.textContent = bridge.formatStats(
          fps,
          health ? `health: ${health.summary}` : undefined,
        )
      }
    }
  })
}

boot()
