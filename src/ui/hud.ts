/**
 * Derived / science HUD panel (radii, disk, shadow diagnostics).
 */
import {
  mdotTemperatureScale,
  novikovThorneEfficiency,
  thinDiskScaleHeight,
} from '../physics/disk'
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
  const diag = shadowDiagnostics(params, derived, disk.prograde)
  const tScale = mdotTemperatureScale(disk.mdot)
  const m = Math.max(params.mass, 1e-12)
  const orbit = disk.prograde ? 'prograde (co-rot)' : 'retrograde (counter)'
  const eta = novikovThorneEfficiency(params.spinStar, disk.prograde)
  const hOverR = thinDiskScaleHeight(disk.mdot, diag.rIscoOverM)
  root.innerHTML = `
      <div class="diag-title">Black hole (no-hair)</div>
      <div><dt>family</dt><dd>${derived.family}</dd></div>
      <div><dt>r₊</dt><dd>${fmt(derived.rPlus)} <span class="dim">(${fmt(diag.rPlusOverM, 2)} M)</span></dd></div>
      <div><dt>r₋</dt><dd>${fmt(derived.rMinus)}</dd></div>
      <div><dt>r_ph</dt><dd>${fmt(derived.rPhotonSphere)} <span class="dim">(${fmt(diag.rPhotonOverM, 2)} M)</span></dd></div>
      <div class="diag-title">Disk (not hair · derived)</div>
      <div><dt>orbit</dt><dd>${orbit}</dd></div>
      <div><dt>r_ISCO</dt><dd>${fmt(diag.rIsco)} <span class="dim">(${fmt(diag.rIscoOverM, 2)} M)</span></dd></div>
      <div><dt>η_NT</dt><dd>${(eta * 100).toFixed(2)}% <span class="dim">(1−Ẽ_ISCO)</span></dd></div>
      <div><dt>ṁ</dt><dd>${fmtMdot(disk.mdot)} ṁ_Edd</dd></div>
      <div><dt>r_out</dt><dd>${fmt(disk.outerM, 1)} M</dd></div>
      <div><dt>H/R</dt><dd>${fmt(hOverR, 3)} <span class="dim">(thin-disk)</span></dd></div>
      <div><dt>T∝ṁ¼</dt><dd>×${fmt(tScale, 3)}</dd></div>
      <div class="diag-title">Shadow / critical curve (analytic HUD)</div>
      <div><dt>b_c⁺</dt><dd>${fmt(diag.bCritPro)} <span class="dim">(${fmt(diag.bCritProOverM, 2)} M · co-rot)</span></dd></div>
      <div><dt>b_c⁻</dt><dd>${fmt(diag.bCritRet)} <span class="dim">(${fmt(diag.bCritRetOverM, 2)} M · counter)</span></dd></div>
      <div><dt>⌀_shad</dt><dd>${fmt(diag.shadowDiameter)} <span class="dim">(~${fmt(diag.shadowDiameter / m, 2)} M · analytic ≠ image)</span></dd></div>
      <div><dt>r_ergo</dt><dd>${fmt(derived.rErgoEquator)} <span class="dim">(eq. static limit)</span></dd></div>
      <div><dt>Δ_ext</dt><dd>${fmt(derived.extremalityDelta)}</dd></div>
      <p class="ctrl-hint" style="margin-top:6px">η, ISCO, H/R derived · image from RT geodesic · pure black voids</p>
    `
}
