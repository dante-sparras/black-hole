import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import { MAX_SPIN_STAR } from '../physics/constants'
import { DISK_LIMITS, type DiskParams } from '../physics/diskParams'
import { withBatch } from '../state/batch'
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
import { getDerived, getParams, setParams, subscribe } from '../state/params'
import { applyPreset, DEFAULT_PRESET_ID } from '../state/presets'
import { setIdealBeam } from '../state/idealBeam'
import { setScaleFree } from '../state/scaleFree'
import {
  setQuality,
  getQuality,
  subscribeQuality,
  type QualityLevel,
} from '../state/quality'
import { getGrmhd, setGrmhd, subscribeGrmhd } from '../state/grmhd'
import {
  bindNumber,
  bindRange,
  bindSelect,
  qs,
  setNumValue,
  setRangeValue,
  setText,
} from './controlBind'
import { captureAndDownloadScreenshot } from './screenshot'
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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Expert free-base panel (ṁ not free). Slider + typed number on each free lever. */
export type ControlsOptions = {
  /** Live canvas (WebGPU renderer.domElement). */
  getCanvas?: () => HTMLCanvasElement
  /** Run one frame of the post stack before capture. */
  renderFrame?: () => void
  /** Show/hide the debug tools panel (from Debug mode checkbox). */
  setDebugOpen?: (on: boolean) => void
}

export function mountControls(
  root: HTMLElement,
  derivedRoot: HTMLElement | null,
  options: ControlsOptions = {},
): void {
  root.innerHTML = buildControlsHtml()
  setScaleFree(true)
  setIdealBeam(true)
  // Boot on Hot (default look); scale-free + M=1 locked via applyPreset
  const boot = applyPreset(DEFAULT_PRESET_ID)
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

  const spinNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="spin"]')
  const chargeNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="charge"]')
  const rho0Num = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="rho0"]')
  const hrNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="hr"]')
  const gammaNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="gamma"]')
  const betaNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="beta"]')
  const rinNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="rin"]')
  const outerNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="outer"]')
  const tiltNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="tilt"]')
  const jetNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="jet"]')

  const distInput = qs<HTMLInputElement>(root, '#c-dist')
  const incInput = qs<HTMLInputElement>(root, '#c-inc')
  const azInput = qs<HTMLInputElement>(root, '#c-az')
  const fovInput = qs<HTMLInputElement>(root, '#c-fov')
  const distNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="dist"]')
  const incNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="inc"]')
  const azNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="az"]')
  const fovNum = qs<HTMLInputElement>(root, 'input.ctrl-num[data-val="fov"]')

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
        hint ?? 'Hot · Cool · Interstellar · ṁ derived on HUD'
    }
  }
  function onUserTweaked(): void {
    if (activePresetId !== null) setActivePresetUi(null)
  }

  function syncPhysicsInputs(p: BlackHoleParams): void {
    setRangeValue(spinInput, p.spinStar)
    setRangeValue(chargeInput, p.charge)
    setNumValue(spinNum, fmt(p.spinStar, 3))
    setNumValue(chargeNum, fmt(p.charge, 3))
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

    setNumValue(rho0Num, fmt(d.rho0, 2))
    setNumValue(hrNum, fmt(d.scaleHeight, 3))
    setNumValue(gammaNum, fmt(d.gamma, 3))
    setNumValue(betaNum, fmt(d.plasmaBeta, 1))
    setNumValue(rinNum, fmt(d.rinOverM, 2))
    setNumValue(outerNum, fmt(d.outerM, 0))
    setNumValue(tiltNum, fmt(radToDeg(d.tiltRad), 1))
    setNumValue(jetNum, fmt(d.jetBoost, 2))
  }

  function syncCameraInputs(c: CameraState): void {
    setRangeValue(distInput, c.distanceM)
    setRangeValue(incInput, radToDeg(c.inclination))
    setRangeValue(azInput, radToDeg(c.azimuth))
    setRangeValue(fovInput, c.fov)
    setNumValue(distNum, fmt(c.distanceM, 1))
    setNumValue(incNum, fmt(radToDeg(c.inclination), 1))
    setNumValue(azNum, fmt(radToDeg(c.azimuth), 1))
    setNumValue(fovNum, fmt(c.fov, 2))
  }

  function syncDerived(d: DerivedGeometry): void {
    if (derivedRoot) renderDerivedHud(derivedRoot, getParams(), d, getDisk())
  }

  // —— Slider ↔ store ——
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

  // —— Number field → store (physical units; clamps to limits) ——
  bindNumber(
    spinNum,
    (v) => {
      onUserTweaked()
      setParams({ spinStar: v })
    },
    { parse: (v) => clamp(v, -MAX_SPIN_STAR, MAX_SPIN_STAR) },
  )
  bindNumber(
    chargeNum,
    (v) => {
      onUserTweaked()
      setParams({ charge: v })
    },
    { parse: (v) => clamp(v, 0, 0.95) },
  )
  bindNumber(
    rho0Num,
    (v) => {
      onUserTweaked()
      setDisk({ rho0: v })
    },
    { parse: (v) => clamp(v, DISK_LIMITS.rho0.min, DISK_LIMITS.rho0.max) },
  )
  bindNumber(
    hrNum,
    (v) => {
      onUserTweaked()
      setDisk({ scaleHeight: v })
    },
    {
      parse: (v) =>
        clamp(v, DISK_LIMITS.scaleHeight.min, DISK_LIMITS.scaleHeight.max),
    },
  )
  bindNumber(
    gammaNum,
    (v) => {
      onUserTweaked()
      setDisk({ gamma: v })
    },
    { parse: (v) => clamp(v, DISK_LIMITS.gamma.min, DISK_LIMITS.gamma.max) },
  )
  bindNumber(
    betaNum,
    (v) => {
      onUserTweaked()
      setDisk({ plasmaBeta: v })
    },
    {
      parse: (v) =>
        clamp(v, DISK_LIMITS.plasmaBeta.min, DISK_LIMITS.plasmaBeta.max),
    },
  )
  bindNumber(
    rinNum,
    (v) => {
      onUserTweaked()
      setDisk({ rinOverM: v })
    },
    { parse: (v) => clamp(v, DISK_LIMITS.rinOverM.min, DISK_LIMITS.rinOverM.max) },
  )
  bindNumber(
    outerNum,
    (v) => {
      onUserTweaked()
      const outerM = clamp(v, DISK_LIMITS.outerM.min, DISK_LIMITS.outerM.max)
      const cur = getDisk()
      setDisk({ outerM, rinOverM: Math.min(cur.rinOverM, outerM - 0.5) })
    },
    { parse: (v) => clamp(v, DISK_LIMITS.outerM.min, DISK_LIMITS.outerM.max) },
  )
  bindNumber(
    tiltNum,
    (v) => {
      onUserTweaked()
      setDisk({ tiltRad: degToRad(v) })
    },
    {
      parse: (v) =>
        clamp(v, 0, radToDeg(DISK_LIMITS.tiltRad.max)),
    },
  )
  bindNumber(
    jetNum,
    (v) => {
      onUserTweaked()
      setDisk({ jetBoost: v })
    },
    { parse: (v) => clamp(v, 0, 1) },
  )
  bindNumber(
      distNum,
      (v) => {
        onUserTweaked()
        setCamera({ distanceM: v })
      },
      {
        parse: (v) => clamp(v, CAMERA_LIMITS.distanceM.min, CAMERA_LIMITS.distanceM.max),
      },
    )
    bindNumber(
      incNum,
      (v) => {
        onUserTweaked()
        setCamera({ inclination: degToRad(v) })
      },
      {
        parse: (v) =>
          clamp(
            v,
            radToDeg(CAMERA_LIMITS.inclination.min),
            radToDeg(CAMERA_LIMITS.inclination.max),
          ),
      },
    )
    bindNumber(
      azNum,
      (v) => {
        onUserTweaked()
        let a = v % 360
        if (a < 0) a += 360
        setCamera({ azimuth: degToRad(a) })
      },
      {
        parse: (v) => {
          let a = v % 360
          if (a < 0) a += 360
          return a
        },
      },
    )
    bindNumber(
      fovNum,
      (v) => {
        onUserTweaked()
        setCamera({ fov: v })
      },
      { parse: (v) => clamp(v, CAMERA_LIMITS.fov.min, CAMERA_LIMITS.fov.max) },
    )

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

    const shotBtn = qs<HTMLButtonElement>(root, '#btn-screenshot')
    const shotStatus = qs<HTMLElement>(root, '#screenshot-status')
    shotBtn?.addEventListener('click', () => {
          void (async () => {
            if (!options.getCanvas || !options.renderFrame) {
              if (shotStatus) shotStatus.textContent = 'Screenshot not ready'
              return
            }
            if (shotBtn) shotBtn.disabled = true
            if (shotStatus) shotStatus.textContent = 'Capturing…'
            try {
              const p = getParams()
              const q = getQuality()
              const result = await captureAndDownloadScreenshot({
                getCanvas: options.getCanvas,
                renderFrame: options.renderFrame,
                tags: [
                  q.level,
                  `a${fmt(p.spinStar, 2)}`,
                  p.charge > 1e-4 ? `Q${fmt(p.charge, 2)}` : '',
                ],
              })
              if (shotStatus) {
                shotStatus.textContent = `Saved ${result.width}×${result.height}`
              }
            } catch (err) {
              if (shotStatus) {
                shotStatus.textContent =
                  err instanceof Error ? err.message : 'Screenshot failed'
              }
            } finally {
              if (shotBtn) shotBtn.disabled = false
              window.setTimeout(() => {
                if (shotStatus && shotStatus.textContent?.startsWith('Saved')) {
                  shotStatus.textContent = ''
                }
              }, 4_000)
            }
          })()
        })

      const dbgMaster = qs<HTMLInputElement>(root, '#dbg-master')
      const dbgMasterVal = qs<HTMLElement>(root, '#dbg-master-val')
      dbgMaster?.addEventListener('change', () => {
        const on = Boolean(dbgMaster.checked)
        if (dbgMasterVal) dbgMasterVal.textContent = on ? 'on' : 'off'
        options.setDebugOpen?.(on)
      })

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
  setActivePresetUi(boot.id, boot.hint)
}
