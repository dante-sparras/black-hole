/**
 * Deep-space backdrop controls (not black-hole hair, not per-preset).
 * Shared globally so every preset sees the same sky unless the user changes it.
 */
import { clamp } from '../physics/math'
import { emitStore } from './batch'

export type SkyState = {
  /** Multiplier for star spawn density (0 = none, ~1.2 default, 2 = dense) */
  starDensity: number
  /** Star brightness multiplier */
  starBrightness: number
  /** Soft dust / nebula amount */
  nebula: number
  /** Milky-lane haze amount */
  milky: number
}

export const SKY_DEFAULTS: SkyState = {
  /** Dense field like space.jpg */
  starDensity: 2.4,
  starBrightness: 1.55,
  /** Cool void dust + magenta patches */
  nebula: 0.85,
  /** Warm core + dust lanes */
  milky: 1.15,
}

export const SKY_LIMITS = {
  starDensity: { min: 0, max: 6 },
  starBrightness: { min: 0, max: 6 },
  nebula: { min: 0, max: 5 },
  milky: { min: 0, max: 5 },
} as const

type Listener = (sky: SkyState) => void

let sky: SkyState = { ...SKY_DEFAULTS }
const listeners = new Set<Listener>()

export function getSky(): SkyState {
  return sky
}

export function setSky(partial: Partial<SkyState>): SkyState {
  const next: SkyState = { ...sky, ...partial }
  next.starDensity = clamp(
    next.starDensity,
    SKY_LIMITS.starDensity.min,
    SKY_LIMITS.starDensity.max,
  )
  next.starBrightness = clamp(
    next.starBrightness,
    SKY_LIMITS.starBrightness.min,
    SKY_LIMITS.starBrightness.max,
  )
  next.nebula = clamp(next.nebula, SKY_LIMITS.nebula.min, SKY_LIMITS.nebula.max)
  next.milky = clamp(next.milky, SKY_LIMITS.milky.min, SKY_LIMITS.milky.max)
  sky = next
  emitStore('sky', () => {
    for (const fn of listeners) fn(sky)
  })
  return sky
}

/** Reset to global defaults (same for all presets). */
export function resetSky(): SkyState {
  sky = { ...SKY_DEFAULTS }
  emitStore('sky', () => {
    for (const fn of listeners) fn(sky)
  })
  return sky
}

export function subscribeSky(listener: Listener): () => void {
  listeners.add(listener)
  listener(sky)
  return () => {
    listeners.delete(listener)
  }
}
