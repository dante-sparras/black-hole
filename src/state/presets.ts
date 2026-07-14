/**
 * Named scene presets: physics + look (not black-hole hair).
 * All presets share CAMERA_DEFAULTS — framing is independent of look mode.
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
  params: Partial<BlackHoleParams>
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

/** Default / reset baseline. */
export const PRESET_DEFAULT: ScenePreset = {
  id: 'default',
  label: 'Default',
  hint: 'Unit mass · moderate ṁ · subtle bloom',
  params: {
    mass: 1,
    spinStar: 0.7,
    charge: 0,
    mdot: 0.1,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: { ...LOOK_DEFAULTS },
}

/** Cinematic warm disk, high spin — glow stays mild so the hole reads. */
export const PRESET_INTERSTELLAR: ScenePreset = {
  id: 'interstellar',
  label: 'Interstellar',
  hint: 'Near-extremal · warm · subtle glow',
  params: {
    mass: 1,
    spinStar: 0.998,
    charge: 0,
    mdot: 0.08,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.32,
    bloomRadius: 0.45,
    bloomThreshold: 0.65,
    exposure: 0.9,
  },
}

/** Hot disk via ṁ / exposure — not by blowing out bloom. */
export const PRESET_HOT: ScenePreset = {
  id: 'hot',
  label: 'Hot',
  hint: 'High ṁ · hotter multi-color BB',
  params: {
    mass: 1,
    spinStar: 0.9,
    charge: 0,
    mdot: 0.6,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.32,
    bloomRadius: 0.4,
    bloomThreshold: 0.75,
    exposure: 1.0,
  },
}

/** Dim cool disk, low accretion. */
export const PRESET_COOL: ScenePreset = {
  id: 'cool',
  label: 'Cool',
  hint: 'Low ṁ · cooler multi-color BB',
  params: {
    mass: 1,
    spinStar: 0.4,
    charge: 0,
    mdot: 0.04,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.22,
    bloomRadius: 0.45,
    bloomThreshold: 0.6,
    exposure: 1.0,
  },
}

/** Schwarzschild classic silhouette. */
export const PRESET_SCHWARZSCHILD: ScenePreset = {
  id: 'schwarzschild',
  label: 'Schwarzschild',
  hint: 'a★=0 · Q=0 · classic shadow',
  params: {
    mass: 1,
    spinStar: 0,
    charge: 0,
    mdot: 0.12,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: { ...LOOK_SOFT },
}

/** Max spin Doppler asymmetry. */
export const PRESET_EXTREMAL: ScenePreset = {
  id: 'extremal',
  label: 'Extremal Kerr',
  hint: 'a★≈0.998 · Doppler asymmetry',
  params: {
    mass: 1,
    spinStar: 0.998,
    charge: 0,
    mdot: 0.15,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.3,
    exposure: 0.98,
  },
}

/** Reissner–Nordström charged (no spin). */
export const PRESET_RN: ScenePreset = {
  id: 'rn',
  label: 'RN charged',
  hint: 'High Q · a★=0 · RN family',
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
 * Apply physics + look; camera always resets to shared CAMERA_DEFAULTS.
 */
export function applyPreset(preset: ScenePreset | string): ScenePreset {
  const p = typeof preset === 'string' ? getPresetById(preset) : preset
  if (!p) {
    throw new Error(`Unknown preset: ${String(preset)}`)
  }
  setParams(p.params)
  setCamera({ ...CAMERA_DEFAULTS })
  setLook(p.look)
  return p
}

export function listPresetIds(): string[] {
  return ALL_PRESETS.map((p) => p.id)
}
