/**
 * Derived / science HUD panel (radii, disk, shadow diagnostics).
 */
import { mdotTemperatureScale } from '../physics/disk'
import type { DiskParams } from '../physics/diskParams'
import { shadowDiagnostics } from '../physics/diagnostics'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import { fmt, fmtMdot } from './format'

export function renderDerivedHud(
  root: HTMLElement,
  params: BlackHoleParams,
  derived: DerivedGeometry,
  disk: DiskParams,
): void {
  const diag = shadowDiagnostics(params, derived)
  const tScale = mdotTemperatureScale(disk.mdot)
  const m = Math.max(params.mass, 1e-12)
  root.innerHTML = `
      <div class="diag-title">Black hole (no-hair)</div>
      <div><dt>family</dt><dd>${derived.family}</dd></div>
      <div><dt>r₊</dt><dd>${fmt(derived.rPlus)} <span class="dim">(${fmt(diag.rPlusOverM, 2)} M)</span></dd></div>
      <div><dt>r₋</dt><dd>${fmt(derived.rMinus)}</dd></div>
      <div><dt>r_ph</dt><dd>${fmt(derived.rPhotonSphere)} <span class="dim">(${fmt(diag.rPhotonOverM, 2)} M)</span></dd></div>
      <div><dt>r_ISCO</dt><dd>${fmt(derived.rIsco)} <span class="dim">(${fmt(diag.rIscoOverM, 2)} M)</span></dd></div>
      <div class="diag-title">Disk (not hair)</div>
      <div><dt>ṁ</dt><dd>${fmtMdot(disk.mdot)} ṁ_Edd</dd></div>
      <div><dt>r_out</dt><dd>${fmt(disk.outerM, 1)} M</dd></div>
      <div><dt>T∝ṁ¼</dt><dd>×${fmt(tScale, 3)}</dd></div>
      <div class="diag-title">Shadow / critical curve (analytic)</div>
      <div><dt>b_c⁺</dt><dd>${fmt(diag.bCritPro)} <span class="dim">(${fmt(diag.bCritProOverM, 2)} M)</span></dd></div>
      <div><dt>b_c⁻</dt><dd>${fmt(diag.bCritRet)} <span class="dim">(${fmt(diag.bCritRetOverM, 2)} M)</span></dd></div>
      <div><dt>⌀_shad</dt><dd>${fmt(diag.shadowDiameter)} <span class="dim">(~${fmt(diag.shadowDiameter / m, 2)} M · analytic)</span></dd></div>
      <div><dt>Δ_ext</dt><dd>${fmt(derived.extremalityDelta)}</dd></div>
    `
}
