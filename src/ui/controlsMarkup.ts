import { MAX_SPIN_STAR } from '../physics/constants'
import { DISK_LIMITS } from '../physics/diskParams'
import { CAMERA_LIMITS, radToDeg } from '../state/camera'
import { ALL_PRESETS } from '../state/presets'

function infoBtn(helpId: string, label: string): string {
  // No `title` attr — browser native tooltip stacks on top of our card.
  return `<button type="button" class="ctrl-info" data-help="${helpId}" aria-label="About ${label}" aria-expanded="false">🛈</button>`
}

/** Select / non-numeric value readout (quality, dens src). */
function selectRow(helpId: string, name: string, controlHtml: string, valAttr: string): string {
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
 * Slider + editable number. `num*` may differ from range (log-mapped ρ₀/β₀).
 */
function sliderRow(
  helpId: string,
  name: string,
  id: string,
  range: { min: number; max: number; step: number },
  valAttr: string,
  num: { min: number; max: number; step: number | string },
): string {
  return `
    <div class="ctrl">
      <span class="ctrl-label">
        <span class="ctrl-name">${name}</span>
        ${infoBtn(helpId, name)}
      </span>
      <input type="range" id="${id}" min="${range.min}" max="${range.max}" step="${range.step}" />
      <input
        type="number"
        class="ctrl-num"
        data-val="${valAttr}"
        min="${num.min}"
        max="${num.max}"
        step="${num.step}"
        inputmode="decimal"
        aria-label="${name} value"
      />
    </div>`
}

/**
 * Free controls only — no section blurb clutter.
 * Scale-free note once at top; details on 🛈 cards.
 */
export function buildControlsHtml(): string {
  const distLim = CAMERA_LIMITS.distanceM
  const incDegMin = radToDeg(CAMERA_LIMITS.inclination.min)
  const incDegMax = radToDeg(CAMERA_LIMITS.inclination.max)
  const fovLim = CAMERA_LIMITS.fov
  const tiltDegMax = radToDeg(DISK_LIMITS.tiltRad.max)
  const h = DISK_LIMITS.scaleHeight
  const g = DISK_LIMITS.gamma
  const rin = DISK_LIMITS.rinOverM
  const rho = DISK_LIMITS.rho0
  const beta = DISK_LIMITS.plasmaBeta
  const outer = DISK_LIMITS.outerM

  return `
    <p class="ctrl-hint controls-lede">Scale-free · D = d·M · M = 1 locked</p>

    <div class="ctrl-section">Presets</div>
    <div class="preset-grid" id="preset-grid">
      ${ALL_PRESETS.map(
        (p) =>
          `<button type="button" class="preset-btn" data-preset="${p.id}" title="${p.hint}">${p.label}</button>`,
      ).join('')}
    </div>
    <div class="export-row">
      <button type="button" id="btn-screenshot" class="preset-btn export-btn" title="Download a PNG of the current view at full canvas resolution (includes DPR)">
        Screenshot PNG
      </button>
      <span class="ctrl-hint" id="screenshot-status" aria-live="polite"></span>
    </div>

    <div class="ctrl-section">Black hole</div>
    ${sliderRow(
      'spin',
      'Spin a★',
      'p-spin',
      { min: -MAX_SPIN_STAR, max: MAX_SPIN_STAR, step: 0.001 },
      'spin',
      { min: -MAX_SPIN_STAR, max: MAX_SPIN_STAR, step: 0.001 },
    )}
    ${sliderRow(
      'charge',
      'Charge Q',
      'p-charge',
      { min: 0, max: 0.95, step: 0.01 },
      'charge',
      { min: 0, max: 0.95, step: 0.01 },
    )}

    <div class="ctrl-section">Accretion disk</div>
    ${sliderRow(
      'rho0',
      'ρ₀ dens',
      'd-rho0',
      { min: 0, max: 1000, step: 1 },
      'rho0',
      { min: rho.min, max: rho.max, step: 'any' },
    )}
    ${sliderRow(
      'scaleH',
      'H/r',
      'd-hr',
      { min: h.min, max: h.max, step: 0.002 },
      'hr',
      { min: h.min, max: h.max, step: 0.002 },
    )}
    ${sliderRow(
      'gamma',
      'Γ EOS',
      'd-gamma',
      { min: g.min, max: g.max, step: 0.01 },
      'gamma',
      { min: g.min, max: g.max, step: 0.01 },
    )}
    ${sliderRow(
      'beta',
      'β₀ plasma',
      'd-beta',
      { min: 0, max: 1000, step: 1 },
      'beta',
      { min: beta.min, max: beta.max, step: 'any' },
    )}
    ${sliderRow(
      'rin',
      'r_in / M',
      'd-rin',
      { min: rin.min, max: rin.max, step: 0.1 },
      'rin',
      { min: rin.min, max: rin.max, step: 0.1 },
    )}
    ${sliderRow(
      'outer',
      'r_out / M',
      'd-outer',
      { min: outer.min, max: outer.max, step: 1 },
      'outer',
      { min: outer.min, max: outer.max, step: 1 },
    )}
    ${sliderRow(
      'tilt',
      'Tilt °',
      'd-tilt',
      { min: 0, max: Number(tiltDegMax.toFixed(0)), step: 0.5 },
      'tilt',
      { min: 0, max: Number(tiltDegMax.toFixed(0)), step: 0.5 },
    )}
    ${sliderRow(
      'jet',
      'Jet strength',
      'd-jet',
      { min: 0, max: 1, step: 0.01 },
      'jet',
      { min: 0, max: 1, step: 0.01 },
    )}

    <div class="ctrl-section">Observer</div>
    ${sliderRow(
      'dist',
      'Distance / M',
      'c-dist',
      { min: distLim.min, max: distLim.max, step: 0.5 },
      'dist',
      { min: distLim.min, max: distLim.max, step: 0.5 },
    )}
    ${sliderRow(
      'inc',
      'Incl °',
      'c-inc',
      { min: Number(incDegMin.toFixed(0)), max: Number(incDegMax.toFixed(0)), step: 0.5 },
      'inc',
      { min: Number(incDegMin.toFixed(0)), max: Number(incDegMax.toFixed(0)), step: 0.5 },
    )}
    ${sliderRow(
      'azim',
      'Azim °',
      'c-az',
      { min: 0, max: 360, step: 0.5 },
      'azim',
      { min: 0, max: 360, step: 0.5 },
    )}
    ${sliderRow(
      'fov',
      'FOV',
      'c-fov',
      { min: fovLim.min, max: fovLim.max, step: 0.01 },
      'fov',
      { min: fovLim.min, max: fovLim.max, step: 0.01 },
    )}

    <div class="ctrl-section">Numerics</div>
    ${selectRow(
      'quality',
      'Quality',
      `<select id="q-level" class="ctrl-select">
        <option value="low">Low (fast)</option>
        <option value="med" selected>Med</option>
        <option value="high">High (photon ring)</option>
      </select>`,
      'quality',
    )}
    ${selectRow(
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
