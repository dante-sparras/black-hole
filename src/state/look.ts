/**
 * Look / post-process settings (not black-hole hair).
 * Bloom is Unreal-style luminance threshold + multi-mip blur.
 */

export type LookState = {
  /** Master bloom toggle */
  bloomEnabled: boolean
  /** Bloom intensity (0 = off visually even if enabled) */
  bloomStrength: number
  /** Blur spread in [0, 1] */
  bloomRadius: number
  /** Luminance threshold (HDR); higher = only hottest pixels bloom */
  bloomThreshold: number
  /** Renderer tone-mapping exposure */
  exposure: number
}

export const LOOK_DEFAULTS: LookState = {
  bloomEnabled: true,
  bloomStrength: 0.75,
  bloomRadius: 0.55,
  bloomThreshold: 0.45,
  exposure: 1.0,
}

export const LOOK_LIMITS = {
  bloomStrength: { min: 0, max: 2.5 },
  bloomRadius: { min: 0, max: 1 },
  bloomThreshold: { min: 0, max: 2 },
  exposure: { min: 0.2, max: 3 },
} as const

type Listener = (look: LookState) => void

let look: LookState = { ...LOOK_DEFAULTS }
const listeners = new Set<Listener>()

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function getLook(): LookState {
  return look
}

export function setLook(partial: Partial<LookState>): LookState {
  const next: LookState = { ...look, ...partial }
  next.bloomStrength = clamp(
    next.bloomStrength,
    LOOK_LIMITS.bloomStrength.min,
    LOOK_LIMITS.bloomStrength.max,
  )
  next.bloomRadius = clamp(
    next.bloomRadius,
    LOOK_LIMITS.bloomRadius.min,
    LOOK_LIMITS.bloomRadius.max,
  )
  next.bloomThreshold = clamp(
    next.bloomThreshold,
    LOOK_LIMITS.bloomThreshold.min,
    LOOK_LIMITS.bloomThreshold.max,
  )
  next.exposure = clamp(
    next.exposure,
    LOOK_LIMITS.exposure.min,
    LOOK_LIMITS.exposure.max,
  )
  next.bloomEnabled = Boolean(next.bloomEnabled)
  look = next
  for (const fn of listeners) fn(look)
  return look
}

export function subscribeLook(listener: Listener): () => void {
  listeners.add(listener)
  listener(look)
  return () => {
    listeners.delete(listener)
  }
}
