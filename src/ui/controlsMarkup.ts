import { MAX_SPIN_STAR } from '../physics/constants'
import { DISK_LIMITS } from '../physics/diskParams'
import { CAMERA_LIMITS, radToDeg } from '../state/camera'
import { LOOK_LIMITS } from '../state/look'
import { ALL_PRESETS } from '../state/presets'
import { SKY_LIMITS } from '../state/sky'

/** Static controls panel markup (limits inlined). */
export function buildControlsHtml(): string {
  const distLim = CAMERA_LIMITS.distanceM
  const incDegMin = radToDeg(CAMERA_LIMITS.inclination.min)
  const incDegMax = radToDeg(CAMERA_LIMITS.inclination.max)
  const fovLim = CAMERA_LIMITS.fov

  return `
    <div class="ctrl-section">Presets</div>
    <div class="preset-grid" id="preset-grid">
      ${ALL_PRESETS.map(
        (p) =>
          `<button type="button" class="preset-btn" data-preset="${p.id}" title="${p.hint}">${p.label}</button>`,
      ).join('')}
    </div>
    <p class="ctrl-hint" id="preset-hint">One-click scene: physics + camera + look</p>

    <div class="ctrl-section">Black hole (no-hair)</div>
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
    <label class="ctrl">
      <span class="ctrl-name">Charge Q</span>
      <input type="range" id="p-charge" min="0" max="0.95" step="0.01" />
      <span class="ctrl-val" data-val="charge"></span>
    </label>
    <p class="ctrl-hint">Only M, a★, Q characterize the stationary BH (no-hair)</p>

    <div class="ctrl-section">Accretion disk (not hair)</div>
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
    <p class="ctrl-hint">ṁ → NT flux &amp; T∝ṁ¼ · ISCO from orbit sense · Doppler L/R flips with retrograde</p>

    <div class="ctrl-section">Camera</div>
    <label class="ctrl">
      <span class="ctrl-name">Scale-free</span>
      <input type="checkbox" id="c-scale-free" checked />
      <span class="ctrl-val" data-val="scaleFree"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name" id="c-dist-name">Distance / M</span>
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
    <p class="ctrl-hint" id="c-scale-hint">D = d·M · Mass cancels angular size · zoom with Distance / FOV</p>

    <div class="ctrl-section">Geodesics (global)</div>
    <label class="ctrl">
      <span class="ctrl-name">Integrator</span>
      <select id="g-integr" style="flex:1;min-width:0">
        <option value="rt">RT (Cartesian, default)</option>
        <option value="bl">BL (Boyer–Lindquist)</option>
      </select>
      <span class="ctrl-val" data-val="geodesic"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">I ∝ g³ ideal</span>
      <input type="checkbox" id="g-ideal-beam" />
      <span class="ctrl-val" data-val="idealBeam"></span>
    </label>
    <p class="ctrl-hint">RT = force approx · BL = Mino · default beam g² (display); ideal g³ = bolometric science</p>

    <div class="ctrl-section">Look</div>
    <label class="ctrl">
      <span class="ctrl-name">Bloom</span>
      <input type="checkbox" id="l-bloom-on" />
      <span class="ctrl-val" data-val="bloomOn"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Strength</span>
      <input type="range" id="l-bloom-str" min="${LOOK_LIMITS.bloomStrength.min}" max="${LOOK_LIMITS.bloomStrength.max}" step="0.01" />
      <span class="ctrl-val" data-val="bloomStr"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Radius</span>
      <input type="range" id="l-bloom-rad" min="${LOOK_LIMITS.bloomRadius.min}" max="${LOOK_LIMITS.bloomRadius.max}" step="0.01" />
      <span class="ctrl-val" data-val="bloomRad"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Threshold</span>
      <input type="range" id="l-bloom-thr" min="${LOOK_LIMITS.bloomThreshold.min}" max="${LOOK_LIMITS.bloomThreshold.max}" step="0.01" />
      <span class="ctrl-val" data-val="bloomThr"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Exposure</span>
      <input type="range" id="l-exposure" min="${LOOK_LIMITS.exposure.min}" max="${LOOK_LIMITS.exposure.max}" step="0.01" />
      <span class="ctrl-val" data-val="exposure"></span>
    </label>
    <p class="ctrl-hint">Unreal bloom on HDR · ACES tone map · not hair</p>

    <div class="ctrl-section">Deep space (global)</div>
    <label class="ctrl">
      <span class="ctrl-name">Stars</span>
      <input type="range" id="s-density" min="${SKY_LIMITS.starDensity.min}" max="${SKY_LIMITS.starDensity.max}" step="0.05" />
      <span class="ctrl-val" data-val="starDens"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Star bright</span>
      <input type="range" id="s-bright" min="${SKY_LIMITS.starBrightness.min}" max="${SKY_LIMITS.starBrightness.max}" step="0.05" />
      <span class="ctrl-val" data-val="starBright"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Nebula</span>
      <input type="range" id="s-nebula" min="${SKY_LIMITS.nebula.min}" max="${SKY_LIMITS.nebula.max}" step="0.05" />
      <span class="ctrl-val" data-val="nebula"></span>
    </label>
    <label class="ctrl">
      <span class="ctrl-name">Milky lane</span>
      <input type="range" id="s-milky" min="${SKY_LIMITS.milky.min}" max="${SKY_LIMITS.milky.max}" step="0.05" />
      <span class="ctrl-val" data-val="milky"></span>
    </label>
    <button type="button" class="preset-btn" id="s-reset" style="margin-top:6px;width:100%">Reset sky defaults</button>
    <p class="ctrl-hint">Same sky for every preset · not hair</p>
  `
}
