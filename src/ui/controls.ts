import { MDOT_MAX, MDOT_MIN } from '../physics/constants'
import {
  mdotFromSlider as mdotFromSliderRange,
  mdotTemperatureScale,
  sliderFromMdot as sliderFromMdotRange,
} from '../physics/disk'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import { DISK_LIMITS, type DiskParams } from '../physics/diskParams'
import { withBatch } from '../state/batch'
import {
  degToRad,
  getCamera,
  radToDeg,
  setCamera,
  subscribeCamera,
  type CameraState,
} from '../state/camera'
import { getDisk, setDisk, subscribeDisk } from '../state/disk'
import { getDerived, getParams, setParams, subscribe } from '../state/params'
import { applyPreset } from '../state/presets'
import { setIdealBeam } from '../state/idealBeam'
import { setScaleFree } from '../state/scaleFree'
import {
  setQuality,
  subscribeQuality,
  type QualityLevel,
} from '../state/quality'
import { getGrmhd, setGrmhd, subscribeGrmhd } from '../state/grmhd'
import {
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

/** Log-space 0…1000 ↔ plasma β ∈ [β_min, β_max]. */
function betaFromSlider(t: number): number {
  const lo = Math.log10(DISK_LIMITS.plasmaBeta.min)
  const hi = Math.log10(DISK_LIMITS.plasmaBeta.max)
  const u = Math.min(1, Math.max(0, t / 1000))
  return 10 ** (lo + u * (hi - lo))
}

function sliderFromBeta(beta: number): number {
  const lo = Math.log10(DISK_LIMITS.plasmaBeta.min)
  const hi = Math.log10(DISK_LIMITS.plasmaBeta.max)
  const b = Math.log10(Math.max(beta, DISK_LIMITS.plasmaBeta.min))
  return Math.min(1000, Math.max(0, ((b - lo) / (hi - lo)) * 1000))
}

/**
 * Base-parameter panel + optional jets + expert Γ/β.
 * Locks: scale-free ON, ideal I∝g³ ON, structure/shear model defaults.
 */
export function mountControls(
  root: HTMLElement,
  derivedRoot: HTMLElement | null,
): void {
  root.innerHTML = buildControlsHtml()

  setScaleFree(true)
  setIdealBeam(true)

  const massInput = qs<HTMLInputElement>(root, '#p-mass')
  const spinInput = qs<HTMLInputElement>(root, '#p-spin')
  const chargeInput = qs<HTMLInputElement>(root, '#p-charge')
  const mdotInput = qs<HTMLInputElement>(root, '#d-mdot')
  const outerInput = qs<HTMLInputElement>(root, '#d-outer')
  const orbitSelect = qs<HTMLSelectElement>(root, '#d-orbit')
  const tiltInput = qs<HTMLInputElement>(root, '#d-tilt')
  const tiltNodeInput = qs<HTMLInputElement>(root, '#d-tilt-node')
  const jetInput = qs<HTMLInputElement>(root, '#d-jet')
  const gammaSelect = qs<HTMLSelectElement>(root, '#d-gamma')
  const betaInput = qs<HTMLInputElement>(root, '#d-beta')

  const massVal = qs<HTMLElement>(root, '[data-val="mass"]')
  const spinVal = qs<HTMLElement>(root, '[data-val="spin"]')
  const chargeVal = qs<HTMLElement>(root, '[data-val="charge"]')
  const mdotVal = qs<HTMLElement>(root, '[data-val="mdot"]')
  const outerVal = qs<HTMLElement>(root, '[data-val="outer"]')
  const orbitVal = qs<HTMLElement>(root, '[data-val="orbit"]')
  const tiltVal = qs<HTMLElement>(root, '[data-val="tilt"]')
  const tiltNodeVal = qs<HTMLElement>(root, '[data-val="tiltNode"]')
  const jetVal = qs<HTMLElement>(root, '[data-val="jet"]')
  const gammaVal = qs<HTMLElement>(root, '[data-val="gamma"]')
  const betaVal = qs<HTMLElement>(root, '[data-val="beta"]')

  const distInput = qs<HTMLInputElement>(root, '#c-dist')
  const incInput = qs<HTMLInputElement>(root, '#c-inc')
  const azInput = qs<HTMLInputElement>(root, '#c-az')
  const fovInput = qs<HTMLInputElement>(root, '#c-fov')
  const distVal = qs<HTMLElement>(root, '[data-val="dist"]')
  const incVal = qs<HTMLElement>(root, '[data-val="inc"]')
  const azVal = qs<HTMLElement>(root, '[data-val="az"]')
  const fovVal = qs<HTMLElement>(root, '[data-val="fov"]')

  const presetHint = qs<HTMLElement>(root, '#preset-hint')
  const presetBtns = root.querySelectorAll<HTMLButtonElement>('[data-preset]')

  let activePresetId: string | null = null

  function setActivePresetUi(id: string | null, hint?: string): void {
    activePresetId = id
    for (const btn of presetBtns) {
      const on = btn.dataset.preset === id
      btn.classList.toggle('active', on)
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
    if (presetHint) {
      presetHint.textContent = hint ?? 'Base-parameter scenes only'
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
    if (orbitSelect) orbitSelect.value = d.prograde ? 'pro' : 'ret'
    setRangeValue(tiltInput, radToDeg(d.tiltRad))
    setRangeValue(tiltNodeInput, radToDeg(d.tiltNodeRad))
    setRangeValue(jetInput, d.jetPower)
    setRangeValue(betaInput, sliderFromBeta(d.plasmaBeta))
    if (gammaSelect) {
      // snap to 5/3 or 4/3
      gammaSelect.value = d.gamma < 1.5 ? '1.3333' : '1.6667'
    }
    if (mdotVal) {
      const tScale = mdotTemperatureScale(d.mdot)
      mdotVal.textContent = `${fmtMdot(d.mdot)}  (T×${fmt(tScale, 2)})`
    }
    setText(outerVal, `${fmt(d.outerM, 0)} M`)
    setText(orbitVal, d.prograde ? 'pro' : 'ret')
    setText(tiltVal, fmt(radToDeg(d.tiltRad), 1))
    setText(tiltNodeVal, fmt(radToDeg(d.tiltNodeRad), 0))
    setText(jetVal, fmt(d.jetPower, 2))
    setText(gammaVal, d.gamma < 1.5 ? '4/3' : '5/3')
    setText(betaVal, fmt(d.plasmaBeta, 2))
  }

  function syncCameraInputs(c: CameraState): void {
    setRangeValue(distInput, c.distanceM)
    setRangeValue(incInput, radToDeg(c.inclination))
    setRangeValue(azInput, radToDeg(c.azimuth))
    setRangeValue(fovInput, c.fov)
    setText(distVal, fmt(c.distanceM, 1))
    setText(incVal, fmt(radToDeg(c.inclination), 1))
    setText(azVal, fmt(radToDeg(c.azimuth), 1))
    setText(fovVal, fmt(c.fov, 2))
  }

  function syncDerived(d: DerivedGeometry): void {
    if (derivedRoot) renderDerivedHud(derivedRoot, getParams(), d, getDisk())
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
  bindSelect(orbitSelect, (v) => {
    onUserTweaked()
    setDisk({ prograde: v === 'pro' })
  })
  bindRange(tiltInput, (v) => {
    onUserTweaked()
    setDisk({ tiltRad: degToRad(v) })
  })
  bindRange(tiltNodeInput, (v) => {
    onUserTweaked()
    setDisk({ tiltNodeRad: degToRad(v) })
  })
  bindRange(jetInput, (v) => {
    onUserTweaked()
    setDisk({ jetPower: v })
  })
  bindSelect(gammaSelect, (v) => {
    onUserTweaked()
    setDisk({ gamma: Number(v) })
  })
  bindRange(betaInput, (v) => {
    onUserTweaked()
    setDisk({ plasmaBeta: betaFromSlider(v) })
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

  const qualitySelect = qs<HTMLSelectElement>(root, '#q-level')
  const qualityVal = qs<HTMLElement>(root, '[data-val="quality"]')
  bindSelect(qualitySelect, (v) => {
    setQuality(v as QualityLevel)
  })
  subscribeQuality((q) => {
    if (qualitySelect) qualitySelect.value = q.level
    setText(qualityVal, q.level)
  })

  const grmhdSelect = qs<HTMLSelectElement>(root, '#grmhd-src')
  const grmhdVal = qs<HTMLElement>(root, '[data-val="grmhd"]')
  bindSelect(grmhdSelect, (v) => {
    const wantCube = v === 'cube'
    const s = getGrmhd()
    if (wantCube && !s.cube) {
      setText(grmhdVal, 'no cube')
      if (grmhdSelect) grmhdSelect.value = 'analytic'
      return
    }
    setGrmhd({
      enabled: wantCube,
      mix: wantCube ? 1 : 0,
    })
  })
  subscribeGrmhd((s) => {
    const mode = s.enabled && s.cube ? 'cube' : 'analytic'
    if (grmhdSelect) grmhdSelect.value = mode
    setText(grmhdVal, s.enabled && s.cube ? s.label : 'analytic')
  })

  for (const btn of presetBtns) {
    btn.addEventListener('click', () => {
      const id = btn.dataset.preset
      if (!id) return
      withBatch(() => {
        applyPreset(id)
        setScaleFree(true)
        setIdealBeam(true)
      })
      setActivePresetUi(id, btn.title || id)
    })
  }

  subscribe((p) => {
    syncPhysicsInputs(p)
    syncDerived(getDerived())
  })
  subscribeDisk((d) => {
    syncDiskInputs(d)
    syncDerived(getDerived())
  })
  subscribeCamera(syncCameraInputs)

  syncPhysicsInputs(getParams())
  syncDiskInputs(getDisk())
  syncCameraInputs(getCamera())
  syncDerived(getDerived())
}
