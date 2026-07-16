import { MDOT_MAX, MDOT_MIN } from '../physics/constants'
import {
  mdotFromSlider as mdotFromSliderRange,
  mdotTemperatureScale,
  sliderFromMdot as sliderFromMdotRange,
} from '../physics/disk'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import {
  DISK_LIMITS,
  type DiskParams,
  type MagGeometry,
  type MagnetState,
} from '../physics/diskParams'
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

function mdotFromSlider(t: number): number {
  return mdotFromSliderRange(t, MDOT_MIN, MDOT_MAX)
}
function sliderFromMdot(mdot: number): number {
  return sliderFromMdotRange(mdot, MDOT_MIN, MDOT_MAX)
}

function logFromSlider(t: number, min: number, max: number): number {
  const lo = Math.log10(min)
  const hi = Math.log10(max)
  const u = Math.min(1, Math.max(0, t / 1000))
  return 10 ** (lo + u * (hi - lo))
}
function sliderFromLog(v: number, min: number, max: number): number {
  const lo = Math.log10(min)
  const hi = Math.log10(max)
  const x = Math.log10(Math.max(v, min))
  return Math.min(1000, Math.max(0, ((x - lo) / (hi - lo)) * 1000))
}

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
  const rho0Input = qs<HTMLInputElement>(root, '#d-rho0')
  const hrInput = qs<HTMLInputElement>(root, '#d-hr')
  const gammaSelect = qs<HTMLSelectElement>(root, '#d-gamma')
  const polyKInput = qs<HTMLInputElement>(root, '#d-polyk')
  const ellInput = qs<HTMLInputElement>(root, '#d-ell')
  const betaInput = qs<HTMLInputElement>(root, '#d-beta')
  const magGeomSelect = qs<HTMLSelectElement>(root, '#d-maggeom')
  const madSelect = qs<HTMLSelectElement>(root, '#d-mad')
  const rinModeSelect = qs<HTMLSelectElement>(root, '#d-rinmode')
  const rinInput = qs<HTMLInputElement>(root, '#d-rin')
  const outerInput = qs<HTMLInputElement>(root, '#d-outer')
  const orbitSelect = qs<HTMLSelectElement>(root, '#d-orbit')
  const tiltInput = qs<HTMLInputElement>(root, '#d-tilt')
  const tiltNodeInput = qs<HTMLInputElement>(root, '#d-tilt-node')
  const perturbInput = qs<HTMLInputElement>(root, '#d-perturb')
  const jetInput = qs<HTMLInputElement>(root, '#d-jet')

  const massVal = qs<HTMLElement>(root, '[data-val="mass"]')
  const spinVal = qs<HTMLElement>(root, '[data-val="spin"]')
  const chargeVal = qs<HTMLElement>(root, '[data-val="charge"]')
  const mdotVal = qs<HTMLElement>(root, '[data-val="mdot"]')
  const rho0Val = qs<HTMLElement>(root, '[data-val="rho0"]')
  const hrVal = qs<HTMLElement>(root, '[data-val="hr"]')
  const gammaVal = qs<HTMLElement>(root, '[data-val="gamma"]')
  const polykVal = qs<HTMLElement>(root, '[data-val="polyk"]')
  const ellVal = qs<HTMLElement>(root, '[data-val="ell"]')
  const betaVal = qs<HTMLElement>(root, '[data-val="beta"]')
  const maggeomVal = qs<HTMLElement>(root, '[data-val="maggeom"]')
  const madVal = qs<HTMLElement>(root, '[data-val="mad"]')
  const rinmodeVal = qs<HTMLElement>(root, '[data-val="rinmode"]')
  const rinVal = qs<HTMLElement>(root, '[data-val="rin"]')
  const outerVal = qs<HTMLElement>(root, '[data-val="outer"]')
  const orbitVal = qs<HTMLElement>(root, '[data-val="orbit"]')
  const tiltVal = qs<HTMLElement>(root, '[data-val="tilt"]')
  const tiltNodeVal = qs<HTMLElement>(root, '[data-val="tiltNode"]')
  const perturbVal = qs<HTMLElement>(root, '[data-val="perturb"]')
  const jetVal = qs<HTMLElement>(root, '[data-val="jet"]')

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
    if (presetHint) presetHint.textContent = hint ?? 'Base-parameter scenes'
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
    setRangeValue(
      rho0Input,
      sliderFromLog(d.rho0, DISK_LIMITS.rho0.min, DISK_LIMITS.rho0.max),
    )
    setRangeValue(hrInput, d.scaleHeight)
    if (gammaSelect) gammaSelect.value = d.gamma < 1.5 ? '1.3333' : '1.6667'
    setRangeValue(
      polyKInput,
      sliderFromLog(d.polyK, DISK_LIMITS.polyK.min, DISK_LIMITS.polyK.max),
    )
    setRangeValue(ellInput, d.specificL)
    setRangeValue(
      betaInput,
      sliderFromLog(d.plasmaBeta, DISK_LIMITS.plasmaBeta.min, DISK_LIMITS.plasmaBeta.max),
    )
    if (magGeomSelect) magGeomSelect.value = d.magGeometry
    if (madSelect) madSelect.value = d.magnetState
    if (rinModeSelect) rinModeSelect.value = d.rinFree ? 'free' : 'isco'
    setRangeValue(rinInput, d.rinM)
    setRangeValue(outerInput, d.outerM)
    if (orbitSelect) orbitSelect.value = d.prograde ? 'pro' : 'ret'
    setRangeValue(tiltInput, radToDeg(d.tiltRad))
    setRangeValue(tiltNodeInput, radToDeg(d.tiltNodeRad))
    setRangeValue(perturbInput, d.perturbAmp)
    setRangeValue(jetInput, d.jetPower)

    if (mdotVal) {
      const tScale = mdotTemperatureScale(d.mdot)
      mdotVal.textContent = `${fmtMdot(d.mdot)}  (T×${fmt(tScale, 2)})`
    }
    setText(rho0Val, fmt(d.rho0, 2))
    setText(hrVal, fmt(d.scaleHeight, 3))
    setText(gammaVal, d.gamma < 1.5 ? '4/3' : '5/3')
    setText(polykVal, fmt(d.polyK, 2))
    setText(ellVal, fmt(d.specificL, 2))
    setText(betaVal, fmt(d.plasmaBeta, 1))
    setText(maggeomVal, d.magGeometry)
    setText(madVal, d.magnetState.toUpperCase())
    setText(rinmodeVal, d.rinFree ? 'free' : 'ISCO')
    setText(rinVal, `${fmt(d.rinM, 1)} M`)
    setText(outerVal, `${fmt(d.outerM, 0)} M`)
    setText(orbitVal, d.prograde ? 'pro' : 'ret')
    setText(tiltVal, fmt(radToDeg(d.tiltRad), 1))
    setText(tiltNodeVal, fmt(radToDeg(d.tiltNodeRad), 0))
    setText(perturbVal, fmt(d.perturbAmp, 2))
    setText(jetVal, fmt(d.jetPower, 2))
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
  bindRange(rho0Input, (v) => {
    onUserTweaked()
    setDisk({ rho0: logFromSlider(v, DISK_LIMITS.rho0.min, DISK_LIMITS.rho0.max) })
  })
  bindRange(hrInput, (v) => {
    onUserTweaked()
    setDisk({ scaleHeight: v })
  })
  bindSelect(gammaSelect, (v) => {
    onUserTweaked()
    setDisk({ gamma: Number(v) })
  })
  bindRange(polyKInput, (v) => {
    onUserTweaked()
    setDisk({ polyK: logFromSlider(v, DISK_LIMITS.polyK.min, DISK_LIMITS.polyK.max) })
  })
  bindRange(ellInput, (v) => {
    onUserTweaked()
    setDisk({ specificL: v })
  })
  bindRange(betaInput, (v) => {
    onUserTweaked()
    setDisk({
      plasmaBeta: logFromSlider(v, DISK_LIMITS.plasmaBeta.min, DISK_LIMITS.plasmaBeta.max),
    })
  })
  bindSelect(magGeomSelect, (v) => {
    onUserTweaked()
    setDisk({ magGeometry: v as MagGeometry })
  })
  bindSelect(madSelect, (v) => {
    onUserTweaked()
    const state = v as MagnetState
    // Switching MAD/SANE nudges β toward typical seeds if extreme
    if (state === 'mad') setDisk({ magnetState: state, plasmaBeta: Math.min(getDisk().plasmaBeta, 5) })
    else setDisk({ magnetState: state, plasmaBeta: Math.max(getDisk().plasmaBeta, 50) })
  })
  bindSelect(rinModeSelect, (v) => {
    onUserTweaked()
    setDisk({ rinFree: v === 'free' })
  })
  bindRange(rinInput, (v) => {
    onUserTweaked()
    setDisk({ rinM: v, rinFree: true })
    if (rinModeSelect) rinModeSelect.value = 'free'
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
  bindRange(perturbInput, (v) => {
    onUserTweaked()
    setDisk({ perturbAmp: v })
  })
  bindRange(jetInput, (v) => {
    onUserTweaked()
    setDisk({ jetPower: v })
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
  bindSelect(qualitySelect, (v) => setQuality(v as QualityLevel))
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
    setGrmhd({ enabled: wantCube, mix: wantCube ? 1 : 0 })
  })
  subscribeGrmhd((s) => {
    if (grmhdSelect) grmhdSelect.value = s.enabled && s.cube ? 'cube' : 'analytic'
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
