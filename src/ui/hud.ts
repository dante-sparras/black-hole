/**
 * Derived / science HUD — non-controllable readouts only.
 * Free bases live in the controls panel; this is pure diagnostics.
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
import { realtimeModeTag } from '../physics/metricFamily'
import { getGeodesicIntegrator } from '../state/geodesic'
import { getGrmhd } from '../state/grmhd'
import { getIdealBeam } from '../state/idealBeam'
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
  const eta = novikovThorneEfficiency(params.spinStar, true)
  const ell = keplerSpecificL(geom.rinOverM)
  const magClass = magnetClassFromBeta(disk.plasmaBeta)
  const jetEff = jetEffectivePower({
    jetBoost: disk.jetBoost,
    spinStar: params.spinStar,
    mdot: disk.mdot,
  })
  const iscoDelta = geom.rinOverM - geom.iscoOverM

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
    const mode = realtimeModeTag(params, getGeodesicIntegrator())
    const grmhd = getGrmhd()
    const densTag =
        grmhd.enabled && grmhd.cube ? grmhd.label : 'analytic'
    const beamTag = getIdealBeam() ? 'I∝g³' : 'I∝g²'

    root.innerHTML = `
        <div class="diag-title">Session</div>
        <div><dt>mode</dt><dd>${mode}</dd></div>
        <div><dt>dens</dt><dd>${densTag}</dd></div>
        <div><dt>beam</dt><dd>${beamTag}</dd></div>
        <div><dt>a★</dt><dd>${fmt(params.spinStar, 3)}</dd></div>
        <div><dt>Q</dt><dd>${fmt(params.charge, 3)}</dd></div>

        <div class="diag-title">Black hole</div>
        <div><dt>family</dt><dd>${derived.family}</dd></div>
        <div><dt>r₊</dt><dd>${fmt(diag.rPlusOverM, 2)} M</dd></div>
        <div><dt>r_ph</dt><dd>${fmt(diag.rPhotonOverM, 2)} M</dd></div>
        <div><dt>r_ergo</dt><dd>${fmt(derived.rErgoEquator / m, 2)} M</dd></div>

        <div class="diag-title">Accretion</div>
        <div><dt>ṁ / ṁ_Edd</dt><dd><strong>${fmtMdot(disk.mdot)}</strong> <span class="dim">from free bases</span></dd></div>
        <div><dt>T_peak</dt><dd><strong>${fmtTempK(tPeakRest)}</strong> <span class="dim">rest · free r_in edge</span></dd></div>
        <div><dt>T face-on</dt><dd>${fmtTempK(tPeakFace)} <span class="dim">g=${fmt(face.g, 3)}</span></dd></div>
        <div><dt>T∝ṁ¼</dt><dd>×${fmt(tScale, 3)} <span class="dim">vs ṁ=0.1</span></dd></div>
        <div><dt>η_NT</dt><dd>${(eta * 100).toFixed(2)}%</dd></div>
        <div><dt>ℓ̃</dt><dd>${fmt(ell, 2)} <span class="dim">≈√(r_in/M)</span></dd></div>
        <div><dt>r_ISCO</dt><dd>${fmt(geom.iscoOverM, 2)} M <span class="dim">ref · Δr_in=${fmt(iscoDelta, 2)} M</span></dd></div>
        <div><dt>β class</dt><dd>${magClass.toUpperCase()}</dd></div>
        <div><dt>jet_eff</dt><dd>${fmt(jetEff, 3)} <span class="dim">∝ a★² ṁ^0.4</span></dd></div>

        <div class="diag-title">Shadow (analytic)</div>
        <div><dt>b_c⁺</dt><dd>${fmt(diag.bCritProOverM, 2)} M</dd></div>
        <div><dt>b_c⁻</dt><dd>${fmt(diag.bCritRetOverM, 2)} M</dd></div>
        <div><dt>⌀_shad</dt><dd>${fmt(diag.shadowDiameter / m, 2)} M</dd></div>
        <div><dt>Δ_ext</dt><dd>${fmt(derived.extremalityDelta, 3)}</dd></div>
      `
  }
