import { MAX_SPIN_STAR } from '../physics/constants'
import { DISK_LIMITS } from '../physics/diskParams'
import { CAMERA_LIMITS, radToDeg } from '../state/camera'
import { ALL_PRESETS } from '../state/presets'

/**
 * Controls = free base parameters + optional jets + expert disk EOS/mag.
 *
 * Black hole (no-hair): M, signed a★, Q
 * Disk (matter, not hair): ṁ, r_out/M, orbit sense, tilt
 * Jets (optional): jetPower
 * Expert: Γ, plasma β
 * Observer: distance, inclination, azimuth, FOV
 *
 * NOT free (derived or fixed): ISCO/rin, T(r), H/R (from ṁ+Γ), structure defaults,
 * I∝g³, integrator (RT), bloom/sky/look knobs
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
    <p class="ctrl-hint" id="preset-hint">Base-parameter scenes only</p>

    <div class="ctrl-section">Black hole (no-hair)</div>
    <label class="ctrl">
      <span class="ctrl-name">Mass M</span>
      <input type="range" id="p-mass" min="0.1" max="10" step="0.01" />
      <span class="ctrl-val" data-val="mass"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Spin a★</span>
      <input type="range" id="p-spin" min="${-MAX_SPIN_STAR}" max="${MAX_SPIN_STAR}" step="0.001" />
      <span class="ctrl-val" data-val="spin"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Charge Q</span>
      <input type="range" id="p-charge" min="0" max="0.95" step="0.01" />
      <span class="ctrl-val" data-val="charge"></span>
    </label>
    <p class="ctrl-hint">a★ ∈ [−0.998, +0.998] · default +0.9 · horizon / ISCO / photon sphere derived</p>

    <div class="ctrl-section">Accretion disk (matter)</div>
    <label class="ctrl">
      <span class="ctrl-name">ṁ / ṁ_Edd</span>
      <input type="range" id="d-mdot" min="0" max="1000" step="1" />
      <span class="ctrl-val" data-val="mdot"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">r_out / M</span>
      <input type="range" id="d-outer" min="${DISK_LIMITS.outerM.min}" max="${DISK_LIMITS.outerM.max}" step="1" />
      <span class="ctrl-val" data-val="outer"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Orbit</span>
      <select id="d-orbit" style="flex:1;min-width:0">
        <option value="pro">Prograde (co-rot)</option>
        <option value="ret">Retrograde (counter)</option>
      </select>
      <span class="ctrl-val" data-val="orbit"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Tilt °</span>
      <input type="range" id="d-tilt" min="0" max="${tiltDegMax.toFixed(0)}" step="0.5" />
      <span class="ctrl-val" data-val="tilt"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Tilt node °</span>
      <input type="range" id="d-tilt-node" min="0" max="360" step="1" />
      <span class="ctrl-val" data-val="tiltNode"></span>
    </label>
    <p class="ctrl-hint">ṁ sets NT power · r_in = ISCO · tilt vs spin (+Y) · H/R from ṁ+Γ</p>

    <div class="ctrl-section">Jets (optional)</div>
    <label class="ctrl">
      <span class="ctrl-name">Jet power</span>
      <input type="range" id="d-jet" min="0" max="1" step="0.01" />
      <span class="ctrl-val" data-val="jet"></span>
    </label>
    <p class="ctrl-hint">0 = off · strength ∝ a★² · ṁ^0.4 · weaker at low |a★|</p>

    <div class="ctrl-section">Observer</div>
    <label class="ctrl">
      <span class="ctrl-name">Distance / M</span>
      <input type="range" id="c-dist" min="${distLim.min}" max="${distLim.max}" step="0.5" />
      <span class="ctrl-val" data-val="dist"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Incl °</span>
      <input type="range" id="c-inc" min="${incDegMin.toFixed(0)}" max="${incDegMax.toFixed(0)}" step="0.5" />
      <span class="ctrl-val" data-val="inc"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Azim °</span>
      <input type="range" id="c-az" min="0" max="360" step="0.5" />
      <span class="ctrl-val" data-val="az"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">FOV</span>
      <input type="range" id="c-fov" min="${fovLim.min}" max="${fovLim.max}" step="0.01" />
      <span class="ctrl-val" data-val="fov"></span>
    </label>
    <p class="ctrl-hint">Scale-free D = d·M (fixed on) · drag on canvas to orbit</p>

    <details class="ctrl-expert">
      <summary class="ctrl-section" style="cursor:pointer">Expert disk (Γ / β)</summary>
      <label class="ctrl">
        <span class="ctrl-name">Γ (EOS)</span>
        <select id="d-gamma" style="flex:1;min-width:0">
          <option value="1.6667">5/3 (gas)</option>
          <option value="1.3333">4/3 (radiation)</option>
        </select>
        <span class="ctrl-val" data-val="gamma"></span>
      </label>
      <label class="ctrl">
        <span class="ctrl-name">Plasma β</span>
        <input type="range" id="d-beta" min="0" max="1000" step="1" />
        <span class="ctrl-val" data-val="beta"></span>
      </label>
      <p class="ctrl-hint">Γ → derived H/R · β → MRI dens variance (low β = stronger B) · log β slider</p>
    </details>

    <div class="ctrl-section">Numerics (not physics)</div>
    <label class="ctrl">
      <span class="ctrl-name">Quality</span>
      <select id="q-level" style="flex:1;min-width:0">
        <option value="low">Low (fast)</option>
        <option value="med" selected>Med</option>
        <option value="high">High (photon ring)</option>
      </select>
      <span class="ctrl-val" data-val="quality"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Density source</span>
      <select id="grmhd-src" style="flex:1;min-width:0">
        <option value="analytic" selected>Analytic</option>
        <option value="cube">GRMHD cube</option>
      </select>
      <span class="ctrl-val" data-val="grmhd"></span>
    </label>
    <p class="ctrl-hint">Analytic = sech² model · GRMHD cube = 3D dens (.bhcm R8) · toggle if image ok</p>
  `
}
