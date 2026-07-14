/**
 * Named scene presets: physics + look (not black-hole hair).
 * All presets share CAMERA_DEFAULTS — framing is independent of look mode.
 *
 * Design rules (audited):
 * - Temperature ladder at fixed display physics:
 *     Cool < Schwarzschild ≲ RN < Default < Interstellar < Extremal < Hot
 * - Higher spin → smaller r_ISCO → hotter (not cooler).
 * - Higher ṁ → hotter (T ∝ ṁ^{1/4}).
 * - Bloom stays subtle so the shadow stays readable.
 * - Every preset sets full {mass, spinStar, charge, mdot} (no stale merges).
 */
import type { BlackHoleParams } from '../physics/types'
import {
  CAMERA_DEFAULTS,
  setCamera,
  type CameraState,
} from './camera'
import { LOOK_DEFAULTS, setLook, type LookState } from './look'
import { setParams } from './params'

export type ScenePreset = {
  id: string
  label: string
  /** Short HUD hint */
  hint: string
  /** Full physics snapshot (all no-hair + ṁ) */
  params: Pick<BlackHoleParams, 'mass' | 'spinStar' | 'charge' | 'mdot'>
  /** Always CAMERA_DEFAULTS — kept for type/API completeness */
  camera: Partial<CameraState>
  look: Partial<LookState>
}

/** Soft shared bloom base; presets only nudge slightly. */
const LOOK_SOFT: LookState = {
  bloomEnabled: true,
  bloomStrength: 0.28,
  bloomRadius: 0.4,
  bloomThreshold: 0.7,
  exposure: 0.95,
}

/** Default / reset baseline — moderate Kerr + default ṁ. */
export const PRESET_DEFAULT: ScenePreset = {
  id: 'default',
  label: 'Default',
  hint: 'a★=0.7 · ṁ=0.1 · balanced Kerr',
  params: {
    mass: 1,
    spinStar: 0.7,
    charge: 0,
    mdot: 0.1,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: { ...LOOK_DEFAULTS },
}

/**
 * Near-extremal Kerr showcase (Interstellar-class spin).
 * Hot from small ISCO; ṁ moderate so Hot/Extremal still rank hotter.
 */
export const PRESET_INTERSTELLAR: ScenePreset = {
  id: 'interstellar',
  label: 'Interstellar',
  hint: 'a★≈0.998 · hot ISCO · soft glow',
  params: {
    mass: 1,
    spinStar: 0.998,
    charge: 0,
    mdot: 0.1,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.3,
    bloomRadius: 0.42,
    bloomThreshold: 0.68,
    exposure: 0.95,
  },
}

/**
 * Hottest preset: high ṁ dominates color temperature.
 * Spin high enough for asymmetry, not max (that’s Extremal).
 */
export const PRESET_HOT: ScenePreset = {
  id: 'hot',
  label: 'Hot',
  hint: 'ṁ=1.5 · hottest multi-color BB',
  params: {
    mass: 1,
    spinStar: 0.92,
    charge: 0,
    mdot: 1.5,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.3,
    bloomRadius: 0.38,
    // Higher threshold — only the brightest core blooms (shadow stays black)
    bloomThreshold: 0.78,
    exposure: 0.92,
  },
}

/**
 * Coolest preset: low ṁ + modest spin.
 * Must stay below Schwarzschild in peak T (do not raise a★ without lowering ṁ).
 */
export const PRESET_COOL: ScenePreset = {
  id: 'cool',
  label: 'Cool',
  hint: 'ṁ=0.02 · coolest multi-color BB',
  params: {
    mass: 1,
    spinStar: 0.25,
    charge: 0,
    mdot: 0.02,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.2,
    bloomRadius: 0.42,
    // Higher threshold + less strength — dim red disk, not muddy bloom soup
    bloomThreshold: 0.72,
    exposure: 1.05,
  },
}

/** Schwarzschild classic silhouette (no spin, no charge). */
export const PRESET_SCHWARZSCHILD: ScenePreset = {
  id: 'schwarzschild',
  label: 'Schwarzschild',
  hint: 'a★=0 · Q=0 · classic shadow',
  params: {
    mass: 1,
    spinStar: 0,
    charge: 0,
    mdot: 0.1,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: { ...LOOK_SOFT },
}

/**
 * Max-spin Doppler asymmetry; slightly higher ṁ than Interstellar.
 * Still cooler peak than Hot (Hot wins via ṁ).
 */
export const PRESET_EXTREMAL: ScenePreset = {
  id: 'extremal',
  label: 'Extremal Kerr',
  hint: 'a★≈0.998 · max Doppler · hot',
  params: {
    mass: 1,
    spinStar: 0.998,
    charge: 0,
    mdot: 0.18,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.3,
    bloomThreshold: 0.72,
    exposure: 0.95,
  },
}

/**
 * Reissner–Nordström charged (no spin).
 * Slightly smaller r_ISCO than Schw → mildly hotter than Schw at same ṁ.
 */
export const PRESET_RN: ScenePreset = {
  id: 'rn',
  label: 'RN charged',
  hint: 'Q=0.85 · a★=0 · RN family',
  params: {
    mass: 1,
    spinStar: 0,
    charge: 0.85,
    mdot: 0.1,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: { ...LOOK_SOFT },
}

export const ALL_PRESETS: readonly ScenePreset[] = [
  PRESET_DEFAULT,
  PRESET_INTERSTELLAR,
  PRESET_HOT,
  PRESET_COOL,
  PRESET_SCHWARZSCHILD,
  PRESET_EXTREMAL,
  PRESET_RN,
] as const

export function getPresetById(id: string): ScenePreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id)
}

/**
 * Apply full physics snapshot + look; camera always resets to shared CAMERA_DEFAULTS.
 */
export function applyPreset(preset: ScenePreset | string): ScenePreset {
  const p = typeof preset === 'string' ? getPresetById(preset) : preset
  if (!p) {
    throw new Error(`Unknown preset: ${String(preset)}`)
  }
  // Full snapshot — avoid partial merge leaving stale charge/spin/mdot
  setParams({
    mass: p.params.mass,
    spinStar: p.params.spinStar,
    charge: p.params.charge,
    mdot: p.params.mdot,
  })
  setCamera({ ...CAMERA_DEFAULTS })
  setLook({
    bloomEnabled: p.look.bloomEnabled ?? LOOK_DEFAULTS.bloomEnabled,
    bloomStrength: p.look.bloomStrength ?? LOOK_DEFAULTS.bloomStrength,
    bloomRadius: p.look.bloomRadius ?? LOOK_DEFAULTS.bloomRadius,
    bloomThreshold: p.look.bloomThreshold ?? LOOK_DEFAULTS.bloomThreshold,
    exposure: p.look.exposure ?? LOOK_DEFAULTS.exposure,
  })
  return p
}

export function listPresetIds(): string[] {
  return ALL_PRESETS.map((p) => p.id)
}
