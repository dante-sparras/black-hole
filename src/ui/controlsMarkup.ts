import { MAX_SPIN_STAR } from '../physics/constants'
import { DISK_LIMITS } from '../physics/diskParams'
import { CAMERA_LIMITS, radToDeg } from '../state/camera'
import { ALL_PRESETS } from '../state/presets'

function infoBtn(helpId: string, label: string): string {
  return `<button type="button" class="ctrl-info" data-help="${helpId}" aria-label="About ${label}" aria-expanded="false" title="About ${label}">🛈</button>`
}

function ctrlRow(
  helpId: string,
  name: string,
  controlHtml: string,
  valAttr: string,
): string {
  return `
    <div class="ctrl">
      <span class="ctrl-label">
        <span class="ctrl-name">${name}</span>
        ${infoBtn(helpId, name)}
      </span>
      ${controlHtml}
      <span class="ctrl-val" data-val="${valAttr}"></span>
    </div>`
}

/**
 * Free UI bases only (ṁ is derived / scenario — HUD + presets, not a slider).
 * Derived HUD: ṁ, r_in=ISCO, H/r, Γ, ℓ̃, SANE/MAD, jet_eff, …
 */
export function buildControlsHtml(): string {
  const distLim = CAMERA_LIMITS.distanceM
  const incDegMin = radToDeg(CAMERA_LIMITS.inclination.min)
  const incDegMax = radToDeg(CAMERA_LIMITS.inclination.max)
  const fovLim = CAMERA_LIMITS.fov
  const tiltDegMax = radToDeg(DISK_LIMITS.tiltRad.max)

  return `
    <div class="ctrl-section">Presets</div>
    <div class="preset-grid" id="preset-grid">
      ${ALL_PRESETS.map(
        (p) =>
          `<button type="button" class="preset-btn" data-preset="${p.id}" title="${p.hint}">${p.label}</button>`,
      ).join('')}
    </div>
    <p class="ctrl-hint" id="preset-hint">Free bases + presets · ṁ is derived (HUD) · 🛈 for details</p>

    <div class="ctrl-section">Black hole (no-hair)</div>
    ${ctrlRow(
      'mass',
      'Mass M',
      `<input type="range" id="p-mass" min="0.1" max="10" step="0.01" />`,
      'mass',
    )}
    ${ctrlRow(
      'spin',
      'Spin a★',
      `<input type="range" id="p-spin" min="${-MAX_SPIN_STAR}" max="${MAX_SPIN_STAR}" step="0.001" />`,
      'spin',
    )}
    ${ctrlRow(
      'charge',
      'Charge Q',
      `<input type="range" id="p-charge" min="0" max="0.95" step="0.01" />`,
      'charge',
    )}
    <p class="ctrl-hint">a★ ∈ [−0.998, +0.998] · default +0.9</p>

    <div class="ctrl-section">Accretion disk (free bases)</div>
    ${ctrlRow(
      'rho0',
      'ρ₀ dens',
      `<input type="range" id="d-rho0" min="0" max="1000" step="1" />`,
      'rho0',
    )}
    ${ctrlRow(
      'beta',
      'β₀ plasma',
      `<input type="range" id="d-beta" min="0" max="1000" step="1" />`,
      'beta',
    )}
    ${ctrlRow(
      'outer',
      'r_out / M',
      `<input type="range" id="d-outer" min="${DISK_LIMITS.outerM.min}" max="${DISK_LIMITS.outerM.max}" step="1" />`,
      'outer',
    )}
    ${ctrlRow(
      'tilt',
      'Tilt °',
      `<input type="range" id="d-tilt" min="0" max="${tiltDegMax.toFixed(0)}" step="0.5" />`,
      'tilt',
    )}
    ${ctrlRow(
      'jet',
      'Jet boost',
      `<input type="range" id="d-jet" min="0" max="1" step="0.01" />`,
      'jet',
    )}
    <p class="ctrl-hint">Free: ρ₀ · β₀ · r_out · tilt · jet · ṁ derived (presets / scenario, see HUD)</p>

    <div class="ctrl-section">Observer</div>
    ${ctrlRow(
      'dist',
      'Distance / M',
      `<input type="range" id="c-dist" min="${distLim.min}" max="${distLim.max}" step="0.5" />`,
      'dist',
    )}
    ${ctrlRow(
      'inc',
      'Incl °',
      `<input type="range" id="c-inc" min="${incDegMin.toFixed(0)}" max="${incDegMax.toFixed(0)}" step="0.5" />`,
      'inc',
    )}
    ${ctrlRow(
      'azim',
      'Azim °',
      `<input type="range" id="c-az" min="0" max="360" step="0.5" />`,
      'azim',
    )}
    ${ctrlRow(
      'fov',
      'FOV',
      `<input type="range" id="c-fov" min="${fovLim.min}" max="${fovLim.max}" step="0.01" />`,
      'fov',
    )}
    <p class="ctrl-hint">Scale-free D = d·M · drag canvas to orbit</p>

    <div class="ctrl-section">Numerics (not physics)</div>
    ${ctrlRow(
      'quality',
      'Quality',
      `<select id="q-level" class="ctrl-select">
        <option value="low">Low (fast)</option>
        <option value="med" selected>Med</option>
        <option value="high">High (photon ring)</option>
      </select>`,
      'quality',
    )}
    ${ctrlRow(
      'grmhd',
      'Density src',
      `<select id="grmhd-src" class="ctrl-select">
        <option value="analytic" selected>Analytic</option>
        <option value="cube">GRMHD cube</option>
      </select>`,
      'grmhd',
    )}
  `
}
