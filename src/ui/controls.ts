import { MDOT_MAX, MDOT_MIN } from '../physics/constants'
import {
  mdotFromSlider as mdotFromSliderRange,
  mdotTemperatureScale,
  sliderFromMdot as sliderFromMdotRange,
} from '../physics/disk'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import type { DiskParams } from '../physics/diskParams'
import {
  degToRad,
  getCamera,
  radToDeg,
  setCamera,
  subscribeCamera,
  type CameraState,
} from '../state/camera'
import { getDisk, setDisk, subscribeDisk } from '../state/disk'
import { getLook, setLook, subscribeLook, type LookState } from '../state/look'
import { getDerived, getParams, setParams, subscribe } from '../state/params'
import { applyPreset } from '../state/presets'
import {
  getGeodesicIntegrator,
  setGeodesicIntegrator,
  subscribeGeodesic,
} from '../state/geodesic'
import {
  getSky,
  resetSky,
  setSky,
  subscribeSky,
  type SkyState,
} from '../state/sky'
import {
  bindCheckbox,
  bindRange,
  bindSelect,
  qs,
  setRangeValue,
  setText,
} from './controlBind'
import { buildControlsHtml } from './controlsMarkup'
import { fmt, fmtMdot } from './format'
import { renderDerivedHud } from './hud'

/** Log-space slider (0…1000) ↔ ṁ ∈ [MDOT_MIN, MDOT_MAX]. */
function mdotFromSlider(t: number): number {
  return mdotFromSliderRange(t, MDOT_MIN, MDOT_MAX)
}

function sliderFromMdot(mdot: number): number {
  return sliderFromMdotRange(mdot, MDOT_MIN, MDOT_MAX)
}

export function mountControls(
  root: HTMLElement,
  derivedRoot: HTMLElement | null,
): void {
  root.innerHTML = buildControlsHtml()

  const massInput = qs<HTMLInputElement>(root, '#p-mass')
  const spinInput = qs<HTMLInputElement>(root, '#p-spin')
  const chargeInput = qs<HTMLInputElement>(root, '#p-charge')
  const mdotInput = qs<HTMLInputElement>(root, '#d-mdot')
  const outerInput = qs<HTMLInputElement>(root, '#d-outer')
  const massVal = qs<HTMLElement>(root, '[data-val="mass"]')
  const spinVal = qs<HTMLElement>(root, '[data-val="spin"]')
  const chargeVal = qs<HTMLElement>(root, '[data-val="charge"]')
  const mdotVal = qs<HTMLElement>(root, '[data-val="mdot"]')
  const outerVal = qs<HTMLElement>(root, '[data-val="outer"]')

  const distInput = qs<HTMLInputElement>(root, '#c-dist')
  const incInput = qs<HTMLInputElement>(root, '#c-inc')
  const azInput = qs<HTMLInputElement>(root, '#c-az')
  const fovInput = qs<HTMLInputElement>(root, '#c-fov')
  const distVal = qs<HTMLElement>(root, '[data-val="dist"]')
  const incVal = qs<HTMLElement>(root, '[data-val="inc"]')
  const azVal = qs<HTMLElement>(root, '[data-val="az"]')
  const fovVal = qs<HTMLElement>(root, '[data-val="fov"]')

  const bloomOnInput = qs<HTMLInputElement>(root, '#l-bloom-on')
  const bloomStrInput = qs<HTMLInputElement>(root, '#l-bloom-str')
  const bloomRadInput = qs<HTMLInputElement>(root, '#l-bloom-rad')
  const bloomThrInput = qs<HTMLInputElement>(root, '#l-bloom-thr')
  const exposureInput = qs<HTMLInputElement>(root, '#l-exposure')
  const bloomOnVal = qs<HTMLElement>(root, '[data-val="bloomOn"]')
  const bloomStrVal = qs<HTMLElement>(root, '[data-val="bloomStr"]')
  const bloomRadVal = qs<HTMLElement>(root, '[data-val="bloomRad"]')
  const bloomThrVal = qs<HTMLElement>(root, '[data-val="bloomThr"]')
  const exposureVal = qs<HTMLElement>(root, '[data-val="exposure"]')

  const starDensInput = qs<HTMLInputElement>(root, '#s-density')
  const starBrightInput = qs<HTMLInputElement>(root, '#s-bright')
  const nebulaInput = qs<HTMLInputElement>(root, '#s-nebula')
  const milkyInput = qs<HTMLInputElement>(root, '#s-milky')
  const skyResetBtn = qs<HTMLButtonElement>(root, '#s-reset')
  const starDensVal = qs<HTMLElement>(root, '[data-val="starDens"]')
  const starBrightVal = qs<HTMLElement>(root, '[data-val="starBright"]')
  const nebulaVal = qs<HTMLElement>(root, '[data-val="nebula"]')
  const milkyVal = qs<HTMLElement>(root, '[data-val="milky"]')

  const geodesicSelect = qs<HTMLSelectElement>(root, '#g-integr')
  const geodesicVal = qs<HTMLElement>(root, '[data-val="geodesic"]')

  const presetHint = qs<HTMLElement>(root, '#preset-hint')
  const presetBtns = root.querySelectorAll<HTMLButtonElement>('.preset-btn:not(#s-reset)')

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
    if (activePresetId !== null) setActivePresetUi(null)
  }

  function syncPhysicsInputs(p: BlackHoleParams): void {
    setRangeValue(massInput, p.mass)
    setRangeValue(spinInput, p.spinStar)
    setRangeValue(chargeInput, p.charge)
    setText(massVal, fmt(p.mass, 2))
    setText(spinVal, fmt(p.spinStar, 3))
    setText(chargeVal, fmt(p.charge, 3))
  }

  function syncDiskInputs(d: DiskParams): void {
    setRangeValue(mdotInput, sliderFromMdot(d.mdot))
    setRangeValue(outerInput, d.outerM)
    if (mdotVal) {
      const tScale = mdotTemperatureScale(d.mdot)
      mdotVal.textContent = `${fmtMdot(d.mdot)}  (T×${fmt(tScale, 2)})`
    }
    setText(outerVal, `${fmt(d.outerM, 0)} M`)
  }

  function syncCameraInputs(c: CameraState): void {
    setRangeValue(distInput, c.distanceM)
    setRangeValue(incInput, radToDeg(c.inclination))
    setRangeValue(azInput, radToDeg(c.azimuth))
    setRangeValue(fovInput, c.fov)
    setText(distVal, `${fmt(c.distanceM, 1)}M`)
    setText(incVal, fmt(radToDeg(c.inclination), 1))
    setText(azVal, fmt(radToDeg(c.azimuth), 1))
    setText(fovVal, fmt(c.fov, 2))
  }

  function syncLookInputs(l: LookState): void {
    if (bloomOnInput) bloomOnInput.checked = l.bloomEnabled
    setRangeValue(bloomStrInput, l.bloomStrength)
    setRangeValue(bloomRadInput, l.bloomRadius)
    setRangeValue(bloomThrInput, l.bloomThreshold)
    setRangeValue(exposureInput, l.exposure)
    setText(bloomOnVal, l.bloomEnabled ? 'on' : 'off')
    setText(bloomStrVal, fmt(l.bloomStrength, 2))
    setText(bloomRadVal, fmt(l.bloomRadius, 2))
    setText(bloomThrVal, fmt(l.bloomThreshold, 2))
    setText(exposureVal, fmt(l.exposure, 2))
  }

  function syncSkyInputs(s: SkyState): void {
    setRangeValue(starDensInput, s.starDensity)
    setRangeValue(starBrightInput, s.starBrightness)
    setRangeValue(nebulaInput, s.nebula)
    setRangeValue(milkyInput, s.milky)
    setText(starDensVal, fmt(s.starDensity, 2))
    setText(starBrightVal, fmt(s.starBrightness, 2))
    setText(nebulaVal, fmt(s.nebula, 2))
    setText(milkyVal, fmt(s.milky, 2))
  }

  function syncGeodesicUi(): void {
    const mode = getGeodesicIntegrator()
    if (geodesicSelect) geodesicSelect.value = mode
    setText(geodesicVal, mode === 'bl' ? 'BL' : 'RT')
  }

  function syncDerived(d: DerivedGeometry, p: BlackHoleParams): void {
    if (!derivedRoot) return
    renderDerivedHud(derivedRoot, p, d, getDisk())
  }

  bindRange(massInput, (v) => {
    onUserTweaked()
    setParams({ mass: v })
  })
  bindRange(spinInput, (v) => {
    onUserTweaked()
    setParams({ spinStar: v })
  })
  bindRange(chargeInput, (v) => {
    onUserTweaked()
    setParams({ charge: v })
  })
  bindRange(mdotInput, (v) => {
    onUserTweaked()
    setDisk({ mdot: mdotFromSlider(v) })
  })
  bindRange(outerInput, (v) => {
    onUserTweaked()
    setDisk({ outerM: v })
  })

  bindRange(distInput, (v) => {
    onUserTweaked()
    setCamera({ distanceM: v })
  })
  bindRange(incInput, (v) => {
    onUserTweaked()
    setCamera({ inclination: degToRad(v) })
  })
  bindRange(azInput, (v) => {
    onUserTweaked()
    setCamera({ azimuth: degToRad(v) })
  })
  bindRange(fovInput, (v) => {
    onUserTweaked()
    setCamera({ fov: v })
  })

  bindCheckbox(bloomOnInput, (checked) => {
    onUserTweaked()
    setLook({ bloomEnabled: checked })
  })
  bindRange(bloomStrInput, (v) => {
    onUserTweaked()
    setLook({ bloomStrength: v })
  })
  bindRange(bloomRadInput, (v) => {
    onUserTweaked()
    setLook({ bloomRadius: v })
  })
  bindRange(bloomThrInput, (v) => {
    onUserTweaked()
    setLook({ bloomThreshold: v })
  })
  bindRange(exposureInput, (v) => {
    onUserTweaked()
    setLook({ exposure: v })
  })

  bindRange(starDensInput, (v) => setSky({ starDensity: v }))
  bindRange(starBrightInput, (v) => setSky({ starBrightness: v }))
  bindRange(nebulaInput, (v) => setSky({ nebula: v }))
  bindRange(milkyInput, (v) => setSky({ milky: v }))
  skyResetBtn?.addEventListener('click', () => {
    resetSky()
  })

  bindSelect(geodesicSelect, (v) => {
    setGeodesicIntegrator(v === 'bl' ? 'bl' : 'rt')
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

  subscribeSky((s) => {
    syncSkyInputs(s)
  })

  subscribeGeodesic(() => {
    syncGeodesicUi()
  })

  syncGeodesicUi()

  massInput?.addEventListener('input', () => {
    if (!chargeInput) return
    const m = Number(massInput.value)
    chargeInput.max = String(Math.max(0, m * 0.99))
  })

  syncPhysicsInputs(getParams())
  syncDiskInputs(getDisk())
  syncCameraInputs(getCamera())
  syncLookInputs(getLook())
  syncSkyInputs(getSky())
  syncDerived(getDerived(), getParams())
}
