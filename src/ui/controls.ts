import { MAX_SPIN_STAR } from '../physics/constants'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import {
  CAMERA_LIMITS,
  degToRad,
  getCamera,
  radToDeg,
  setCamera,
  subscribeCamera,
  type CameraState,
} from '../state/camera'
import { getParams, setParams, subscribe } from '../state/params'

function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

export type ControlsApi = {
  /** Refresh camera slider labels from store (after orbit drag). */
  syncCameraUi: () => void
}

export function mountControls(
  root: HTMLElement,
  derivedRoot: HTMLElement | null,
): ControlsApi {
  const distLim = CAMERA_LIMITS.distanceM
  const incDegMin = radToDeg(CAMERA_LIMITS.inclination.min)
  const incDegMax = radToDeg(CAMERA_LIMITS.inclination.max)
  const fovLim = CAMERA_LIMITS.fov

  root.innerHTML = `
    <div class="ctrl-section">Physics</div>
    <label class="ctrl">
      <span class="ctrl-name">Mass M</span>
      <input type="range" id="p-mass" min="0.1" max="10" step="0.01" />
      <span class="ctrl-val" data-val="mass"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Spin a★</span>
      <input type="range" id="p-spin" min="0" max="${MAX_SPIN_STAR}" step="0.001" />
      <span class="ctrl-val" data-val="spin"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Charge Q</span>
      <input type="range" id="p-charge" min="0" max="0.95" step="0.01" />
      <span class="ctrl-val" data-val="charge"></span>
    </label>
    <p class="ctrl-hint">Families: Schw · Kerr · RN · KN (extremality clamps Q)</p>

    <div class="ctrl-section">Camera</div>
    <label class="ctrl">
      <span class="ctrl-name">Distance</span>
      <input type="range" id="c-dist" min="${distLim.min}" max="${distLim.max}" step="0.5" />
      <span class="ctrl-val" data-val="dist"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Incl °</span>
      <input type="range" id="c-inc" min="${incDegMin.toFixed(0)}" max="${incDegMax.toFixed(0)}" step="0.5" />
      <span class="ctrl-val" data-val="inc"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Azim °</span>
      <input type="range" id="c-az" min="0" max="360" step="0.5" />
      <span class="ctrl-val" data-val="az"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">FOV</span>
      <input type="range" id="c-fov" min="${fovLim.min}" max="${fovLim.max}" step="0.01" />
      <span class="ctrl-val" data-val="fov"></span>
    </label>
    <p class="ctrl-hint">Drag canvas to orbit · scroll/pinch to zoom</p>
  `

  const massInput = root.querySelector<HTMLInputElement>('#p-mass')
  const spinInput = root.querySelector<HTMLInputElement>('#p-spin')
  const chargeInput = root.querySelector<HTMLInputElement>('#p-charge')
  const massVal = root.querySelector<HTMLElement>('[data-val="mass"]')
  const spinVal = root.querySelector<HTMLElement>('[data-val="spin"]')
  const chargeVal = root.querySelector<HTMLElement>('[data-val="charge"]')

  const distInput = root.querySelector<HTMLInputElement>('#c-dist')
  const incInput = root.querySelector<HTMLInputElement>('#c-inc')
  const azInput = root.querySelector<HTMLInputElement>('#c-az')
  const fovInput = root.querySelector<HTMLInputElement>('#c-fov')
  const distVal = root.querySelector<HTMLElement>('[data-val="dist"]')
  const incVal = root.querySelector<HTMLElement>('[data-val="inc"]')
  const azVal = root.querySelector<HTMLElement>('[data-val="az"]')
  const fovVal = root.querySelector<HTMLElement>('[data-val="fov"]')

  function syncPhysicsInputs(p: BlackHoleParams): void {
    if (massInput) massInput.value = String(p.mass)
    if (spinInput) spinInput.value = String(p.spinStar)
    if (chargeInput) chargeInput.value = String(p.charge)
    if (massVal) massVal.textContent = fmt(p.mass, 2)
    if (spinVal) spinVal.textContent = fmt(p.spinStar, 3)
    if (chargeVal) chargeVal.textContent = fmt(p.charge, 3)
  }

  function syncCameraInputs(c: CameraState): void {
    if (distInput) distInput.value = String(c.distanceM)
    if (incInput) incInput.value = String(radToDeg(c.inclination))
    if (azInput) azInput.value = String(radToDeg(c.azimuth))
    if (fovInput) fovInput.value = String(c.fov)
    if (distVal) distVal.textContent = `${fmt(c.distanceM, 1)}M`
    if (incVal) incVal.textContent = fmt(radToDeg(c.inclination), 1)
    if (azVal) azVal.textContent = fmt(radToDeg(c.azimuth), 1)
    if (fovVal) fovVal.textContent = fmt(c.fov, 2)
  }

  function syncDerived(d: DerivedGeometry): void {
    if (!derivedRoot) return
    derivedRoot.innerHTML = `
      <div><dt>family</dt><dd>${d.family}</dd></div>
      <div><dt>r₊</dt><dd>${fmt(d.rPlus)}</dd></div>
      <div><dt>r₋</dt><dd>${fmt(d.rMinus)}</dd></div>
      <div><dt>r_ph</dt><dd>${fmt(d.rPhotonSphere)}</dd></div>
      <div><dt>Δ_ext</dt><dd>${fmt(d.extremalityDelta)}</dd></div>
    `
  }

  massInput?.addEventListener('input', () => {
    setParams({ mass: Number(massInput.value) })
  })
  spinInput?.addEventListener('input', () => {
    setParams({ spinStar: Number(spinInput.value) })
  })
  chargeInput?.addEventListener('input', () => {
    setParams({ charge: Number(chargeInput.value) })
  })

  distInput?.addEventListener('input', () => {
    setCamera({ distanceM: Number(distInput.value) })
  })
  incInput?.addEventListener('input', () => {
    setCamera({ inclination: degToRad(Number(incInput.value)) })
  })
  azInput?.addEventListener('input', () => {
    setCamera({ azimuth: degToRad(Number(azInput.value)) })
  })
  fovInput?.addEventListener('input', () => {
    setCamera({ fov: Number(fovInput.value) })
  })

  subscribe((p, d) => {
    syncPhysicsInputs(p)
    syncDerived(d)
  })

  subscribeCamera((c) => {
    syncCameraInputs(c)
  })

  massInput?.addEventListener('input', () => {
    if (!chargeInput) return
    const m = Number(massInput.value)
    chargeInput.max = String(Math.max(0, m * 0.99))
  })

  syncPhysicsInputs(getParams())
  syncCameraInputs(getCamera())

  return {
    syncCameraUi: () => syncCameraInputs(getCamera()),
  }
}
