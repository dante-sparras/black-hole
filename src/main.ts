import './style.css'

import * as THREE from 'three/webgpu'

import { createSceneBridge } from './app/sceneBridge'
import { loadGrmhdFromUrl } from './app/grmhdLoader'
import { publicUrl } from './app/publicUrl'
import { getDebug } from './debug/state'
import { createBloomPipeline } from './render/bloomPipeline'
import { createGeodesicTracer } from './render/geodesicTracer'
import { getLook } from './state/look'
import { getQuality, subscribeQuality } from './state/quality'
import { mountControls } from './ui/controls'
import { mountDebugHud } from './ui/debugHud'
import { mountOrbitControls } from './ui/orbit'

// Geometric units G = c = 1. No-hair: M, a★, Q · disk free bases (ṁ scenario/HUD).

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

const renderer = new THREE.WebGPURenderer({ antialias: false })
function applyDpr(): void {
  renderer.setPixelRatio(getQuality().dpr)
}
applyDpr()
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
// Store subscriptions apply physics/camera/sky/geodesic/debug on attach.
bridge.connect()

let bloomPipeline: ReturnType<typeof createBloomPipeline> | null = null
let debugHud: ReturnType<typeof mountDebugHud> | null = null

function onResize(): void {
  applyDpr()
  renderer.setSize(window.innerWidth, window.innerHeight)
  bloomPipeline?.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)
subscribeQuality(() => {
  applyDpr()
  onResize()
})

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
const t0 = performance.now()

async function boot(): Promise<void> {
  try {
    await renderer.init()
  } catch (err) {
    showError(
          [
            'WebGPU failed to initialize.',
            '',
            err instanceof Error ? err.message : String(err),
            '',
            'Use Chrome/Edge with WebGPU enabled.',
          ].join('\n'),
        )
    return
  }

  bloomPipeline = createBloomPipeline(renderer, scene, camera, getLook())
  bridge.setBloomPipeline(bloomPipeline)
  // Bloom is created post-WebGPU init; look subscribe already ran before bloom existed.
  bridge.applyLook()

  // Default dens = analytic (demo cube still has high-m lace → face-on rings)
  // User can enable GRMHD cube via Numerics.
  try {
    await loadGrmhdFromUrl(publicUrl('cubes/demo.bhcm'), tracer, {
      enable: false,
      mix: 0,
      label: 'demo',
    })
  } catch {
    // Analytic dens if cube missing
  }

  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 1 / 20)
    last = now

    // Keplerian disk shear / plasma structure animation
    tracer.setTime((now - t0) / 1000)

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
