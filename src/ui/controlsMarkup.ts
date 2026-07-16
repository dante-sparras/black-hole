import { MAX_SPIN_STAR } from '../physics/constants'
import { DISK_LIMITS } from '../physics/diskParams'
import { CAMERA_LIMITS, radToDeg } from '../state/camera'
import { ALL_PRESETS } from '../state/presets'

/**
 * All free base physics in main panels — no expert submenu.
 * Disk torus / GRMHD-init style params live under one Accretion disk section.
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
    <p class="ctrl-hint" id="preset-hint">Base-parameter scenes</p>

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
    <p class="ctrl-hint">a★ ∈ [−0.998, +0.998] · default +0.9</p>

    <div class="ctrl-section">Accretion disk (base)</div>
    <label class="ctrl">
      <span class="ctrl-name">ṁ / ṁ_Edd</span>
      <input type="range" id="d-mdot" min="0" max="1000" step="1" />
      <span class="ctrl-val" data-val="mdot"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">ρ₀ dens</span>
      <input type="range" id="d-rho0" min="0" max="1000" step="1" />
      <span class="ctrl-val" data-val="rho0"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">H/r</span>
      <input type="range" id="d-hr" min="${DISK_LIMITS.scaleHeight.min}" max="${DISK_LIMITS.scaleHeight.max}" step="0.005" />
      <span class="ctrl-val" data-val="hr"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Γ (EOS)</span>
      <select id="d-gamma" style="flex:1;min-width:0">
        <option value="1.6667">5/3 gas</option>
        <option value="1.3333">4/3 radiation</option>
      </select>
      <span class="ctrl-val" data-val="gamma"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">K (poly)</span>
      <input type="range" id="d-polyk" min="0" max="1000" step="1" />
      <span class="ctrl-val" data-val="polyk"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">ℓ̃ (ang mom)</span>
      <input type="range" id="d-ell" min="${DISK_LIMITS.specificL.min}" max="${DISK_LIMITS.specificL.max}" step="0.05" />
      <span class="ctrl-val" data-val="ell"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">β₀ plasma</span>
      <input type="range" id="d-beta" min="0" max="1000" step="1" />
      <span class="ctrl-val" data-val="beta"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">B geometry</span>
      <select id="d-maggeom" style="flex:1;min-width:0">
        <option value="single-loop">Single loop</option>
        <option value="multi-loop">Multi loop</option>
        <option value="vertical">Vertical</option>
      </select>
      <span class="ctrl-val" data-val="maggeom"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Magnetization</span>
      <select id="d-mad" style="flex:1;min-width:0">
        <option value="sane">SANE</option>
        <option value="mad">MAD</option>
      </select>
      <span class="ctrl-val" data-val="mad"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">r_in mode</span>
      <select id="d-rinmode" style="flex:1;min-width:0">
        <option value="isco">ISCO (derived)</option>
        <option value="free">Free r_in</option>
      </select>
      <span class="ctrl-val" data-val="rinmode"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">r_in / M</span>
      <input type="range" id="d-rin" min="${DISK_LIMITS.rinM.min}" max="${DISK_LIMITS.rinM.max}" step="0.1" />
      <span class="ctrl-val" data-val="rin"></span>
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
    <label class="ctrl">
      <span class="ctrl-name">Perturb</span>
      <input type="range" id="d-perturb" min="0" max="1" step="0.01" />
      <span class="ctrl-val" data-val="perturb"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Jet power</span>
      <input type="range" id="d-jet" min="0" max="1" step="0.01" />
      <span class="ctrl-val" data-val="jet"></span>
    </label>
    <p class="ctrl-hint">Torus-style base: ρ₀ · H/r · Γ · K · ℓ · β₀ · B · r_in · tilt · jets · MAD/SANE</p>

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
    <p class="ctrl-hint">Scale-free D = d·M · drag canvas to orbit</p>

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
  `
}
