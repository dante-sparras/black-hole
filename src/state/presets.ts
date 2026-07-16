/**
 * Named scene presets: no-hair + disk + look (disk is not hair).
 * All presets share CAMERA_DEFAULTS.
 * Deep-space sky is GLOBAL (state/sky) — presets never touch it.
 *
 * Temperature ladder:
 *   Cool < Schwarzschild ≲ RN < Default < Interstellar < Extremal < Hot
 */
import type { DiskParams } from '../physics/diskParams'
import { DEFAULT_DISK } from '../physics/diskParams'
import type { BlackHoleParams } from '../physics/types'
import { withBatch } from './batch'
import {
  CAMERA_DEFAULTS,
  setCamera,
  type CameraState,
} from './camera'
import { setDisk } from './disk'
import { LOOK_DEFAULTS, setLook, type LookState } from './look'
import { setParams } from './params'

export type ScenePreset = {
  id: string
  label: string
  hint: string
  /** No-hair only */
  params: Pick<BlackHoleParams, 'mass' | 'spinStar' | 'charge'>
  /** Accretion disk (not hair) */
  disk: Partial<DiskParams> & Pick<DiskParams, 'mdot' | 'outerM'>
  camera: Partial<CameraState>
  look: Partial<LookState>
}

const LOOK_SOFT: LookState = {
  bloomEnabled: true,
  bloomStrength: 0.28,
  bloomRadius: 0.4,
  bloomThreshold: 0.7,
  exposure: 0.95,
}

const DISK_DEFAULT: Pick<DiskParams, 'mdot' | 'outerM'> = {
  mdot: DEFAULT_DISK.mdot,
  outerM: DEFAULT_DISK.outerM,
}

export const PRESET_DEFAULT: ScenePreset = {
  id: 'default',
  label: 'Default',
  hint: 'a★=0.7 · ṁ=0.1 · balanced Kerr',
  params: { mass: 1, spinStar: 0.7, charge: 0 },
  disk: { ...DISK_DEFAULT, mdot: 0.1 },
  camera: { ...CAMERA_DEFAULTS },
  look: { ...LOOK_DEFAULTS },
}

export const PRESET_INTERSTELLAR: ScenePreset = {
  id: 'interstellar',
  label: 'Interstellar',
  hint: 'a★≈0.998 · hot ISCO · soft glow',
  params: { mass: 1, spinStar: 0.998, charge: 0 },
  disk: { ...DISK_DEFAULT, mdot: 0.1 },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.3,
    bloomRadius: 0.42,
    bloomThreshold: 0.68,
    exposure: 0.95,
  },
}

export const PRESET_HOT: ScenePreset = {
  id: 'hot',
  label: 'Hot',
  hint: 'ṁ=1.5 · hottest multi-color BB',
  params: { mass: 1, spinStar: 0.92, charge: 0 },
  disk: { ...DISK_DEFAULT, mdot: 1.5 },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.3,
    bloomRadius: 0.38,
    bloomThreshold: 0.78,
    exposure: 0.92,
  },
}

export const PRESET_COOL: ScenePreset = {
  id: 'cool',
  label: 'Cool',
  hint: 'ṁ=0.02 · coolest multi-color BB',
  params: { mass: 1, spinStar: 0.25, charge: 0 },
  disk: { ...DISK_DEFAULT, mdot: 0.02 },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.2,
    bloomRadius: 0.42,
    bloomThreshold: 0.72,
    exposure: 1.05,
  },
}

export const PRESET_SCHWARZSCHILD: ScenePreset = {
  id: 'schwarzschild',
  label: 'Schwarzschild',
  hint: 'a★=0 · Q=0 · classic shadow',
  params: { mass: 1, spinStar: 0, charge: 0 },
  disk: { ...DISK_DEFAULT, mdot: 0.1 },
  camera: { ...CAMERA_DEFAULTS },
  look: { ...LOOK_SOFT },
}

export const PRESET_EXTREMAL: ScenePreset = {
  id: 'extremal',
  label: 'Extremal Kerr',
  hint: 'a★≈0.998 · max Doppler · hot',
  params: { mass: 1, spinStar: 0.998, charge: 0 },
  disk: { ...DISK_DEFAULT, mdot: 0.18 },
  camera: { ...CAMERA_DEFAULTS },
  look: {
    ...LOOK_SOFT,
    bloomStrength: 0.3,
    bloomThreshold: 0.72,
    exposure: 0.95,
  },
}

export const PRESET_RN: ScenePreset = {
  id: 'rn',
  label: 'RN charged',
  hint: 'Q=0.85 · a★=0 · RN family',
  params: { mass: 1, spinStar: 0, charge: 0.85 },
  disk: { ...DISK_DEFAULT, mdot: 0.1 },
  camera: { ...CAMERA_DEFAULTS },
  look: { ...LOOK_SOFT },
}

/** Pure Page–Thorne / smooth NT (no spiral texture) */
export const PRESET_NT_SMOOTH: ScenePreset = {
  id: 'nt-smooth',
  label: 'NT smooth',
  hint: 'structure=0 · pure Page–Thorne theory disk',
  params: { mass: 1, spinStar: 0.9, charge: 0 },
  disk: {
    ...DISK_DEFAULT,
    mdot: 0.15,
    structure: 0,
    arms: 0,
    clumps: 0,
    dust: 0,
  },
  camera: { ...CAMERA_DEFAULTS },
  look: { bloomEnabled: false, exposure: 0.95 },
}

export const ALL_PRESETS: readonly ScenePreset[] = [
  PRESET_DEFAULT,
  PRESET_INTERSTELLAR,
  PRESET_HOT,
  PRESET_COOL,
  PRESET_SCHWARZSCHILD,
  PRESET_EXTREMAL,
  PRESET_RN,
  PRESET_NT_SMOOTH,
] as const

export function getPresetById(id: string): ScenePreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id)
}

export function applyPreset(preset: ScenePreset | string): ScenePreset {
  const p = typeof preset === 'string' ? getPresetById(preset) : preset
  if (!p) {
    throw new Error(`Unknown preset: ${String(preset)}`)
  }
  withBatch(() => {
    setParams({
      mass: p.params.mass,
      spinStar: p.params.spinStar,
      charge: p.params.charge,
    })
    setDisk({
      mdot: p.disk.mdot,
      outerM: p.disk.outerM,
      ...(typeof p.disk.structure === 'number' ? { structure: p.disk.structure } : {}),
      ...(typeof p.disk.arms === 'number' ? { arms: p.disk.arms } : {}),
      ...(typeof p.disk.clumps === 'number' ? { clumps: p.disk.clumps } : {}),
      ...(typeof p.disk.dust === 'number' ? { dust: p.disk.dust } : {}),
    })
    setCamera({ ...CAMERA_DEFAULTS })
    setLook({
      bloomEnabled: p.look.bloomEnabled ?? LOOK_DEFAULTS.bloomEnabled,
      bloomStrength: p.look.bloomStrength ?? LOOK_DEFAULTS.bloomStrength,
      bloomRadius: p.look.bloomRadius ?? LOOK_DEFAULTS.bloomRadius,
      bloomThreshold: p.look.bloomThreshold ?? LOOK_DEFAULTS.bloomThreshold,
      exposure: p.look.exposure ?? LOOK_DEFAULTS.exposure,
    })
  })
  return p
}

export function listPresetIds(): string[] {
  return ALL_PRESETS.map((p) => p.id)
}
