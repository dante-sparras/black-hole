/**
 * Derived / science HUD — non-controllable readouts under free bases.
 * ṁ from free bases; ℓ̃ from r_in; ISCO ref; T_peak optical viz from NT edge.
 */
import {
  densRestTemperatureK,
  diskPeakTemperatureK,
  mdotTemperatureScale,
  novikovThorneEfficiency,
  novikovThornePeakRadius,
  observedTemperatureK,
} from '../physics/disk'
import {
  keplerSpecificL,
  magnetClassFromBeta,
  type DiskParams,
} from '../physics/diskParams'
import { effectiveDiskGeom } from '../physics/diskGeometry'
import { orbitingRedshiftFactor } from '../physics/geodesic/doppler'
import { jetEffectivePower } from '../physics/jets'
import { shadowDiagnostics } from '../physics/diagnostics'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import { spinLength } from '../physics/types'
import { fmt, fmtMdot, fmtTempK } from './format'

export function renderDerivedHud(
  root: HTMLElement,
  params: BlackHoleParams,
  derived: DerivedGeometry,
  disk: DiskParams,
): void {
  const diag = shadowDiagnostics(params, derived, true)
  const geom = effectiveDiskGeom(params, disk)
  const tScale = mdotTemperatureScale(disk.mdot)
  const m = Math.max(params.mass, 1e-12)
  const orbit = 'co-rotating (L ‖ J)'
  const eta = novikovThorneEfficiency(params.spinStar, true)
  const ell = keplerSpecificL(geom.rinOverM)
  const magClass = magnetClassFromBeta(disk.plasmaBeta)
  const jetEff = jetEffectivePower({
    jetBoost: disk.jetBoost,
    spinStar: params.spinStar,
    mdot: disk.mdot,
  })
  const tiltDeg = (disk.tiltRad * 180) / Math.PI
  const iscoDelta = geom.rinOverM - geom.iscoOverM

  // Optical-viz peak T (rest) at free r_in edge heating; dens path uses Schw NT peak
  const tPeakRest = diskPeakTemperatureK(disk.mdot, geom.rinOverM, params.spinStar)
  const rIn = geom.rIn
  const rPeakNt = novikovThornePeakRadius(rIn)
  const tPeakDens = densRestTemperatureK(rPeakNt, rIn, disk.mdot, m)
  const aLen = spinLength(params)
  const face = orbitingRedshiftFactor({
    mass: m,
    r: rPeakNt,
    spinLength: aLen,
    charge: params.charge,
    mu: 0,
    prograde: true,
  })
  const tPeakFace = observedTemperatureK(tPeakDens, face.g)

  root.innerHTML = `
      <div class="diag-title">Black hole (derived)</div>
      <div><dt>family</dt><dd>${derived.family}</dd></div>
      <div><dt>a★</dt><dd>${fmt(params.spinStar, 3)}</dd></div>
      <div><dt>r₊</dt><dd>${fmt(derived.rPlus)} <span class="dim">(${fmt(diag.rPlusOverM, 2)} M)</span></dd></div>
      <div><dt>r₋</dt><dd>${fmt(derived.rMinus)}</dd></div>
      <div><dt>r_ph</dt><dd>${fmt(derived.rPhotonSphere)} <span class="dim">(${fmt(diag.rPhotonOverM, 2)} M)</span></dd></div>

      <div class="diag-title">Disk (derived · expert)</div>
      <div><dt>ṁ / ṁ_Edd</dt><dd><strong>${fmtMdot(disk.mdot)}</strong> <span class="dim">from ρ₀·H/r·Γ·β₀·r_in</span></dd></div>
      <div><dt>T_peak</dt><dd><strong>${fmtTempK(tPeakRest)}</strong> <span class="dim">rest · optical viz · free r_in edge</span></dd></div>
      <div><dt>T_peak dens</dt><dd>${fmtTempK(tPeakDens)} <span class="dim">NT r_peak · face-on ${fmtTempK(tPeakFace)} (g=${fmt(face.g, 3)})</span></dd></div>
      <div><dt>T∝ṁ¼</dt><dd>×${fmt(tScale, 3)} <span class="dim">vs ṁ=0.1</span></dd></div>
      <div><dt>η_NT</dt><dd>${(eta * 100).toFixed(2)}%</dd></div>
      <div><dt>ℓ̃</dt><dd>${fmt(ell, 2)} <span class="dim">≈√(r_in/M) from free r_in</span></dd></div>
      <div><dt>r_ISCO</dt><dd>${fmt(geom.iscoOverM, 2)} M <span class="dim">ref · Δr_in=${fmt(iscoDelta, 2)} M</span></dd></div>
      <div><dt>r_peak</dt><dd>${fmt(geom.rPeakOverM, 1)} M <span class="dim">dens ℓ · NT ${fmt(rPeakNt / m, 2)} M</span></dd></div>
      <div><dt>orbit</dt><dd>${orbit}</dd></div>
      <div><dt>β class</dt><dd>${magClass.toUpperCase()} <span class="dim">from β₀</span></dd></div>
      <div><dt>jet_eff</dt><dd>${fmt(jetEff, 3)} <span class="dim">∝ a★² ṁ^0.4 · strength</span></dd></div>
      <div><dt>H/r</dt><dd>${fmt(disk.scaleHeight, 3)} <span class="dim">(free)</span></dd></div>
      <div><dt>Γ</dt><dd>${fmt(disk.gamma, 3)} <span class="dim">(free)</span></dd></div>
      <div><dt>r_in</dt><dd>${fmt(geom.rinOverM, 2)} M <span class="dim">(free · floored r₊)</span></dd></div>
      <div><dt>r_out</dt><dd>${fmt(disk.outerM, 1)} M <span class="dim">(free)</span></dd></div>
      <div><dt>tilt</dt><dd>${fmt(tiltDeg, 1)}° <span class="dim">(free)</span></dd></div>
      <div><dt>ρ₀</dt><dd>${fmt(disk.rho0, 2)} <span class="dim">(free)</span></dd></div>

      <div class="diag-title">Shadow (analytic HUD)</div>
      <div><dt>b_c⁺</dt><dd>${fmt(diag.bCritPro)} <span class="dim">(${fmt(diag.bCritProOverM, 2)} M)</span></dd></div>
      <div><dt>b_c⁻</dt><dd>${fmt(diag.bCritRet)} <span class="dim">(${fmt(diag.bCritRetOverM, 2)} M)</span></dd></div>
      <div><dt>⌀_shad</dt><dd>${fmt(diag.shadowDiameter)} <span class="dim">(~${fmt(diag.shadowDiameter / m, 2)} M)</span></dd></div>
      <div><dt>r_ergo</dt><dd>${fmt(derived.rErgoEquator)}</dd></div>
      <div><dt>Δ_ext</dt><dd>${fmt(derived.extremalityDelta)}</dd></div>
      <p class="ctrl-hint" style="margin-top:6px">Free: ρ₀, H/r, Γ, β₀, r_in, r_out, tilt, jet · ṁ & T_peak derived · ISCO ref · g Doppler on dens</p>
    `
}
