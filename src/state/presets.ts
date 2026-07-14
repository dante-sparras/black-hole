/**
 * Named scene presets: physics + camera + look (not black-hole hair).
 * Pure data + apply helper; stores do clamping/normalization.
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
  camera: Partial<CameraState>
  look: Partial<LookState>
}

/** Default / reset baseline. */
export const PRESET_DEFAULT: ScenePreset = {
  id: 'default',
  label: 'Default',
  hint: 'Unit mass · moderate ṁ · soft bloom',
  params: {
    mass: 1,
    spinStar: 0.7,
    charge: 0,
    mdot: 0.1,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: { ...LOOK_DEFAULTS },
}

/** Cinematic warm disk, high spin, Interstellar-ish grade. */
export const PRESET_INTERSTELLAR: ScenePreset = {
  id: 'interstellar',
  label: 'Interstellar',
  hint: 'Near-extremal · warm · soft glow',
  params: {
    mass: 1,
    spinStar: 0.998,
    charge: 0,
    mdot: 0.08,
  },
  camera: {
    distanceM: 28,
    inclination: 1.35, // ~77°
    azimuth: 0.35,
    fov: 0.62,
  },
  look: {
    bloomEnabled: true,
    bloomStrength: 0.85,
    bloomRadius: 0.62,
    bloomThreshold: 0.38,
    exposure: 0.92,
  },
}

/** Hot, bright, blue-white accretion. */
export const PRESET_HOT: ScenePreset = {
  id: 'hot',
  label: 'Hot',
  hint: 'High ṁ · bright bloom · blue-white',
  params: {
    mass: 1,
    spinStar: 0.9,
    charge: 0,
    mdot: 0.8,
  },
  camera: {
    distanceM: 32,
    inclination: 1.15,
    azimuth: 0.2,
    fov: 0.68,
  },
  look: {
    bloomEnabled: true,
    bloomStrength: 1.35,
    bloomRadius: 0.5,
    bloomThreshold: 0.55,
    exposure: 1.25,
  },
}

/** Dim cool disk, low accretion. */
export const PRESET_COOL: ScenePreset = {
  id: 'cool',
  label: 'Cool',
  hint: 'Low ṁ · muted · soft',
  params: {
    mass: 1,
    spinStar: 0.5,
    charge: 0,
    mdot: 0.015,
  },
  camera: {
    distanceM: 36,
    inclination: 1.2,
    azimuth: 0,
    fov: 0.65,
  },
  look: {
    bloomEnabled: true,
    bloomStrength: 0.45,
    bloomRadius: 0.7,
    bloomThreshold: 0.25,
    exposure: 0.7,
  },
}

/** Face-on Schwarzschild classic silhouette. */
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
  camera: {
    distanceM: 30,
    inclination: 1.05,
    azimuth: 0,
    fov: 0.65,
  },
  look: {
    bloomEnabled: true,
    bloomStrength: 0.7,
    bloomRadius: 0.55,
    bloomThreshold: 0.42,
    exposure: 1.0,
  },
}

/** Max spin Doppler asymmetry showcase. */
export const PRESET_EXTREMAL: ScenePreset = {
  id: 'extremal',
  label: 'Extremal Kerr',
  hint: 'a★≈0.998 · edge-on Doppler',
  params: {
    mass: 1,
    spinStar: 0.998,
    charge: 0,
    mdot: 0.15,
  },
  camera: {
    distanceM: 26,
    inclination: 1.45, // nearly edge-on
    azimuth: 0.5,
    fov: 0.7,
  },
  look: {
    bloomEnabled: true,
    bloomStrength: 0.95,
    bloomRadius: 0.48,
    bloomThreshold: 0.4,
    exposure: 1.05,
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
  camera: {
    distanceM: 30,
    inclination: 1.2,
    azimuth: 0,
    fov: 0.65,
  },
  look: {
    bloomEnabled: true,
    bloomStrength: 0.75,
    bloomRadius: 0.55,
    bloomThreshold: 0.45,
    exposure: 1.0,
  },
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
 * Apply a preset to all three stores.
 * Returns the applied preset (for tests / UI label).
 */
export function applyPreset(preset: ScenePreset | string): ScenePreset {
  const p =
    typeof preset === 'string' ? getPresetById(preset) : preset
  if (!p) {
    throw new Error(`Unknown preset: ${String(preset)}`)
  }
  setParams(p.params)
  setCamera(p.camera)
  setLook(p.look)
  return p
}

export function listPresetIds(): string[] {
  return ALL_PRESETS.map((p) => p.id)
}
