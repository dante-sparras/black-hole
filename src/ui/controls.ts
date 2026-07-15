import { MAX_SPIN_STAR, MDOT_MAX, MDOT_MIN } from '../physics/constants'
import {
  mdotFromSlider as mdotFromSliderRange,
  mdotTemperatureScale,
  sliderFromMdot as sliderFromMdotRange,
} from '../physics/disk'
import { DISK_LIMITS } from '../physics/diskParams'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import type { DiskParams } from '../physics/diskParams'
import {
  CAMERA_LIMITS,
  degToRad,
  getCamera,
  radToDeg,
  setCamera,
  subscribeCamera,
  type CameraState,
} from '../state/camera'
import { getDisk, setDisk, subscribeDisk } from '../state/disk'
import {
  getLook,
  LOOK_LIMITS,
  setLook,
  subscribeLook,
  type LookState,
} from '../state/look'
import { getDerived, getParams, setParams, subscribe } from '../state/params'
import { ALL_PRESETS, applyPreset } from '../state/presets'
import { fmt, fmtMdot } from './format'
import { renderDerivedHud } from './hud'

/** Log-space slider (0…1000) ↔ ṁ ∈ [MDOT_MIN, MDOT_MAX]. */
export function mdotFromSlider(t: number): number {
  return mdotFromSliderRange(t, MDOT_MIN, MDOT_MAX)
}

export function sliderFromMdot(mdot: number): number {
  return sliderFromMdotRange(mdot, MDOT_MIN, MDOT_MAX)
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
    <div class="ctrl-section">Presets</div>
    <div class="preset-grid" id="preset-grid">
      ${ALL_PRESETS.map(
        (p) =>
          `<button type="button" class="preset-btn" data-preset="${p.id}" title="${p.hint}">${p.label}</button>`,
      ).join('')}
    </div>
    <p class="ctrl-hint" id="preset-hint">One-click scene: physics + camera + look</p>

    <div class="ctrl-section">Black hole (no-hair)</div>
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
    <p class="ctrl-hint">Only M, a★, Q characterize the stationary BH (no-hair)</p>

    <div class="ctrl-section">Accretion disk (not hair)</div>
    <label class="ctrl">
      <span class="ctrl-name">ṁ / ṁ_Edd</span>
      <input type="range" id="d-mdot" min="0" max="1000" step="1" />
      <span class="ctrl-val" data-val="mdot"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">r_out / M</span>
      <input type="range" id="d-outer" min="${DISK_LIMITS.outerM.min}" max="${DISK_LIMITS.outerM.max}" step="1" />
      <span class="ctrl-val" data-val="outer"></span>
    </label>
    <p class="ctrl-hint">ṁ → NT flux &amp; T∝ṁ¼ · r_out = luminous outer edge · ISCO = derived inner edge</p>

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

    <div class="ctrl-section">Look</div>
    <label class="ctrl">
      <span class="ctrl-name">Bloom</span>
      <input type="checkbox" id="l-bloom-on" />
      <span class="ctrl-val" data-val="bloomOn"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Strength</span>
      <input type="range" id="l-bloom-str" min="${LOOK_LIMITS.bloomStrength.min}" max="${LOOK_LIMITS.bloomStrength.max}" step="0.01" />
      <span class="ctrl-val" data-val="bloomStr"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Radius</span>
      <input type="range" id="l-bloom-rad" min="${LOOK_LIMITS.bloomRadius.min}" max="${LOOK_LIMITS.bloomRadius.max}" step="0.01" />
      <span class="ctrl-val" data-val="bloomRad"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Threshold</span>
      <input type="range" id="l-bloom-thr" min="${LOOK_LIMITS.bloomThreshold.min}" max="${LOOK_LIMITS.bloomThreshold.max}" step="0.01" />
      <span class="ctrl-val" data-val="bloomThr"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Exposure</span>
      <input type="range" id="l-exposure" min="${LOOK_LIMITS.exposure.min}" max="${LOOK_LIMITS.exposure.max}" step="0.01" />
      <span class="ctrl-val" data-val="exposure"></span>
    </label>
    <p class="ctrl-hint">Unreal bloom on HDR · ACES tone map · not hair</p>
  `

  const massInput = root.querySelector<HTMLInputElement>('#p-mass')
  const spinInput = root.querySelector<HTMLInputElement>('#p-spin')
  const chargeInput = root.querySelector<HTMLInputElement>('#p-charge')
  const mdotInput = root.querySelector<HTMLInputElement>('#d-mdot')
  const outerInput = root.querySelector<HTMLInputElement>('#d-outer')
  const massVal = root.querySelector<HTMLElement>('[data-val="mass"]')
  const spinVal = root.querySelector<HTMLElement>('[data-val="spin"]')
  const chargeVal = root.querySelector<HTMLElement>('[data-val="charge"]')
  const mdotVal = root.querySelector<HTMLElement>('[data-val="mdot"]')
  const outerVal = root.querySelector<HTMLElement>('[data-val="outer"]')

  const distInput = root.querySelector<HTMLInputElement>('#c-dist')
  const incInput = root.querySelector<HTMLInputElement>('#c-inc')
  const azInput = root.querySelector<HTMLInputElement>('#c-az')
  const fovInput = root.querySelector<HTMLInputElement>('#c-fov')
  const distVal = root.querySelector<HTMLElement>('[data-val="dist"]')
  const incVal = root.querySelector<HTMLElement>('[data-val="inc"]')
  const azVal = root.querySelector<HTMLElement>('[data-val="az"]')
  const fovVal = root.querySelector<HTMLElement>('[data-val="fov"]')

  const bloomOnInput = root.querySelector<HTMLInputElement>('#l-bloom-on')
  const bloomStrInput = root.querySelector<HTMLInputElement>('#l-bloom-str')
  const bloomRadInput = root.querySelector<HTMLInputElement>('#l-bloom-rad')
  const bloomThrInput = root.querySelector<HTMLInputElement>('#l-bloom-thr')
  const exposureInput = root.querySelector<HTMLInputElement>('#l-exposure')
  const bloomOnVal = root.querySelector<HTMLElement>('[data-val="bloomOn"]')
  const bloomStrVal = root.querySelector<HTMLElement>('[data-val="bloomStr"]')
  const bloomRadVal = root.querySelector<HTMLElement>('[data-val="bloomRad"]')
  const bloomThrVal = root.querySelector<HTMLElement>('[data-val="bloomThr"]')
  const exposureVal = root.querySelector<HTMLElement>('[data-val="exposure"]')
  const presetHint = root.querySelector<HTMLElement>('#preset-hint')
  const presetBtns = root.querySelectorAll<HTMLButtonElement>('.preset-btn')

  let activePresetId: string | null = null

  function setActivePresetUi(id: string | null, hint?: string): void {
    activePresetId = id
    for (const btn of presetBtns) {
      const on = btn.dataset.preset === id
      btn.classList.toggle('active', on)
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
    if (presetHint) {
      presetHint.textContent =
        hint ?? 'One-click scene: physics + camera + look'
    }
  }

  function onUserTweaked(): void {
    // Manual slider changes leave presets; clear highlight
    if (activePresetId !== null) setActivePresetUi(null)
  }

  function syncPhysicsInputs(p: BlackHoleParams): void {
    if (massInput) massInput.value = String(p.mass)
    if (spinInput) spinInput.value = String(p.spinStar)
    if (chargeInput) chargeInput.value = String(p.charge)
    if (massVal) massVal.textContent = fmt(p.mass, 2)
    if (spinVal) spinVal.textContent = fmt(p.spinStar, 3)
    if (chargeVal) chargeVal.textContent = fmt(p.charge, 3)
  }

  function syncDiskInputs(d: DiskParams): void {
    if (mdotInput) mdotInput.value = String(sliderFromMdot(d.mdot))
    if (outerInput) outerInput.value = String(d.outerM)
    if (mdotVal) {
      const tScale = mdotTemperatureScale(d.mdot)
      mdotVal.textContent = `${fmtMdot(d.mdot)}  (T×${fmt(tScale, 2)})`
    }
    if (outerVal) outerVal.textContent = `${fmt(d.outerM, 0)} M`
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

  function syncLookInputs(l: LookState): void {
    if (bloomOnInput) bloomOnInput.checked = l.bloomEnabled
    if (bloomStrInput) bloomStrInput.value = String(l.bloomStrength)
    if (bloomRadInput) bloomRadInput.value = String(l.bloomRadius)
    if (bloomThrInput) bloomThrInput.value = String(l.bloomThreshold)
    if (exposureInput) exposureInput.value = String(l.exposure)
    if (bloomOnVal) bloomOnVal.textContent = l.bloomEnabled ? 'on' : 'off'
    if (bloomStrVal) bloomStrVal.textContent = fmt(l.bloomStrength, 2)
    if (bloomRadVal) bloomRadVal.textContent = fmt(l.bloomRadius, 2)
    if (bloomThrVal) bloomThrVal.textContent = fmt(l.bloomThreshold, 2)
    if (exposureVal) exposureVal.textContent = fmt(l.exposure, 2)
  }

  function syncDerived(d: DerivedGeometry, p: BlackHoleParams): void {
    if (!derivedRoot) return
    renderDerivedHud(derivedRoot, p, d, getDisk())
  }

  massInput?.addEventListener('input', () => {
    onUserTweaked()
    setParams({ mass: Number(massInput.value) })
  })
  spinInput?.addEventListener('input', () => {
    onUserTweaked()
    setParams({ spinStar: Number(spinInput.value) })
  })
  chargeInput?.addEventListener('input', () => {
    onUserTweaked()
    setParams({ charge: Number(chargeInput.value) })
  })
  mdotInput?.addEventListener('input', () => {
    onUserTweaked()
    setDisk({ mdot: mdotFromSlider(Number(mdotInput.value)) })
  })
  outerInput?.addEventListener('input', () => {
    onUserTweaked()
    setDisk({ outerM: Number(outerInput.value) })
  })

  distInput?.addEventListener('input', () => {
    onUserTweaked()
    setCamera({ distanceM: Number(distInput.value) })
  })
  incInput?.addEventListener('input', () => {
    onUserTweaked()
    setCamera({ inclination: degToRad(Number(incInput.value)) })
  })
  azInput?.addEventListener('input', () => {
    onUserTweaked()
    setCamera({ azimuth: degToRad(Number(azInput.value)) })
  })
  fovInput?.addEventListener('input', () => {
    onUserTweaked()
    setCamera({ fov: Number(fovInput.value) })
  })

  bloomOnInput?.addEventListener('change', () => {
    onUserTweaked()
    setLook({ bloomEnabled: Boolean(bloomOnInput.checked) })
  })
  bloomStrInput?.addEventListener('input', () => {
    onUserTweaked()
    setLook({ bloomStrength: Number(bloomStrInput.value) })
  })
  bloomRadInput?.addEventListener('input', () => {
    onUserTweaked()
    setLook({ bloomRadius: Number(bloomRadInput.value) })
  })
  bloomThrInput?.addEventListener('input', () => {
    onUserTweaked()
    setLook({ bloomThreshold: Number(bloomThrInput.value) })
  })
  exposureInput?.addEventListener('input', () => {
    onUserTweaked()
    setLook({ exposure: Number(exposureInput.value) })
  })

  for (const btn of presetBtns) {
    btn.addEventListener('click', () => {
      const id = btn.dataset.preset
      if (!id) return
      const applied = applyPreset(id)
      setActivePresetUi(applied.id, applied.hint)
    })
  }

  subscribe((p, d) => {
    syncPhysicsInputs(p)
    syncDerived(d, p)
  })

  subscribeDisk((disk) => {
    syncDiskInputs(disk)
    syncDerived(getDerived(), getParams())
  })

  subscribeCamera((c) => {
    syncCameraInputs(c)
  })

  subscribeLook((l) => {
    syncLookInputs(l)
  })

  massInput?.addEventListener('input', () => {
    if (!chargeInput) return
    const m = Number(massInput.value)
    chargeInput.max = String(Math.max(0, m * 0.99))
  })

  syncPhysicsInputs(getParams())
  syncDiskInputs(getDisk())
  syncCameraInputs(getCamera())
  syncLookInputs(getLook())
  syncDerived(getDerived(), getParams())

  return {
    syncCameraUi: () => syncCameraInputs(getCamera()),
  }
}
