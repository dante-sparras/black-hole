/**
 * Debug HUD: mode select, health strip, probe log.
 * Panel is shown only when master “Debug mode” is on (see mountControls).
 */
import {
  DEBUG_MODE_OPTIONS,
  getDebug,
  getDebugLog,
  probeRay,
  runHealthCheck,
  setDebug,
  subscribeDebug,
  subscribeDebugLog,
  type DebugState,
  type HealthReport,
  type ProbeResult,
  debugLog,
} from '../debug'
import { getCamera } from '../state/camera'
import { getDisk } from '../state/disk'
import { getDerived, getParams } from '../state/params'
import { getScaleFree } from '../state/scaleFree'

export type DebugHudApi = {
  /** Call periodically from main loop */
  tickHealth: () => void
  /** Screen pixel → NDC probe (aspect-corrected like tracer) */
  probeAtClient: (
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
  ) => ProbeResult
  getLastHealth: () => HealthReport | null
  getLastProbe: () => ProbeResult | null
  /** Whether the debug panel is visible / active for probes */
  isOpen: () => boolean
  setOpen: (on: boolean) => void
}

export function mountDebugHud(root: HTMLElement): DebugHudApi {
  root.hidden = true
  root.classList.add('debug-panel')
  root.innerHTML = `
    <div class="ctrl-section">Debug tools</div>
    <p class="ctrl-hint">False-color modes · health strip · click-to-probe · log</p>
    <div class="ctrl">
      <span class="ctrl-label"><span class="ctrl-name">View mode</span></span>
      <select id="dbg-mode" class="ctrl-select" aria-label="Debug view mode"></select>
      <span class="ctrl-val" data-val="dbgMode"></span>
    </div>
    <label class="ctrl dbg-check-row">
      <span class="ctrl-label"><span class="ctrl-name">Health</span></span>
      <input type="checkbox" id="dbg-health" />
      <span class="ctrl-val" data-val="dbgHealth"></span>
    </label>
    <label class="ctrl dbg-check-row">
      <span class="ctrl-label"><span class="ctrl-name">Click probe</span></span>
      <input type="checkbox" id="dbg-probe" />
      <span class="ctrl-val" data-val="dbgProbe"></span>
    </label>
    <label class="ctrl dbg-check-row">
      <span class="ctrl-label"><span class="ctrl-name">Console log</span></span>
      <input type="checkbox" id="dbg-console" />
      <span class="ctrl-val" data-val="dbgConsole"></span>
    </label>
    <div id="dbg-health-strip" class="dbg-health ok">health: …</div>
    <div id="dbg-checks" class="dbg-checks"></div>
    <div id="dbg-probe-out" class="dbg-probe">Enable click probe, then click the canvas.</div>
    <div id="dbg-log" class="dbg-log"></div>
  `

  const modeSelect = root.querySelector<HTMLSelectElement>('#dbg-mode')
  const healthCb = root.querySelector<HTMLInputElement>('#dbg-health')
  const probeCb = root.querySelector<HTMLInputElement>('#dbg-probe')
  const consoleCb = root.querySelector<HTMLInputElement>('#dbg-console')
  const modeVal = root.querySelector<HTMLElement>('[data-val="dbgMode"]')
  const healthVal = root.querySelector<HTMLElement>('[data-val="dbgHealth"]')
  const probeVal = root.querySelector<HTMLElement>('[data-val="dbgProbe"]')
  const consoleVal = root.querySelector<HTMLElement>('[data-val="dbgConsole"]')
  const healthStrip = root.querySelector<HTMLElement>('#dbg-health-strip')
  const checksEl = root.querySelector<HTMLElement>('#dbg-checks')
  const probeOut = root.querySelector<HTMLElement>('#dbg-probe-out')
  const logEl = root.querySelector<HTMLElement>('#dbg-log')

  if (modeSelect) {
    for (const opt of DEBUG_MODE_OPTIONS) {
      const o = document.createElement('option')
      o.value = String(opt.id)
      o.textContent = opt.label
      modeSelect.appendChild(o)
    }
  }

  let lastHealth: HealthReport | null = null
  let lastProbe: ProbeResult | null = null
  let healthAccum = 0
  let open = false

  function syncInputs(s: DebugState): void {
    if (modeSelect) modeSelect.value = String(s.mode)
    if (healthCb) healthCb.checked = s.healthEnabled
    if (probeCb) probeCb.checked = s.probeEnabled
    if (consoleCb) consoleCb.checked = s.consoleMirror
    if (modeVal) {
      const label =
        DEBUG_MODE_OPTIONS.find((o) => o.id === s.mode)?.label ?? 'Normal'
      modeVal.textContent = label
    }
    if (healthVal) healthVal.textContent = s.healthEnabled ? 'on' : 'off'
    if (probeVal) probeVal.textContent = s.probeEnabled ? 'on' : 'off'
    if (consoleVal) consoleVal.textContent = s.consoleMirror ? 'on' : 'off'
  }

  function renderHealth(h: HealthReport): void {
    lastHealth = h
    if (healthStrip) {
      healthStrip.className = `dbg-health ${h.level}`
      healthStrip.textContent = h.summary
    }
    if (checksEl) {
      checksEl.innerHTML = h.checks
        .map(
          (c) =>
            `<div class="dbg-check ${c.level}"><b>${c.label}</b> ${c.detail}</div>`,
        )
        .join('')
    }
  }

  function renderLog(): void {
    if (!logEl) return
    const entries = getDebugLog().slice(-8)
    logEl.innerHTML = entries
      .map(
        (e) =>
          `<div class="dbg-log-line ${e.level}">${e.level} · ${e.code}: ${e.message}</div>`,
      )
      .join('')
  }

  function renderProbe(p: ProbeResult): void {
    lastProbe = p
    if (!probeOut) return
    const lastEvents = p.stepsLog
      .filter((s) => s.event)
      .slice(-6)
      .map((s) => `#${s.i} ${s.event} r=${(s.r / getParams().mass).toFixed(2)}M`)
      .join(' · ')
    probeOut.innerHTML =
      `<div><b>Probe</b> ndc=(${p.ndcX.toFixed(3)}, ${p.ndcY.toFixed(3)})</div>` +
      `<div>${p.summary}</div>` +
      (lastEvents ? `<div class="dbg-probe-events">${lastEvents}</div>` : '')
  }

  modeSelect?.addEventListener('change', () => {
    setDebug({ mode: Number(modeSelect.value) as DebugState['mode'] })
  })
  healthCb?.addEventListener('change', () => {
    setDebug({ healthEnabled: healthCb.checked })
  })
  probeCb?.addEventListener('change', () => {
    setDebug({ probeEnabled: probeCb.checked })
  })
  consoleCb?.addEventListener('change', () => {
    setDebug({ consoleMirror: consoleCb.checked })
  })

  subscribeDebug(syncInputs)
  subscribeDebugLog(() => renderLog())
  syncInputs(getDebug())
  renderLog()

  function setOpen(on: boolean): void {
    open = on
    root.hidden = !on
    document.getElementById('hud')?.classList.toggle('debug-on', on)
    if (!on) {
      // Leave the image in normal mode when closing the panel
      setDebug({ mode: 0, probeEnabled: false })
    }
  }

  function tickHealth(): void {
    if (!open) return
    const s = getDebug()
    if (!s.healthEnabled) return
    healthAccum++
    if (healthAccum > 1 && healthAccum % 90 !== 0) return
    try {
      const report = runHealthCheck({
        params: getParams(),
        derived: getDerived(),
        disk: getDisk(),
        camera: getCamera(),
        scaleFree: getScaleFree(),
      })
      renderHealth(report)
    } catch (err) {
      debugLog.error(
        'health',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  function probeAtClient(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
  ): ProbeResult {
    const rect = canvas.getBoundingClientRect()
    const u = (clientX - rect.left) / Math.max(rect.width, 1)
    const v = (clientY - rect.top) / Math.max(rect.height, 1)
    const aspect = rect.width / Math.max(rect.height, 1)
    const ndcX = (u * 2 - 1) * aspect
    const ndcY = -(v * 2 - 1)
    const p = probeRay({
      params: getParams(),
      camera: getCamera(),
      diskOuterM: getDisk().outerM,
      ndcX,
      ndcY,
      logStride: 6,
      scaleFree: getScaleFree(),
      prograde: true,
    })
    renderProbe(p)
    debugLog.info('probe', p.summary, {
      fate: p.fate,
      hits: p.hits,
      steps: p.steps,
    })
    return p
  }

  return {
    tickHealth,
    probeAtClient,
    getLastHealth: () => lastHealth,
    getLastProbe: () => lastProbe,
    isOpen: () => open,
    setOpen,
  }
}
