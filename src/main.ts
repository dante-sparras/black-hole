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
import { mountMobileHud } from './ui/mobileHud'
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
const t0 = performance.now()

/** One frame of the full post stack (used by the animation loop + screenshot). */
function renderOneFrame(): void {
  tracer.setTime((performance.now() - t0) / 1000)
  if (bloomPipeline) {
    bloomPipeline.render()
  } else {
    renderer.render(scene, camera)
  }
}

function onResize(): void {
  const w = Math.floor(window.visualViewport?.width ?? window.innerWidth)
  const h = Math.floor(window.visualViewport?.height ?? window.innerHeight)
  applyDpr()
  renderer.setSize(w, h)
  bloomPipeline?.setSize(w, h)
}
window.addEventListener('resize', onResize)
window.visualViewport?.addEventListener('resize', onResize)
window.visualViewport?.addEventListener('scroll', onResize)
// Quality → DPR/size + post-AA scale (bloomPipeline set after init)
subscribeQuality((q) => {
  applyDpr()
  onResize()
  bloomPipeline?.setQualityLevel(q.level)
})

const mobileHud = mountMobileHud()

let debugHud: ReturnType<typeof mountDebugHud> | null = null

if (debugEl) {
  debugHud = mountDebugHud(debugEl)
}

if (controlsEl) {
  mountControls(controlsEl, derivedEl, {
    getCanvas: () => renderer.domElement as HTMLCanvasElement,
    renderFrame: renderOneFrame,
    setDebugOpen: (on) => debugHud?.setOpen(on),
  })
}

const orbit = mountOrbitControls(renderer.domElement, undefined, {
  touchDragBoost: mobileHud.isMobile() ? 1.35 : 1,
})

// Click-to-probe only when Debug mode is open + probe enabled
renderer.domElement.addEventListener('click', (ev) => {
  if (!debugHud || !debugHud.isOpen()) return
  if (!getDebug().probeEnabled) return
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

  bloomPipeline = createBloomPipeline(renderer, scene, camera, getLook(), getQuality().level)
  bridge.setBloomPipeline(bloomPipeline)
  // Bloom is created post-WebGPU init; look subscribe already ran before bloom existed.
  bridge.applyLook()
  bloomPipeline.setQualityLevel(getQuality().level)

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

  function frame(): void {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 1 / 20)
    last = now

    renderOneFrame()

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
  }

  // Pause GPU work when tab hidden — zero visual impact while viewing
  let loopOn = true
  const setLoop = (on: boolean): void => {
    if (on === loopOn) return
    loopOn = on
    if (on) {
      last = performance.now()
      renderer.setAnimationLoop(frame)
    } else {
      renderer.setAnimationLoop(null)
    }
  }
  document.addEventListener('visibilitychange', () => {
    setLoop(document.visibilityState === 'visible')
  })
  renderer.setAnimationLoop(frame)
}

boot()
