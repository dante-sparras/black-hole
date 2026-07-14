import { MAX_SPIN_STAR, MDOT_MAX, MDOT_MIN } from '../physics/constants'
import {
  mdotFromSlider as mdotFromSliderRange,
  mdotTemperatureScale,
  sliderFromMdot as sliderFromMdotRange,
} from '../physics/disk'
import { shadowDiagnostics } from '../physics/diagnostics'
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
import {
  getLook,
  LOOK_LIMITS,
  setLook,
  subscribeLook,
  type LookState,
} from '../state/look'
import { getDerived, getParams, setParams, subscribe } from '../state/params'

function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

/** Log-space slider (0…1000) ↔ ṁ ∈ [MDOT_MIN, MDOT_MAX]. */
export function mdotFromSlider(t: number): number {
  return mdotFromSliderRange(t, MDOT_MIN, MDOT_MAX)
}

export function sliderFromMdot(mdot: number): number {
  return sliderFromMdotRange(mdot, MDOT_MIN, MDOT_MAX)
}

function fmtMdot(m: number): string {
  if (m >= 0.1) return fmt(m, 2)
  if (m >= 0.01) return fmt(m, 3)
  return m.toExponential(1)
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
    <label class="ctrl">
      <span class="ctrl-name">ṁ / ṁ_Edd</span>
      <input type="range" id="p-mdot" min="0" max="1000" step="1" />
      <span class="ctrl-val" data-val="mdot"></span>
    </label>
    <p class="ctrl-hint">ṁ = Eddington ratio (disk). T ∝ ṁ¼ · log slider · not hair</p>

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
  const mdotInput = root.querySelector<HTMLInputElement>('#p-mdot')
  const massVal = root.querySelector<HTMLElement>('[data-val="mass"]')
  const spinVal = root.querySelector<HTMLElement>('[data-val="spin"]')
  const chargeVal = root.querySelector<HTMLElement>('[data-val="charge"]')
  const mdotVal = root.querySelector<HTMLElement>('[data-val="mdot"]')

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

  function syncPhysicsInputs(p: BlackHoleParams): void {
    if (massInput) massInput.value = String(p.mass)
    if (spinInput) spinInput.value = String(p.spinStar)
    if (chargeInput) chargeInput.value = String(p.charge)
    if (mdotInput) mdotInput.value = String(sliderFromMdot(p.mdot))
    if (massVal) massVal.textContent = fmt(p.mass, 2)
    if (spinVal) spinVal.textContent = fmt(p.spinStar, 3)
    if (chargeVal) chargeVal.textContent = fmt(p.charge, 3)
    if (mdotVal) {
      const tScale = mdotTemperatureScale(p.mdot)
      mdotVal.textContent = `${fmtMdot(p.mdot)}  (T×${fmt(tScale, 2)})`
    }
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
    const diag = shadowDiagnostics(p, d)
    const tScale = mdotTemperatureScale(p.mdot)
    derivedRoot.innerHTML = `
      <div class="diag-title">Radii</div>
      <div><dt>family</dt><dd>${d.family}</dd></div>
      <div><dt>r₊</dt><dd>${fmt(d.rPlus)} <span class="dim">(${fmt(diag.rPlusOverM, 2)} M)</span></dd></div>
      <div><dt>r₋</dt><dd>${fmt(d.rMinus)}</dd></div>
      <div><dt>r_ph</dt><dd>${fmt(d.rPhotonSphere)} <span class="dim">(${fmt(diag.rPhotonOverM, 2)} M)</span></dd></div>
      <div><dt>r_ISCO</dt><dd>${fmt(d.rIsco)} <span class="dim">(${fmt(diag.rIscoOverM, 2)} M)</span></dd></div>
      <div class="diag-title">Disk (not hair)</div>
      <div><dt>ṁ</dt><dd>${fmtMdot(p.mdot)} ṁ_Edd</dd></div>
      <div><dt>T∝ṁ¼</dt><dd>×${fmt(tScale, 3)}</dd></div>
      <div class="diag-title">Shadow / critical curve</div>
      <div><dt>b_c⁺</dt><dd>${fmt(diag.bCritPro)} <span class="dim">(${fmt(diag.bCritProOverM, 2)} M)</span></dd></div>
      <div><dt>b_c⁻</dt><dd>${fmt(diag.bCritRet)} <span class="dim">(${fmt(diag.bCritRetOverM, 2)} M)</span></dd></div>
      <div><dt>⌀_shad</dt><dd>${fmt(diag.shadowDiameter)} <span class="dim">(~${fmt(diag.shadowDiameter / Math.max(p.mass, 1e-12), 2)} M)</span></dd></div>
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
  mdotInput?.addEventListener('input', () => {
    setParams({ mdot: mdotFromSlider(Number(mdotInput.value)) })
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

  bloomOnInput?.addEventListener('change', () => {
    setLook({ bloomEnabled: Boolean(bloomOnInput.checked) })
  })
  bloomStrInput?.addEventListener('input', () => {
    setLook({ bloomStrength: Number(bloomStrInput.value) })
  })
  bloomRadInput?.addEventListener('input', () => {
    setLook({ bloomRadius: Number(bloomRadInput.value) })
  })
  bloomThrInput?.addEventListener('input', () => {
    setLook({ bloomThreshold: Number(bloomThrInput.value) })
  })
  exposureInput?.addEventListener('input', () => {
    setLook({ exposure: Number(exposureInput.value) })
  })

  subscribe((p, d) => {
    syncPhysicsInputs(p)
    syncDerived(d, p)
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
  syncCameraInputs(getCamera())
  syncLookInputs(getLook())
  syncDerived(getDerived(), getParams())

  return {
    syncCameraUi: () => syncCameraInputs(getCamera()),
  }
}
