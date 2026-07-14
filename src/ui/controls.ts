import { MAX_SPIN_STAR } from '../physics/constants'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import { getParams, setParams, subscribe } from '../state/params'

function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

export function mountControls(root: HTMLElement, derivedRoot: HTMLElement | null): void {
  root.innerHTML = `
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
    <details class="advanced">
      <summary>Advanced — charge Q</summary>
      <label class="ctrl">
        <span class="ctrl-name">Charge Q</span>
        <input type="range" id="p-charge" min="0" max="0.9" step="0.01" />
        <span class="ctrl-val" data-val="charge"></span>
      </label>
    </details>
  `

  const massInput = root.querySelector<HTMLInputElement>('#p-mass')
  const spinInput = root.querySelector<HTMLInputElement>('#p-spin')
  const chargeInput = root.querySelector<HTMLInputElement>('#p-charge')
  const massVal = root.querySelector<HTMLElement>('[data-val="mass"]')
  const spinVal = root.querySelector<HTMLElement>('[data-val="spin"]')
  const chargeVal = root.querySelector<HTMLElement>('[data-val="charge"]')

  function syncInputs(p: BlackHoleParams): void {
    if (massInput) massInput.value = String(p.mass)
    if (spinInput) spinInput.value = String(p.spinStar)
    if (chargeInput) chargeInput.value = String(p.charge)
    if (massVal) massVal.textContent = fmt(p.mass, 2)
    if (spinVal) spinVal.textContent = fmt(p.spinStar, 3)
    if (chargeVal) chargeVal.textContent = fmt(p.charge, 3)
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

  subscribe((p, d) => {
    syncInputs(p)
    syncDerived(d)
  })

  // Ensure charge max tracks current mass for UI affordance (clamp still in physics)
  massInput?.addEventListener('input', () => {
    if (!chargeInput) return
    const m = Number(massInput.value)
    chargeInput.max = String(Math.max(0, m * 0.99))
  })

  syncInputs(getParams())
}
