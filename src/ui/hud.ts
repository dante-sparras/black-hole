/**
 * Derived / science HUD panel (radii, disk, shadow diagnostics).
 */
import {
  mdotTemperatureScale,
  novikovThorneEfficiency,
  thinDiskScaleHeight,
} from '../physics/disk'
import {
  polyTemperatureScale,
  type DiskParams,
} from '../physics/diskParams'
import { effectiveDiskGeom } from '../physics/diskGeometry'
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
  const geom = effectiveDiskGeom(params, disk)
  const tScale = mdotTemperatureScale(disk.mdot)
  const polyT = polyTemperatureScale(disk.polyK, disk.rho0, disk.gamma)
  const m = Math.max(params.mass, 1e-12)
  const orbit = disk.prograde ? 'prograde (co-rot)' : 'retrograde (counter)'
  const eta = novikovThorneEfficiency(params.spinStar, disk.prograde)
  const hThin = thinDiskScaleHeight(disk.mdot, geom.iscoOverM, disk.gamma)
  const tiltDeg = (disk.tiltRad * 180) / Math.PI
  root.innerHTML = `
      <div class="diag-title">Black hole (no-hair)</div>
      <div><dt>family</dt><dd>${derived.family}</dd></div>
      <div><dt>a★</dt><dd>${fmt(params.spinStar, 3)} <span class="dim">(signed)</span></dd></div>
      <div><dt>r₊</dt><dd>${fmt(derived.rPlus)} <span class="dim">(${fmt(diag.rPlusOverM, 2)} M)</span></dd></div>
      <div><dt>r₋</dt><dd>${fmt(derived.rMinus)}</dd></div>
      <div><dt>r_ph</dt><dd>${fmt(derived.rPhotonSphere)} <span class="dim">(${fmt(diag.rPhotonOverM, 2)} M)</span></dd></div>
      <div class="diag-title">Disk (base + derived)</div>
      <div><dt>orbit</dt><dd>${orbit}</dd></div>
      <div><dt>tilt</dt><dd>${fmt(tiltDeg, 1)}°</dd></div>
      <div><dt>ρ₀</dt><dd>${fmt(disk.rho0, 2)}</dd></div>
      <div><dt>H/r</dt><dd>${fmt(disk.scaleHeight, 3)} <span class="dim">(free)</span></dd></div>
      <div><dt>H/r thin</dt><dd>${fmt(hThin, 3)} <span class="dim">(ref ṁ+Γ)</span></dd></div>
      <div><dt>Γ</dt><dd>${disk.gamma < 1.5 ? '4/3' : '5/3'}</dd></div>
      <div><dt>K</dt><dd>${fmt(disk.polyK, 2)} <span class="dim">T×${fmt(polyT, 2)}</span></dd></div>
      <div><dt>ℓ̃</dt><dd>${fmt(disk.specificL, 2)} <span class="dim">r_peak≈${fmt(geom.rPeakOverM, 1)}M</span></dd></div>
      <div><dt>β₀</dt><dd>${fmt(disk.plasmaBeta, 1)} · ${disk.magnetState.toUpperCase()}</dd></div>
      <div><dt>B</dt><dd>${disk.magGeometry}</dd></div>
      <div><dt>r_in</dt><dd>${fmt(geom.rinOverM, 2)} M <span class="dim">(${disk.rinFree ? 'free' : 'ISCO'})</span></dd></div>
      <div><dt>r_ISCO</dt><dd>${fmt(geom.iscoOverM, 2)} M</dd></div>
      <div><dt>η_NT</dt><dd>${(eta * 100).toFixed(2)}%</dd></div>
      <div><dt>ṁ</dt><dd>${fmtMdot(disk.mdot)} ṁ_Edd</dd></div>
      <div><dt>r_out</dt><dd>${fmt(disk.outerM, 1)} M</dd></div>
      <div><dt>jet</dt><dd>${fmt(disk.jetPower, 2)}</dd></div>
      <div><dt>T∝ṁ¼</dt><dd>×${fmt(tScale, 3)}</dd></div>
      <div class="diag-title">Shadow / critical curve (analytic HUD)</div>
      <div><dt>b_c⁺</dt><dd>${fmt(diag.bCritPro)} <span class="dim">(${fmt(diag.bCritProOverM, 2)} M · co-rot)</span></dd></div>
      <div><dt>b_c⁻</dt><dd>${fmt(diag.bCritRet)} <span class="dim">(${fmt(diag.bCritRetOverM, 2)} M · counter)</span></dd></div>
      <div><dt>⌀_shad</dt><dd>${fmt(diag.shadowDiameter)} <span class="dim">(~${fmt(diag.shadowDiameter / m, 2)} M)</span></dd></div>
      <div><dt>r_ergo</dt><dd>${fmt(derived.rErgoEquator)}</dd></div>
      <div><dt>Δ_ext</dt><dd>${fmt(derived.extremalityDelta)}</dd></div>
      <p class="ctrl-hint" style="margin-top:6px">Image from RT geodesic · pure black voids · torus params ≈ equilibrium seeds</p>
    `
}
