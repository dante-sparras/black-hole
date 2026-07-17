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
import { mountControlInfo } from './controlInfo'
import { buildControlsHtml } from './controlsMarkup'
import { fmt } from './format'
import { renderDerivedHud } from './hud'

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

/** Expert free-base panel (ṁ not free). */
export function mountControls(
  root: HTMLElement,
  derivedRoot: HTMLElement | null,
): void {
  root.innerHTML = buildControlsHtml()
    setScaleFree(true)
    setIdealBeam(true)
    // Scale-free: free M is pure scale — lock geometric mass
    setParams({ mass: 1 })
    mountControlInfo(root)

    const spinInput = qs<HTMLInputElement>(root, '#p-spin')
    const chargeInput = qs<HTMLInputElement>(root, '#p-charge')
    const rho0Input = qs<HTMLInputElement>(root, '#d-rho0')
    const hrInput = qs<HTMLInputElement>(root, '#d-hr')
    const gammaInput = qs<HTMLInputElement>(root, '#d-gamma')
    const betaInput = qs<HTMLInputElement>(root, '#d-beta')
    const rinInput = qs<HTMLInputElement>(root, '#d-rin')
    const outerInput = qs<HTMLInputElement>(root, '#d-outer')
    const tiltInput = qs<HTMLInputElement>(root, '#d-tilt')
    const jetInput = qs<HTMLInputElement>(root, '#d-jet')

    const spinVal = qs<HTMLElement>(root, '[data-val="spin"]')
    const chargeVal = qs<HTMLElement>(root, '[data-val="charge"]')
    const rho0Val = qs<HTMLElement>(root, '[data-val="rho0"]')
    const hrVal = qs<HTMLElement>(root, '[data-val="hr"]')
    const gammaVal = qs<HTMLElement>(root, '[data-val="gamma"]')
    const betaVal = qs<HTMLElement>(root, '[data-val="beta"]')
    const rinVal = qs<HTMLElement>(root, '[data-val="rin"]')
    const outerVal = qs<HTMLElement>(root, '[data-val="outer"]')
    const tiltVal = qs<HTMLElement>(root, '[data-val="tilt"]')
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
      if (presetHint) {
        presetHint.textContent =
          hint ?? 'Cool · Interstellar · Hot · ṁ derived on HUD'
      }
    }
    function onUserTweaked(): void {
      if (activePresetId !== null) setActivePresetUi(null)
    }

    function syncPhysicsInputs(p: BlackHoleParams): void {
      setRangeValue(spinInput, p.spinStar)
      setRangeValue(chargeInput, p.charge)
      setText(spinVal, fmt(p.spinStar, 3))
      setText(chargeVal, fmt(p.charge, 3))
    }

  function syncDiskInputs(d: DiskParams): void {
    setRangeValue(
      rho0Input,
      sliderFromLog(d.rho0, DISK_LIMITS.rho0.min, DISK_LIMITS.rho0.max),
    )
    setRangeValue(hrInput, d.scaleHeight)
    setRangeValue(gammaInput, d.gamma)
    setRangeValue(
      betaInput,
      sliderFromLog(d.plasmaBeta, DISK_LIMITS.plasmaBeta.min, DISK_LIMITS.plasmaBeta.max),
    )
    setRangeValue(rinInput, d.rinOverM)
    setRangeValue(outerInput, d.outerM)
    setRangeValue(tiltInput, radToDeg(d.tiltRad))
    setRangeValue(jetInput, d.jetBoost)

    setText(rho0Val, fmt(d.rho0, 2))
    setText(hrVal, fmt(d.scaleHeight, 3))
    setText(gammaVal, fmt(d.gamma, 3))
    setText(betaVal, fmt(d.plasmaBeta, 1))
    setText(rinVal, fmt(d.rinOverM, 2))
    setText(outerVal, `${fmt(d.outerM, 0)} M`)
    setText(tiltVal, fmt(radToDeg(d.tiltRad), 1))
    setText(jetVal, fmt(d.jetBoost, 2))
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

  bindRange(spinInput, (v) => {
      onUserTweaked()
      setParams({ spinStar: v })
    })
    bindRange(chargeInput, (v) => {
      onUserTweaked()
      setParams({ charge: v })
    })
  bindRange(rho0Input, (v) => {
    onUserTweaked()
    setDisk({ rho0: logFromSlider(v, DISK_LIMITS.rho0.min, DISK_LIMITS.rho0.max) })
  })
  bindRange(hrInput, (v) => {
    onUserTweaked()
    setDisk({ scaleHeight: v })
  })
  bindRange(gammaInput, (v) => {
    onUserTweaked()
    setDisk({ gamma: v })
  })
  bindRange(betaInput, (v) => {
    onUserTweaked()
    setDisk({
      plasmaBeta: logFromSlider(v, DISK_LIMITS.plasmaBeta.min, DISK_LIMITS.plasmaBeta.max),
    })
  })
  bindRange(rinInput, (v) => {
    onUserTweaked()
    setDisk({ rinOverM: v })
  })
  bindRange(outerInput, (v) => {
    onUserTweaked()
    // re-clamp r_in if outer shrinks
    const cur = getDisk()
    setDisk({ outerM: v, rinOverM: Math.min(cur.rinOverM, v - 0.5) })
  })
  bindRange(tiltInput, (v) => {
    onUserTweaked()
    setDisk({ tiltRad: degToRad(v) })
  })
  bindRange(jetInput, (v) => {
    onUserTweaked()
    setDisk({ jetBoost: v })
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
